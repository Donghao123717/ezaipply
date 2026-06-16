# EZCollegeApp Instagram Agent (instagrapi only)

This agent now uses a single backend: `instagrapi`.

It supports five functions:
- Post content: `post_manual`, `post_llm`
- Send DMs: `dm_manual`, `dm_llm`
- Comment on posts: `comment_manual`, `comment_llm`
- Reply to comments: `reply_manual`, `reply_llm`
- Follow accounts: `follow_batch`

## Workflow

The runtime is centered on one orchestrator and one backend client.

1. CLI entry
- You run either a single action command or `run-job`.
- `main.py` builds `Orchestrator` and forwards your inputs.

2. Mode routing
- `manual` mode: uses your exact provided text.
- `llm` mode: generates text from materials/context via prompt templates.
- No fallback generation is used when LLM output is invalid.

3. Action execution
- Post: `PostAgent.post_manual` or `PostAgent.post_llm`
- DM: `DMAgent.dm_manual` or `DMAgent.dm_llm`
- Comment: `CommentAgent.comment_manual` or `CommentAgent.comment_llm`
- Reply: `ReplyAgent.reply_manual` or `ReplyAgent.reply_llm`
- Follow: `FollowAgent.follow_batch`

4. Backend call
- All actions are executed by `InstagrapiTool` methods:
	- `publish_media_post`
	- `send_dm`
	- `post_comment`
	- `reply_to_comment`
	- `follow_user`

5. Memory and logging
- `MemoryTool` tracks daily counters and dedup IDs.
- Every completed action is appended to `memory/comment_log.json`.

6. Dry-run behavior
- With `DRY_RUN=true`, write calls print the action and return dry-run IDs.
- No live Instagram write occurs in dry-run mode.

## Notes

- `manual` mode: uses exact content you provide.
- `llm` mode: generates content from your materials/context.
- There is no fallback reply generator path.
- `DRY_RUN=true` prints actions without posting.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env
```

Fill `.env`:

```dotenv
OPENAI_API_KEY=...
GEMINI_API_KEY=...
LLM_PROVIDER=openai
DRY_RUN=true
INSTAGRAPI_USERNAME=your_ig_username
INSTAGRAPI_PASSWORD=your_ig_password
```

## CLI

Run one job file:

```bash
python main.py run-job --job-file job_schema.example.yaml --mode manual
```

Individual commands:

```bash
python main.py post-manual --media ./assets/post.jpg --caption "Final caption"
python main.py post-llm --media ./assets/post.jpg --format tips --context "financial aid"

python main.py dm-manual --username target --text "Hi there"
python main.py dm-llm --username target --materials "Student asked about deadlines"

python main.py comment-manual --post-url https://www.instagram.com/p/ABC123/ --text "Great post"
python main.py comment-llm --post-url https://www.instagram.com/p/ABC123/ --context "peer tone"

python main.py reply-manual --username target --post-url https://www.instagram.com/p/ABC123/ --replies-file replies.yaml
python main.py reply-llm --username target --post-url https://www.instagram.com/p/ABC123/

python main.py follow --accounts-file accounts_to_follow.yaml
```

## Follow Accounts

### Accounts file format

Create a YAML file listing the usernames you want to follow:

```yaml
# accounts_to_follow.yaml
accounts:
  - username_one
  - username_two
  - username_three
```

The agent tracks every account it has followed in `memory/state.json`. Re-running will never follow the same account twice — already-followed names are automatically skipped.

### CLI command

```bash
python main.py follow --accounts-file accounts_to_follow.yaml
```

Each run picks a random number of accounts between `min_per_day` and `max_per_day` (default 20–40) and follows them with a random delay between each action. The agent stops for the day once the daily max is reached.

### Via job file

You can include follows in a `run-job` job file in two ways:

**Inline list:**

```yaml
follow:
  enabled: true
  accounts:
    - username_one
    - username_two
```

**External file (useful for large lists):**

```yaml
follow:
  enabled: true
  accounts_file: ./accounts_to_follow.yaml
```

`accounts_file` takes priority if both are set.

### Rate limit and delay settings (`config/settings.yaml`)

```yaml
rate_limits:
  follow:
    min_per_day: 20           # minimum follows per run
    max_per_day: 40           # hard daily cap
    delay_seconds_min: 15     # min wait between follows
    delay_seconds_max: 45     # max wait between follows
    # active_hours: [8, 22]   # optional: only run between 8am–10pm local time
