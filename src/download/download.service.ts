import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import * as path from 'path';
import { QueueService } from '../queue/queue.service';
import { ScraperOrchestratorService } from '../scraper-orchestrator.service';
import { MetadataService } from '../storage/metadata.service';
import { DownloadedFileItem } from '../types';
import { isWatermarkedUrl } from '../utils';

export interface DownloadFileResponseItem {
  aweme_id: string;
  file_path: string;
  desc: string;
  created_at: string;
}

export interface DownloadApiResponse {
  total: number;
  downloaded: number;
  skipped: number;
  failed: number;
  videos: Array<{
    aweme_id: string;
    download_url: string;
    desc: string;
    created_at: number;
  }>;
  files: DownloadFileResponseItem[];
}

interface MetadataLookupResult {
  userId: string;
  filePath: string;
  sourceUrl: string;
  desc: string;
  createTime: number;
}

@Injectable()
export class DownloadService {
  constructor(
    private readonly scraperOrchestratorService: ScraperOrchestratorService,
    private readonly configService: ConfigService,
    private readonly metadataService: MetadataService,
    private readonly queueService: QueueService,
  ) {}

  async downloadAndCollect(urlOrUserId: string): Promise<DownloadApiResponse> {
    const summary = await this.scraperOrchestratorService.run(urlOrUserId);

    return {
      total: summary.totalVideos,
      downloaded: summary.downloaded,
      skipped: summary.skipped,
      failed: summary.failed,
      videos: summary.items.map((item) => ({
        aweme_id: item.aweme_id,
        download_url: item.playUrl,
        desc: item.desc,
        created_at: item.create_time,
      })),
      files: summary.files.map((item: DownloadedFileItem) => ({
        aweme_id: item.aweme_id,
        file_path: item.file_path,
        desc: item.desc,
        created_at: item.created_at,
      })),
    };
  }

  async listFilesByUserId(userId: string): Promise<DownloadFileResponseItem[]> {
    const userDir = path.resolve(this.getDownloadRoot(), userId);
    const metadataPath = path.join(userDir, 'metadata.json');
    const metadata = await this.metadataService.read(metadataPath);

    const items: DownloadFileResponseItem[] = [];
    for (const [awemeId, item] of Object.entries(metadata)) {
      if (!item.filePath || !existsSync(item.filePath)) {
        continue;
      }

      items.push({
        aweme_id: awemeId,
        file_path: this.toApiFilePath(item.filePath),
        desc: item.desc,
        created_at: new Date(item.createTime * 1000).toISOString(),
      });
    }

    return items;
  }

  async getOrDownloadFileByAwemeId(awemeId: string): Promise<string> {
    const existing = await this.findExistingFileByAwemeId(awemeId);
    if (existing) {
      return existing;
    }

    const metadataEntry = await this.findMetadataEntry(awemeId);
    if (!metadataEntry) {
      throw new Error(`Cannot find aweme_id=${awemeId} in local metadata.`);
    }

    if (!metadataEntry.sourceUrl || isWatermarkedUrl(metadataEntry.sourceUrl)) {
      throw new Error(`No valid play_addr source URL for aweme_id=${awemeId}.`);
    }

    const outputPath = metadataEntry.filePath;
    const job = await this.queueService.queue.add(
      `video:${awemeId}`,
      {
        userId: metadataEntry.userId,
        awemeId,
        desc: metadataEntry.desc,
        createTime: metadataEntry.createTime,
        playUrl: metadataEntry.sourceUrl,
        outputPath,
      },
      {
        jobId: awemeId,
      },
    );

    await job.waitUntilFinished(this.queueService.queueEvents);

    if (!existsSync(outputPath)) {
      throw new Error(`Download failed for aweme_id=${awemeId}.`);
    }

    return outputPath;
  }

  async getExistingFileByAwemeId(awemeId: string): Promise<string | null> {
    return this.findExistingFileByAwemeId(awemeId);
  }

  private async findExistingFileByAwemeId(awemeId: string): Promise<string | null> {
    const downloadRoot = this.getDownloadRoot();
    const userDirs = await this.readSubDirectories(downloadRoot);

    for (const userId of userDirs) {
      const filePath = path.join(downloadRoot, userId, `${awemeId}.mp4`);
      if (existsSync(filePath)) {
        return filePath;
      }
    }

    return null;
  }

  private async findMetadataEntry(awemeId: string): Promise<MetadataLookupResult | null> {
    const downloadRoot = this.getDownloadRoot();
    const userDirs = await this.readSubDirectories(downloadRoot);

    for (const userId of userDirs) {
      const metadataPath = path.join(downloadRoot, userId, 'metadata.json');
      const metadata = await this.metadataService.read(metadataPath);
      const item = metadata[awemeId];
      if (!item) {
        continue;
      }

      return {
        userId,
        filePath: item.filePath || path.join(downloadRoot, userId, `${awemeId}.mp4`),
        sourceUrl: item.sourceUrl,
        desc: item.desc,
        createTime: item.createTime,
      };
    }

    return null;
  }

  private async readSubDirectories(rootPath: string): Promise<string[]> {
    if (!existsSync(rootPath)) {
      return [];
    }

    const entries = await readdir(rootPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  }

  private getDownloadRoot(): string {
    return path.resolve(this.configService.get<string>('downloadRoot') || './downloads');
  }

  private toApiFilePath(absolutePath: string): string {
    const relative = path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');
    return `/${relative}`;
  }
}
