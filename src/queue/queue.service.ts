import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { DownloadJobPayload } from '../types';

@Injectable()
export class QueueService implements OnModuleDestroy {
  readonly connection: IORedis;
  readonly queue: Queue<DownloadJobPayload>;
  readonly queueEvents: QueueEvents;

  constructor(private readonly configService: ConfigService) {
    const redisHost = this.configService.get<string>('redis.host') || '127.0.0.1';
    const redisPort = Number(this.configService.get<number>('redis.port') || 6379);
    const redisPassword = this.configService.get<string>('redis.password') || undefined;
    const queueName =
      this.configService.get<string>('queueName') || 'douyin-video-download';

    this.connection = new IORedis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    this.queue = new Queue<DownloadJobPayload>(queueName, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: 500,
        removeOnFail: 1000,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.queueEvents = new QueueEvents(queueName, {
      connection: this.connection,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queueEvents.close();
    await this.queue.close();
    await this.connection.quit();
  }
}
