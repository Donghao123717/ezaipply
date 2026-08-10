"""
S3 Service for EZ Common Application
Handles file uploads, listing, retrieval, and deletion in AWS S3 for user documents
"""
import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from botocore.exceptions import ClientError

from aws_config import get_s3_client, AWS_REGION

# S3 bucket used to store user-uploaded documents (profile, education, activity, testing)
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME", "aipply-user-uploads")

# How long presigned URLs remain valid (in seconds). Default: 7 days.
PRESIGNED_URL_EXPIRATION = int(os.environ.get("S3_PRESIGNED_URL_EXPIRATION", str(7 * 24 * 60 * 60)))

# Prefix under which all user files are stored
USER_UPLOADS_PREFIX = "user-uploads"


class S3Service:
    """Service for managing user file uploads in S3"""

    def __init__(self):
        """Initialize the S3 service with a boto3 client and configured bucket name"""
        self.client = get_s3_client()
        self.bucket_name = S3_BUCKET_NAME
        self.region = AWS_REGION

    def ensure_bucket_exists(self) -> bool:
        """
        Ensure the configured S3 bucket exists, creating it if necessary.

        This is idempotent and safe to call on every startup.

        Returns:
            True if the bucket exists (or was created) successfully, False on failure.
        """
        try:
            self.client.head_bucket(Bucket=self.bucket_name)
            print(f"✓ S3 bucket already exists: {self.bucket_name}")
            return True
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            status_code = e.response.get("ResponseMetadata", {}).get("HTTPStatusCode")

            # Bucket not found - try to create it
            if error_code in ("404", "NoSuchBucket") or status_code == 404:
                try:
                    if self.region and self.region != "us-east-1":
                        self.client.create_bucket(
                            Bucket=self.bucket_name,
                            CreateBucketConfiguration={"LocationConstraint": self.region},
                        )
                    else:
                        self.client.create_bucket(Bucket=self.bucket_name)
                    print(f"✓ Created S3 bucket: {self.bucket_name}")
                    return True
                except ClientError as create_error:
                    create_code = create_error.response.get("Error", {}).get("Code", "")
                    if create_code in ("BucketAlreadyOwnedByYou", "BucketAlreadyExists"):
                        print(f"✓ S3 bucket already exists: {self.bucket_name}")
                        return True
                    print(f"❌ Failed to create S3 bucket '{self.bucket_name}': {create_error}")
                    return False
                except Exception as create_error:
                    print(f"❌ Failed to create S3 bucket '{self.bucket_name}': {create_error}")
                    return False

            # Forbidden - bucket likely exists but owned by someone else, or permissions issue
            print(f"❌ Failed to verify S3 bucket '{self.bucket_name}': {e}")
            return False
        except Exception as e:
            print(f"❌ Unexpected error ensuring S3 bucket exists: {e}")
            return False

    def upload_file(
        self,
        file_content: bytes,
        filename: str,
        user_id: str,
        section: str,
        content_type: Optional[str] = None,
    ) -> dict:
        """
        Upload a file to S3 under the user's section.

        Args:
            file_content: Raw bytes of the file to upload
            filename: Original filename (used to derive the unique filename and extension)
            user_id: ID of the user who owns the file
            section: Upload section (e.g. profile, education, activity, testing)
            content_type: MIME type of the file, if known

        Returns:
            On success: dict with keys success, filename, unique_filename, s3_key, url,
                size, section.
            On failure: dict with keys success (False), filename, error.
        """
        try:
            unique_filename = self._generate_unique_filename(filename)
            s3_key = self._build_s3_key(user_id, section, unique_filename)

            extra_args = {
                "Metadata": {
                    "section": section,
                    "user_id": user_id,
                    "original_filename": filename,
                }
            }
            if content_type:
                extra_args["ContentType"] = content_type
                extra_args["Metadata"]["content_type"] = content_type

            self.client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_content,
                **extra_args,
            )

            url = self._generate_presigned_url(s3_key)

            print(f"✓ Uploaded file to S3: {s3_key}")

            return {
                "success": True,
                "filename": filename,
                "unique_filename": unique_filename,
                "s3_key": s3_key,
                "url": url,
                "size": len(file_content),
                "section": section,
            }
        except Exception as e:
            print(f"❌ Failed to upload file '{filename}' to S3: {e}")
            return {
                "success": False,
                "filename": filename,
                "error": str(e),
            }

    def list_user_files(self, user_id: str, section: Optional[str] = None) -> List[dict]:
        """
        List files uploaded by a user, optionally filtered by section.

        Args:
            user_id: ID of the user
            section: Optional upload section to filter by. If omitted, files across
                all sections are returned.

        Returns:
            List of dicts describing each file. Empty list on error or if none found.
        """
        try:
            if section:
                prefix = f"{USER_UPLOADS_PREFIX}/{user_id}/{section}/"
            else:
                prefix = f"{USER_UPLOADS_PREFIX}/{user_id}/"

            files = []
            paginator = self.client.get_paginator("list_objects_v2")

            for page in paginator.paginate(Bucket=self.bucket_name, Prefix=prefix):
                for obj in page.get("Contents", []):
                    s3_key = obj["Key"]

                    # Skip "directory marker" style keys
                    if s3_key.endswith("/"):
                        continue

                    file_info = self._build_file_info(s3_key, obj)
                    if file_info:
                        files.append(file_info)

            return files
        except Exception as e:
            print(f"⚠ Failed to list files for user '{user_id}': {e}")
            return []

    def delete_file(self, s3_key: str) -> bool:
        """
        Delete a file from S3. Deletion is idempotent - deleting a key that does not
        exist is treated as success.

        Args:
            s3_key: S3 object key to delete

        Returns:
            True if the object was deleted (or did not exist), False on real failure.
        """
        try:
            self.client.delete_object(Bucket=self.bucket_name, Key=s3_key)
            print(f"✓ Deleted file from S3: {s3_key}")
            return True
        except Exception as e:
            print(f"❌ Failed to delete file '{s3_key}' from S3: {e}")
            return False

    def get_file_metadata(self, s3_key: str) -> Optional[dict]:
        """
        Get metadata for a specific file.

        Args:
            s3_key: S3 object key

        Returns:
            Dict describing the file (same shape as a list_user_files() entry), or
            None if the file does not exist or an error occurred.
        """
        try:
            obj = self.client.head_object(Bucket=self.bucket_name, Key=s3_key)
            return self._build_file_info(s3_key, obj)
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code in ("404", "NoSuchKey"):
                return None
            print(f"⚠ Failed to get metadata for '{s3_key}': {e}")
            return None
        except Exception as e:
            print(f"⚠ Failed to get metadata for '{s3_key}': {e}")
            return None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _generate_unique_filename(self, filename: str) -> str:
        """Prefix the original filename with a UUID to avoid collisions, keeping the extension"""
        unique_id = uuid.uuid4().hex
        return f"{unique_id}_{filename}"

    def _build_s3_key(self, user_id: str, section: str, unique_filename: str) -> str:
        """Build the S3 key for a user's uploaded file"""
        return f"{USER_UPLOADS_PREFIX}/{user_id}/{section}/{unique_filename}"

    def _generate_presigned_url(self, s3_key: str) -> Optional[str]:
        """Generate a presigned GET URL for a given S3 key"""
        try:
            return self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": s3_key},
                ExpiresIn=PRESIGNED_URL_EXPIRATION,
            )
        except Exception as e:
            print(f"⚠ Failed to generate presigned URL for '{s3_key}': {e}")
            return None

    def _section_from_key(self, s3_key: str) -> str:
        """Parse the section out of an S3 key of the form user-uploads/{user_id}/{section}/..."""
        parts = s3_key.split("/")
        if len(parts) >= 3:
            return parts[2]
        return "unknown"

    def _build_file_info(self, s3_key: str, obj: dict) -> Optional[dict]:
        """
        Build a normalized file info dict from an S3 object (as returned by
        list_objects_v2 or head_object), fetching metadata via head_object if needed.

        Args:
            s3_key: S3 object key
            obj: Object dict from list_objects_v2 (has Size/LastModified) or the
                response from head_object (has ContentLength/LastModified/Metadata/ContentType)

        Returns:
            Normalized file info dict, or None on failure.
        """
        try:
            # list_objects_v2 entries don't include Metadata/ContentType - fetch via head_object
            if "Metadata" not in obj:
                head = self.client.head_object(Bucket=self.bucket_name, Key=s3_key)
            else:
                head = obj

            metadata = head.get("Metadata", {}) or {}
            size = head.get("ContentLength", obj.get("Size", 0))
            last_modified = head.get("LastModified", obj.get("LastModified"))

            if isinstance(last_modified, datetime):
                if last_modified.tzinfo is None:
                    last_modified = last_modified.replace(tzinfo=timezone.utc)
                last_modified_str = last_modified.isoformat()
            elif last_modified:
                last_modified_str = str(last_modified)
            else:
                last_modified_str = datetime.now(timezone.utc).isoformat()

            section = metadata.get("section") or self._section_from_key(s3_key)
            content_type = metadata.get("content_type") or head.get("ContentType") or self._guess_content_type(s3_key)
            original_filename = metadata.get("original_filename") or s3_key.rsplit("/", 1)[-1]

            return {
                "filename": original_filename,
                "size": int(size) if size is not None else 0,
                "url": self._generate_presigned_url(s3_key),
                "s3_key": s3_key,
                "section": section,
                "uploaded_at": last_modified_str,
                "last_modified": last_modified_str,
                "file_type": content_type,
            }
        except Exception as e:
            print(f"⚠ Failed to build file info for '{s3_key}': {e}")
            return None

    def _guess_content_type(self, filename: str) -> str:
        """Best-effort content type guess based on file extension"""
        import mimetypes

        guessed, _ = mimetypes.guess_type(filename)
        return guessed or "application/octet-stream"


# Global singleton instance
_s3_service = None


def get_s3_service() -> S3Service:
    """Get or create the global S3 service instance"""
    global _s3_service
    if _s3_service is None:
        _s3_service = S3Service()
    return _s3_service
