import { Injectable } from '@nestjs/common';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { MetadataItem } from '../types';

@Injectable()
export class MetadataService {
  async read(metadataPath: string): Promise<Record<string, MetadataItem>> {
    if (!existsSync(metadataPath)) {
      return {};
    }

    const raw = await readFile(metadataPath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, MetadataItem>;
    return parsed || {};
  }

  async write(metadataPath: string, data: Record<string, MetadataItem>): Promise<void> {
    await writeFile(metadataPath, JSON.stringify(data, null, 2), 'utf8');
  }
}
