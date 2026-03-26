# Douyin No-Watermark Downloader Platform

Backend NestJS + frontend Next.js for fetching no-watermark Douyin video URLs from profile link or user_id.

## Core Rule (No Watermark)

- Use only `video.play_addr.url_list`
- Never use `video.download_addr`
- Any URL containing `playwm` is rejected

## Architecture

- Backend: NestJS + Axios + BullMQ + Redis
- Frontend: Next.js
- Optional anti-bot fallback: Puppeteer

## API

### `POST /download`

Request body:

```json
{
  "url": "https://www.douyin.com/user/... or 43256206108"
}
```

Response:

```json
{
  "videos": [
    {
      "aweme_id": "...",
      "download_url": "...",
      "desc": "...",
      "created_at": "...",
      "thumbnail": "..."
    }
  ]
}
```

### Backend features added

- Input auto-detect URL or numeric user_id
- Request logging middleware
- Global error handling filter
- Rate limit: 20 requests per minute per IP

## Setup

### 1. Backend

```bash
npm install
copy .env.example .env
npm run start:api
```

Backend default URL: `http://localhost:3000`

### 2. Frontend

```bash
npm run install:web
copy frontend/.env.example frontend/.env.local
npm run start:web
```

Frontend default URL: `http://localhost:3001`

If backend runs on a different host/port, update `NEXT_PUBLIC_API_BASE_URL` in `frontend/.env.local`.

## Existing CLI downloader (still available)

```bash
node app.js --profile="https://www.douyin.com/user/..."
```

or

```bash
node app.js --profile="43256206108"
```

## Notes

- Redis is required for queue-based downloading.
- For production stability, provide valid Douyin cookie in `.env`.
- Douyin web API may change; refresh cookie/user-agent when needed.
