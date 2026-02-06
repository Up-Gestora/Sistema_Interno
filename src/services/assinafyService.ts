export interface AssinafyConfig {
  apiKey: string;
  ambiente: 'sandbox' | 'production';
  accountId: string;
}

export interface AssinafyResponse<T = any> {
  status: number;
  message: string;
  data: T;
}

const ASSINAFY_CONFIG_KEY = 'assinafy_config';

export function getAssinafyConfig(): AssinafyConfig | null {
  const config = localStorage.getItem(ASSINAFY_CONFIG_KEY);
  if (!config) return null;
  try {
    return JSON.parse(config);
  } catch {
    return null;
  }
}

export function saveAssinafyConfig(config: AssinafyConfig): void {
  localStorage.setItem(ASSINAFY_CONFIG_KEY, JSON.stringify(config));
}

export function removeAssinafyConfig(): void {
  localStorage.removeItem(ASSINAFY_CONFIG_KEY);
}

export function isAssinafyConfigured(): boolean {
  const config = getAssinafyConfig();
  return !!config?.apiKey && !!config?.accountId;
}

async function assinafyRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  params?: Record<string, any>
): Promise<T> {
  const config = getAssinafyConfig();

  if (!config?.apiKey || !config?.accountId) {
    throw new Error('API do Assinafy não configurada. Informe API Key e Workspace Account ID.');
  }

  const response = await fetch('/api/assinafy/proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Assinafy-Api-Key': config.apiKey,
      'X-Assinafy-Ambiente': config.ambiente,
    },
    body: JSON.stringify({
      endpoint,
      method: options.method || 'GET',
      params,
      body: options.body
        ? typeof options.body === 'string'
          ? JSON.parse(options.body)
          : options.body
        : undefined,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.message || data?.error || 'Erro ao acessar API do Assinafy';
    throw new Error(message);
  }

  return data;
}

export async function listarDocumentos(
  accountId: string,
  params?: Record<string, any>
): Promise<AssinafyResponse> {
  return assinafyRequest<AssinafyResponse>(`/accounts/${accountId}/documents`, { method: 'GET' }, params);
}

export async function criarSignatario(
  accountId: string,
  data: { full_name: string; email: string }
): Promise<AssinafyResponse> {
  return assinafyRequest<AssinafyResponse>(`/accounts/${accountId}/signers`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function enviarAssinatura(
  documentId: string,
  signerIds: string[],
  method: 'virtual' | 'collect' = 'virtual'
): Promise<AssinafyResponse> {
  return assinafyRequest<AssinafyResponse>(`/documents/${documentId}/assignments`, {
    method: 'POST',
    body: JSON.stringify({ method, signerIds }),
  });
}

export async function uploadDocumento(
  file: File,
  accountId: string,
  nomeDocumento?: string
): Promise<AssinafyResponse> {
  const config = getAssinafyConfig();

  if (!config?.apiKey) {
    throw new Error('API do Assinafy não configurada. Informe a API Key.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('accountId', accountId);
  if (nomeDocumento) {
    formData.append('name', nomeDocumento);
  }

  const response = await fetch('/api/assinafy/upload', {
    method: 'POST',
    headers: {
      'X-Assinafy-Api-Key': config.apiKey,
      'X-Assinafy-Ambiente': config.ambiente,
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.message || data?.error || 'Erro ao enviar documento para o Assinafy';
    throw new Error(message);
  }

  return data;
}
