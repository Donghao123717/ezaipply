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

    def extract_field_suggestions(
        self,
        user_id: str,
        files: List[Dict[str, Any]],
        field_schema: List[Dict[str, Any]],
        existing_records: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Like extract_from_files, but schema-aware: instead of free-form
        {category, information} chunks, prompts the LLM to fill in a specific
        set of profile form fields so the frontend can write results directly
        into ProfileBuilder's state for the student to review and confirm.

        Args:
            user_id: User ID
            files: List of {"filename": str, "section": str} dicts identifying
                which of the user's uploaded files to read
            field_schema: List of {"section", "field", "label", "type",
                "options"} dicts describing the exact fields available to fill
                in (mirrors lib/profile-schema.ts on the frontend)
            existing_records: List of {"section", "nestedKey", "records"} dicts
                describing repeatable-list records the student's profile
                already has, so the LLM can avoid re-suggesting duplicates of
                a test score/activity/award that's already been applied.

        Returns:
            {"suggestions": [{"section": str, "field": str, "value": str}, ...]}
            Empty list (never raises) if nothing could be extracted.
        """
        if not files or not field_schema or not self.llm_provider:
            return {"suggestions": []}

        text_parts: List[str] = []
        for file_ref in files:
            filename = file_ref.get("filename")
            section = file_ref.get("section", "unknown")
            if not filename:
                continue
            try:
                file_bytes = self._fetch_file_bytes(user_id, filename, section)
                if file_bytes is None:
                    continue
                text = self._extract_text(filename, file_bytes)
                if text and text.strip():
                    text_parts.append(f"--- {filename} ---\n{text}")
            except Exception as e:
                print(f"⚠ Error reading file '{filename}' for field suggestions: {e}")
                continue

        if not text_parts:
            return {"suggestions": []}

        # Generous cap - this can legitimately be many documents at once (transcript,
        # passport, several score reports). GPT-4o-mini's context window comfortably
        # fits this; a small cap here was silently dropping later documents.
        combined_text = "\n\n".join(text_parts)[:80000]
        schema_json = json.dumps(field_schema, ensure_ascii=False)
        existing_json = json.dumps(existing_records or [], ensure_ascii=False)

        prompt = f"""You are an assistant that fills in a college application profile form from a student's uploaded documents.

Below is the list of form fields available to fill in, as a JSON array. Each field has a "section" and "field" key - copy these EXACTLY as given, do not invent new ones. Some fields also have "repeatable": true - these belong to a list (e.g. one row per standardized test, activity, or award), and some of those also have a "nestedKey" - these belong to a sub-list nested inside their section (e.g. one row per parent/guardian, per language spoken, per other school attended).

Fields:
{schema_json}

IMPORTANT section boundaries: the "testing" section is ONLY for standardized test/exam scores (SAT, ACT, AP, IB, TOEFL, IELTS, etc.) - a numeric or letter score tied to a specific exam. The "honors" section is ONLY for named awards, distinctions, and recognitions (e.g. "AP Scholar with Distinction", "National Merit Finalist", "Eagle Scout") - never put an individual exam score in "honors", and never put an award's title in "testing".

The student's profile already has these records - do NOT suggest a new entry for anything that duplicates one of these (same test/activity/award, even if worded slightly differently or the date format differs). Skip it entirely rather than re-adding it:
{existing_json}

The document text below contains MULTIPLE separate documents, each preceded by a "--- filename ---" header. Go through EVERY document one at a time and extract a value for every field you can confidently determine from it - do not stop early or skip documents just because you already found values in an earlier one. Skip individual fields you cannot determine with reasonable confidence - do not guess.

For "repeatable" fields, the same document may describe multiple separate records (e.g. five different AP exam scores, or two different SAT test dates). Give every field belonging to the same record the same "item" number (starting at 0), and use a new "item" number for each distinct record - including across different documents.

Return ONLY a JSON array (no markdown, no commentary) of objects with exactly these keys:
- "section": copied exactly from the field list above
- "field": copied exactly from the field list above
- "value": the extracted value as a plain string. For "select"/"radio" fields, use one of that field's listed options exactly as written. For "checkbox-multi" fields, join multiple selected options with a comma.
- "item": integer, only needed for "repeatable" fields as described above.

Document text:
\"\"\"
{combined_text}
\"\"\"
"""

        try:
            response = self.llm_provider.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=8000,
            )
            content = response.get("content", "") if isinstance(response, dict) else str(response)
        except Exception as e:
            print(f"⚠ LLM call failed while extracting field suggestions: {e}")
            return {"suggestions": []}

        parsed = self._parse_llm_json_response(content)
        if parsed is None:
            print(f"⚠ Could not parse field-suggestion LLM response as JSON: {content[:200]!r}")
            return {"suggestions": []}

        field_meta = {(f.get("section"), f.get("field")): f for f in field_schema}
        suggestions = []
        for entry in parsed:
            if not isinstance(entry, dict):
                continue
            section = str(entry.get("section", "")).strip()
            field = str(entry.get("field", "")).strip()
            value = str(entry.get("value", "")).strip()
            meta = field_meta.get((section, field))
            if not value or meta is None:
                continue
            suggestion: Dict[str, Any] = {"section": section, "field": field, "value": value}
            if meta.get("repeatable"):
                try:
                    suggestion["item"] = int(entry.get("item", 0) or 0)
                except (TypeError, ValueError):
                    suggestion["item"] = 0
                if meta.get("nestedKey"):
                    suggestion["nestedKey"] = meta["nestedKey"]
            suggestions.append(suggestion)

        return {"suggestions": self._drop_duplicate_records(suggestions, existing_records or [])}

    @staticmethod
    def _drop_duplicate_records(
        suggestions: List[Dict[str, Any]], existing_records: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Deterministic backstop for repeatable-field suggestions: the prompt asks
        the LLM to skip records that duplicate one already in existing_records,
        but instruction-following isn't 100% reliable, so also drop any new
        record here that exactly matches (on every field they share) one the
        student's profile already has.
        """
        existing_by_group: Dict[tuple, List[Dict[str, Any]]] = {}
        for group in existing_records:
            key = (group.get("section"), group.get("nestedKey") or "")
            existing_by_group[key] = group.get("records") or []

        grouped: Dict[tuple, List[Dict[str, Any]]] = {}
        for s in suggestions:
            if "item" not in s:
                continue
            key = (s["section"], s.get("nestedKey") or "", s["item"])
            grouped.setdefault(key, []).append(s)

        duplicate_items = set()
        for (section, nested_key, item), items in grouped.items():
            candidate: Dict[str, str] = {}
            for s in items:
                field = s["field"]
                if nested_key and field.startswith(f"{nested_key}."):
                    field = field[len(nested_key) + 1 :]
                candidate[field] = s["value"]
            for existing in existing_by_group.get((section, nested_key), []):
                overlap = [k for k in candidate if k in existing]
                if overlap and all(
                    str(candidate[k]).strip().lower() == str(existing.get(k, "")).strip().lower() for k in overlap
                ):
                    duplicate_items.add((section, nested_key, item))
                    break

        if not duplicate_items:
            return suggestions
        return [
            s
            for s in suggestions
            if "item" not in s or (s["section"], s.get("nestedKey") or "", s["item"]) not in duplicate_items
        ]

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
        Best-effort: unsupported/binary formats return an empty string rather
        than raising, so callers can gracefully skip them.
        """
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

        try:
            if ext == "pdf":
                return self._extract_text_from_pdf(file_bytes)
            elif ext in ("txt", "md", "csv"):
                return file_bytes.decode("utf-8", errors="ignore")
            elif ext in ("jpg", "jpeg", "png", "gif", "webp"):
                return self._extract_text_from_image(filename, file_bytes, ext)
            else:
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

    def _extract_text_from_image(self, filename: str, file_bytes: bytes, ext: str) -> str:
        """
        Transcribe an image's visible text/data using the vision-capable LLM
        provider (e.g. a screenshotted score report or transcript), so it can
        flow through the same text-based extraction prompt as PDFs/text files.
        """
        if not self.llm_provider:
            return ""

        import base64

        b64_image = base64.b64encode(file_bytes).decode("utf-8")
        mime_ext = "jpeg" if ext == "jpg" else ext

        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            f"Transcribe all text, labels, and data visible in this image "
                            f"(filename: '{filename}'). Preserve labels next to their values "
                            "(e.g. 'Test Date: ...', 'Total Score: ...', course names and "
                            "grades in a table). Output plain text only, no commentary."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/{mime_ext};base64,{b64_image}"},
                    },
                ],
            }
        ]

        try:
            response = self.llm_provider.chat_completion(
                messages=messages,
                temperature=0.0,
                max_tokens=2048,
                model=getattr(self.llm_provider, "vision_model", None),
            )
            return response.get("content", "") if isinstance(response, dict) else str(response)
        except Exception as e:
            print(f"⚠ Vision LLM call failed for '{filename}': {e}")
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
