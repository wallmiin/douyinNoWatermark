import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import puppeteer from 'puppeteer';
import { AppConfig } from '../config';
import { ScrapeVideoItem } from '../types';
import { isWatermarkedUrl, randomDelay } from '../utils';

export const isUserId = (input: string): boolean => /^\d+$/.test(input.trim());

const isHttpUrl = (input: string): boolean => /^https?:\/\//i.test(input.trim());

@Injectable()
export class DouyinApiService {
  private readonly logger = new Logger(DouyinApiService.name);
  private readonly http: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const userAgent =
      this.configService.get<string>('douyin.userAgent') ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
    const timeoutMs = Number(this.configService.get<number>('douyin.timeoutMs') || 25000);
    const cookie = this.configService.get<string>('douyin.cookie') || undefined;

    this.http = axios.create({
      timeout: timeoutMs,
      maxRedirects: 5,
      headers: {
        'User-Agent': userAgent,
        Referer: 'https://www.douyin.com/',
      },
    });

    if (cookie) {
      this.http.defaults.headers.Cookie = cookie;
    }
  }

  isUserId(input: string): boolean {
    return isUserId(input);
  }

  async resolveUserId(profileOrUserId: string): Promise<string> {
    if (this.isUserId(profileOrUserId)) {
      return profileOrUserId.trim();
    }

    if (!isHttpUrl(profileOrUserId)) {
      throw new Error('Invalid input. Provide a Douyin profile URL or numeric user_id.');
    }

    const profileUrl = profileOrUserId.trim();
    const resolvedUrl = await this.resolveFinalUrl(profileUrl);
    const secUserFromUrl = this.extractSecUserIdFromUrl(resolvedUrl);
    if (secUserFromUrl) {
      return secUserFromUrl;
    }

    const html = await this.fetchProfileHtml(resolvedUrl);
    const secUserFromHtml = this.extractSecUserIdFromHtml(html);
    if (secUserFromHtml) {
      return secUserFromHtml;
    }

    throw new Error('Cannot resolve sec_uid from provided profile URL.');
  }

  async fetchAllVideos(userIdentifier: string): Promise<ScrapeVideoItem[]> {
    try {
      return await this.fetchAllVideosByAxios(userIdentifier);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Axios API path failed, switching to Puppeteer fallback: ${message}`);
      return this.fetchAllVideosByPuppeteer(userIdentifier);
    }
  }

  private async fetchAllVideosByAxios(userIdentifier: string): Promise<ScrapeVideoItem[]> {
    const allItems: ScrapeVideoItem[] = [];
    let maxCursor = '0';
    let hasMore = true;

    while (hasMore) {
      await randomDelay(1000, 3000);
      const data = await this.fetchPostPage(userIdentifier, maxCursor);
      const awemeList = Array.isArray(data?.aweme_list) ? data.aweme_list : [];

      for (const item of awemeList) {
        const awemeId = String(item?.aweme_id || '').trim();
        const desc = String(item?.desc || '');
        const createTime = Number(item?.create_time || 0);
        const playUrls = Array.isArray(item?.video?.play_addr?.url_list)
          ? item.video.play_addr.url_list.map((u: unknown) => String(u))
          : [];

        if (!awemeId || playUrls.length === 0) {
          continue;
        }

        allItems.push({ awemeId, desc, createTime, playUrls });
      }

      hasMore = Boolean(data?.has_more);
      maxCursor = String(data?.max_cursor || '0');
      this.logger.log(
        `Fetched page: items=${awemeList.length}, total=${allItems.length}, hasMore=${hasMore}, max_cursor=${maxCursor}`,
      );
    }

    return allItems;
  }

  private async fetchAllVideosByPuppeteer(userIdentifier: string): Promise<ScrapeVideoItem[]> {
    const userAgent =
      this.configService.get<string>('douyin.userAgent') ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
    const timeoutMs = Number(this.configService.get<number>('douyin.timeoutMs') || 25000);
    const cookie = this.configService.get<string>('douyin.cookie') || '';

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(userAgent);
      await page.setExtraHTTPHeaders({
        Referer: 'https://www.douyin.com/',
      });

      if (cookie) {
        const cookiePairs = cookie
          .split(';')
          .map((x) => x.trim())
          .filter(Boolean)
          .map((pair) => {
            const idx = pair.indexOf('=');
            return {
              name: pair.slice(0, idx),
              value: pair.slice(idx + 1),
            };
          })
          .filter((x) => x.name && x.value);

        await page.setCookie(
          ...cookiePairs.map((c) => ({
            ...c,
            domain: '.douyin.com',
            path: '/',
            httpOnly: false,
            secure: true,
          })),
        );
      }

      await page.goto('https://www.douyin.com/', {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs,
      });

      const allItems: ScrapeVideoItem[] = [];
      let maxCursor = '0';
      let hasMore = true;

      while (hasMore) {
        await randomDelay(1000, 3000);
        const data = await page.evaluate(
          async (identifier: string, cursor: string) => {
            const isNumericUserId = /^\d+$/.test(identifier.trim());
            const params = new URLSearchParams({
              device_platform: 'webapp',
              aid: '6383',
              channel: 'channel_pc_web',
              max_cursor: cursor,
              count: '20',
              publish_video_strategy_type: '2',
              update_version_code: '170400',
              pc_client_type: '1',
              version_code: '190500',
              version_name: '19.5.0',
              cookie_enabled: 'true',
              platform: 'PC',
              downlink: '10',
            });

            if (isNumericUserId) {
              params.set('user_id', identifier);
            } else {
              params.set('sec_user_id', identifier);
            }

            const resp = await fetch(
              `https://www.douyin.com/aweme/v1/web/aweme/post/?${params.toString()}`,
              {
                method: 'GET',
                credentials: 'include',
                headers: {
                  Accept: 'application/json, text/plain, */*',
                },
              },
            );

            if (!resp.ok) {
              throw new Error(`Puppeteer fetch failed: HTTP ${resp.status}`);
            }

            return resp.json();
          },
          userIdentifier,
          maxCursor,
        );

        const awemeList = Array.isArray(data?.aweme_list) ? data.aweme_list : [];
        for (const item of awemeList) {
          const awemeId = String(item?.aweme_id || '').trim();
          const desc = String(item?.desc || '');
          const createTime = Number(item?.create_time || 0);
          const playUrls = Array.isArray(item?.video?.play_addr?.url_list)
            ? item.video.play_addr.url_list.map((u: unknown) => String(u))
            : [];

          if (!awemeId || playUrls.length === 0) {
            continue;
          }

          allItems.push({ awemeId, desc, createTime, playUrls });
        }

        hasMore = Boolean(data?.has_more);
        maxCursor = String(data?.max_cursor || '0');
        this.logger.log(
          `[Puppeteer] Fetched page: items=${awemeList.length}, total=${allItems.length}, hasMore=${hasMore}, max_cursor=${maxCursor}`,
        );
      }

      return allItems;
    } finally {
      await browser.close();
    }
  }

  pickNoWatermarkUrl(urls: string[]): string | null {
    if (urls.length === 0) {
      return null;
    }

    return urls[0];
  }

  private async fetchPostPage(userIdentifier: string, maxCursor: string): Promise<any> {
    const params: Record<string, string> = {
      device_platform: 'webapp',
      aid: '6383',
      channel: 'channel_pc_web',
      max_cursor: maxCursor,
      count: '20',
      publish_video_strategy_type: '2',
      update_version_code: '170400',
      pc_client_type: '1',
      version_code: '190500',
      version_name: '19.5.0',
      cookie_enabled: 'true',
      platform: 'PC',
      downlink: '10',
    };

    if (this.isUserId(userIdentifier)) {
      params.user_id = userIdentifier;
    } else {
      params.sec_user_id = userIdentifier;
    }

    const response = await this.http.get('https://www.douyin.com/aweme/v1/web/aweme/post/', {
      params,
      headers: {
        Accept: 'application/json, text/plain, */*',
      },
    });

    if (!response?.data) {
      throw new Error('Douyin API returned empty payload.');
    }

    return response.data;
  }

  private async resolveFinalUrl(inputUrl: string): Promise<string> {
    const resp = await this.http.get(inputUrl, {
      maxRedirects: 5,
      responseType: 'text',
      validateStatus: (s) => s >= 200 && s < 400,
    });

    if (resp?.request?.res?.responseUrl) {
      return String(resp.request.res.responseUrl);
    }

    return inputUrl;
  }

  private async fetchProfileHtml(url: string): Promise<string> {
    const resp = await this.http.get(url, { responseType: 'text' });
    return String(resp.data || '');
  }

  private extractSecUserIdFromUrl(url: string): string | null {
    const match = url.match(/\/user\/([^/?]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }

  private extractSecUserIdFromHtml(html: string): string | null {
    const patterns = [
      /"secUid"\s*:\s*"([^"]+)"/,
      /"sec_user_id"\s*:\s*"([^"]+)"/,
      /sec_uid=([A-Za-z0-9._-]+)/,
    ];

    for (const regex of patterns) {
      const match = html.match(regex);
      if (match?.[1]) {
        return match[1];
      }
    }

    return null;
  }
}
