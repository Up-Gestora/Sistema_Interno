import { useEffect, useMemo, useState } from 'react';
import { Cliente, Aplicacao, SaldoCliente } from '../../types';
import { useEstrategias } from '../../hooks/useEstrategias';
import { calculateDashboardData, formatCurrency, calculateTotalAssinaturaMensal } from '../../utils/calculations';
import { buscarDashboardAsaasData, isAsaasConfigured } from '../../services/asaasService';
import { useMoneyVisibility } from '../../contexts/MoneyVisibilityContext';
import StatCard from '../StatCard/StatCard';
import Clientes from '../Clientes/Clientes';
import Modal from '../Modal/Modal';
import './Dashboard.css';

interface DashboardProps {
  clientes: Cliente[];
  aplicacoes: Aplicacao[];
  saldos: SaldoCliente[];
}

export default function Dashboard({ clientes, aplicacoes, saldos }: DashboardProps) {
  const [filtroEstrategia, setFiltroEstrategia] = useState<string>('');
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [pagamentosStatus, setPagamentosStatus] = useState<Record<string, 'OK' | 'Inad' | '-'>>({});
  const [asaasContato, setAsaasContato] = useState<Record<string, { email?: string; telefone?: string }>>({});
  const [showInadModal, setShowInadModal] = useState(false);
  const { showValues, maskValue } = useMoneyVisibility();

  const INAD_POPUP_STORAGE_KEY = 'dashboard_inadimplentes_popup_date';
  const DASHBOARD_CACHE_KEY = 'dashboard_asaas_cache_v1';
  const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;

  const normalizarStatus = (status: Cliente['status'] | string) => (status === 'ok' ? 'ativo' : status);

  const getStatusKey = (cliente: Cliente) => {
    const status = normalizarStatus(cliente.status);
    if (status === 'inativo') return 'inativo';
    if (status === 'antecipado') return 'antecipado';
    if (!cliente.asaasCustomerId) return 'pendente-asaas';
    return 'ativo';
  };

  // Filtrar clientes baseado na estratégia e status selecionados
  const clientesFiltrados = useMemo(() => {
    let base = clientes;
    if (filtroEstrategia === 'sem-estrategia') {
      base = clientes.filter(c => !c.estrategiaId);
    } else if (filtroEstrategia) {
      base = clientes.filter(c => c.estrategiaId === filtroEstrategia);
    }
    if (!filtroStatus) return base;
    return base.filter(cliente => getStatusKey(cliente) === filtroStatus);
  }, [clientes, filtroEstrategia, filtroStatus]);

  // Filtrar aplicações e saldos baseado nos clientes filtrados
  const aplicacoesFiltradas = useMemo(() => {
    const clientesIds = new Set(clientesFiltrados.map(c => c.id));
    return aplicacoes.filter(a => clientesIds.has(a.clienteId));
  }, [aplicacoes, clientesFiltrados]);

  const saldosFiltrados = useMemo(() => {
    const clientesIds = new Set(clientesFiltrados.map(c => c.id));
    return saldos.filter(s => clientesIds.has(s.clienteId));
  }, [saldos, clientesFiltrados]);

  const asaasCustomerIds = useMemo(
    () => clientes
      .filter(cliente => cliente.status !== 'inativo')
      .filter(cliente => cliente.asaasCustomerId)
      .map(cliente => cliente.asaasCustomerId as string),
    [clientes]
  );

  useEffect(() => {
    let ativo = true;

    const carregarResumoDashboard = async () => {
      const mapaSemAsaas = Object.fromEntries(
        clientes.map(cliente => [cliente.id, '-'])
      ) as Record<string, 'OK' | 'Inad' | '-'>;

      if (!isAsaasConfigured()) {
        if (ativo) {
          setPagamentosStatus(mapaSemAsaas);
          setAsaasContato({});
        }
        return;
      }

      if (asaasCustomerIds.length === 0) {
        if (ativo) {
          setPagamentosStatus(mapaSemAsaas);
          setAsaasContato({});
        }
        return;
      }

      const agora = Date.now();
      let dadosCache: any = null;
      const cacheRaw = localStorage.getItem(DASHBOARD_CACHE_KEY);
      if (cacheRaw) {
        try {
          dadosCache = JSON.parse(cacheRaw);
        } catch {
          dadosCache = null;
        }
      }

      const cacheValido =
        dadosCache &&
        agora - dadosCache.timestamp < DASHBOARD_CACHE_TTL_MS &&
        asaasCustomerIds.every((id: string) => Object.prototype.hasOwnProperty.call(dadosCache.status || {}, id));

      const dados = cacheValido
        ? dadosCache
        : await buscarDashboardAsaasData(asaasCustomerIds);

      if (!cacheValido) {
        localStorage.setItem(
          DASHBOARD_CACHE_KEY,
          JSON.stringify({
            timestamp: agora,
            contatos: dados.contatos || {},
            status: dados.status || {},
          })
        );
      }

      if (!ativo) return;

      const statusPorCliente: Record<string, 'OK' | 'Inad' | '-'> = {};
      const contatoPorCliente: Record<string, { email?: string; telefone?: string }> = {};

      clientes.forEach((cliente) => {
        if (cliente.status === 'inativo') {
          statusPorCliente[cliente.id] = '-';
          return;
        }
        if (!cliente.asaasCustomerId) {
          statusPorCliente[cliente.id] = '-';
          return;
        }

        const asaasId = cliente.asaasCustomerId;
        statusPorCliente[cliente.id] = dados.status?.[asaasId] || 'OK';

        const contato = dados.contatos?.[asaasId];
        if (contato) {
          contatoPorCliente[cliente.id] = contato;
        }
      });

      setPagamentosStatus(statusPorCliente);
      setAsaasContato(contatoPorCliente);
    };

    carregarResumoDashboard();

    return () => {
      ativo = false;
    };
  }, [clientes, asaasCustomerIds]);

  const dashboardData = useMemo(
    () => calculateDashboardData(clientesFiltrados, aplicacoesFiltradas, saldosFiltrados),
    [clientesFiltrados, aplicacoesFiltradas, saldosFiltrados]
  );

  const totalAssinaturaMensal = useMemo(() => {
    return calculateTotalAssinaturaMensal(clientesFiltrados);
  }, [clientesFiltrados]);

  const totalClientesAsaas = useMemo(
    () => clientesFiltrados.filter(cliente => cliente.asaasCustomerId).length,
    [clientesFiltrados]
  );

  const inadimplentes = useMemo(() => {
    return clientesFiltrados.filter(cliente => pagamentosStatus[cliente.id] === 'Inad');
  }, [clientesFiltrados, pagamentosStatus]);

  const formatValorOuMascara = (valor: string) => {
    return maskValue(valor);
  };

  useEffect(() => {
    if (!isAsaasConfigured()) return;
    if (inadimplentes.length === 0) return;

    const hoje = new Date();
    const chaveHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    const jaMostrouHoje = localStorage.getItem(INAD_POPUP_STORAGE_KEY) === chaveHoje;

    if (jaMostrouHoje) return;

    setShowInadModal(true);
    localStorage.setItem(INAD_POPUP_STORAGE_KEY, chaveHoje);
  }, [inadimplentes.length]);

  return (
    <div className="dashboard">
      <Modal
        isOpen={showInadModal}
        onClose={() => setShowInadModal(false)}
        title="Clientes inadimplentes"
        size="small"
      >
        <p className="dashboard-inad-text">
          Há clientes inadimplentes hoje. Verifique a lista na dashboard.
        </p>
        <button className="dashboard-inad-btn" onClick={() => setShowInadModal(false)}>
          Ok, entendi
        </button>
      </Modal>
      <div className="dashboard-header">
        <div>
          <h2>Dashboard</h2>
          <p className="dashboard-welcome">Bem-vindo de volta, Igor!</p>
        </div>
      </div>

      <div className="dashboard-stats">
        <StatCard
          title="Total de Clientes"
          value={dashboardData.totalClientes}
          subtitle={`${dashboardData.clientesAtivos} ativos`}
          icon="👥"
        />
        <StatCard
          title="Assinaturas Mensais"
          value={formatValorOuMascara(formatCurrency(totalAssinaturaMensal))}
          subtitle="Soma dos valores de assinatura"
          icon="💵"
        />
        <StatCard
          title="Patrimônio Total"
          value={formatValorOuMascara(formatCurrency(dashboardData.patrimonioTotal))}
          subtitle={
            showValues
              ? `Aplicações: ${formatCurrency(dashboardData.totalAplicacoes)} | Saldos: ${formatCurrency(dashboardData.totalSaldos)}`
              : 'Aplicações: **** | Saldos: ****'
          }
          icon="💰"
        />
        <StatCard
          title="Clientes Asaas"
          value={totalClientesAsaas}
          subtitle="Vinculados ao Asaas"
          icon="🔗"
        />
      </div>

      <div className="dashboard-content">
        <Clientes 
          clientes={clientes} 
          pagamentosStatus={pagamentosStatus}
          asaasContato={asaasContato}
          dashboardView
          filtroEstrategia={filtroEstrategia}
          onFiltroEstrategiaChange={setFiltroEstrategia}
          filtroStatus={filtroStatus}
          onFiltroStatusChange={setFiltroStatus}
        />
      </div>
    </div>
  );
}
