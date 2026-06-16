from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import yaml


def test_post_agent_manual_and_llm_split(tmp_memory_dir):
    from agents.post_agent import PostAgent

    llm = MagicMock()
    llm.chat.return_value = "CAPTION:\nGenerated caption text"

    instagrapi = MagicMock()
    instagrapi.publish_media_post.return_value = "media_100"

    agent = PostAgent(llm=llm, instagrapi=instagrapi, memory=tmp_memory_dir, max_daily_posts=10)

    manual_caption = agent.post_manual("https://example.com/a.jpg", "manual caption")
    llm_caption = agent.post_llm("https://example.com/b.jpg", post_format="story")

    assert manual_caption == "manual caption"
    assert llm_caption == "Generated caption text"
    assert instagrapi.publish_media_post.call_count == 2


def test_comment_agent_manual_and_llm_split(tmp_memory_dir):
    from agents.comment_agent import CommentAgent

    llm = MagicMock()

    def side_effect(system, user):
        if "quality reviewer" in system:
            return '{"approved": true, "feedback": ""}'
        return "Generated comment"

    llm.chat.side_effect = side_effect

    instagrapi = MagicMock()
    instagrapi.get_post_by_url.return_value = (
        "media_55",
        "https://www.instagram.com/p/ABC123/",
        "caption #collegeapps",
    )
    instagrapi.post_comment.return_value = "comment_77"

    agent = CommentAgent(llm=llm, instagrapi=instagrapi, memory=tmp_memory_dir, max_daily_comments=10)

    manual_text = agent.comment_manual("https://www.instagram.com/p/ABC123/", "manual comment")

    instagrapi.get_post_by_url.return_value = (
        "media_56",
        "https://www.instagram.com/p/XYZ123/",
        "caption #commonapp",
    )
    llm_text = agent.comment_llm("https://www.instagram.com/p/XYZ123/")

    assert manual_text == "manual comment"
    assert llm_text == "Generated comment"


def test_dm_agent_manual_and_llm_split(tmp_memory_dir):
    from agents.dm_agent import DMAgent

    llm = MagicMock()
    llm.chat.return_value = "Generated DM"

    instagrapi = MagicMock()
    instagrapi.send_dm.return_value = "thread_1"

    agent = DMAgent(llm=llm, instagrapi=instagrapi, memory=tmp_memory_dir)

    manual = agent.dm_manual("alice", "manual dm")
    generated = agent.dm_llm("bob", materials="student asking for deadlines")

    assert manual == "manual dm"
    assert generated == "Generated DM"
    assert instagrapi.send_dm.call_count == 2


def test_orchestrator_run_job_manual(monkeypatch, tmp_path: Path, tmp_memory_dir):
    from agents import orchestrator as orch_mod

    class FakeLLMClient:
        def __init__(self, provider=None, model=None):
            self.provider = provider
            self.model = model

        def chat(self, system, user):
            return "CAPTION:\nGenerated"

    class FakeInstagrapiTool:
        def __init__(self, dry_run=True):
            self.dry_run = dry_run

        def publish_media_post(self, media_path_or_url, caption):
            return "media_1"

        def send_dm(self, username, text):
            return "thread_1"

        def get_post_by_url(self, url):
            return "m1", url, "caption #collegeapps"

        def post_comment(self, media_id, text):
            return "comment_1"

        def get_comments(self, media_id):
            return []

        def get_latest_post(self, username):
            return "m1", "https://www.instagram.com/p/ABC123/", "caption"

        def reply_to_comment(self, media_id, comment_id, text):
            return "reply_1"

    monkeypatch.setattr(orch_mod, "LLMClient", FakeLLMClient)
    monkeypatch.setattr(orch_mod, "InstagrapiTool", FakeInstagrapiTool)
    # Force orchestrator to use temp in-test memory, not memory/state.json.
    monkeypatch.setattr(orch_mod, "MemoryTool", lambda: tmp_memory_dir)

    job = {
        "mode": "manual",
        "post": {"enabled": True, "media": "https://example.com/a.jpg", "caption": "manual caption"},
        "dm": {
            "enabled": True,
            "recipients": [
                {"username": "target_1", "text": "hello 1"},
                {"username": "target_2", "text": "hello 2"},
            ],
        },
        "comment": {
            "enabled": True,
            "post_url": "https://www.instagram.com/p/ABC123/",
            "text": "manual comment",
        },
        "reply": {
            "enabled": True,
            "username": "owner",
            "post_url": "https://www.instagram.com/p/ABC123/",
            "manual_replies": [{"comment_id": "x", "text": "thanks"}],
        },
    }

    job_path = tmp_path / "job.yaml"
    job_path.write_text(yaml.safe_dump(job))

    orch = orch_mod.Orchestrator()
    summary = orch.run_job(str(job_path))

    assert summary["mode"] == "manual"
    assert summary["results"]["post"]["ok"] is True
    assert summary["results"]["dm"]["ok"] is True
    assert len(summary["results"]["dm"]["sent"]) == 2
    assert summary["results"]["comment"]["ok"] is True
    assert summary["results"]["reply"]["ok"] is True
