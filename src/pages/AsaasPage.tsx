import { useState, useEffect, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import { getAsaasConfig, saveAsaasConfig, isAsaasConfigured, testarConexao, buscarPagamentosPaginados } from '../services/asaasService';
import { AsaasConfig, AsaasPagamento, AsaasResumoFinanceiro } from '../types/asaas';
import { formatCurrency } from '../utils/calculations';
import { useMoneyVisibility } from '../contexts/MoneyVisibilityContext';
import { useClientes } from '../hooks/useClientes';
import Card from '../components/Card/Card';
import Modal from '../components/Modal/Modal';
import './AsaasPage.css';

let pagamentosCache: AsaasPagamento[] | null = null;

export interface FinanceiroOutletContext {
  pagamentosFiltrados: AsaasPagamento[];
  carregando: boolean;
  filtroStatus: string;
  setFiltroStatus: (status: string) => void;
  clientesPorAsaasId: Record<string, string>;
  getStatusBadgeClass: (status: string) => string;
  getStatusLabel: (status: string) => string;
  maskValue: (value: string) => string;
}

export default function AsaasPage() {
  const { maskValue } = useMoneyVisibility();
  const { clientes } = useClientes();
  const [config, setConfig] = useState<AsaasConfig | null>(null);
  const [mostrarModalConfig, setMostrarModalConfig] = useState(false);
  const [configForm, setConfigForm] = useState<AsaasConfig>({
    apiKey: '',
    ambiente: 'production',
  });
  const [pagamentos, setPagamentos] = useState<AsaasPagamento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string>('');
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [filtroPeriodo, setFiltroPeriodo] = useState<'mes' | 'ano' | 'inicio'>('mes');

  useEffect(() => {
    const savedConfig = getAsaasConfig();
    if (savedConfig) {
      setConfig(savedConfig);
      setConfigForm(savedConfig);
      if (pagamentosCache) {
        setPagamentos(pagamentosCache);
      } else {
        carregarDados();
      }
    } else {
      setMostrarModalConfig(true);
    }
  }, []);

  const pagamentosFiltrados = useMemo(() => {
    if (!filtroStatus) return pagamentos;
    return pagamentos.filter((pagamento) => pagamento.status === filtroStatus);
  }, [pagamentos, filtroStatus]);

  const clientesPorAsaasId = useMemo(() => {
    return clientes.reduce<Record<string, string>>((acc, cliente) => {
      if (cliente.asaasCustomerId) {
        acc[cliente.asaasCustomerId] = cliente.nome;
      }
      return acc;
    }, {});
  }, [clientes]);

  const resumo = useMemo(() => {
    if (pagamentos.length === 0) return null;

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

    const getDataReferencia = (status: string, pagamento: AsaasPagamento) => {
      if (['RECEIVED', 'RECEIVED_IN_CASH', 'CONFIRMED', 'REFUNDED'].includes(status)) {
        return pagamento.paymentDate || pagamento.clientPaymentDate || pagamento.dateCreated;
      }

      return pagamento.dueDate || pagamento.dateCreated;
    };

    const somarPorStatus = (statusList: string[]) => {
      return pagamentos.reduce((sum, pagamento) => {
        if (!statusList.includes(pagamento.status)) return sum;
        const dataReferencia = getDataReferencia(pagamento.status, pagamento);
        if (!isDentroPeriodo(dataReferencia)) return sum;
        return sum + (pagamento.value || 0);
      }, 0);
    };

    const received = somarPorStatus(['RECEIVED', 'RECEIVED_IN_CASH']);
    const confirmed = somarPorStatus(['CONFIRMED']);
    const pending = somarPorStatus(['PENDING']);
    const overdue = somarPorStatus(['OVERDUE']);
    const refunded = somarPorStatus(['REFUNDED']);
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

    try {
      const resposta = await buscarPagamentosPaginados();
      const lista = resposta || [];
      pagamentosCache = lista;
      setPagamentos(lista);
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao carregar dados do Asaas';
      setErro(errorMessage);
      console.error('Erro completo:', error);
      
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
          <div className="resumo-cards">
            <Card className="resumo-card">
              <h3>Saldo</h3>
              <p className="valor">
                {carregando ? (
                  <span className="loading-dots" aria-label="Carregando">
                    <span />
                    <span />
                    <span />
                  </span>
                ) : resumo ? (
                  maskValue(formatCurrency(resumo.balance))
                ) : (
                  '—'
                )}
              </p>
            </Card>
            <Card className="resumo-card">
              <h3>Recebidos</h3>
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
                  '—'
                )}
              </p>
            </Card>
            <Card className="resumo-card">
              <h3>Confirmados</h3>
              <p className="valor">
                {carregando ? (
                  <span className="loading-dots" aria-label="Carregando">
                    <span />
                    <span />
                    <span />
                  </span>
                ) : resumo ? (
                  maskValue(formatCurrency(resumo.confirmed))
                ) : (
                  '—'
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
                  '—'
                )}
              </p>
            </Card>
            <Card className="resumo-card">
              <h3>Vencido</h3>
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
                  '—'
                )}
              </p>
            </Card>
          </div>
          <Outlet
            context={{
              pagamentosFiltrados,
              carregando,
              filtroStatus,
              setFiltroStatus,
              clientesPorAsaasId,
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

