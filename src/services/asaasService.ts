import {
  AsaasConfig,
  AsaasPagamento,
  AsaasCobranca,
  AsaasCliente,
  AsaasRespostaPagamentos,
  AsaasRespostaCobrancas,
  AsaasResumoFinanceiro,
  AsaasSubscription,
  AsaasRespostaSubscriptions,
} from '../types/asaas';

// URLs base da API do Asaas (usadas apenas para referência)
// As requisições agora passam pelo backend proxy
const ASAAS_API_BASE = {
  sandbox: 'https://sandbox.asaas.com/api/v3',
  production: 'https://www.asaas.com/api/v3',
};

/**
 * Obtém a configuração do Asaas do localStorage
 */
export function getAsaasConfig(): AsaasConfig | null {
  const config = localStorage.getItem('asaas_config');
  if (!config) return null;
  try {
    return JSON.parse(config);
  } catch {
    return null;
  }
}

/**
 * Salva a configuração do Asaas no localStorage
 */
export function saveAsaasConfig(config: AsaasConfig): void {
  localStorage.setItem('asaas_config', JSON.stringify(config));
}

/**
 * Remove a configuração do Asaas
 */
export function removeAsaasConfig(): void {
  localStorage.removeItem('asaas_config');
}

/**
 * Verifica se a API está configurada
 */
export function isAsaasConfigured(): boolean {
  const config = getAsaasConfig();
  return config !== null && config.apiKey !== '';
}

/**
 * Faz uma requisição autenticada para a API do Asaas via proxy do backend
 */
async function asaasRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  params?: Record<string, any>
): Promise<T> {
  const config = getAsaasConfig();
  
  if (!config || !config.apiKey) {
    throw new Error('API do Asaas não configurada. Configure sua API Key primeiro.');
  }

  try {
    // Usar proxy do backend para evitar problemas de CORS
    const response = await fetch('/api/asaas/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Asaas-Api-Key': config.apiKey,
        'X-Asaas-Ambiente': config.ambiente,
      },
      body: JSON.stringify({
        endpoint,
        method: options.method || 'GET',
        params: params || extractParamsFromUrl(endpoint),
        body: options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined,
      }),
    });

    if (!response.ok) {
      let errorMessage = `Erro na API: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorData.errors?.[0]?.description || errorMessage;
      } catch {
        // Se não conseguir ler o JSON, usar a mensagem padrão
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error: any) {
    // Se for erro de conexão com o backend
    if (error.message === 'Failed to fetch' || error.name === 'TypeError' || error.message?.includes('fetch')) {
      throw new Error('Erro de conexão com o backend. Certifique-se de que o servidor backend está rodando na porta 3001.');
    }
    throw error;
  }
}

/**
 * Extrai parâmetros de query string da URL do endpoint
 */
function extractParamsFromUrl(endpoint: string): Record<string, string> | undefined {
  const url = new URL(endpoint, 'http://dummy.com');
  const params: Record<string, string> = {};
  
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  
  return Object.keys(params).length > 0 ? params : undefined;
}

/**
 * Busca pagamentos (recebidos)
 */
export async function buscarPagamentos(
  params?: {
    customer?: string;
    subscription?: string;
    installment?: string;
    status?: string;
    billingType?: string;
    paymentDate?: string;
    dueDate?: string;
    offset?: number;
    limit?: number;
  }
): Promise<AsaasRespostaPagamentos> {
  const endpoint = '/payments';
  return asaasRequest<AsaasRespostaPagamentos>(endpoint, {
    method: 'GET',
  }, params);
}

/**
 * Busca contatos e inadimplência em lote para o dashboard
 */
export async function buscarDashboardAsaasData(
  customerIds: string[]
): Promise<{
  contatos: Record<string, { email?: string; telefone?: string }>;
  status: Record<string, 'OK' | 'Inad'>;
}> {
  const config = getAsaasConfig();

  if (!config || !config.apiKey) {
    throw new Error('API do Asaas não configurada. Configure sua API Key primeiro.');
  }

  try {
    const response = await fetch('/api/asaas/dashboard-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Asaas-Api-Key': config.apiKey,
        'X-Asaas-Ambiente': config.ambiente,
      },
      body: JSON.stringify({ customerIds }),
    });

    if (!response.ok) {
      let errorMessage = `Erro na API: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorData.errors?.[0]?.description || errorMessage;
      } catch {
        // ignore
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error: any) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError' || error.message?.includes('fetch')) {
      throw new Error('Erro de conexão com o backend. Certifique-se de que o servidor backend está rodando na porta 3001.');
    }
    throw error;
  }
}

