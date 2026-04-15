import { savePortSharedStorageValue } from './portSharedStorage';

export const LAMINA_STORAGE_SNAPSHOT_KEY = 'lamina_storage_snapshot_v1';

const LAMINA_KEY_PREFIXES = ['lamina_', 'laminas_template_json_v2', 'estrategia_diaria_'] as const;

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const shouldIncludeKey = (key: string) =>
  LAMINA_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));

const parseSnapshot = (raw: string | null): Record<string, string> => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!isObjectRecord(parsed)) return {};
    return Object.entries(parsed).reduce<Record<string, string>>((acc, [key, value]) => {
      if (!shouldIncludeKey(key) || typeof value !== 'string') return acc;
      acc[key] = value;
      return acc;
    }, {});
  } catch {
    return {};
  }
};

export const captureLaminaSnapshotFromLocalStorage = (): Record<string, string> => {
  const snapshot: Record<string, string> = {};

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !shouldIncludeKey(key)) continue;
    const value = localStorage.getItem(key);
    if (typeof value !== 'string') continue;
    snapshot[key] = value;
  }

  return snapshot;
};

export const hydrateLaminaSnapshotIntoLocalStorage = (): boolean => {
  const rawSnapshot = localStorage.getItem(LAMINA_STORAGE_SNAPSHOT_KEY);
  const snapshot = parseSnapshot(rawSnapshot);
  if (!Object.keys(snapshot).length) return false;

  let changed = false;
  for (const [key, value] of Object.entries(snapshot)) {
    const current = localStorage.getItem(key);
    if (current === value) continue;
    localStorage.setItem(key, value);
    changed = true;
  }

  return changed;
};

export async function syncLaminaSnapshotToSharedStorage(): Promise<void> {
  const snapshot = captureLaminaSnapshotFromLocalStorage();
  if (!Object.keys(snapshot).length) return;
  await savePortSharedStorageValue(LAMINA_STORAGE_SNAPSHOT_KEY, snapshot);
}
