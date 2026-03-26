# Douyin Profile Video Downloader (No Watermark)

Production-oriented NestJS + BullMQ tool to download **all videos from a Douyin profile** using `video.play_addr.url_list` only.

## Key Rules Enforced

- Uses `video.play_addr.url_list` as source URL.
- Does **not** use `video.download_addr`.
- Rejects candidates that look like watermark links (`playwm`, `watermark`, `logo`, etc.).
- Stores files locally at `downloads/{sec_user_id}/{aweme_id}.mp4`.

## Stack

- Node.js + NestJS (application context)
- Axios (HTTP)
- BullMQ + Redis (queue/retry/concurrency)
- Optional Puppeteer dependency installed for future anti-bot fallback

## Setup

1. Install Redis and ensure it is running.
2. Install dependencies:

```bash
npm install
```

3. Create env file:

```bash
copy .env.example .env
```

4. Put your Douyin cookie into `DOUYIN_COOKIE` (highly recommended).

## Run

```bash
node app.js --profile="https://www.douyin.com/user/xxxxx"
```

## Output

CLI prints:

- Total video
- Queued
- Downloaded
- Skipped
- Failed

## Resume / Skip / Metadata

- Existing files are skipped automatically.
- `metadata.json` is written to `downloads/{sec_user_id}/metadata.json`.
- You can rerun the same profile safely; tool resumes from local files.

## Notes for Stability

- Random delay 1-3s is applied between paginated API calls.
- Browser-like headers are sent (`User-Agent`, `Referer`, optional `Cookie`).
- Queue retry policy: 3 attempts with exponential backoff.

## Important

Douyin internal web APIs may change signatures or anti-bot checks over time. If API starts rejecting requests, refresh cookie and user-agent first.
