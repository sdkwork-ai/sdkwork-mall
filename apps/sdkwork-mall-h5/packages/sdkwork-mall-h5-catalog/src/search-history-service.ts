const SEARCH_HISTORY_STORAGE_KEY = "sdkwork-mall-h5-search-history";
const SEARCH_HISTORY_LIMIT = 10;

export function readMallH5SearchHistory(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

export function recordMallH5SearchHistory(keyword: string): void {
  const trimmed = keyword.trim();
  if (!trimmed) {
    return;
  }
  const history = readMallH5SearchHistory().filter((entry) => entry !== trimmed);
  window.localStorage.setItem(
    SEARCH_HISTORY_STORAGE_KEY,
    JSON.stringify([trimmed, ...history].slice(0, SEARCH_HISTORY_LIMIT)),
  );
}

export function clearMallH5SearchHistory(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SEARCH_HISTORY_STORAGE_KEY);
  }
}
