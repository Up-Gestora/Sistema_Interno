import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Aplicacao, SaldoCliente, Cliente } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { useMoneyVisibility } from '../../contexts/MoneyVisibilityContext';
import Card from '../Card/Card';
import './PatrimonioLiquido.css';

interface PatrimonioLiquidoProps {
  aplicacoes: Aplicacao[];
  saldos: SaldoCliente[];
  clientes: Cliente[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function PatrimonioLiquido({ aplicacoes, saldos, clientes }: PatrimonioLiquidoProps) {
  const { showValues, maskValue } = useMoneyVisibility();
  const dadosResumo = useMemo(() => {
    // Calcular aplicações a partir dos dados dos clientes
    const aplicacoesClientes = clientes.reduce((sum, cliente) => {
      const btg = cliente.btg || 0;
      const xp = cliente.xp || 0;
      const avenue = cliente.avenue || 0;
      const outros = cliente.outros || 0;
      return sum + btg + xp + avenue + outros;
    }, 0);
    
    // Somar com aplicações mockadas (se houver)
    const aplicacoesMockadas = aplicacoes.reduce((sum, a) => sum + a.valor, 0);
    const totalAplicacoes = aplicacoesClientes + aplicacoesMockadas;
    
    const totalSaldos = saldos.reduce((sum, s) => sum + s.saldo, 0);
    
    // Calcular patrimônio total a partir dos clientes
    const patrimonioTotalClientes = clientes.reduce((sum, cliente) => {
      if (cliente.valorTotalContratos) {
        return sum + cliente.valorTotalContratos;
      } else if (cliente.patrimonioTotal) {
        return sum + cliente.patrimonioTotal;
      } else {
        const btg = cliente.btg || 0;
        const xp = cliente.xp || 0;
        const avenue = cliente.avenue || 0;
        const outros = cliente.outros || 0;
        return sum + btg + xp + avenue + outros;
      }
    }, 0);
    
    const patrimonioTotal = patrimonioTotalClientes + totalSaldos + aplicacoesMockadas;

    return {
      totalAplicacoes,
      totalSaldos,
      patrimonioTotal,
    };
  }, [aplicacoes, saldos, clientes]);

  const dadosGraficoPizza = useMemo(() => {
    return [
      { name: 'Aplicações', value: dadosResumo.totalAplicacoes },
      { name: 'Saldos', value: dadosResumo.totalSaldos },
    ];
  }, [dadosResumo]);

  const dadosPorTipo = useMemo(() => {
    const grupos: Record<string, number> = {};

    // Agrupar por corretora dos clientes
    clientes.forEach((cliente) => {
      if (cliente.btg && cliente.btg > 0) {
        grupos['BTG'] = (grupos['BTG'] || 0) + cliente.btg;
      }
      if (cliente.xp && cliente.xp > 0) {
        grupos['XP'] = (grupos['XP'] || 0) + cliente.xp;
      }
      if (cliente.avenue && cliente.avenue > 0) {
        grupos['Avenue'] = (grupos['Avenue'] || 0) + cliente.avenue;
      }
      if (cliente.outros && cliente.outros > 0) {
        grupos['Outros'] = (grupos['Outros'] || 0) + cliente.outros;
      }
    });

    // Adicionar aplicações mockadas por tipo
    aplicacoes.forEach((aplicacao) => {
      if (!grupos[aplicacao.tipo]) {
        grupos[aplicacao.tipo] = 0;
      }
      grupos[aplicacao.tipo] += aplicacao.valor;
    });

    return Object.entries(grupos).map(([name, value]) => ({
      name,
      value,
    }));
  }, [aplicacoes, clientes]);

  const patrimonioPorCliente = useMemo(() => {
    return clientes.map((cliente) => {
      // Calcular aplicações do cliente
      const btg = cliente.btg || 0;
      const xp = cliente.xp || 0;
      const avenue = cliente.avenue || 0;
      const outros = cliente.outros || 0;
      const aplicacoesCliente = aplicacoes.filter((a) => a.clienteId === cliente.id);
      const aplicacoesMockadas = aplicacoesCliente.reduce((sum, a) => sum + a.valor, 0);
      const totalAplicacoes = btg + xp + avenue + outros + aplicacoesMockadas;
      
      const saldoCliente = saldos.find((s) => s.clienteId === cliente.id);
      const saldo = saldoCliente?.saldo || 0;
      
      // Priorizar valorTotalContratos ou patrimonioTotal do cliente
      let patrimonioTotal = cliente.valorTotalContratos || cliente.patrimonioTotal;
      if (!patrimonioTotal) {
        patrimonioTotal = totalAplicacoes + saldo;
      }

      return {
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        aplicacoes: aplicacoesCliente,
        saldo,
        patrimonioTotal,
      };
    });
  }, [clientes, aplicacoes, saldos]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{payload[0].name}</p>
          <p className="tooltip-value">{maskValue(formatCurrency(payload[0].value))}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="patrimonio-container">
      <div className="patrimonio-resumo">
        <Card className="resumo-card">
          <h4>Resumo Patrimonial</h4>
          <div className="resumo-grid">
            <div className="resumo-item">
              <span className="resumo-label">Total de Aplicações</span>
              <span className="resumo-value resumo-aplicacoes">
                {maskValue(formatCurrency(dadosResumo.totalAplicacoes))}
              </span>
            </div>
            <div className="resumo-item">
              <span className="resumo-label">Total de Saldos</span>
              <span className="resumo-value resumo-saldos">
                {maskValue(formatCurrency(dadosResumo.totalSaldos))}
              </span>
            </div>
            <div className="resumo-item">
              <span className="resumo-label">Patrimônio Total</span>
              <span className="resumo-value resumo-patrimonio">
                {maskValue(formatCurrency(dadosResumo.patrimonioTotal))}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <div className="patrimonio-graficos">
        <Card title="Distribuição Aplicações vs Saldos" className="grafico-card">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={dadosGraficoPizza}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {dadosGraficoPizza.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => maskValue(formatCurrency(value))} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Aplicações por Tipo" className="grafico-card">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dadosPorTipo}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis
                tickFormatter={(value) =>
                  showValues ? `R$ ${(value / 1000).toFixed(0)}k` : '****'
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill={COLORS[0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Patrimônio por Cliente" className="detalhamento-card">
        <div className="patrimonio-lista">
          {patrimonioPorCliente.map((item) => (
            <div key={item.clienteId} className="patrimonio-item">
              <div className="patrimonio-info">
                <h5>{item.clienteNome}</h5>
                <span className="patrimonio-tipo">
                  {item.aplicacoes.length} aplicação(ões) | Saldo: {maskValue(formatCurrency(item.saldo))}
                </span>
              </div>
              <div className="patrimonio-valor-container">
                <span className="patrimonio-valor patrimonio-total">
                  {maskValue(formatCurrency(item.patrimonioTotal))}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Detalhamento de Aplicações" className="detalhamento-card">
        <div className="patrimonio-lista">
          {aplicacoes.map((aplicacao) => {
            const cliente = clientes.find((c) => c.id === aplicacao.clienteId);
            return (
              <div key={aplicacao.id} className="patrimonio-item">
                <div className="patrimonio-info">
                  <h5>{aplicacao.descricao}</h5>
                  <span className="patrimonio-tipo">
                    {aplicacao.tipo} | Cliente: {cliente?.nome || 'N/A'}
                  </span>
                </div>
                <div className="patrimonio-valor-container">
                  <span className="patrimonio-valor patrimonio-aplicacao">
                    {maskValue(formatCurrency(aplicacao.valor))}
                  </span>
                  <span className="patrimonio-badge patrimonio-aplicacao">
                    {aplicacao.tipo}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
