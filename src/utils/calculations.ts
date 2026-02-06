import { Cliente, Aplicacao, SaldoCliente, DashboardData } from '../types';

export function calculateDashboardData(
  clientes: Cliente[],
  aplicacoes: Aplicacao[],
  saldos: SaldoCliente[]
): DashboardData {
  const totalClientes = clientes.length;
  
  const clientesAtivos = clientes.filter((c) => c.status === 'ativo').length;
  const clientesInativos = totalClientes - clientesAtivos;

  // Calcular aplicações a partir dos dados dos clientes (BTG, XP, Avenue, Outros)
  const totalAplicacoes = clientes.reduce((sum, cliente) => {
    const btg = cliente.btg || 0;
    const xp = cliente.xp || 0;
    const avenue = cliente.avenue || 0;
    const outros = cliente.outros || 0;
    return sum + btg + xp + avenue + outros;
  }, 0);

  // Calcular saldos (se houver dados de saldos separados, senão usar 0)
  const totalSaldos = saldos.reduce((sum, s) => sum + s.saldo, 0);

  // Calcular patrimônio total a partir do valorTotalContratos ou patrimonioTotal dos clientes
  // Se não houver, usar a soma das aplicações + saldos
  const patrimonioTotal = clientes.reduce((sum, cliente) => {
    // Priorizar valorTotalContratos, depois patrimonioTotal, senão calcular
    if (cliente.valorTotalContratos) {
      return sum + cliente.valorTotalContratos;
    } else if (cliente.patrimonioTotal) {
      return sum + cliente.patrimonioTotal;
    } else {
      // Calcular a partir das aplicações
      const btg = cliente.btg || 0;
      const xp = cliente.xp || 0;
      const avenue = cliente.avenue || 0;
      const outros = cliente.outros || 0;
      return sum + btg + xp + avenue + outros;
    }
  }, 0) + totalSaldos;

  return {
    totalClientes,
    clientesAtivos,
    clientesInativos,
    patrimonioTotal,
    totalAplicacoes,
    totalSaldos,
  };
}

export function getPatrimonioByCliente(
  clienteId: string,
  aplicacoes: Aplicacao[],
  saldos: SaldoCliente[],
  cliente?: Cliente
) {
  // Se temos dados do cliente (importados), usar esses dados
  if (cliente) {
    const btg = cliente.btg || 0;
    const xp = cliente.xp || 0;
    const avenue = cliente.avenue || 0;
    const outros = cliente.outros || 0;
    const totalAplicacoes = btg + xp + avenue + outros;
    
    // Usar saldo se houver, senão 0
    const saldoCliente = saldos.find((s) => s.clienteId === clienteId);
    const saldo = saldoCliente?.saldo || 0;
    
    // Priorizar valorTotalContratos ou patrimonioTotal do cliente
    let patrimonioTotal = cliente.valorTotalContratos || cliente.patrimonioTotal;
    if (!patrimonioTotal) {
      patrimonioTotal = totalAplicacoes + saldo;
    }

    return {
      aplicacoes: aplicacoes.filter((a) => a.clienteId === clienteId),
      saldo,
      patrimonioTotal,
    };
  }

  // Fallback para dados mockados
  const aplicacoesCliente = aplicacoes.filter((a) => a.clienteId === clienteId);
  const saldoCliente = saldos.find((s) => s.clienteId === clienteId);

  const totalAplicacoes = aplicacoesCliente.reduce((sum, a) => sum + a.valor, 0);
  const saldo = saldoCliente?.saldo || 0;
  const patrimonioTotal = totalAplicacoes + saldo;

  return {
    aplicacoes: aplicacoesCliente,
    saldo,
    patrimonioTotal,
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR');
}

export function calculateTotalAssinaturaMensal(clientes: Cliente[]): number {
  return clientes.reduce((total, cliente) => {
    // Soma os valores de assinatura de todos os clientes
    const assinatura = cliente.assinatura || 0;
    return total + assinatura;
  }, 0);
}
