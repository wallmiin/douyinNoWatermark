'use client';

import { FormEvent, useMemo, useState } from 'react';

type VideoItem = {
  aweme_id: string;
  file_path: string;
  desc: string;
  created_at: string;
};

type ApiPayload = {
  total: number;
  videos: VideoItem[];
  message?: string;
};

export default function NiPage(): JSX.Element {
  const [profile, setProfile] = useState('');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [error, setError] = useState('');

  const apiBase = useMemo(() => 'http://localhost:3000', []);

  const buildPreviewUrl = (filePath: string): string => `${apiBase}${filePath}`;
  const buildDownloadUrl = (awemeId: string): string => `${apiBase}/download/${awemeId}`;

  const toggleVideoSelection = (awemeId: string): void => {
    setSelectedVideos((prev) =>
      prev.includes(awemeId) ? prev.filter((id) => id !== awemeId) : [...prev, awemeId],
    );
  };

  const selectAll = (): void => {
    setSelectedVideos(videos.map((video) => video.aweme_id));
  };

  const clearSelection = (): void => {
    setSelectedVideos([]);
  };

  const triggerDownload = (awemeId: string): void => {
    const link = document.createElement('a');
    link.href = buildDownloadUrl(awemeId);
    link.download = `${awemeId}.mp4`;
    link.target = '_blank';
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAllSelected = async (): Promise<void> => {
    if (selectedVideos.length === 0) {
      setError('Vui long chon it nhat 1 video de tai.');
      return;
    }

    setError('');
    setIsBulkDownloading(true);
    try {
      for (const awemeId of selectedVideos) {
        triggerDownload(awemeId);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } finally {
      setIsBulkDownloading(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const input = profile.trim();
    if (!input) {
      setError('Vui long nhap link profile hoac user_id.');
      setVideos([]);
      setTotal(null);
      return;
    }

    setIsLoading(true);
    setError('');
    setVideos([]);
    setSelectedVideos([]);
    setTotal(null);

    try {
      const url = `/api?profile=${encodeURIComponent(input)}`;
      const response = await fetch(url, { method: 'GET' });
      const text = await response.text();

      let payload: ApiPayload | null = null;
      if (text) {
        try {
          payload = JSON.parse(text) as ApiPayload;
        } catch {
          throw new Error('Backend tra ve sai dinh dang JSON.');
        }
      }

      if (!response.ok) {
        throw new Error(payload?.message || `API loi ${response.status}`);
      }

      const items = payload?.videos || [];
      setVideos(items);
      setSelectedVideos([]);
      setTotal(payload?.total ?? 0);
      if (items.length === 0) {
        setError('Khong co du lieu');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Loi khong xac dinh';
      setError(message);
      setVideos([]);
      setSelectedVideos([]);
      setTotal(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="page-shell">
      <section className="hero-card">
        <h1>Douyin Downloader No Watermark</h1>
        <p>Nhap profile link hoac user_id. He thong chi dung file server local, khong phat link Douyin truc tiep.</p>

        <form className="control-row" onSubmit={submit}>
          <input
            placeholder="https://www.douyin.com/user/... or 43256206108"
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Dang tai...' : 'Tai danh sach'}
          </button>
        </form>

        {isLoading && (
          <div className="loading-wrap" role="status" aria-live="polite">
            <span className="spinner" />
            <span>Dang xu ly...</span>
          </div>
        )}

        {total !== null && !isLoading && <div className="summary-row"><span>Total: {total}</span></div>}
        {error && <div className="error-box">{error}</div>}
      </section>

      <section className="grid-wrap">
        {videos.length > 0 && (
          <article className="hero-card" style={{ gridColumn: '1 / -1' }}>
            <div className="summary-row">
              <span>Da chon: {selectedVideos.length} video</span>
            </div>
            <div className="control-row">
              <button type="button" onClick={selectAll} disabled={isBulkDownloading}>
                Chon tat ca
              </button>
              <button type="button" onClick={clearSelection} disabled={isBulkDownloading}>
                Bo chon
              </button>
              <button
                type="button"
                onClick={downloadAllSelected}
                disabled={isBulkDownloading || selectedVideos.length === 0}
              >
                {isBulkDownloading ? 'Dang tai...' : 'Tai tat ca'}
              </button>
            </div>
          </article>
        )}

        {videos.map((video) => (
          <article key={video.aweme_id} className="video-card">
            <div className="thumb-wrap">
              <video src={buildPreviewUrl(video.file_path)} controls preload="metadata" playsInline />
            </div>
            <div className="video-content">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={selectedVideos.includes(video.aweme_id)}
                  onChange={() => toggleVideoSelection(video.aweme_id)}
                />
                Chon video
              </label>
              <h3>{video.desc || 'No description'}</h3>
              <p>{new Date(video.created_at).toLocaleString()}</p>
              <button
                type="button"
                onClick={() => triggerDownload(video.aweme_id)}
                disabled={isBulkDownloading}
              >
                Download
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
