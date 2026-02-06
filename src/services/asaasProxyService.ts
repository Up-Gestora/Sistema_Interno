/**
 * Serviço alternativo para fazer requisições ao Asaas via proxy
 * 
 * IMPORTANTE: Este arquivo é um exemplo. Para usar em produção,
 * você precisa criar um endpoint no seu backend que faça as requisições
 * à API do Asaas, evitando problemas de CORS.
 */

import { getAsaasConfig } from './asaasService';
import { AsaasPagamento, AsaasRespostaPagamentos } from '../types/asaas';

/**
 * Exemplo de como fazer requisição via proxy do backend
 * 
 * Você precisaria criar um endpoint no seu backend, por exemplo:
 * POST /api/asaas/proxy
 * Body: { endpoint: '/payments', method: 'GET', params: {...} }
 * 
 * O backend faria a requisição à API do Asaas e retornaria o resultado
 */
export async function buscarPagamentosViaProxy(
  params?: {
    customer?: string;
    status?: string;
    limit?: number;
  }
): Promise<AsaasRespostaPagamentos> {
  const config = getAsaasConfig();
  
  if (!config) {
    throw new Error('API do Asaas não configurada');
  }

  // Exemplo de como seria a chamada ao seu backend
  // const response = await fetch('/api/asaas/proxy', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({
  //     endpoint: '/payments',
  //     method: 'GET',
  //     params,
  //   }),
  // });
  
  // return response.json();

  // Por enquanto, retorna erro informando que precisa configurar o proxy
  throw new Error('Proxy não configurado. Configure um endpoint no backend para fazer as requisições à API do Asaas.');
}







