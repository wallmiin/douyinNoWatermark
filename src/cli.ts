import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import minimist = require('minimist');
import { AppModule } from './app.module';
import { ScraperOrchestratorService } from './scraper-orchestrator.service';

async function bootstrap(): Promise<void> {
  const argv = minimist(process.argv.slice(2));
  const profileInput = String(argv.profile || '').trim();

  if (!profileInput) {
    throw new Error(
      'Missing required argument: --profile="https://www.douyin.com/user/..." or --profile="43256206108"',
    );
  }

  const logger = new Logger('CLI');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const orchestrator = app.get(ScraperOrchestratorService);
    const summary = await orchestrator.run(profileInput);

    logger.log(`Total video: ${summary.totalVideos}`);
    logger.log(`Queued: ${summary.queued}`);
    logger.log(`Downloaded: ${summary.downloaded}`);
    logger.log(`Skipped: ${summary.skipped}`);
    logger.log(`Failed: ${summary.failed}`);
  } finally {
    await app.close();
  }
}

bootstrap().catch((err: Error) => {
  // eslint-disable-next-line no-console
  console.error(`[FATAL] ${err.message}`);
  process.exitCode = 1;
});
