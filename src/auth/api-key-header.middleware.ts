import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class ApiKeyHeaderMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const apiKey = String(req.headers['x-api-key'] || '').trim();
    if (!apiKey) {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    next();
  }
}
