import os
import json
import glob
import pickle
import time
from dataclasses import dataclass
from typing import List

import numpy as np
import faiss

from google import genai


# -----------------------
# Config
# -----------------------
JSONL_ROOT = "/Users/yiweili/Documents/EZcommonapp/json_qa_university"  # 你的jsonl目录（递归读）
OUT_DIR = "./rag_store"
EMBED_MODEL = "gemini-embedding-001"

# embedding batch size：推荐 64~256
BATCH_SIZE = 64

# 每 N 条打印一次（除了每个 batch 也会打印）
PRINT_EVERY = 500


# -----------------------
# Data structure
# -----------------------
@dataclass
class QAItem:
    question: str
    answer: str
    label: str
    source_file: str
    source_name: str


# -----------------------
# Load JSONL
# -----------------------
def load_all_jsonl_simple(root: str) -> List[QAItem]:
    """
    读取 root 下所有 .jsonl 文件，每行格式为：
    {"Question": "...", "Answer": "...", "Label": "..."}
    """
    items: List[QAItem] = []
    paths = glob.glob(os.path.join(root, "**/*.jsonl"), recursive=True)

    if not paths:
        print(f"[WARN] No .jsonl found under: {root}")
        return items

    for p in sorted(paths):
        rel = os.path.relpath(p, root)
        source_name = os.path.splitext(os.path.basename(p))[0]  # 用文件名当 source_name

        try:
            with open(p, "r", encoding="utf-8") as f:
                for line_no, line in enumerate(f, start=1):
                    line = line.strip()
                    if not line:
                        continue

                    try:
                        obj = json.loads(line)
                    except Exception:
                        print(f"[SKIP] Bad JSON at {rel}:{line_no}")
                        continue

                    q = (obj.get("Question") or obj.get("question") or "").strip()
                    a = (obj.get("Answer") or obj.get("answer") or "").strip()
                    label = (obj.get("Label") or obj.get("label") or "General").strip()

                    if not q or not a:
                        continue

                    items.append(
                        QAItem(
                            question=q,
                            answer=a,
                            label=label,
                            source_file=rel,
                            source_name=source_name,
                        )
                    )
        except Exception as e:
            print(f"[WARN] Skip {p}: {e}")

    print(f"[INFO] Loaded JSONL QA items: {len(items)}")
    return items


# -----------------------
# Embedding (batched)
# -----------------------
def _safe_embed_batch(client: genai.Client, batch_texts: List[str], max_retry: int = 6):
    """
    对单个 batch 调用 embed API，带指数退避重试。
    """
    for attempt in range(max_retry):
        try:
            res = client.models.embed_content(
                model=EMBED_MODEL,
                contents=batch_texts
            )
            return res
        except Exception as e:
            wait = min(60, 2 ** attempt)
            print(f"[RETRY] embed batch failed (attempt={attempt+1}/{max_retry}): {e}")
            print(f"        sleep {wait}s then retry...")
            time.sleep(wait)

    raise RuntimeError("Embedding failed too many times. Please check API quota / network.")


def embed_texts_batch(
    texts: List[str],
    client: genai.Client,
    batch_size: int = 128,
    print_every: int = 500
) -> np.ndarray:
    """
    texts -> (N, D) float32 embeddings
    每个 batch 打印进度，并且额外每 print_every 条也打印一次。
    """
    n = len(texts)
    vecs: List[np.ndarray] = []

    start_time = time.time()

    for start in range(0, n, batch_size):
        end = min(start + batch_size, n)
        batch = texts[start:end]

        # --- call embedding API (batch) ---
        res = _safe_embed_batch(client, batch)

        # res.embeddings 是 list，对应 batch 每条
        for emb in res.embeddings:
            v = np.array(emb.values, dtype=np.float32)
            vecs.append(v)

        # --- progress prints ---
        done = end
        elapsed = time.time() - start_time

        print(f"[EMB] embedded {done}/{n}  | batch [{start}:{end}]  | elapsed {elapsed:.1f}s")

        # 额外每 print_every 条打印一次（更明显）
        if (done % print_every) == 0 or done == n:
            print(f"      ✅ Progress checkpoint: {done}/{n} items embedded")

    mat = np.stack(vecs, axis=0)
    faiss.normalize_L2(mat)  # cosine similarity -> inner product
    return mat


# -----------------------
# Main build
# -----------------------
def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError(
            "No API key found. Please export GEMINI_API_KEY or GOOGLE_API_KEY first.\n"
            "Example:\n"
            "  export GEMINI_API_KEY='YOUR_KEY'\n"
        )

    client = genai.Client(api_key=api_key)

    # 1) load
    items = load_all_jsonl_simple(JSONL_ROOT)
    if len(items) == 0:
        raise RuntimeError(f"No QA loaded. Check your JSONL_ROOT={JSONL_ROOT}")

    # 2) build embedding corpus
    # 这里把 Q/A/Label 拼一起更利于检索
    corpus_texts = [
        f"Question: {it.question}\nAnswer: {it.answer}\nLabel: {it.label}"
        for it in items
    ]

    print(f"[INFO] Start embedding {len(corpus_texts)} items...")
    emb = embed_texts_batch(
        corpus_texts,
        client,
        batch_size=BATCH_SIZE,
        print_every=PRINT_EVERY
    )

    dim = emb.shape[1]
    print(f"[INFO] Embedding dim = {dim}")
    print(f"[INFO] FAISS adding vectors: {emb.shape}")

    # 3) build faiss index (cosine sim)
    index = faiss.IndexFlatIP(dim)
    index.add(emb)

    # 4) save
    faiss_index_path = os.path.join(OUT_DIR, "faiss.index")
    items_path = os.path.join(OUT_DIR, "items.pkl")

    faiss.write_index(index, faiss_index_path)
    with open(items_path, "wb") as f:
        pickle.dump([it.__dict__ for it in items], f)

    print("[OK] RAG index built successfully!")
    print(f"     FAISS index: {faiss_index_path}")
    print(f"     Items meta : {items_path}")


if __name__ == "__main__":
    main()