```

Uncomment `active_hours` to restrict follow activity to daylight hours. If the agent is triggered outside that window it logs a message and skips the run without error.

## Job Schema

Use `job_schema.example.yaml` as template.

## Where To Configure Safety

You can tune anti-ban safety behavior in two places.

1. Environment flags in `.env`
- `DRY_RUN=true` keeps all write actions as no-op previews.
- Keep this true while validating prompts/content.

2. Rate limits in `config/settings.yaml`
- `rate_limits.max_posts_per_day`
- `rate_limits.max_comments_per_day`
- `rate_limits.max_replies_per_run`
- `rate_limits.follow.min_per_day` / `max_per_day`
- `rate_limits.follow.delay_seconds_min` / `delay_seconds_max`
- `rate_limits.follow.active_hours` (optional)

Recommended rollout:
1. Start with `DRY_RUN=true` and review outputs.
2. Lower limits before first live run (for example 1-2 posts/comments/replies).
3. Increase limits gradually only after stable behavior.

## Where To Edit LLM Prompts

Edit prompt templates and shared context here:

1. Action prompts
- `prompts/caption_prompt.yaml` for post generation
- `prompts/dm_prompt.yaml` for DM generation
- `prompts/comment_prompt.yaml` for comment generation
- `prompts/reply_prompt.yaml` for reply generation

2. Shared context
- `prompts/product_context.md` for product facts and positioning
- `prompts/brand_voice.md` for tone/style rules
- `prompts/hashtag_guide.md` for hashtag/community guidance

Prompt variables are rendered by `tools/prompt_loader.py` and consumed by agents in `agents/`.

## Where To Provide LLM Materials

You can provide campaign-specific materials in CLI args or job YAML.

1. CLI arguments
- Post LLM: `main.py post-llm --context "..."`
- DM LLM: `main.py dm-llm --materials "..." --context "..."`
- Comment LLM: `main.py comment-llm --context "..."`
- Reply LLM: `main.py reply-llm --context "..."`

2. Job file fields (`job_schema.example.yaml`)
- Post LLM: `post.extra_context`
- DM LLM:
	- global: `dm.materials` and `dm.extra_context`
	- per-recipient override: `dm.recipients[].materials` and `dm.recipients[].extra_context`
- Comment LLM: `comment.extra_context`
- Reply LLM: `reply.extra_context`

Use prompts for stable rules and voice, and put run-specific campaign materials in CLI/job fields.

## Testing

Run all tests:

```bash
python -m pytest -q
```

Run a single file:

```bash
python -m pytest -q tests/test_dry_run.py
python -m pytest -q tests/test_fixtures.py
python -m pytest -q -s tests/test_cli.py
```

Run content preview test (prints manual + LLM output for all 4 functions, no Instagram posting):

```bash
RUN_LLM_PREVIEW_TEST=1 python -m pytest -q -s tests/test_content_preview.py
```

### What is covered

1. `tests/test_dry_run.py`
- Instagrapi dry-run behavior for post, DM, comment, reply
- Reply agent no-fallback behavior (empty generated reply raises)
- Manual reply input validation

2. `tests/test_fixtures.py`
- Manual/LLM split behavior for post, DM, comment agents
- Orchestrator `run_job` manual path summary and action routing

3. `tests/test_cli.py`
- CLI command-handler smoke test with printed output
- Runs without live Instagram calls by mocking the orchestrator

4. `tests/test_content_preview.py`
- Prints generated content for post, dm, comment, reply
- Covers both manual and llm modes in one run
- Uses a fake backend, so nothing is posted to Instagram

5. `tests/conftest.py`
- Shared fixtures for temporary memory state and mocking support

### Expected result

Current baseline is all tests passing.
Example:

```text
10 passed
```

## Safety

This project uses an unofficial Instagram API client. Account restrictions are still possible.
No implementation can guarantee zero ban risk.

### Anti-ban mechanism in this agent

1. Dry-run first
- `DRY_RUN=true` prevents live write calls.

2. Hard daily caps
- `max_posts_per_day`
- `max_comments_per_day`
- `max_replies_per_run`
- `follow.max_per_day`

3. Dedup protection
- Comment dedup: `commented_media_ids`
- Reply dedup: `replied_comment_ids`
- Follow dedup: `followed_usernames`
- Prevents repeated actions on the same target.

4. Follow-specific anti-ban
- Randomized follow count per run (between `min_per_day` and `max_per_day`) so the volume is never a fixed fingerprint.
- Random inter-follow delay (`delay_seconds_min`–`delay_seconds_max`) to mimic human pacing.
- Optional `active_hours` guard to restrict follows to daylight hours only.
- Session caching (`memory/ig_session.json`) reuses the authenticated session across runs, avoiding repeated login challenges that trigger account flags.

5. Fail-fast policy
- No fallback message generation for replies.
- If mode input is missing/invalid, action raises an error instead of sending risky text.

6. Explicit manual mode
- Manual mode lets you fully control outgoing content before any action is sent.

### Recommended operating policy to reduce risk

1. Start in dry-run for 3-7 days.
2. Start live with low volume only (small daily limits).
3. Avoid repeated templates across many targets.
4. Prefer reply/comment before DM-heavy campaigns.
5. Stop immediately on checkpoint/challenge signals.
6. Keep account profile/activity human-like outside automation windows.
