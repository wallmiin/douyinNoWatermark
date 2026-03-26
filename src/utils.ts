export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const randomDelay = async (minMs = 1000, maxMs = 3000): Promise<void> => {
  const duration = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await sleep(duration);
};

export const sanitizeFilename = (value: string): string =>
  value.replace(/[<>:\"/\\|?*\x00-\x1F]/g, '_');

export const isWatermarkedUrl = (url: string): boolean => {
  const lower = url.toLowerCase();
  return lower.includes('playwm');
};
