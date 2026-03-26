import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ApiKeyService } from './api-key.service';
import { UsageInfo } from './api-key.types';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { usageInfo?: UsageInfo }>();
    const apiKey = String(req.headers['x-api-key'] || '').trim();

    if (!apiKey) {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    const usageInfo = this.apiKeyService.consumeQuota(apiKey);
    req.usageInfo = usageInfo;
    return true;
  }
}
