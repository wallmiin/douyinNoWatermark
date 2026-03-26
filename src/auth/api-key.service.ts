import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database = require('better-sqlite3');
import { mkdirSync } from 'fs';
import * as path from 'path';
import { ApiUser, UsageInfo, UserPlan } from './api-key.types';

@Injectable()
export class ApiKeyService {
  private readonly db: Database.Database;
  private readonly planLimits: Record<UserPlan, number> = {
    FREE: 20,
    PRO: 1000,
  };

  constructor(private readonly configService: ConfigService) {
    const dbPath = path.resolve(
      this.configService.get<string>('API_DB_PATH') || './data/api.sqlite',
    );
    mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.initialize();
  }

  consumeQuota(apiKey: string): UsageInfo {
    const normalized = apiKey.trim();
    const row = this.findUser(normalized);
    if (!row) {
      throw new UnauthorizedException('Invalid API key');
    }

    const today = this.today();
    if (row.usageDate !== today) {
      this.db
        .prepare('UPDATE users SET usage_count = 0, usage_date = ? WHERE id = ?')
        .run(today, row.id);
      row.usageCount = 0;
      row.usageDate = today;
    }

    const dailyLimit = this.planLimits[row.plan];
    if (row.usageCount >= dailyLimit) {
      throw new ForbiddenException(`Daily quota exceeded for plan ${row.plan}`);
    }

    const nextUsage = row.usageCount + 1;
    this.db.prepare('UPDATE users SET usage_count = ? WHERE id = ?').run(nextUsage, row.id);

    return {
      id: row.id,
      plan: row.plan,
      usage_count: nextUsage,
      daily_limit: dailyLimit,
      remaining: Math.max(dailyLimit - nextUsage, 0),
      usage_date: today,
    };
  }

  getUsage(apiKey: string): UsageInfo {
    const normalized = apiKey.trim();
    const row = this.findUser(normalized);
    if (!row) {
      throw new UnauthorizedException('Invalid API key');
    }

    const today = this.today();
    if (row.usageDate !== today) {
      this.db
        .prepare('UPDATE users SET usage_count = 0, usage_date = ? WHERE id = ?')
        .run(today, row.id);
      row.usageCount = 0;
      row.usageDate = today;
    }

    const dailyLimit = this.planLimits[row.plan];
    return {
      id: row.id,
      plan: row.plan,
      usage_count: row.usageCount,
      daily_limit: dailyLimit,
      remaining: Math.max(dailyLimit - row.usageCount, 0),
      usage_date: today,
    };
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        api_key TEXT NOT NULL UNIQUE,
        plan TEXT NOT NULL CHECK (plan IN ('FREE', 'PRO')),
        usage_count INTEGER NOT NULL DEFAULT 0,
        usage_date TEXT NOT NULL
      );
    `);

    const existing = this.db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
    if (existing.cnt === 0) {
      const today = this.today();
      this.db
        .prepare('INSERT INTO users (api_key, plan, usage_count, usage_date) VALUES (?, ?, 0, ?)')
        .run('demo-free-key', 'FREE', today);
      this.db
        .prepare('INSERT INTO users (api_key, plan, usage_count, usage_date) VALUES (?, ?, 0, ?)')
        .run('demo-pro-key', 'PRO', today);
    }
  }

  private findUser(apiKey: string): ApiUser | null {
    const row = this.db
      .prepare('SELECT id, api_key, plan, usage_count, usage_date FROM users WHERE api_key = ?')
      .get(apiKey) as
      | {
          id: number;
          api_key: string;
          plan: UserPlan;
          usage_count: number;
          usage_date: string;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      apiKey: row.api_key,
      plan: row.plan,
      usageCount: row.usage_count,
      usageDate: row.usage_date,
    };
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