/**
 * Busca todos os pagamentos paginando automaticamente
 */
export async function buscarPagamentosPaginados(
  params?: {
    customer?: string;
    subscription?: string;
    installment?: string;
    status?: string;
    billingType?: string;
    paymentDate?: string;
    dueDate?: string;
  }
): Promise<AsaasPagamento[]> {
  const limit = 100;
  let offset = 0;
  const todos: AsaasPagamento[] = [];

  while (true) {
    const resposta = await buscarPagamentos({ ...params, limit, offset });
    todos.push(...(resposta.data || []));
    if (!resposta.hasMore) break;
    offset += limit;
  }

  return todos;
}

/**
 * Busca cobranças (a receber)
 */
export async function buscarCobrancas(
  params?: {
    customer?: string;
    subscription?: string;
    installment?: string;
    status?: string;
    billingType?: string;
    dueDate?: string;
    offset?: number;
    limit?: number;
  }
): Promise<AsaasRespostaCobrancas> {
  const endpoint = '/payments';
  return asaasRequest<AsaasRespostaCobrancas>(endpoint, {
    method: 'GET',
  }, params);
}

/**
 * Busca um pagamento específico por ID
 */
export async function buscarPagamentoPorId(id: string): Promise<AsaasPagamento> {
  return asaasRequest<AsaasPagamento>(`/payments/${id}`);
}

/**
 * Cria uma cobrança avulsa (à vista ou parcelada)
 */
