export interface AppConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  douyin: {
    cookie?: string;
    userAgent: string;
    timeoutMs: number;
  };
  downloadRoot: string;
  queueName: string;
}

export const appConfig = (): AppConfig => ({
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  douyin: {
    cookie: process.env.DOUYIN_COOKIE || undefined,
    userAgent:
      process.env.DOUYIN_USER_AGENT ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    timeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 25000),
  },
  downloadRoot: process.env.DOWNLOAD_ROOT || './downloads',
  queueName: process.env.QUEUE_NAME || 'douyin-video-download',
});
