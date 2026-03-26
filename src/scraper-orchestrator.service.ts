import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import * as path from 'path';
import { DouyinApiService } from './douyin/douyin-api.service';
import { QueueService } from './queue/queue.service';
import { MetadataService } from './storage/metadata.service';
import { DownloadedFileItem, MetadataItem, RunSummary, RunSummaryItem } from './types';

interface DownloadWorkerResult {
  aweme_id: string;
  file_path: string;
  desc: string;
  created_at: string;
}

interface QueuedJobContext {
  job: Awaited<ReturnType<QueueService['queue']['add']>>;
  awemeId: string;
  desc: string;
  createTime: number;
  outputPath: string;
  selectedUrl: string;
}

@Injectable()
export class ScraperOrchestratorService {
  private readonly logger = new Logger(ScraperOrchestratorService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly douyinApiService: DouyinApiService,
    private readonly queueService: QueueService,
    private readonly metadataService: MetadataService,
  ) {}

  async run(profileUrl: string, options?: { force?: boolean }): Promise<RunSummary> {
    const force = Boolean(options?.force);
    const downloadRoot = this.configService.get<string>('downloadRoot') || './downloads';
    const secUserId = await this.douyinApiService.resolveUserId(profileUrl);

    this.logger.log(`Resolved profile to sec_user_id=${secUserId}`);

    const videos = await this.douyinApiService.fetchAllVideos(secUserId);
    if (videos.length === 0) {
      throw new Error('Fetch failed');
    }

    if (videos.length > 0) {
      this.logger.log(
        `Debug first video playUrls: ${JSON.stringify(videos[0].playUrls)}`,
      );
    }

    const userDir = path.resolve(downloadRoot, secUserId);
    const metadataPath = path.join(userDir, 'metadata.json');

    await mkdir(userDir, { recursive: true });

    const metadata = await this.metadataService.read(metadataPath);
    let queued = 0;
    let skipped = 0;
    let failed = 0;
    let downloaded = 0;
    const files: DownloadedFileItem[] = [];
    const items: RunSummaryItem[] = [];
    const queuedJobs: QueuedJobContext[] = [];

    await this.queueService.queue.drain(true);
    await this.queueService.queue.clean(0, 1000, 'failed');
    await this.queueService.queue.clean(0, 1000, 'completed');

    for (const video of videos) {
      const outputPath = path.join(userDir, `${video.awemeId}.mp4`);
      const selectedUrl = this.douyinApiService.pickNoWatermarkUrl(video.playUrls);
      this.logger.log(
        `Selected play URL before download aweme_id=${video.awemeId}: ${selectedUrl || 'N/A'}`,
      );

      if (!selectedUrl) {
        failed += 1;
        metadata[video.awemeId] = this.buildMetadata(
          video.awemeId,
          video.desc,
          video.createTime,
          outputPath,
          '',
          'failed',
          'No valid no-watermark URL in play_addr.url_list',
        );
        continue;
      }

      items.push({
        aweme_id: video.awemeId,
        desc: video.desc,
        create_time: video.createTime,
        playUrl: selectedUrl,
      });

      if (!force && existsSync(outputPath)) {
        skipped += 1;
        files.push({
          aweme_id: video.awemeId,
          file_path: this.toApiFilePath(outputPath),
          desc: video.desc,
          created_at: new Date(video.createTime * 1000).toISOString(),
        });
        metadata[video.awemeId] = this.buildMetadata(
          video.awemeId,
          video.desc,
          video.createTime,
          outputPath,
          selectedUrl,
          'skipped',
        );
        continue;
      }

      const job = await this.queueService.queue.add(
        `video:${video.awemeId}`,
        {
          userId: secUserId,
          awemeId: video.awemeId,
          desc: video.desc,
          createTime: video.createTime,
          playUrl: selectedUrl,
          outputPath,
        },
        {
          jobId: video.awemeId,
        },
      );

      queued += 1;
      queuedJobs.push({
        job,
        awemeId: video.awemeId,
        desc: video.desc,
        createTime: video.createTime,
        outputPath,
        selectedUrl,
      });
    }

    const results = await Promise.allSettled(
      queuedJobs.map((item) =>
        item.job.waitUntilFinished(this.queueService.queueEvents) as Promise<DownloadWorkerResult>,
      ),
    );

    results.forEach((result, index) => {
      const context = queuedJobs[index];
      if (!context) {
        return;
      }

      if (result.status === 'fulfilled') {
        downloaded += 1;
        files.push(result.value);
        metadata[context.awemeId] = this.buildMetadata(
          context.awemeId,
          context.desc,
          context.createTime,
          context.outputPath,
          context.selectedUrl,
          'downloaded',
        );
        return;
      }

      failed += 1;
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      metadata[context.awemeId] = this.buildMetadata(
        context.awemeId,
        context.desc,
        context.createTime,
        context.outputPath,
        context.selectedUrl,
        'failed',
        reason,
      );
    });

    await this.metadataService.write(metadataPath, metadata);

    const summary: RunSummary = {
      totalVideos: videos.length,
      queued,
      downloaded,
      skipped,
      failed,
      files,
      items,
    };

    return summary;
  }

  private toApiFilePath(absolutePath: string): string {
    const relative = path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');
    return `/${relative}`;
  }

  private buildMetadata(
    awemeId: string,
    desc: string,
    createTime: number,
    filePath: string,
    sourceUrl: string,
    status: MetadataItem['status'],
    error?: string,
  ): MetadataItem {
    return {
      awemeId,
      desc,
      createTime,
      filePath,
      sourceUrl,
      status,
      error,
      updatedAt: new Date().toISOString(),
    };
  }
}