export async function criarCobranca(
  dados: {
    customer: string;
    billingType: string;
    value: number;
    dueDate: string;
    description?: string;
    installmentCount?: number;
    installmentValue?: number;
  }
): Promise<AsaasPagamento> {
  const endpoint = '/payments';
  return asaasRequest<AsaasPagamento>(endpoint, {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}

/**
 * Atualiza uma cobranca existente (valor, vencimento, descricao, tipo)
 */
export async function atualizarCobranca(
  id: string,
  dados: {
    value?: number;
    dueDate?: string;
    description?: string;
    billingType?: string;
  }
): Promise<AsaasPagamento> {
  const endpoint = `/payments/${id}`;
  return asaasRequest<AsaasPagamento>(endpoint, {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}

/**
 * Cancela/Exclui uma cobranca pendente no Asaas
 */
export async function cancelarCobranca(id: string): Promise<AsaasPagamento> {
  const endpointCancel = `/payments/${id}/cancel`;
  try {
    return await asaasRequest<AsaasPagamento>(endpointCancel, {
      method: 'POST',
    });
  } catch (error: any) {
    const mensagem = error?.message || '';
    if (mensagem.includes('404')) {
      const endpointDelete = `/payments/${id}`;
      return asaasRequest<AsaasPagamento>(endpointDelete, {
        method: 'DELETE',
      });
    }
    throw error;
  }
}

/**
 * Busca clientes
 */
export async function buscarClientes(
  params?: {
    name?: string;
    email?: string;
    cpfCnpj?: string;
    offset?: number;
    limit?: number;
  }
): Promise<{ object: string; hasMore: boolean; totalCount: number; limit: number; offset: number; data: AsaasCliente[] }> {
  const endpoint = '/customers';
  return asaasRequest(endpoint, {
    method: 'GET',
  }, params);
}

/**
 * Busca um cliente específico por ID
 */
export async function buscarClientePorId(id: string): Promise<AsaasCliente> {
  return asaasRequest<AsaasCliente>(`/customers/${id}`);
}

/**
 * Calcula resumo financeiro
 */
export async function calcularResumoFinanceiro(
  periodo: 'mes' | 'ano' | 'inicio' = 'mes'
): Promise<AsaasResumoFinanceiro> {
  try {
    const getDateParts = (dateString?: string) => {
      if (!dateString) return null;
      const [dataSemHora] = dateString.split('T');
      const [ano, mes, dia] = dataSemHora.split('-').map(Number);
      if (!ano || !mes || !dia) return null;
      return { ano, mes, dia };
    };

    const isDentroPeriodo = (dateString?: string) => {
      if (periodo === 'inicio') return true;
      const partes = getDateParts(dateString);
      if (!partes) return false;

      const agora = new Date();
      const anoAtual = agora.getFullYear();
      const mesAtual = agora.getMonth() + 1;

      if (periodo === 'ano') {
        return partes.ano === anoAtual;
      }

      return partes.ano === anoAtual && partes.mes === mesAtual;
    };

    const getDataReferencia = (status: string, pagamento: AsaasPagamento) => {
      if (['RECEIVED', 'RECEIVED_IN_CASH', 'CONFIRMED', 'REFUNDED'].includes(status)) {
        return pagamento.paymentDate || pagamento.clientPaymentDate || pagamento.dateCreated;
      }

      return pagamento.dueDate || pagamento.dateCreated;
    };

    const somarPagamentos = async (status: string) => {
      const limit = 100;
      let offset = 0;
      let total = 0;

      while (true) {
        const resposta = await buscarPagamentos({ status, limit, offset });
        total += (resposta.data || []).reduce((sum, pagamento) => {
          const dataReferencia = getDataReferencia(status, pagamento);
          if (!isDentroPeriodo(dataReferencia)) return sum;
          return sum + (pagamento.value || 0);
        }, 0);

        if (!resposta.hasMore) break;
        offset += limit;
      }

      return total;
    };

    const somarMultiplosStatus = async (statusList: string[]) => {
      const totais = await Promise.all(statusList.map(somarPagamentos));
      return totais.reduce((sum, valor) => sum + valor, 0);
    };

    const received = await somarMultiplosStatus(['RECEIVED', 'RECEIVED_IN_CASH']);
    const confirmed = await somarMultiplosStatus(['CONFIRMED']);
    const pending = await somarMultiplosStatus(['PENDING']);
    const overdue = await somarMultiplosStatus(['OVERDUE']);
    const refunded = await somarMultiplosStatus(['REFUNDED']);

    const balance = received + confirmed - refunded;

    return {
      balance,
      received,
      confirmed,
      pending,
      overdue,
      refunded,
    };
  } catch (error) {
    console.error('Erro ao calcular resumo financeiro:', error);
    throw error;
  }
}

/**
 * Testa a conexão com a API
 */
export async function testarConexao(): Promise<boolean> {
  try {
    await buscarPagamentos({ limit: 1 });
    return true;
  } catch (error) {
    console.error('Erro ao testar conexão:', error);
    return false;
  }
}

/**
 * Busca assinaturas (subscriptions) do Asaas
 */
export async function buscarSubscriptions(
  params?: {
    customer?: string;
    status?: string;
    offset?: number;
    limit?: number;
  }
): Promise<AsaasRespostaSubscriptions> {
  const endpoint = '/subscriptions';
  return asaasRequest<AsaasRespostaSubscriptions>(endpoint, {
    method: 'GET',
  }, params);
}

/**
 * Busca uma assinatura específica por ID
 */
export async function buscarSubscriptionPorId(id: string): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>(`/subscriptions/${id}`);
}

/**
 * Cancela uma assinatura no Asaas
 */
export async function cancelarSubscription(id: string): Promise<AsaasSubscription> {
  const endpointCancel = `/subscriptions/${id}/cancel`;
  try {
    return await asaasRequest<AsaasSubscription>(endpointCancel, {
      method: 'POST',
    });
  } catch (error: any) {
    const mensagem = error?.message || '';
    if (mensagem.includes('404')) {
      const endpointDelete = `/subscriptions/${id}`;
      return asaasRequest<AsaasSubscription>(endpointDelete, {
        method: 'DELETE',
      });
    }
    throw error;
  }
}

/**
 * Atualiza uma assinatura no Asaas
 * Usa updatePendingPayments: true para atualizar também as cobranças pendentes
 */
export async function atualizarSubscription(
  subscriptionId: string,
  dados: {
    value?: number;
    billingType?: string;
    description?: string;
    cycle?: string;
    nextDueDate?: string;
    updatePendingPayments?: boolean;
  }
): Promise<AsaasSubscription> {
  const endpoint = `/subscriptions/${subscriptionId}`;
  return asaasRequest<AsaasSubscription>(endpoint, {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}

/**
 * Atualiza apenas as cobranças pendentes vinculadas à assinatura (subscription) do cliente no Asaas.
 *
 * Importante: não deve alterar cobranças avulsas ou parcelamentos, mesmo que estejam pendentes.
 */
export async function atualizarCobrancasPendentes(
  customerId: string,
  subscriptionId: string | undefined,
  novoValor: number
): Promise<{ atualizadas: number; erros: number; subscriptionId?: string }> {
  try {
    let subscriptionParaAtualizar = subscriptionId;

    const atualizarPendentesDireto = async (subscriptionIdAlvo: string) => {
      const resposta = await buscarPagamentos({
        customer: customerId,
        subscription: subscriptionIdAlvo,
        status: 'PENDING',
        limit: 100,
      });
      // Segurança: garantir que só cobranças da assinatura sejam alteradas.
      const cobrancasPendentes = (resposta.data || []).filter(
        cobranca => cobranca.subscription === subscriptionIdAlvo
      );
      let atualizadas = 0;
      let erros = 0;

      for (const cobranca of cobrancasPendentes) {
        const valorAtual = cobranca.value || 0;
        if (Math.abs(valorAtual - novoValor) < 0.01) {
          atualizadas++;
          continue;
        }

        try {
          await atualizarCobranca(cobranca.id, { value: novoValor });
          atualizadas++;
        } catch {
          erros++;
        }
      }

      return { atualizadas, erros };
    };

    if (!subscriptionParaAtualizar) {
      const respostaSubscriptions = await buscarSubscriptions({ customer: customerId, limit: 100 });
      const lista = respostaSubscriptions.data || [];
      const ativa = lista.find(sub => sub.status === 'ACTIVE');
      const selecionada = ativa || lista[0];

      if (!selecionada) {
        throw new Error('Nenhuma assinatura encontrada no Asaas para este cliente.');
      }

      subscriptionParaAtualizar = selecionada.id;
    }

    if (!subscriptionParaAtualizar) {
      throw new Error('Nenhuma assinatura encontrada no Asaas para este cliente.');
    }

    // Atualizar a subscription (isso atualiza as cobranças pendentes da assinatura)
    try {
      const subscriptionAtual = await buscarSubscriptionPorId(subscriptionParaAtualizar);
      await atualizarSubscription(subscriptionParaAtualizar, {
        value: novoValor,
        billingType: subscriptionAtual.billingType,
        description: subscriptionAtual.description,
        cycle: subscriptionAtual.cycle,
        nextDueDate: subscriptionAtual.nextDueDate,
        updatePendingPayments: true,
      });
    } catch (error: any) {
      console.error('Erro ao atualizar subscription:', error);
      // Fallback: tenta atualizar cobranças pendentes individualmente
      const fallback = await atualizarPendentesDireto(subscriptionParaAtualizar);
      if (fallback.atualizadas > 0 || fallback.erros > 0) {
        return { ...fallback, subscriptionId: subscriptionParaAtualizar };
      }
      throw error;
    }

    const resultado = await atualizarPendentesDireto(subscriptionParaAtualizar);
    return { ...resultado, subscriptionId: subscriptionParaAtualizar };
  } catch (error) {
    console.error('Erro ao atualizar cobranças pendentes:', error);
    throw error;
  }
}

/**
 * Cria uma nova assinatura no Asaas
 */
export async function criarSubscription(
  dados: {
    customer: string;
    billingType: string;
    value: number;
    description: string;
    cycle: string;
    nextDueDate: string;
  }
): Promise<AsaasSubscription> {
  const endpoint = '/subscriptions';
  return asaasRequest<AsaasSubscription>(endpoint, {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}
