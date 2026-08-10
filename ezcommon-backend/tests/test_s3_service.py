"""
Tests for s3_service.py using moto to mock AWS S3 (no real AWS calls).
"""
import os
import sys

import boto3
import pytest
from moto import mock_aws

# Make sure the repo root is importable when running pytest from elsewhere
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

TEST_BUCKET_NAME = "aipply-test-bucket"
TEST_REGION = "us-east-1"


@pytest.fixture
def aws_credentials(monkeypatch):
    """Set fake AWS credentials and config so nothing touches real AWS."""
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SECURITY_TOKEN", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")
    monkeypatch.setenv("AWS_REGION", TEST_REGION)
    monkeypatch.setenv("AWS_DEFAULT_REGION", TEST_REGION)
    monkeypatch.setenv("S3_BUCKET_NAME", TEST_BUCKET_NAME)


@pytest.fixture
def s3_service(aws_credentials):
    """
    Create a fresh S3Service instance inside a mocked AWS environment.

    We import s3_service fresh (after env vars + mock_aws are active) so the
    module-level S3_BUCKET_NAME picks up the monkeypatched env var, and the
    boto3 client created via aws_config.get_s3_client() talks to moto.
    """
    with mock_aws():
        # Reload module-level state so S3_BUCKET_NAME reflects the monkeypatched env var
        import importlib
        import s3_service as s3_service_module
        importlib.reload(s3_service_module)

        service = s3_service_module.S3Service()
        yield service


def _make_bucket(service):
    """Helper: create the bucket directly via boto3 (bypassing ensure_bucket_exists)"""
    client = boto3.client("s3", region_name=TEST_REGION)
    client.create_bucket(Bucket=service.bucket_name)


class TestEnsureBucketExists:
    def test_creates_bucket_when_missing(self, s3_service):
        result = s3_service.ensure_bucket_exists()
        assert result is True

        # Bucket should now exist
        s3_service.client.head_bucket(Bucket=s3_service.bucket_name)

    def test_idempotent_when_bucket_already_exists(self, s3_service):
        first = s3_service.ensure_bucket_exists()
        second = s3_service.ensure_bucket_exists()
        assert first is True
        assert second is True

    def test_never_raises(self, s3_service, monkeypatch):
        def boom(*args, **kwargs):
            raise Exception("boom")

        monkeypatch.setattr(s3_service.client, "head_bucket", boom)
        monkeypatch.setattr(s3_service.client, "create_bucket", boom)

        result = s3_service.ensure_bucket_exists()
        assert result is False


class TestUploadFile:
    def test_upload_success_shape(self, s3_service):
        s3_service.ensure_bucket_exists()

        result = s3_service.upload_file(
            file_content=b"hello world",
            filename="resume.pdf",
            user_id="user123",
            section="profile",
            content_type="application/pdf",
        )

        assert result["success"] is True
        assert result["filename"] == "resume.pdf"
        assert result["unique_filename"].endswith("resume.pdf")
        assert result["unique_filename"] != "resume.pdf"
        assert result["s3_key"] == f"user-uploads/user123/profile/{result['unique_filename']}"
        assert result["size"] == len(b"hello world")
        assert result["section"] == "profile"
        assert result["url"]
        assert "http" in result["url"]

    def test_upload_key_convention(self, s3_service):
        s3_service.ensure_bucket_exists()

        result = s3_service.upload_file(
            file_content=b"data",
            filename="transcript.png",
            user_id="user-abc",
            section="education",
        )

        assert result["s3_key"].startswith("user-uploads/user-abc/education/")

    def test_upload_failure_returns_dict_not_raise(self, s3_service, monkeypatch):
        s3_service.ensure_bucket_exists()

        def boom(*args, **kwargs):
            raise Exception("put_object failed")

        monkeypatch.setattr(s3_service.client, "put_object", boom)

        result = s3_service.upload_file(
            file_content=b"data",
            filename="file.txt",
            user_id="user1",
            section="testing",
        )

        assert result["success"] is False
        assert result["filename"] == "file.txt"
        assert "error" in result


