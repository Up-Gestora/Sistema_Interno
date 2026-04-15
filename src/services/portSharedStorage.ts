export const PORT_SHARED_STORAGE_KEYS = [
  'asaas_config',
  'asaas_pagamentos_cache_v1',
  'clientes',
  'credito_update_workspace_v1',
  'estrategias',
  'dashboard_asaas_cache_v1',
  'financeiro_recebedores_saidas_custom_v1',
  'inter_manual_lancamentos_v1',
  'lamina_storage_snapshot_v1',
  'links_uteis_v1',
  'saidas_manual_lancamentos_v1',
] as const;

export type PortSharedStorageKey = (typeof PORT_SHARED_STORAGE_KEYS)[number];

const PORT_SHARED_STORAGE_ENDPOINT = '/api/port-shared-storage';
const MERGE_BY_ID_KEYS = new Set<PortSharedStorageKey>([
  'inter_manual_lancamentos_v1',
  'saidas_manual_lancamentos_v1',
]);

type PortSharedStorageItem = {
  exists: boolean;
  value: unknown;
};

type MergeByIdValue = {
  id: string;
  data?: string;
  [key: string]: unknown;
};

const parseLocalStorageValue = (raw: string | null) => {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const buildJsonHeaders = () => ({
  'Content-Type': 'application/json',
});

const isObjectRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const parseMergeByIdArray = (value: unknown): MergeByIdValue[] | null => {
  if (!Array.isArray(value)) return null;

  const parsed = value
    .filter(isObjectRecord)
    .filter((item) => typeof item.id === 'string' && item.id.trim().length > 0)
    .map((item) => item as MergeByIdValue);

  return parsed;
};

const getSortTimestamp = (item: MergeByIdValue): number => {
  if (typeof item.data !== 'string' || !item.data) return 0;
  const timestamp = new Date(item.data).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const mergeByIdPreservandoMaisRecente = (serverValue: unknown, localValue: unknown): unknown => {
  const serverArray = parseMergeByIdArray(serverValue);
  const localArray = parseMergeByIdArray(localValue);

  if (!serverArray && !localArray) return serverValue;
  if (!serverArray) return localArray ?? [];
  if (!localArray) return serverArray;

  const merged = new Map<string, MergeByIdValue>();
  serverArray.forEach((item) => merged.set(item.id, item));
  localArray.forEach((item) => merged.set(item.id, item));

  return Array.from(merged.values()).sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a));
};

const asJson = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

const isSameValue = (left: unknown, right: unknown): boolean => asJson(left) === asJson(right);

const persistServerValue = async <T>(key: PortSharedStorageKey, value: T): Promise<void> => {
  const response = await fetch(`${PORT_SHARED_STORAGE_ENDPOINT}/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ value }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao salvar armazenamento compartilhado: ${response.status}`);
  }
};

const seedServerFromLocalStorage = async (key: PortSharedStorageKey) => {
  const parsed = parseLocalStorageValue(localStorage.getItem(key));
  if (parsed === undefined) return;
  await persistServerValue(key, parsed);
};

export async function bootstrapPortSharedStorage(
  keys: readonly PortSharedStorageKey[] = PORT_SHARED_STORAGE_KEYS
): Promise<void> {
  try {
    const response = await fetch(`${PORT_SHARED_STORAGE_ENDPOINT}/bulk`, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({ keys }),
    });

    if (!response.ok) {
      throw new Error(`Falha ao carregar armazenamento compartilhado: ${response.status}`);
    }

    const payload = (await response.json()) as {
      items?: Partial<Record<PortSharedStorageKey, PortSharedStorageItem>>;
    };
    const items = payload.items || {};

    await Promise.all(
      keys.map(async (key) => {
        const item = items[key];
        if (item?.exists) {
          const localValue = parseLocalStorageValue(localStorage.getItem(key));
          const resolvedValue = MERGE_BY_ID_KEYS.has(key)
            ? mergeByIdPreservandoMaisRecente(item.value, localValue)
            : item.value;

          localStorage.setItem(key, JSON.stringify(resolvedValue));

          if (MERGE_BY_ID_KEYS.has(key) && !isSameValue(item.value, resolvedValue)) {
            await persistServerValue(key, resolvedValue);
          }
          return;
        }

        await seedServerFromLocalStorage(key);
      })
    );
  } catch (error) {
    console.error('Erro ao sincronizar armazenamento compartilhado:', error);
  }
}

export async function savePortSharedStorageValue<T>(key: PortSharedStorageKey, value: T): Promise<void> {
  localStorage.setItem(key, JSON.stringify(value));

  try {
    await persistServerValue(key, value);
  } catch (error) {
    console.error(`Erro ao salvar a chave compartilhada "${key}":`, error);
  }
}

export async function removePortSharedStorageValue(key: PortSharedStorageKey): Promise<void> {
  localStorage.removeItem(key);

  try {
    const response = await fetch(`${PORT_SHARED_STORAGE_ENDPOINT}/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Falha ao remover armazenamento compartilhado: ${response.status}`);
    }
  } catch (error) {
    console.error(`Erro ao remover a chave compartilhada "${key}":`, error);
  }
}
