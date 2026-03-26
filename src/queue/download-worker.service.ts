import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Job, Worker } from 'bullmq';
import { createWriteStream } from 'fs';
import { mkdir, rename } from 'fs/promises';
import * as path from 'path';
import { DownloadJobPayload } from '../types';
import { isWatermarkedUrl } from '../utils';
import { QueueService } from './queue.service';

interface DownloadWorkerResult {
  aweme_id: string;
  file_path: string;
  desc: string;
  created_at: string;
}

@Injectable()
export class DownloadWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(DownloadWorkerService.name);
  private readonly worker: Worker<DownloadJobPayload>;

  constructor(
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
  ) {
    const queueName =
      this.configService.get<string>('queueName') || 'douyin-video-download';

    this.worker = new Worker<DownloadJobPayload>(
      queueName,
      async (job) => this.processJob(job),
      {
        connection: this.queueService.connection,
        concurrency: 5,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Completed job ${job.id} (aweme_id=${job.data.awemeId})`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Failed job ${job?.id} (aweme_id=${job?.data.awemeId}): ${err.message}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
  }

  private async processJob(job: Job<DownloadJobPayload>): Promise<DownloadWorkerResult> {
    const { playUrl, outputPath, awemeId, desc, createTime } = job.data;
    this.logger.log(`Downloading aweme_id=${awemeId} from URL: ${playUrl}`);
    // eslint-disable-next-line no-console
    console.log('Downloading:', playUrl);

    if (isWatermarkedUrl(playUrl)) {
      throw new Error(`Rejected watermark URL for aweme_id=${awemeId}`);
    }

    await mkdir(path.dirname(outputPath), { recursive: true });

    const tempPath = `${outputPath}.part`;
    const response = await axios.get(playUrl, {
      responseType: 'stream',
      timeout: 60000,
      headers: {
        Referer: 'https://www.douyin.com/',
        'User-Agent': this.configService.get<string>('douyin.userAgent') ||
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        Cookie: this.configService.get<string>('douyin.cookie') || '',
      },
      maxRedirects: 5,
    });

    await new Promise<void>((resolve, reject) => {
      const writer = createWriteStream(tempPath);
      response.data.pipe(writer);
      writer.on('finish', () => resolve());
      writer.on('error', (err) => reject(err));
    });

    await rename(tempPath, outputPath);
    // eslint-disable-next-line no-console
    console.log('Saved:', outputPath);

    const relativePath = path.relative(process.cwd(), outputPath).replace(/\\/g, '/');
    return {
      aweme_id: awemeId,
      file_path: `/${relativePath}`,
      desc,
      created_at: new Date(createTime * 1000).toISOString(),
    };
  }
}
