import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiController } from './api/api.controller';
import { ApiKeyGuard } from './auth/api-key.guard';
import { ApiKeyHeaderMiddleware } from './auth/api-key-header.middleware';
import { ApiKeyService } from './auth/api-key.service';
import { appConfig } from './config';
import { DownloadController } from './download/download.controller';
import { DownloadService } from './download/download.service';
import { DouyinApiService } from './douyin/douyin-api.service';
import { RequestLoggingMiddleware } from './middleware/request-logging.middleware';
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
  controllers: [ApiController, DownloadController],
  providers: [
    ApiKeyService,
    ApiKeyGuard,
    DouyinApiService,
    DownloadService,
    QueueService,
    DownloadWorkerService,
    MetadataService,
    ScraperOrchestratorService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
    consumer.apply(ApiKeyHeaderMiddleware).forRoutes(
      { path: 'download', method: RequestMethod.POST },
      { path: 'me', method: RequestMethod.GET },
    );
  }
}
