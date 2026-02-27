import { ReportCoverAdjustment, ReportCoverItem } from '../types/reportCover';

const BASE_URL = '/api/relatorios/capas';

const parseErrorMessage = async (response: Response): Promise<string> => {
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

export async function listarCapas(): Promise<ReportCoverItem[]> {
  const response = await fetch(BASE_URL);
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const data = await response.json();
  return Array.isArray(data?.items) ? data.items : [];
}

export async function uploadCapa(file: File): Promise<ReportCoverItem> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(BASE_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const data = await response.json();
  if (!data?.item) {
    throw new Error('Resposta invalida do servidor ao salvar capa.');
  }

  return data.item;
}

export async function atualizarAjusteCapa(
  id: string,
  adjustment: ReportCoverAdjustment
): Promise<ReportCoverItem> {
  const response = await fetch(`${BASE_URL}/${id}/ajuste`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ adjustment }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const data = await response.json();
  if (!data?.item) {
    throw new Error('Resposta invalida do servidor ao atualizar ajuste.');
  }

  return data.item;
}

export async function excluirCapa(id: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}

