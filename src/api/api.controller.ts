import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ScraperOrchestratorService } from '../scraper-orchestrator.service';
import { DownloadedFileItem } from '../types';

interface ApiResponseVideoItem {
  aweme_id: string;
  file_path: string;
  desc: string;
  created_at: string;
}

interface ApiResponse {
  total: number;
  videos: ApiResponseVideoItem[];
}

@Controller()
export class ApiController {
  constructor(private readonly scraperOrchestratorService: ScraperOrchestratorService) {}

  @Get('api')
  async fetchByProfile(@Query('profile') profile: string): Promise<ApiResponse> {
    const input = String(profile || '').trim();
    if (!input) {
      throw new BadRequestException('Missing required query parameter: profile');
    }

    const isNumericId = /^\d+$/.test(input);
    const isUrl = /^https?:\/\//i.test(input);
    if (!isNumericId && !isUrl) {
      throw new BadRequestException('profile must be a Douyin profile URL or numeric user_id');
    }

    const summary = await this.scraperOrchestratorService.run(input);
    return {
      total: summary.totalVideos,
      videos: summary.files.map((item: DownloadedFileItem) => ({
        aweme_id: item.aweme_id,
        file_path: item.file_path,
        desc: item.desc,
        created_at: item.created_at,
      })),
    };
  }
}
