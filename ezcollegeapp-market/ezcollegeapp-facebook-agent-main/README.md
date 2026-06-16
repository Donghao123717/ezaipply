# EZCollegeApp Facebook Agent (Playwright)

Automates Facebook marketing actions using a real Chrome browser controlled by Playwright.
All actions mimic human browser behavior — no private API calls.

Supports five functions:
- Post to Facebook feed: `post_manual`, `post_llm`
- Send Messenger DMs: `dm_manual`, `dm_llm`
- Comment on posts: `comment_manual`, `comment_llm`
- Reply to comments: `reply_manual`, `reply_llm`
- Follow pages/profiles: `follow_batch`

---

## How it works

On the **first run**, a Chrome browser window opens and you log in to Facebook manually
(supports 2FA, any login method). After you see the home feed, press Enter in the terminal.

The session is saved to `memory/fb_browser_data/`. **All subsequent runs reuse the saved
session** — no repeated logins.

---

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
playwright install chromium
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill `.env`:

```dotenv
OPENAI_API_KEY=sk-...
LLM_PROVIDER=openai
DRY_RUN=true
```

No Facebook credentials needed in `.env` — login is done manually in the browser.

---

## CLI

### Single actions

```bash
python main.py post-manual --media ./assets/post.jpg --caption "My caption here"
python main.py post-llm --media ./assets/post.jpg --format tips --context "financial aid"

python main.py dm-manual --target someprofile --text "Hi there"
python main.py dm-llm --target someprofile --materials "Student asked about deadlines"

python main.py comment-manual --post-url https://www.facebook.com/permalink/123/ --text "Great post"
python main.py comment-llm --post-url https://www.facebook.com/permalink/123/ --context "peer tone"

python main.py reply-manual --post-url https://www.facebook.com/permalink/123/ --replies-file replies.yaml
python main.py reply-llm --post-url https://www.facebook.com/permalink/123/

python main.py follow --accounts-file accounts_to_follow.yaml
```

### Run a job file

```bash
python main.py run-job --job-file job_schema.example.yaml --mode manual
python main.py run-job --job-file job_schema.example.yaml --mode llm
```

---

## Follow Accounts

### Accounts file format

```yaml
# accounts_to_follow.yaml
accounts:
  - commonapp
  - collegeboard
  - somepageschlug
```

Use the Facebook page slug (the part after `facebook.com/`). No `@`, no full URLs.

```bash
python main.py follow --accounts-file accounts_to_follow.yaml
```

Each run picks a random count between `min_per_day` and `max_per_day` (default 20–40),
follows them with random delays, and stops when the daily cap is reached.
Already-followed accounts are automatically skipped across runs.

---

## Rate limits and delays (`config/settings.yaml`)

```yaml
rate_limits:
  max_posts_per_day: 2
  max_comments_per_day: 15
  max_replies_per_run: 10
  follow:
    min_per_day: 20
    max_per_day: 40
    delay_seconds_min: 20
    delay_seconds_max: 90
    # active_hours: [8, 22]   # optional: restrict to 8am–10pm local time
```

Facebook requires longer delays than Instagram. The default range (20–90s) is conservative.

---

## Dry-run behavior

With `DRY_RUN=true` (the default), all write operations print what they would do but
**do not click anything**. The browser still opens so you can visually verify navigation.
Memory state is not updated in dry-run mode.

Set `DRY_RUN=false` in `.env` for live execution.

---

## Job Schema

Use `job_schema.example.yaml` as a template. Fields:

- `mode`: `manual` or `llm`
- `post.enabled` / `dm.enabled` / `comment.enabled` / `reply.enabled` / `follow.enabled`
- Each section has both `manual` and `llm` mode fields — the unused one is ignored

---

## Safety

This project uses Playwright to automate a real browser. Facebook's anti-bot detection
is more aggressive than Instagram's. Account restrictions are still possible.

### Anti-ban mechanisms

1. **Real browser** — traffic is identical to a human using Chrome; no API fingerprints
2. **Session reuse** — logs in once and saves the session to avoid repeated login events
3. **Random delays** — lognormal-distributed delays between actions (not fixed intervals)
4. **Daily caps** — hard limits on posts, comments, and follows per day
5. **Deduplication** — never acts on the same post/comment/page twice
6. **Block detection** — detects "temporarily blocked" and similar signals; stops immediately
7. **Active-hours guard** — optional config to restrict follows to daytime hours
8. **Dry-run first** — `DRY_RUN=true` lets you verify all content before going live

### Recommended rollout

1. Start with `DRY_RUN=true` and review all outputs in the terminal
2. Do the first live run with very low limits (e.g. 1 post, 3 follows)
3. Gradually increase volume over 1–2 weeks
4. Stop immediately on any block/checkpoint signal
5. Wait at least 24 hours before resuming after a block

