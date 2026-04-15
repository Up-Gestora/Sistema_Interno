import { ReportCoverAdjustment, ReportCoverItem } from '../types/reportCover';

const BASE_PATH = '/api/relatorios/capas';
const REQUEST_TIMEOUT_MS = 12000;

type RequestWithFallbackOptions = RequestInit & {
  expectJson?: boolean;
};

const ensureLeadingSlash = (value: string): string => (value.startsWith('/') ? value : `/${value}`);
const removeTrailingSlash = (value: string): string => value.replace(/\/+$/, '');
const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const joinBaseAndPath = (base: string, path: string): string => (
  `${removeTrailingSlash(base)}${ensureLeadingSlash(path)}`
);

const getEnvApiBaseUrl = (): string | null => {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  const raw = String(env?.VITE_API_BASE_URL || '').trim();
  return raw ? removeTrailingSlash(raw) : null;
};

const shouldTryLocalBackendFallback = (): boolean => {
  if (typeof window === 'undefined') return false;
  const { hostname, port } = window.location;
  if (!hostname) return false;

  return (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || port === '5173'
    || port === '5174'
    || port === '4173'
    || port === '4174'
  );
};

const buildCandidateUrls = (path: string): string[] => {
  const normalizedPath = ensureLeadingSlash(path);
  const urls: string[] = [];
  const seen = new Set<string>();

  const push = (value: string) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    urls.push(normalized);
  };

  const envBaseUrl = getEnvApiBaseUrl();
  if (envBaseUrl) {
    push(joinBaseAndPath(envBaseUrl, normalizedPath));
  }

  // Default path for same-origin (production) or Vite proxy (development).
  push(normalizedPath);

  // Useful when frontend is running standalone and backend is on :3001 without proxy.
  if (!envBaseUrl && shouldTryLocalBackendFallback() && typeof window !== 'undefined') {
    const protocol = window.location.protocol || 'http:';
    const hostname = window.location.hostname || 'localhost';
    push(`${protocol}//${hostname}:3001${normalizedPath}`);
  }

  return urls;
};

const parseErrorMessage = async (response: Response): Promise<string> => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    return `Endpoint de API indisponivel (${response.status}).`;
  }

  try {
    const data = await response.json();
    if (typeof data?.error === 'string' && data.error) {
      return data.error;
    }
  } catch {
    // ignore
  }
  return `Falha na requisicao (${response.status})`;
};

const parseNetworkErrorMessage = (error: unknown): string => {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Tempo limite ao acessar o repositorio de capas.';
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Nao foi possivel conectar ao repositorio de capas.';
};

const fetchWithTimeout = async (url: string, init: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timeoutHandle: ReturnType<typeof setTimeout> = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const requestWithFallback = async (
  path: string,
  options: RequestWithFallbackOptions = {}
): Promise<{ response: Response; requestUrl: string }> => {
  const { expectJson = true, ...init } = options;
  const candidates = buildCandidateUrls(path);
  let lastError: Error | null = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const requestUrl = candidates[index];
    const hasNextCandidate = index < candidates.length - 1;

    try {
      const response = await fetchWithTimeout(requestUrl, init);

      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (expectJson && hasNextCandidate && contentType.includes('text/html')) {
          lastError = new Error('Resposta invalida do endpoint de capas.');
          continue;
        }

        return { response, requestUrl };
      }

      const errorMessage = await parseErrorMessage(response);
      lastError = new Error(errorMessage);

      const shouldFallbackByStatus =
        hasNextCandidate && [404, 405, 502, 503, 504].includes(response.status);

      if (shouldFallbackByStatus) {
        continue;
      }

      throw lastError;
    } catch (error) {
      lastError = new Error(parseNetworkErrorMessage(error));
      if (!hasNextCandidate) {
        break;
      }
    }
  }

  throw lastError || new Error('Nao foi possivel acessar o repositorio de capas.');
};

const resolveResponseOrigin = (response: Response, requestUrl: string): string | null => {
  try {
    if (response.url && isHttpUrl(response.url)) {
      return new URL(response.url).origin;
    }
  } catch {
    // ignore
  }

  try {
    if (isHttpUrl(requestUrl)) {
      return new URL(requestUrl).origin;
    }
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return null;
};

const normalizeCoverUrl = (url: string, responseOrigin: string | null): string => {
  if (!url || isHttpUrl(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  if (!responseOrigin) {
    return url;
  }

  try {
    return new URL(url, responseOrigin).toString();
  } catch {
    return url;
  }
};

export async function listarCapas(): Promise<ReportCoverItem[]> {
  const { response, requestUrl } = await requestWithFallback(BASE_PATH, {
    method: 'GET',
    expectJson: true,
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('Resposta invalida ao listar capas do repositorio.');
  }

  const responseOrigin = resolveResponseOrigin(response, requestUrl);
  const items = Array.isArray((data as { items?: unknown[] })?.items)
    ? (data as { items: ReportCoverItem[] }).items
    : [];

  return items.map((item) => ({
    ...item,
    url: normalizeCoverUrl(item.url, responseOrigin),
  }));
}

export async function uploadCapa(file: File): Promise<ReportCoverItem> {
  const formData = new FormData();
  formData.append('file', file);

  const { response, requestUrl } = await requestWithFallback(BASE_PATH, {
    method: 'POST',
    body: formData,
    expectJson: true,
  });

  const data = await response.json() as { item?: ReportCoverItem };
  if (!data?.item) {
    throw new Error('Resposta invalida do servidor ao salvar capa.');
  }

  return {
    ...data.item,
    url: normalizeCoverUrl(data.item.url, resolveResponseOrigin(response, requestUrl)),
  };
}

export async function atualizarAjusteCapa(
  id: string,
  adjustment: ReportCoverAdjustment
): Promise<ReportCoverItem> {
  const { response, requestUrl } = await requestWithFallback(`${BASE_PATH}/${id}/ajuste`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ adjustment }),
    expectJson: true,
  });

  const data = await response.json() as { item?: ReportCoverItem };
  if (!data?.item) {
    throw new Error('Resposta invalida do servidor ao atualizar ajuste.');
  }

  return {
    ...data.item,
    url: normalizeCoverUrl(data.item.url, resolveResponseOrigin(response, requestUrl)),
  };
}

export async function excluirCapa(id: string): Promise<void> {
  await requestWithFallback(`${BASE_PATH}/${id}`, {
    method: 'DELETE',
    expectJson: false,
  });
}
