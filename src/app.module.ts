import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './config';
import { DouyinApiService } from './douyin/douyin-api.service';
import { DownloadWorkerService } from './queue/download-worker.service';
import { QueueService } from './queue/queue.service';
import { MetadataService } from './storage/metadata.service';
import { ScraperOrchestratorService } from './scraper-orchestrator.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig],
    }),
  ],
  providers: [
    DouyinApiService,
    QueueService,
    DownloadWorkerService,
    MetadataService,
    ScraperOrchestratorService,
  ],
})
export class AppModule {}
