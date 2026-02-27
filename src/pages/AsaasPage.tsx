import { useState, useEffect, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { getAsaasConfig, saveAsaasConfig, isAsaasConfigured, testarConexao, buscarPagamentosPaginados } from '../services/asaasService';
import { AsaasConfig, AsaasPagamento, AsaasResumoFinanceiro } from '../types/asaas';
import { Cliente } from '../types';
import { formatCurrency } from '../utils/calculations';
import { useMoneyVisibility } from '../contexts/MoneyVisibilityContext';
import { useClientes } from '../hooks/useClientes';
import Card from '../components/Card/Card';
import Modal from '../components/Modal/Modal';
import './AsaasPage.css';

const INTER_LANCAMENTOS_KEY = 'inter_manual_lancamentos_v1';
const SAIDAS_LANCAMENTOS_KEY = 'saidas_manual_lancamentos_v1';
const ASAAS_PAGAMENTOS_CACHE_KEY = 'asaas_pagamentos_cache_v1';

type AsaasPagamentosCache = {
  updatedAt: string;
  pagamentos: AsaasPagamento[];
};

const lerPagamentosCache = (): AsaasPagamentosCache | null => {
  const saved = localStorage.getItem(ASAAS_PAGAMENTOS_CACHE_KEY);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      return { updatedAt: '', pagamentos: parsed as AsaasPagamento[] };
    }
    if (parsed && Array.isArray(parsed.pagamentos)) {
      return parsed as AsaasPagamentosCache;
    }
  } catch {
    return null;
  }
  return null;
};

const salvarPagamentosCache = (pagamentos: AsaasPagamento[]) => {
  const payload: AsaasPagamentosCache = {
    updatedAt: new Date().toISOString(),
    pagamentos,
  };
  localStorage.setItem(ASAAS_PAGAMENTOS_CACHE_KEY, JSON.stringify(payload));
};

const STATUS_RECEBIDAS = new Set(['RECEIVED', 'RECEIVED_IN_CASH', 'DUNNING_RECEIVED']);
const STATUS_CONFIRMADAS = new Set(['CONFIRMED']);
const STATUS_AGUARDANDO = new Set(['PENDING', 'AWAITING_RISK_ANALYSIS']);
const STATUS_VENCIDAS = new Set(['OVERDUE', 'DUNNING_REQUESTED']);
const STATUS_REEMBOLSADAS = new Set(['REFUNDED']);

export interface FinanceiroOutletContext {
  pagamentos: AsaasPagamento[];
  pagamentosFiltrados: AsaasPagamento[];
  carregando: boolean;
  filtroStatus: string;
  setFiltroStatus: (status: string) => void;
  clientesPorAsaasId: Record<string, string>;
  clientes: Cliente[];
  interLancamentos: InterManualLancamento[];
  onAdicionarLancamentoInter: (lancamento: InterManualLancamento) => void;
  onRemoverLancamentoInter: (id: string) => void;
  saidasLancamentos: SaidaManualLancamento[];
  onAdicionarSaida: (lancamento: SaidaManualLancamento) => void;
  onRemoverSaida: (id: string) => void;
  getStatusBadgeClass: (status: string) => string;
  getStatusLabel: (status: string) => string;
  maskValue: (value: string) => string;
}

export type InterManualLancamento = {
  id: string;
  clienteId: string;
  tipo: 'recebimento' | 'pagamento';
  valor: number;
  data: string;
  descricao?: string;
};

export type SaidaManualLancamento = {
  id: string;
  recebedor: string;
  valor: number;
  data: string;
  descricao?: string;
};