---

## Memory and logs

- `memory/state.json` — daily counters, dedup IDs (not committed to git)
- `memory/comment_log.json` — full action history
- `memory/fb_browser_data/` — saved browser session (not committed to git)

---

## Where to edit prompts

- `prompts/caption_prompt.yaml` — post generation
- `prompts/dm_prompt.yaml` — DM generation
- `prompts/comment_prompt.yaml` — comment generation
- `prompts/reply_prompt.yaml` — reply generation
- `prompts/product_context.md` — product facts
- `prompts/brand_voice.md` — tone and style rules

---

## Testing

### Unit and integration tests (no browser, no API keys)

```bash
python3 -m pytest tests/ --ignore=tests/test_live_browser.py -v
```

Covers: `MemoryTool`, all five agents, dry-run `PlaywrightTool`, and full `Orchestrator` integration.

### Live browser tests (real Facebook, real browser)

Set `LIVE_BROWSER_TEST=1` in `.env` and fill in the relevant `TEST_FB_*` vars, then run each action individually:

```bash
# Publish a post
python3 -m pytest tests/test_live_browser.py::TestLiveBrowserWrites::test_publish_post -v -s --log-cli-level=INFO

# Comment under a post
python3 -m pytest tests/test_live_browser.py::TestLiveBrowserWrites::test_post_comment -v -s --log-cli-level=INFO

# Reply to a comment
python3 -m pytest tests/test_live_browser.py::TestLiveBrowserWrites::test_reply_to_comment -v -s --log-cli-level=INFO

# Follow a page or add friend to a personal account
python3 -m pytest tests/test_live_browser.py::TestLiveBrowserWrites::test_follow_account -v -s --log-cli-level=INFO
```

On first run a browser window opens — log in to Facebook manually, then press Enter in the terminal.
The session is saved and reused on all future runs.

**Required `.env` vars per test:**

| Test | Required vars |
|------|--------------|
| publish post | `TEST_FB_POST_CAPTION`, `TEST_FB_POST_MEDIA` (optional) |
| post comment | `TEST_FB_COMMENT_URL`, `TEST_FB_COMMENT_TEXT` |
| reply to comment | `TEST_FB_REPLY_URL`, `TEST_FB_REPLY_TEXT`, `TEST_FB_REPLY_COMMENT_INDEX` |
| follow / add friend | `TEST_FB_FOLLOW_TARGET` (slug after `facebook.com/`) |

---

## Real Case Usage

### 1. Customise your brand

Edit these two files before generating any content:

- `prompts/product_context.md` — what your product is, its features, and target users
- `prompts/brand_voice.md` — tone, persona, what to do and not do in generated content

### 2. Create a job YAML

Copy `job_schema.example.yaml` and enable the actions you want:

```yaml
mode: llm   # llm = AI generates content; manual = you write it

post:
  enabled: true
  media: ./assets/photo.jpg
  post_format: story            # story | tips | question
  extra_context: "Talk about reducing college application stress"

comment:
  enabled: true
  post_url: https://www.facebook.com/permalink/123456789/
  extra_context: "Keep tone peer-like, student perspective"

follow:
  enabled: true
  accounts:
    - commonapp
    - collegeboard
    - nacac
```

### 3. Dry-run first

Always verify AI-generated content before posting live:

```bash
DRY_RUN=true python3 main.py run-job --job-file my_job.yaml --mode llm
```

The terminal prints exactly what would be posted — no browser actions taken.

### 4. Go live

Once the content looks right, flip the flag:

```bash
DRY_RUN=false python3 main.py run-job --job-file my_job.yaml --mode llm
```

### 5. Typical daily workflow

```bash
# Morning: post to feed + comment on 5 relevant posts
python3 main.py post-llm --media ./assets/today.jpg --format story --context "finals week stress"
python3 main.py comment-llm --post-url https://www.facebook.com/permalink/111/ --context "college list anxiety"

# Follow a batch of target accounts (respects daily cap automatically)
python3 main.py follow --accounts-file accounts_to_follow.yaml

# Check what was done today
cat memory/comment_log.json
```

### 6. Scheduling (optional)

To run a job automatically every day, add a cron entry:

```bash
# Run job at 9am every day
0 9 * * * cd /path/to/facebook_agent && DRY_RUN=false python3 main.py run-job --job-file my_job.yaml
```

---

## Note on selectors

Facebook's HTML uses generated class names that change with every deployment.
`PlaywrightTool` uses `aria-label` and `role` attributes which are more stable,
but Facebook UI updates can still break selectors. If an action stops working,
inspect the element in DevTools and update the relevant selector in
`tools/playwright_tool.py`.
