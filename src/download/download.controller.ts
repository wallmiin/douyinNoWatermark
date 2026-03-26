import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { Request, Response } from 'express';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { UsageInfo } from '../auth/api-key.types';
import {
  DownloadApiResponse,
  DownloadFileResponseItem,
  DownloadService,
} from './download.service';

interface DownloadRequestBody {
  url?: string;
}

@Controller()
export class DownloadController {
  constructor(private readonly downloadService: DownloadService) {}

  @Get('me')
  @UseGuards(ApiKeyGuard)
  getMe(@Req() req: Request & { usageInfo?: UsageInfo }): { usage: UsageInfo | null } {
    return { usage: req.usageInfo || null };
  }

  @Get('files/:user_id')
  async getFiles(@Param('user_id') userId: string): Promise<{ files: DownloadFileResponseItem[] }> {
    const files = await this.downloadService.listFilesByUserId(userId);
    return { files };
  }

  @Post('download')
  @HttpCode(200)
  @UseGuards(ApiKeyGuard)
  async download(@Body() body: DownloadRequestBody): Promise<DownloadApiResponse> {
    const input = String(body?.url || '').trim();
    if (!input) {
      throw new BadRequestException('Missing required body field: url');
    }

    const isNumericId = /^\d+$/.test(input);
    const isUrl = /^https?:\/\//i.test(input);
    if (!isNumericId && !isUrl) {
      throw new BadRequestException('url must be a Douyin profile URL or numeric user_id');
    }

    return this.downloadService.downloadAndCollect(input);
  }

  @Get('download/:aweme_id')
  async streamFileByAwemeId(
    @Param('aweme_id') awemeId: string,
    @Res() res: Response,
  ): Promise<void> {
    const filePath = await this.downloadService.getExistingFileByAwemeId(awemeId);
    if (!filePath) {
      throw new NotFoundException({
        message: `File not found for aweme_id=${awemeId}`,
      });
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${awemeId}.mp4"`);
    createReadStream(filePath).pipe(res);
  }
}