export default function AsaasPage() {
  const { maskValue } = useMoneyVisibility();
  const { clientes } = useClientes();
  const location = useLocation();
  const [config, setConfig] = useState<AsaasConfig | null>(null);
  const [mostrarModalConfig, setMostrarModalConfig] = useState(false);
  const [configForm, setConfigForm] = useState<AsaasConfig>({
    apiKey: '',
    ambiente: 'production',
  });
  const [pagamentos, setPagamentos] = useState<AsaasPagamento[]>(() => {
    const cache = lerPagamentosCache();
    return cache?.pagamentos || [];
  });
  const [interLancamentos, setInterLancamentos] = useState<InterManualLancamento[]>(() => {
    const saved = localStorage.getItem(INTER_LANCAMENTOS_KEY);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved) as InterManualLancamento[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [saidasLancamentos, setSaidasLancamentos] = useState<SaidaManualLancamento[]>(() => {
    const saved = localStorage.getItem(SAIDAS_LANCAMENTOS_KEY);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved) as SaidaManualLancamento[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string>('');
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [filtroPeriodo, setFiltroPeriodo] = useState<'mes' | 'ano' | 'inicio'>('mes');

  useEffect(() => {
    localStorage.setItem(INTER_LANCAMENTOS_KEY, JSON.stringify(interLancamentos));
  }, [interLancamentos]);

  useEffect(() => {
    localStorage.setItem(SAIDAS_LANCAMENTOS_KEY, JSON.stringify(saidasLancamentos));
  }, [saidasLancamentos]);

  useEffect(() => {
    const savedConfig = getAsaasConfig();
    if (savedConfig) {
      setConfig(savedConfig);
      setConfigForm(savedConfig);
      const cache = lerPagamentosCache();
      if (cache?.pagamentos?.length) {
        setPagamentos(cache.pagamentos);
      }
      carregarDados();
    } else {
      setMostrarModalConfig(true);
    }
  }, []);

  const adicionarLancamentoInter = (lancamento: InterManualLancamento) => {
    setInterLancamentos((prev) => [lancamento, ...prev]);
  };

  const removerLancamentoInter = (id: string) => {
    setInterLancamentos((prev) => prev.filter((item) => item.id !== id));
  };

  const adicionarSaida = (lancamento: SaidaManualLancamento) => {
    setSaidasLancamentos((prev) => [lancamento, ...prev]);
  };

  const removerSaida = (id: string) => {
    setSaidasLancamentos((prev) => prev.filter((item) => item.id !== id));
  };

  const pagamentosInter = useMemo<AsaasPagamento[]>(() => {
    return interLancamentos
      .filter((item) => item.tipo === 'recebimento')
      .map((item) => ({
        id: item.id,
        customer: `manual:${item.clienteId}`,
        billingType: 'INTER',
        value: item.valor,
        netValue: item.valor,
      originalValue: item.valor,
      interestValue: 0,
      description: item.descricao?.trim() || 'Recebimento Inter (manual)',
      status: 'INTER_RECEIVED',
      dueDate: item.data,
      originalDueDate: item.data,
      paymentDate: item.data,
      clientPaymentDate: item.data,
      installmentNumber: 1,
      installment: '1',
      subscription: '',
      invoiceUrl: '',
      bankSlipUrl: '',
      transactionReceiptUrl: '',
      invoiceNumber: '',
      externalReference: '',
      deleted: false,
      anticipated: false,
      anticipable: false,
      refunds: undefined,
        dateCreated: item.data,
      }));
  }, [interLancamentos]);

  const pagamentosCombinados = useMemo(
    () => [...pagamentosInter, ...pagamentos],
    [pagamentosInter, pagamentos]
  );

  const pagamentosFiltrados = useMemo(() => {
    if (!filtroStatus) return pagamentosCombinados;
    return pagamentosCombinados.filter((pagamento) => pagamento.status === filtroStatus);
  }, [pagamentosCombinados, filtroStatus]);

  const mostrarResumoCards = location.pathname.includes('/asaas/contas');

  const clientesPorAsaasId = useMemo(() => {
    return clientes.reduce<Record<string, string>>((acc, cliente) => {
      if (cliente.asaasCustomerId) {
        acc[cliente.asaasCustomerId] = cliente.nome;
      }
      acc[`manual:${cliente.id}`] = cliente.nome;
      return acc;
    }, {});
  }, [clientes]);

  const resumo = useMemo(() => {
    const pagamentosValidos = pagamentos.filter((pagamento) => !pagamento.deleted);
    if (pagamentosValidos.length === 0) return null;

    const getDateParts = (dateString?: string) => {
      if (!dateString) return null;
      const [dataSemHora] = dateString.split('T');
      const [ano, mes, dia] = dataSemHora.split('-').map(Number);
      if (!ano || !mes || !dia) return null;
      return { ano, mes, dia };
    };

    const isDentroPeriodo = (dateString?: string) => {
      if (filtroPeriodo === 'inicio') return true;
      const partes = getDateParts(dateString);
      if (!partes) return false;

      const agora = new Date();
      const anoAtual = agora.getFullYear();
      const mesAtual = agora.getMonth() + 1;

      if (filtroPeriodo === 'ano') {
        return partes.ano === anoAtual;
      }

      return partes.ano === anoAtual && partes.mes === mesAtual;
    };

    // O dashboard "Situação das cobranças" do Asaas é orientado à cobrança (vencimento),
    // então o filtro de período deve usar a data de vencimento para todos os status.
    const getDataReferencia = (pagamento: AsaasPagamento) => {
      return pagamento.dueDate || pagamento.originalDueDate || pagamento.dateCreated;
    };

    const somarPorStatus = (statusSet: Set<string>) => {
      return pagamentosValidos.reduce((sum, pagamento) => {
        if (!statusSet.has(pagamento.status)) return sum;
        const dataReferencia = getDataReferencia(pagamento);
        if (!isDentroPeriodo(dataReferencia)) return sum;
        return sum + (pagamento.value || 0);
      }, 0);
    };

    const received = somarPorStatus(STATUS_RECEBIDAS);
    const confirmed = somarPorStatus(STATUS_CONFIRMADAS);
    const pending = somarPorStatus(STATUS_AGUARDANDO);
    const overdue = somarPorStatus(STATUS_VENCIDAS);
    const refunded = somarPorStatus(STATUS_REEMBOLSADAS);
    const balance = received + confirmed - refunded;

    return {
      balance,
      received,
      confirmed,
      pending,
      overdue,
      refunded,
    } as AsaasResumoFinanceiro;
  }, [pagamentos, filtroPeriodo]);

  const carregarDados = async () => {
    if (!isAsaasConfigured()) return;

    setCarregando(true);
    setErro('');

    const cacheAtual = lerPagamentosCache();

    try {
      const resposta = await buscarPagamentosPaginados();
      const lista = resposta || [];
      const atualizados = Array.from(new Map(lista.map((pagamento) => [pagamento.id, pagamento])).values());
      setPagamentos(atualizados);
      salvarPagamentosCache(atualizados);
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao carregar dados do Asaas';
      setErro(errorMessage);
      console.error('Erro completo:', error);
      if (cacheAtual?.pagamentos?.length) {
        setPagamentos(cacheAtual.pagamentos);
      }
      
      // Se for erro de CORS, dar dica mais específica
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('CORS')) {
        setErro('Erro de conexão com a API do Asaas. Isso pode ser causado por: 1) API Key incorreta, 2) Problemas de CORS (a API pode não permitir requisições diretas do navegador). Tente verificar sua API Key ou considere usar um proxy no servidor.');
      }
    } finally {
      setCarregando(false);
    }
  };

  const handleSalvarConfig = async () => {
    if (!configForm.apiKey.trim()) {
      setErro('Por favor, informe a API Key');
      return;
    }

    try {
      saveAsaasConfig(configForm);
      setConfig(configForm);
      setMostrarModalConfig(false);
      setErro('');
      
      // Testar conexão
      const conectado = await testarConexao();
      if (!conectado) {
        setErro('API Key inválida ou sem permissões. Verifique suas credenciais.');
      } else {
        alert('API salva com sucesso. Recarregue a página (F5) para carregar os dados.');
      }
    } catch (error: any) {
      setErro(error.message || 'Erro ao salvar configuração');
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const statusMap: Record<string, string> = {
      RECEIVED: 'status-received',
      PENDING: 'status-pending',
      OVERDUE: 'status-overdue',
      REFUNDED: 'status-refunded',
      INTER_RECEIVED: 'status-received',
      INTER_PAID: 'status-inter-paid',
      RECEIVED_IN_CASH_UNDONE: 'status-received-cash',
      CHARGEBACK_REQUESTED: 'status-chargeback',
      CHARGEBACK_DISPUTE: 'status-chargeback',
      AWAITING_CHARGEBACK_REVERSAL: 'status-awaiting',
      DUNNING_REQUESTED: 'status-dunning',
      DUNNING_RECEIVED: 'status-dunning',
      AWAITING_RISK_ANALYSIS: 'status-awaiting',
    };
    return statusMap[status] || 'status-default';
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      RECEIVED: 'Recebido',
      PENDING: 'Pendente',
      OVERDUE: 'Vencido',
      REFUNDED: 'Reembolsado',
      INTER_RECEIVED: 'Recebido (Inter)',
      INTER_PAID: 'Pagamento (Inter)',
      RECEIVED_IN_CASH_UNDONE: 'Recebido em Dinheiro',
      CHARGEBACK_REQUESTED: 'Chargeback Solicitado',
      CHARGEBACK_DISPUTE: 'Chargeback em Disputa',
      AWAITING_CHARGEBACK_REVERSAL: 'Aguardando Reversão',
      DUNNING_REQUESTED: 'Cobrança Solicitada',
      DUNNING_RECEIVED: 'Cobrança Recebida',
      AWAITING_RISK_ANALYSIS: 'Aguardando Análise',
    };
    return statusMap[status] || status;
  };

  return (
    <div className="asaas-page">
      <div className="page-header">
        <h1>Financeiro</h1>
        <div className="page-actions">
          <div className="periodo-select">
            <label htmlFor="filtroPeriodo">Período</label>
            <select
              id="filtroPeriodo"
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value as 'mes' | 'ano' | 'inicio')}
              className="filtro-select"
            >
              <option value="mes">Mês vigente</option>
              <option value="ano">Ano vigente</option>
              <option value="inicio">Desde o início</option>
            </select>
          </div>
          <button 
            className="btn-config"
            onClick={() => setMostrarModalConfig(true)}
          >
            ⚙️ Configurar API
          </button>
        </div>
      </div>

      {erro && (
        <Card className="error-banner-card">
          <div className="error-banner">
            <div>
              <strong>⚠️ Erro:</strong> {erro}
            </div>
            {(erro.includes('CORS') || erro.includes('Failed to fetch') || erro.includes('conexão')) ? (
              <div className="cors-solution">
                <p><strong>Solução para CORS:</strong></p>
                <ol>
                  <li>
                    <strong>Opção 1 - Backend/Proxy:</strong> Crie um endpoint no seu backend que faça as requisições à API do Asaas.
                    Isso evita problemas de CORS e mantém sua API Key segura.
                  </li>
                  <li>
                    <strong>Opção 2 - Extensão (apenas desenvolvimento):</strong> Use uma extensão como "CORS Unblock" 
                    ou "Allow CORS" no Chrome para desenvolvimento local.
                  </li>
                  <li>
                    <strong>Opção 3 - Verificar API Key:</strong> Certifique-se de que está usando a API Key correta 
                    e o ambiente correto (Produção/Sandbox).
                  </li>
                </ol>
              </div>
            ) : null}
            <button onClick={() => setErro('')}>✕</button>
          </div>
        </Card>
      )}

      {!isAsaasConfigured() ? (
        <Card>
          <div className="config-prompt">
            <p>Configure sua API Key do Asaas para começar a visualizar pagamentos e cobranças.</p>
            <button 
              className="btn-primary"
              onClick={() => setMostrarModalConfig(true)}
            >
              Configurar Agora
            </button>
          </div>
        </Card>
      ) : (
        <>
          {mostrarResumoCards && (
            <div className="resumo-cards resumo-cards-financeiro">
              <Card className="resumo-card">
                <h3>Recebidas</h3>
                <p className="valor positivo">
                  {carregando ? (
                    <span className="loading-dots" aria-label="Carregando">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : resumo ? (
                    maskValue(formatCurrency(resumo.received))
                  ) : (
                    "-"
                  )}
                </p>
              </Card>
              <Card className="resumo-card">
                <h3>Confirmadas</h3>
                <p className="valor positivo">
                  {carregando ? (
                    <span className="loading-dots" aria-label="Carregando">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : resumo ? (
                    maskValue(formatCurrency(resumo.confirmed))
                  ) : (
                    "-"
                  )}
                </p>
              </Card>
              <Card className="resumo-card">
                <h3>Aguardando</h3>
                <p className="valor">
                  {carregando ? (
                    <span className="loading-dots" aria-label="Carregando">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : resumo ? (
                    maskValue(formatCurrency(resumo.pending))
                  ) : (
                    "-"
                  )}
                </p>
              </Card>
              <Card className="resumo-card">
                <h3>Vencidas</h3>
                <p className="valor negativo">
                  {carregando ? (
                    <span className="loading-dots" aria-label="Carregando">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : resumo ? (
                    maskValue(formatCurrency(resumo.overdue))
                  ) : (
                    "-"
                  )}
                </p>
              </Card>
            </div>
          )}
      <Outlet
        context={{
          pagamentos: pagamentosCombinados,
          pagamentosFiltrados,
          carregando,
          filtroStatus,
          setFiltroStatus,
          clientesPorAsaasId,
          clientes,
          interLancamentos,
          onAdicionarLancamentoInter: adicionarLancamentoInter,
          onRemoverLancamentoInter: removerLancamentoInter,
          saidasLancamentos,
          onAdicionarSaida: adicionarSaida,
          onRemoverSaida: removerSaida,
          getStatusBadgeClass,
          getStatusLabel,
          maskValue,
        }}
      />
        </>
      )}

      <Modal
        isOpen={mostrarModalConfig}
        onClose={() => setMostrarModalConfig(false)}
        title="Configurar API Asaas"
        size="medium"
      >
        <div className="config-form">
          <div className="form-group">
            <label htmlFor="apiKey">API Key *</label>
            <input
              type="password"
              id="apiKey"
              value={configForm.apiKey}
              onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
              placeholder="Cole sua API Key do Asaas"
            />
            <small>
              Você pode encontrar sua API Key em: Configurações → Integrações → API Key
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="ambiente">Ambiente</label>
            <select
              id="ambiente"
              value={configForm.ambiente}
              onChange={(e) => setConfigForm({ ...configForm, ambiente: e.target.value as 'sandbox' | 'production' })}
            >
              <option value="production">Produção</option>
              <option value="sandbox">Sandbox (Teste)</option>
            </select>
          </div>

          <div className="cors-warning">
            <p><strong>⚠️ Importante sobre CORS:</strong></p>
            <p>A API do Asaas pode bloquear requisições diretas do navegador. Se encontrar erro "Failed to fetch", você precisará:</p>
            <ul>
              <li>Configurar um backend/proxy para fazer as requisições, ou</li>
              <li>Usar uma extensão do navegador para desabilitar CORS (apenas para desenvolvimento)</li>
            </ul>
          </div>

          <div className="form-actions">
            <button
              className="btn-secondary"
              onClick={() => setMostrarModalConfig(false)}
            >
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={handleSalvarConfig}
            >
              Salvar e Conectar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
