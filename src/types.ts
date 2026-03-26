export interface ScrapeVideoItem {
  awemeId: string;
  desc: string;
  createTime: number;
  playUrls: string[];
}

export interface DownloadJobPayload {
  userId: string;
  awemeId: string;
  desc: string;
  createTime: number;
  playUrl: string;
  outputPath: string;
}

export interface MetadataItem {
  awemeId: string;
  desc: string;
  createTime: number;
  filePath: string;
  sourceUrl: string;
  status: 'downloaded' | 'failed' | 'skipped';
  error?: string;
  updatedAt: string;
}

export interface RunSummary {
  totalVideos: number;
  queued: number;
  downloaded: number;
  skipped: number;
  failed: number;
}
