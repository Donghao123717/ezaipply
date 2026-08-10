"""
Intelligent Extractor Service
Uses an LLM to pull structured facts (GPA, test scores, activities, awards, etc.)
out of a user's uploaded documents (S3) and store the resulting chunks in the
search provider (ChromaDB/OpenSearch) for later use by the form filler.
"""
import io
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from aws_config import get_s3_client, AWS_REGION

# S3 bucket used to store user-uploaded documents - kept in sync with s3_service.py
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME", "aipply-user-uploads")


class IntelligentExtractorService:
    """Service for extracting structured information from user documents using an LLM"""

    def __init__(self, search_provider=None, llm_provider=None):
        """Initialize the intelligent extractor service

        Args:
            search_provider: Search provider instance (OpenSearch or ChromaDB)
            llm_provider: LLM provider instance used to extract structured facts
        """
        # Use injected search provider
        self.search_provider = search_provider

        # Use injected LLM provider
        self.llm_provider = llm_provider

        # auth_api.py constructs the search provider but never calls .initialize()
        # on it before handing it to this service, so we must do it here ourselves
        # (mirrors services/document_parse_service.py, which does the same thing).
        # initialize() is required to be idempotent/safe to call more than once.
        if self.search_provider is not None:
            try:
                self.search_provider.initialize()
                print("✓ Search provider initialized by IntelligentExtractorService")
            except Exception as e:
                print(f"⚠ Search provider initialization failed (continuing): {e}")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def list_user_files(self, user_id: str, section: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List a user's uploaded files (delegates to the S3 service).

        Args:
            user_id: User ID
            section: Optional section filter (education, activity, testing, profile)

        Returns:
            List of file info dicts (filename, section, size, url, s3_key,
            uploaded_at, last_modified, file_type)
        """
        try:
            from s3_service import get_s3_service

            files = get_s3_service().list_user_files(user_id, section)
            print(f"[DEBUG] list_user_files: found {len(files)} files for user_id={user_id}, section={section}")
            return files
        except Exception as e:
            print(f"⚠ Error listing files for user {user_id}: {e}")
            return []

    def extract_from_files(self, user_id: str, files: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Download and extract structured information from a list of the user's files
        using the LLM.

        Args:
            user_id: User ID
            files: List of {"filename": str, "section": str} dicts identifying
                which of the user's uploaded files to process

        Returns:
            {
                "status": "success",
                "total_chunks": int,
                "chunks": [{"category", "information", "source_file", "section"}, ...],
                "source_file": "<comma-joined list of requested filenames>",
            }

        Raises:
            ValueError: if nothing could be extracted from any of the requested files
        """
        if not files:
            raise ValueError("No files provided for extraction")

        all_chunks: List[Dict[str, Any]] = []
        filenames = [f.get("filename", "") for f in files if f.get("filename")]

        for file_ref in files:
            filename = file_ref.get("filename")
            section = file_ref.get("section", "unknown")

            if not filename:
                print(f"[DEBUG] Skipping file entry with no filename: {file_ref}")
                continue

            try:
                print(f"[DEBUG] extract_from_files: processing {filename} (section={section}) for user_id={user_id}")

                file_bytes = self._fetch_file_bytes(user_id, filename, section)
                if file_bytes is None:
                    print(f"[DEBUG] Could not download bytes for {filename}, skipping")
                    continue

                text = self._extract_text(filename, file_bytes)
                if not text or not text.strip():
                    print(f"[DEBUG] No extractable text for {filename}, skipping")
                    continue

                chunks = self._extract_structured_info(text, filename, section)
                if chunks:
                    all_chunks.extend(chunks)
                    print(f"[DEBUG] Extracted {len(chunks)} chunks from {filename}")
                else:
                    print(f"[DEBUG] LLM extraction produced no chunks for {filename}")

            except Exception as e:
                print(f"⚠ Error extracting from file '{filename}': {e}")
                continue

        if not all_chunks:
            raise ValueError(
                "Could not extract any structured information from the provided files"
            )

        return {
            "status": "success",
            "total_chunks": len(all_chunks),
            "chunks": all_chunks,
            "source_file": ", ".join(filenames),
        }

    def store_chunks_to_opensearch(
        self,
        user_id: str,
        chunks: List[Dict[str, Any]],
        source_file: str,
    ) -> Dict[str, Any]:
        """
        Store previously extracted chunks into the search provider.

        Args:
            user_id: User ID
            chunks: List of {"category", "information", "source_file", "section"} dicts
                (the same shape returned by extract_from_files, round-tripped from
                the frontend)
            source_file: Comma-joined list of source filenames (for grouping/document id)

        Returns:
            {"status": "ok", "stored_chunks": <int>}
        """
        if not self.search_provider:
            print("⚠ store_chunks_to_opensearch: no search provider configured, soft-failing")
            return {"status": "ok", "stored_chunks": 0}

        if not chunks:
            return {"status": "ok", "stored_chunks": 0}

        try:
            # Group chunks by (source_file, section) so each document stored in the
            # search provider stays scoped to a single file/section combination.
            groups: Dict[Any, List[Dict[str, Any]]] = {}
            for chunk in chunks:
                chunk_source = chunk.get("source_file") or source_file or "unknown"
                chunk_section = chunk.get("section", "unknown")
                key = (chunk_source, chunk_section)
                groups.setdefault(key, []).append(chunk)

            timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
            stored_count = 0

            for (chunk_source, chunk_section), group_chunks in groups.items():
                information_chunks = [
                    {
                        "content": chunk.get("information", ""),
                        "text": chunk.get("information", ""),
                        "category": chunk.get("category", ""),
                    }
                    for chunk in group_chunks
                ]

                document_id = f"{user_id}_{chunk_source}_{chunk_section}_{timestamp}"
                document = {
                    "user_id": user_id,
                    "source_file": chunk_source,
                    "section": chunk_section,
                    "file_type": "extracted",
                    "information_chunks": information_chunks,
                }

                success = self.search_provider.store_document(document_id, document)
                if success:
                    stored_count += len(group_chunks)
                else:
                    print(f"⚠ Failed to store chunk group for document_id={document_id}")

            print(f"[DEBUG] store_chunks_to_opensearch: stored {stored_count}/{len(chunks)} chunks for user_id={user_id}")

            return {"status": "ok", "stored_chunks": stored_count}
        except Exception as e:
            print(f"⚠ Error storing chunks to search provider: {e}")
            return {"status": "ok", "stored_chunks": 0}

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _fetch_file_bytes(self, user_id: str, filename: str, section: str) -> Optional[bytes]:
        """
        Download the raw bytes of a user's file from S3, resolving the S3 key by
        matching on filename within the given section via the S3 service.
        """
        try:
            from s3_service import get_s3_service

            candidates = get_s3_service().list_user_files(user_id, section)
            match = next((f for f in candidates if f.get("filename") == filename), None)

            if not match:
                # Fall back to searching across all sections in case the frontend's
                # section hint is stale/wrong
                candidates = get_s3_service().list_user_files(user_id, None)
                match = next((f for f in candidates if f.get("filename") == filename), None)

            if not match or not match.get("s3_key"):
                print(f"⚠ Could not resolve s3_key for filename={filename}, section={section}")
                return None

            s3_key = match["s3_key"]
            response = get_s3_client().get_object(Bucket=S3_BUCKET_NAME, Key=s3_key)
            return response["Body"].read()
        except Exception as e:
            print(f"⚠ Error fetching file bytes for '{filename}': {e}")
            return None

    def _extract_text(self, filename: str, file_bytes: bytes) -> str:
        """
        Extract plain text from raw file bytes based on filename extension.
        Best-effort: unsupported/binary formats (e.g. images) return an empty string
        rather than raising, so callers can gracefully skip them.
        """
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

        try:
            if ext == "pdf":
                return self._extract_text_from_pdf(file_bytes)
            elif ext in ("txt", "md", "csv"):
                return file_bytes.decode("utf-8", errors="ignore")
            else:
                # Images and other binary formats are not text-extractable here;
                # skip gracefully rather than failing the whole request.
                print(f"[DEBUG] Unsupported file type for text extraction: .{ext} ({filename})")
                return ""
        except Exception as e:
            print(f"⚠ Error extracting text from '{filename}': {e}")
            return ""

    def _extract_text_from_pdf(self, file_bytes: bytes) -> str:
        """Extract text from a PDF file's raw bytes using PyPDF2"""
        try:
            from PyPDF2 import PdfReader

            reader = PdfReader(io.BytesIO(file_bytes))
            text_parts = []
            for page in reader.pages:
                try:
                    page_text = page.extract_text() or ""
                    if page_text:
                        text_parts.append(page_text)
                except Exception as page_error:
                    print(f"⚠ Error extracting text from PDF page: {page_error}")
                    continue
            return "\n".join(text_parts)
        except Exception as e:
            print(f"⚠ Error reading PDF: {e}")
            return ""

    def _extract_structured_info(
        self,
        text: str,
        filename: str,
        section: str,
    ) -> List[Dict[str, str]]:
        """
        Call the LLM to extract structured {category, information} facts from a
        document's raw text.

        Returns an empty list (rather than raising) if the LLM is unavailable or
        its response can't be parsed as JSON.
        """
        if not self.llm_provider:
            print(f"[DEBUG] No llm_provider configured, cannot extract structured info from {filename}")
            return []

        # Cap the amount of text sent to the LLM to keep prompts reasonably sized
        max_chars = 12000
        truncated_text = text[:max_chars]

        prompt = f"""You are an assistant that extracts structured facts from a student's college application document.

Document filename: {filename}
Document section: {section}

Extract every distinct, useful piece of structured information from the text below - things like GPA, test scores (SAT/ACT/AP), courses, grades, activities, leadership roles, awards, honors, volunteer work, and other application-relevant facts.

Return ONLY a JSON array (no markdown, no commentary) of objects with exactly these keys:
- "category": a short label for the type of information (e.g. "GPA", "Test Score", "Activity", "Award", "Course")
- "information": the extracted fact as a concise, self-contained sentence or phrase

Example format:
[{{"category": "GPA", "information": "Unweighted GPA of 3.95 out of 4.0"}}, {{"category": "Test Score", "information": "SAT score of 1520 (Math 780, EBRW 740)"}}]

If no structured information can be found, return an empty JSON array: []

Document text:
\"\"\"
{truncated_text}
\"\"\"
"""

        try:
            response = self.llm_provider.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=2000,
            )
            content = response.get("content", "") if isinstance(response, dict) else str(response)
        except Exception as e:
            print(f"⚠ LLM call failed while extracting from '{filename}': {e}")
            return []

        parsed = self._parse_llm_json_response(content)
        if parsed is None:
            print(f"⚠ Could not parse LLM response as JSON for '{filename}': {content[:200]!r}")
            return []

        chunks = []
        for item in parsed:
            if not isinstance(item, dict):
                continue
            category = str(item.get("category", "")).strip()
            information = str(item.get("information", "")).strip()
            if not information:
                continue
            chunks.append({
                "category": category or "General",
                "information": information,
                "source_file": filename,
                "section": section,
            })

        return chunks

    @staticmethod
    def _parse_llm_json_response(content: str) -> Optional[List[Any]]:
        """
        Defensively parse a JSON array out of an LLM response, stripping markdown
        code fences if present. Returns None if parsing fails entirely.
        """
        if not content:
            return None

        cleaned = content.strip()

        # Strip markdown code fences (```json ... ``` or ``` ... ```)
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip().startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()

        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError:
            # Try to salvage a JSON array embedded in extra text
            start = cleaned.find("[")
            end = cleaned.rfind("]")
            if start != -1 and end != -1 and end > start:
                try:
                    parsed = json.loads(cleaned[start:end + 1])
                except json.JSONDecodeError:
                    return None
            else:
                return None

        if isinstance(parsed, dict):
            # Some models wrap the array in an object, e.g. {"chunks": [...]}
            for value in parsed.values():
                if isinstance(value, list):
                    return value
            return None

        if isinstance(parsed, list):
            return parsed

        return None
