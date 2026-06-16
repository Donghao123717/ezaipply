import os
import pickle
from typing import List, Dict, Any

import numpy as np
import faiss
from google import genai

EMBED_MODEL = "gemini-embedding-001"


class LocalRAGStore:
    def __init__(self, store_dir: str = "/Users/yiweili/Documents/EZcommonapp/rag_store"):
        self.store_dir = store_dir
        self.index = faiss.read_index(os.path.join(store_dir, "faiss.index"))
        with open(os.path.join(store_dir, "items.pkl"), "rb") as f:
            self.items = pickle.load(f)

        self.client = genai.Client()

    def _embed_query(self, query: str) -> np.ndarray:
        res = self.client.models.embed_content(
            model=EMBED_MODEL,
            contents=query
        )
        v = np.array(res.embeddings[0].values, dtype=np.float32)[None, :]
        faiss.normalize_L2(v)
        return v

    def search(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        qv = self._embed_query(query)
        scores, idxs = self.index.search(qv, k)

        out = []
        for score, idx in zip(scores[0], idxs[0]):
            if idx < 0:
                continue
            it = self.items[idx]  # 现在 it 是 dict
            out.append(
                {
                    "score": float(score),
                    "question": it["question"],
                    "answer": it["answer"],
                    "label": it.get("label", "General"),
                    "source_file": it.get("source_file", ""),
                    "source_name": it.get("source_name", "unknown_source"),
                }
            )
        return out