class TestListUserFiles:
    def test_list_with_section_filter(self, s3_service):
        s3_service.ensure_bucket_exists()

        s3_service.upload_file(
            file_content=b"a", filename="a.pdf", user_id="u1", section="profile"
        )
        s3_service.upload_file(
            file_content=b"b", filename="b.pdf", user_id="u1", section="education"
        )

        profile_files = s3_service.list_user_files(user_id="u1", section="profile")
        assert len(profile_files) == 1
        assert profile_files[0]["filename"] == "a.pdf"
        assert profile_files[0]["section"] == "profile"

    def test_list_without_section_filter_returns_all_sections(self, s3_service):
        s3_service.ensure_bucket_exists()

        s3_service.upload_file(
            file_content=b"a", filename="a.pdf", user_id="u2", section="profile"
        )
        s3_service.upload_file(
            file_content=b"b", filename="b.pdf", user_id="u2", section="education"
        )
        s3_service.upload_file(
            file_content=b"c", filename="c.pdf", user_id="u2", section="activity"
        )

        all_files = s3_service.list_user_files(user_id="u2")
        assert len(all_files) == 3
        sections = {f["section"] for f in all_files}
        assert sections == {"profile", "education", "activity"}

    def test_list_entry_has_required_keys(self, s3_service):
        s3_service.ensure_bucket_exists()
        s3_service.upload_file(
            file_content=b"content",
            filename="doc.docx",
            user_id="u3",
            section="testing",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

        files = s3_service.list_user_files(user_id="u3", section="testing")
        assert len(files) == 1
        entry = files[0]

        for key in (
            "filename",
            "size",
            "url",
            "s3_key",
            "section",
            "uploaded_at",
            "last_modified",
            "file_type",
        ):
            assert key in entry

        assert entry["uploaded_at"] == entry["last_modified"]
        assert entry["file_type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        assert isinstance(entry["size"], int)

    def test_list_does_not_leak_other_users_files(self, s3_service):
        s3_service.ensure_bucket_exists()
        s3_service.upload_file(
            file_content=b"a", filename="a.pdf", user_id="userA", section="profile"
        )
        s3_service.upload_file(
            file_content=b"b", filename="b.pdf", user_id="userB", section="profile"
        )

        files = s3_service.list_user_files(user_id="userA")
        assert len(files) == 1
        assert files[0]["filename"] == "a.pdf"

    def test_list_empty_for_unknown_user(self, s3_service):
        s3_service.ensure_bucket_exists()
        files = s3_service.list_user_files(user_id="nobody")
        assert files == []

    def test_list_never_raises_on_error(self, s3_service, monkeypatch):
        s3_service.ensure_bucket_exists()

        def boom(*args, **kwargs):
            raise Exception("list failed")

        monkeypatch.setattr(s3_service.client, "get_paginator", boom)

        files = s3_service.list_user_files(user_id="u1")
        assert files == []


class TestDeleteFile:
    def test_delete_existing_file(self, s3_service):
        s3_service.ensure_bucket_exists()
        result = s3_service.upload_file(
            file_content=b"data", filename="f.txt", user_id="u1", section="profile"
        )
        s3_key = result["s3_key"]

        assert s3_service.delete_file(s3_key) is True

        # Should no longer show up in listing
        files = s3_service.list_user_files(user_id="u1", section="profile")
        assert files == []

    def test_delete_nonexistent_file_does_not_raise_and_returns_true(self, s3_service):
        s3_service.ensure_bucket_exists()
        result = s3_service.delete_file("user-uploads/nobody/profile/does-not-exist.txt")
        assert result is True

    def test_delete_never_raises_on_real_failure(self, s3_service, monkeypatch):
        s3_service.ensure_bucket_exists()

        def boom(*args, **kwargs):
            raise Exception("delete failed")

        monkeypatch.setattr(s3_service.client, "delete_object", boom)

        result = s3_service.delete_file("user-uploads/u1/profile/f.txt")
        assert result is False


class TestGetFileMetadata:
    def test_get_metadata_existing_file(self, s3_service):
        s3_service.ensure_bucket_exists()
        result = s3_service.upload_file(
            file_content=b"hello",
            filename="notes.txt",
            user_id="u1",
            section="activity",
            content_type="text/plain",
        )
        s3_key = result["s3_key"]

        metadata = s3_service.get_file_metadata(s3_key)

        assert metadata is not None
        assert metadata["s3_key"] == s3_key
        assert metadata["section"] == "activity"
        assert metadata["size"] == len(b"hello")
        assert metadata["file_type"] == "text/plain"
        assert metadata["filename"] == "notes.txt"
        assert metadata["url"]

    def test_get_metadata_missing_file_returns_none(self, s3_service):
        s3_service.ensure_bucket_exists()
        metadata = s3_service.get_file_metadata("user-uploads/u1/profile/missing.txt")
        assert metadata is None

    def test_get_metadata_never_raises(self, s3_service, monkeypatch):
        s3_service.ensure_bucket_exists()

        def boom(*args, **kwargs):
            raise Exception("head_object failed")

        monkeypatch.setattr(s3_service.client, "head_object", boom)

        metadata = s3_service.get_file_metadata("user-uploads/u1/profile/f.txt")
        assert metadata is None


class TestGetS3Service:
    def test_returns_singleton(self, aws_credentials):
        with mock_aws():
            import importlib
            import s3_service as s3_service_module
            importlib.reload(s3_service_module)

            instance1 = s3_service_module.get_s3_service()
            instance2 = s3_service_module.get_s3_service()
            assert instance1 is instance2
