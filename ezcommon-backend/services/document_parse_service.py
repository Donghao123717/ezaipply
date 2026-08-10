"""
Document Parse Service

Orchestrates downloading user-uploaded documents from S3, extracting their
text (PDF via PyPDF2, images via vision LLM, plain text directly), reorganizing
the extracted text into semantic blocks via SemanticChunkFormer, and storing
those blocks in the configured search provider (e.g. ChromaDB).

This mirrors the constructor/injection pattern used by FormFillService.
"""
import base64
import json
import os
import re
import tempfile
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import PyPDF2

from aws_config import get_s3_client, AWS_REGION
from services.semantic_chunk_former import SemanticChunkFormer

S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME", "aipply-user-uploads")

# File extensions handled by each processing path
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff"}
TEXT_EXTENSIONS = {".txt", ".md", ".doc", ".docx", ".csv"}

# Naive fallback chunking parameters
_CHUNK_TARGET_SIZE = 1500
_CHUNK_MAX_SIZE = 2000


class DocumentParseService:
    """Service for downloading, parsing, and semantically chunking user documents."""

    def __init__(self, search_provider=None, llm_provider=None):
        """
        Initialize the document parse service

        Args:
            search_provider: Search provider instance (ChromaDB, OpenSearch, ...) used
                for persisting extracted chunks
            llm_provider: LLM provider instance used for vision extraction and
                semantic chunk formation
        """
        self.search_provider = search_provider
        self.llm_provider = llm_provider

        # Defensively initialize the search provider. auth_api.py constructs the
        # search provider but never calls .initialize() on it before handing it
        # to this service, so we must do it here ourselves. workflow/parse_documents.py
        # DOES call .initialize() itself before passing it in, so this needs to be
        # safe/idempotent either way.
        if self.search_provider is not None:
            try:
                self.search_provider.initialize()
                print("✓ Search provider initialized by DocumentParseService")
            except Exception as e:
                print(f"⚠ Search provider initialization failed (continuing): {e}")

    # ------------------------------------------------------------------
    # File listing
    # ------------------------------------------------------------------

    def list_user_files(self, user_id: str, section: Optional[str] = None) -> List[dict]:
        """
        List all files a user has uploaded to S3.

        Args:
            user_id: User ID
            section: Optional section filter (education, activity, testing, profile)

        Returns:
            List of dicts shaped like FileInfo: key, filename, section, file_type,
            size, last_modified, url
        """
        from s3_service import get_s3_service

        s3_service = get_s3_service()
        raw_files = s3_service.list_user_files(user_id, section)

        files: List[dict] = []
        for f in raw_files:
            files.append({
                "key": f.get("s3_key", ""),
                "filename": f.get("filename", ""),
                "section": f.get("section", "") or "",
                "file_type": f.get("file_type", "") or "",
                "size": f.get("size", 0) or 0,
                "last_modified": f.get("last_modified") or f.get("uploaded_at") or "",
                "url": f.get("url", "") or "",
            })

        return files

    # ------------------------------------------------------------------
    # Extraction helpers
    # ------------------------------------------------------------------

    def process_pdf(self, path: str) -> str:
        """
        Extract plain text from a local PDF file using PyPDF2

        Args:
            path: Local filesystem path to the PDF file

        Returns:
            Extracted text (all pages concatenated)
        """
        text_parts: List[str] = []
        try:
            with open(path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    try:
                        page_text = page.extract_text() or ""
                    except Exception as page_error:
                        print(f"⚠ Failed to extract text from a PDF page: {page_error}")
                        page_text = ""
                    if page_text:
                        text_parts.append(page_text)
        except Exception as e:
            print(f"⚠ Failed to process PDF '{path}': {e}")
            raise

        text = "\n\n".join(text_parts).strip()
        print(f"✓ Extracted {len(text)} chars from PDF: {path}")
        return text

    def process_image(self, path: str, source_file: str) -> dict:
        """
        Read a local image file and use the vision-capable LLM provider to extract
        structured information from it (e.g. a scanned transcript/ID/certificate).

        Args:
            path: Local filesystem path to the image
            source_file: Original filename, used for prompt context

        Returns:
            Parsed dict of structured information extracted from the image
        """
        if not self.llm_provider:
            raise RuntimeError("LLM provider not initialized; cannot process image")

        ext = Path(path).suffix.lower().lstrip(".")
        if ext in ("jpg",):
            ext = "jpeg"

        with open(path, "rb") as f:
            image_bytes = f.read()
        b64_image = base64.b64encode(image_bytes).decode("utf-8")

        prompt_text = (
            "You are an expert document analyst. The attached image is a scanned "
            f"document named '{source_file}' (e.g. it may be a transcript, ID, "
            "certificate, award letter, or similar record).\n\n"
            "Extract ALL structured information visible in the image and return it "
            "as a single valid JSON object. Use clear, descriptive keys for each "
            "piece of information you find (e.g. 'name', 'date_of_birth', "
            "'institution', 'gpa', 'courses', 'award_title', etc). If a field is "
            "not present, omit it rather than guessing.\n\n"
            "Respond with ONLY the JSON object, no explanation, no markdown code fences."
        )

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt_text},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/{ext};base64,{b64_image}"},
                    },
                ],
            }
        ]

        try:
            response = self.llm_provider.chat_completion(
                messages=messages,
                temperature=0.0,
                max_tokens=2048,
            )
            content = response.get("content", "") if isinstance(response, dict) else str(response)
        except Exception as e:
            print(f"⚠ Vision LLM call failed for '{source_file}': {e}")
            raise

        structured_data = self._parse_json_response(content)
        print(f"✓ Extracted structured data from image: {source_file}")
        return structured_data

    def _parse_json_response(self, content: str) -> dict:
        """Be defensive about the LLM not returning clean JSON: strip markdown code
        fences and other common wrapping before parsing."""
        if not content:
            return {}

        cleaned = content.strip()

        # Strip ```json ... ``` or ``` ... ``` code fences
        fence_match = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.DOTALL | re.IGNORECASE)
        if fence_match:
            cleaned = fence_match.group(1).strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # Fallback: find the first {...} block in the text
        brace_match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if brace_match:
            try:
                return json.loads(brace_match.group(0))
            except json.JSONDecodeError:
                pass

        print(f"⚠ Could not parse LLM response as JSON, returning raw text wrapper")
        return {"raw_text": cleaned}

    # ------------------------------------------------------------------
    # Semantic chunking
    # ------------------------------------------------------------------

    def form_semantic_chunks_for_user(
        self, user_id: str, section: str, raw_texts: List[dict]
    ) -> List[dict]:
        """
        Thin wrapper around SemanticChunkFormer to reorganize raw extracted text
        into semantic blocks.

        Args:
            user_id: User ID
            section: Application section
            raw_texts: List of dicts with 'source_file', 'file_type', 'content'

        Returns:
            List of semantic block dicts (see SemanticChunkFormer)
        """
        return SemanticChunkFormer(self.llm_provider).form_semantic_chunks(
            raw_texts, user_id, section
        )

    # ------------------------------------------------------------------
    # Internal utility helpers
    # ------------------------------------------------------------------

    def _generate_document_id(self, filename: str, user_id: str) -> str:
        """
        Generate a stable-ish unique document id.

        Args:
            filename: Original filename
            user_id: User ID

        Returns:
            Sanitized unique document id string
        """
        safe_user_id = re.sub(r"[^A-Za-z0-9_-]", "_", str(user_id))
        safe_filename = re.sub(r"[^A-Za-z0-9_.-]", "_", str(filename))
        return f"doc_{safe_user_id}_{safe_filename}_{int(time.time())}"

    def _create_text_chunks(self, text: str, source_file: str) -> List[dict]:
        """
        Naive fallback chunker used when semantic chunking fails or raises.
        Splits text into paragraph-aware chunks of roughly _CHUNK_TARGET_SIZE
        characters (never exceeding _CHUNK_MAX_SIZE where reasonably avoidable).

        Args:
            text: Full extracted text
            source_file: Source filename, attached to each chunk for provenance

        Returns:
            List of chunk dicts: {content, text, category, source_file}
        """
        if not text or not text.strip():
            return []

        paragraphs = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
        if not paragraphs:
            paragraphs = [text]

        chunks: List[str] = []
        current = ""

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # If a single paragraph itself exceeds the max size, hard-split it
            if len(para) > _CHUNK_MAX_SIZE:
                if current:
                    chunks.append(current.strip())
                    current = ""
                for i in range(0, len(para), _CHUNK_TARGET_SIZE):
                    chunks.append(para[i:i + _CHUNK_TARGET_SIZE].strip())
                continue

            candidate = f"{current}\n\n{para}" if current else para
            if len(candidate) > _CHUNK_MAX_SIZE and current:
                chunks.append(current.strip())
                current = para
            else:
                current = candidate

        if current.strip():
            chunks.append(current.strip())

        return [
            {
                "content": chunk_text,
                "text": chunk_text,
                "category": "general",
                "source_file": source_file,
            }
            for chunk_text in chunks
            if chunk_text
        ]

    def _store_document_chunks(
        self,
        document_id: str,
        source_file: str,
        chunks: List[dict],
        processor_name: str,
        file_type: str,
        user_id: str,
        section: str,
    ) -> bool:
        """
        Build the document payload and store it via the search provider.

        Args:
            document_id: Unique document id
            source_file: Original filename
            chunks: List of chunk dicts (semantic blocks or naive chunks)
            processor_name: Name of the processor used (for logging/traceability)
            file_type: File extension/type
            user_id: User ID
            section: Application section

        Returns:
            True if storage succeeded, False otherwise (including when there is
            no search provider configured)
        """
        if not self.search_provider:
            print("⚠ No search provider configured; skipping chunk storage")
            return False

        document = {
            "user_id": user_id,
            "source_file": source_file,
            "section": section,
            "file_type": file_type,
            "information_chunks": chunks,
        }

        try:
            success = self.search_provider.store_document(document_id, document)
            if success:
                print(f"✓ Stored {len(chunks)} chunks for '{source_file}' via {processor_name}")
            else:
                print(f"⚠ store_document returned False for '{source_file}'")
            return bool(success)
        except Exception as e:
            print(f"⚠ Failed to store document chunks for '{source_file}': {e}")
            return False

    # ------------------------------------------------------------------
    # S3 download helper
    # ------------------------------------------------------------------

    def _download_from_s3(self, s3_key: str) -> bytes:
        """
        Download raw file bytes for a given S3 key.

        Args:
            s3_key: S3 object key

        Returns:
            Raw file bytes

        Raises:
            ValueError: if the file cannot be found/downloaded
        """
        try:
            client = get_s3_client()
            response = client.get_object(Bucket=S3_BUCKET_NAME, Key=s3_key)
            return response["Body"].read()
        except Exception as e:
            raise ValueError(f"Failed to download file from S3 for key '{s3_key}': {e}")

    def _parse_s3_key(self, s3_key: str) -> Dict[str, str]:
        """
        Parse an s3_key of the form user-uploads/{user_id}/{section}/{filename}
        into its component parts.

        Args:
            s3_key: S3 object key

        Returns:
            Dict with 'section' and 'filename'

        Raises:
            ValueError: if s3_key is missing/malformed
        """
        if not s3_key or not isinstance(s3_key, str):
            raise ValueError("s3_key is required and must be a non-empty string")

        parts = [p for p in s3_key.split("/") if p]
        if len(parts) < 2:
            raise ValueError(f"Malformed s3_key (expected user-uploads/{{user_id}}/{{section}}/{{filename}}): '{s3_key}'")

        filename = parts[-1]
        section = parts[-2] if len(parts) >= 3 else "general"

        if not filename:
            raise ValueError(f"Malformed s3_key, could not determine filename: '{s3_key}'")

        return {"section": section, "filename": filename}

    # ------------------------------------------------------------------
    # Main orchestration
    # ------------------------------------------------------------------

    def process_file_from_s3(
        self,
        s3_key: str,
        user_id: str,
        progress_callback: Optional[Callable[[int, str], None]] = None,
    ) -> dict:
        """
        Download a file from S3, extract its text/structured content, form
        semantic chunks (falling back to naive chunking on failure), store the
        chunks, and return a result summary.

        Args:
            s3_key: S3 object key of the file to parse (expected shape:
                user-uploads/{user_id}/{section}/{filename})
            user_id: User ID for tracking/storage
            progress_callback: Optional callable(progress: int, message: str) used
                to report progress for streaming (SSE) callers

        Returns:
            Dict matching ParseResultComplete: status, document_id, source_file,
            s3_key, section, file_type, chunks_created, chunks, processor_used,
            opensearch_stored

        Raises:
            ValueError: for a bad/missing s3_key (caller maps this to HTTP 400)
        """
        def _report(progress: int, message: str):
            if progress_callback:
                try:
                    progress_callback(progress, message)
                except Exception as cb_error:
                    print(f"⚠ progress_callback raised, ignoring: {cb_error}")

        key_info = self._parse_s3_key(s3_key)
        section = key_info["section"]
        filename = key_info["filename"]

        file_ext = Path(filename).suffix.lower()
        file_type = file_ext.lstrip(".") if file_ext else "unknown"

        # Step 1: Download from S3
        _report(10, "Downloading file from S3...")
        file_bytes = self._download_from_s3(s3_key)

        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
                tmp_file.write(file_bytes)
                tmp_path = tmp_file.name

            # Step 2: Extract text based on file type
            _report(40, "Extracting text...")
            extracted_text = None
            processor_used = "TextReader"
            image_structured_data: Optional[dict] = None

            if file_ext == ".pdf":
                extracted_text = self.process_pdf(tmp_path)
                processor_used = "PyPDF2+GPT"
            elif file_ext in IMAGE_EXTENSIONS:
                image_structured_data = self.process_image(tmp_path, source_file=filename)
                extracted_text = json.dumps(image_structured_data, indent=2)
                processor_used = "VisionGPT"
            else:
                # Plain text / fallback: read directly (covers .txt, .md, .doc, .docx, etc.)
                try:
                    with open(tmp_path, "r", encoding="utf-8", errors="ignore") as f:
                        extracted_text = f.read()
                except Exception as e:
                    print(f"⚠ Failed to read file as text, treating as empty: {e}")
                    extracted_text = ""
                processor_used = "TextReader"

            extracted_text = extracted_text or ""

            # Step 3: Form semantic chunks (fall back to naive chunking on failure)
            _report(70, "Forming semantic chunks...")
            raw_texts = [{
                "source_file": filename,
                "file_type": file_type,
                "content": extracted_text,
            }]

            chunks: List[dict] = []
            try:
                chunks = self.form_semantic_chunks_for_user(
                    user_id=user_id,
                    section=section,
                    raw_texts=raw_texts,
                )
                if not chunks:
                    raise RuntimeError("Semantic chunk formation returned no blocks")
                print(f"✓ Formed {len(chunks)} semantic chunks for '{filename}'")
            except Exception as e:
                print(f"⚠ Semantic chunking failed for '{filename}' ({e}); falling back to naive chunking")
                chunks = self._create_text_chunks(extracted_text, source_file=filename)

            # Step 4: Store results
            _report(90, "Storing results...")
            document_id = self._generate_document_id(filename, user_id)
            opensearch_stored = self._store_document_chunks(
                document_id=document_id,
                source_file=filename,
                chunks=chunks,
                processor_name=processor_used,
                file_type=file_type,
                user_id=user_id,
                section=section,
            )

            response_chunks = [
                {
                    "text": chunk.get("text") or chunk.get("content", ""),
                    "category": chunk.get("category", "general"),
                    "chunk_type": chunk.get("block_type", chunk.get("chunk_type", "general")),
                }
                for chunk in chunks
            ]

            result = {
                "status": "success",
                "document_id": document_id,
                "source_file": filename,
                "s3_key": s3_key,
                "section": section,
                "file_type": file_type,
                "chunks_created": len(chunks),
                "chunks": response_chunks,
                "processor_used": processor_used,
                "opensearch_stored": opensearch_stored,
            }

            _report(100, "Processing complete!")
            return result

        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError as e:
                    print(f"⚠ Failed to remove temp file '{tmp_path}': {e}")
