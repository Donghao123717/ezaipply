from __future__ import annotations

import argparse
from pathlib import Path

import yaml


class _FakeOrchestrator:
    def run_job(self, job_path: str, mode_override: str = ""):
        return {
            "mode": mode_override or "manual",
            "results": {
                "post": {"ok": True, "caption": "fake caption"},
                "dm": {"ok": True, "sent": [{"username": "target", "text": "hello"}]},
            },
        }

    def post_manual(self, media_path_or_url: str, caption: str):
        return caption

    def post_llm(self, media_path_or_url: str, post_format: str = "story", extra_context: str = ""):
        return f"generated-{post_format}"

    def dm_manual(self, username: str, text: str):
        return text

    def dm_llm(self, username: str, materials: str, extra_context: str = ""):
        return f"dm-to-{username}"

    def comment_manual(self, post_url: str, text: str):
        return text

    def comment_llm(self, post_url: str, extra_context: str = ""):
        return "generated-comment"

    def reply_manual(self, username: str, manual_replies: dict[str, str], post_url: str = ""):
        return len(manual_replies)

    def reply_llm(self, username: str, post_url: str = "", extra_context: str = ""):
        return 2


def test_cli_command_handlers_print_output(monkeypatch, capsys, tmp_path: Path):
    import main as cli

    fake = _FakeOrchestrator()
    monkeypatch.setattr(cli, "_orch", lambda: fake)

    job_path = tmp_path / "job.yaml"
    job_path.write_text("mode: manual\n")

    replies_path = tmp_path / "replies.yaml"
    replies_path.write_text(
        yaml.safe_dump(
            {
                "manual_replies": [
                    {"comment_id": "c1", "text": "thanks!"},
                    {"comment_id": "c2", "text": "good point"},
                ]
            }
        )
    )

    cli.cmd_run_job(argparse.Namespace(job_file=str(job_path), mode="manual"))
    cli.cmd_post_manual(argparse.Namespace(media="a.jpg", caption="manual caption"))
    cli.cmd_post_llm(argparse.Namespace(media="b.jpg", format="tips", context="x"))
    cli.cmd_dm_manual(argparse.Namespace(username="alice", text="hello alice"))
    cli.cmd_dm_llm(argparse.Namespace(username="bob", materials="m", context="c"))
    cli.cmd_comment_manual(argparse.Namespace(post_url="https://ig/p/1/", text="nice"))
    cli.cmd_comment_llm(argparse.Namespace(post_url="https://ig/p/2/", context="peer"))
    cli.cmd_reply_manual(
        argparse.Namespace(
            username="owner",
            post_url="https://ig/p/3/",
            replies_file=str(replies_path),
        )
    )
    cli.cmd_reply_llm(argparse.Namespace(username="owner", post_url="https://ig/p/3/", context=""))

    out = capsys.readouterr().out

    print("CLI smoke output:\n")
    print(out)

    assert "Job complete" in out
    assert "Posted with caption" in out
    assert "Posted with generated caption" in out
    assert "DM sent to @alice" in out
    assert "Generated DM sent to @bob" in out
    assert "Comment posted" in out
    assert "Generated comment posted" in out
    assert "Done. Replied to 2 comment(s)." in out
