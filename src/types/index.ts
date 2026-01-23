export interface Cliente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  empresa?: string;
  dataCadastro: string;
  status: 'ativo' | 'inativo' | 'ok' | 'antecipado';
  estrategiaId?: string; // ID da estratégia de gestão
  valorTotalContratos?: number;
  // Dados de corretoras
  btg?: number;
  xp?: number;
  avenue?: number;
  outros?: number;
  // Taxas e assinatura
  taxaAdmAnual?: number | string; // Pode ser percentual ou "FIXO"
  taxaAdmMensal?: number | string; // Pode ser percentual ou "FIXO"
  assinatura?: number;
  patrimonioTotal?: number;
  // Integração Asaas
  asaasCustomerId?: string; // ID do cliente no Asaas
  asaasSubscriptionId?: string; // ID da assinatura no Asaas
}

export interface Aplicacao {
  id: string;
  clienteId: string;
  descricao: string;
  tipo: string;
  valor: number;
  data: string;
}

export interface SaldoCliente {
  id: string;
  clienteId: string;
  saldo: number;
  dataAtualizacao: string;
}

export interface PatrimonioCliente {
  clienteId: string;
  aplicacoes: Aplicacao[];
  saldo: number;
  patrimonioTotal: number;
}

export interface DashboardData {
  totalClientes: number;
  clientesAtivos: number;
  clientesInativos: number;
  patrimonioTotal: number;
  totalAplicacoes: number;
  totalSaldos: number;
}

export interface Estrategia {
  id: string;
  nome: string;
  descricao: string;
  dataCriacao: string;
  dataAtualizacao: string;
}

