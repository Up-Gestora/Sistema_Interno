import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './LaminasJsonEditor.css';

type LaminaChart = {
  type: 'line' | 'bar';
  title: string;
  data: Array<{ label: string; value: number }>;
};

type LaminaTabela = {
  headers: string[];
  rows: string[][];
};

type LaminaKpi = {
  label: string;
  value: string;
};

type LaminaTemplate = {
  titulo: string;
  subtitulo: string;
  periodo: string;
  destaque: string;
  descricao: string;
  kpis: LaminaKpi[];
  tabela: LaminaTabela;
  comentarios: string;
  chart: LaminaChart;
};

const TEMPLATE_PADRAO: LaminaTemplate = {
  titulo: 'Carteira UP FILS',
  subtitulo: 'INTELIGÊNCIA ARTIFICIAL A SERVIÇO DO SEU DINHEIRO',
  periodo: 'Dezembro/25',
  destaque: '+6,00%',
  descricao:
    'A Carteira Tática UP se encontra aberta para captação, buscando gerar alpha sobre IFIX e CDI no longo prazo.',
  kpis: [
    { label: 'Público Alvo', value: 'Moderado/Arrojado' },
    { label: 'Drawdown máximo', value: '-3,24%' },
    { label: 'Volatilidade Anualizada', value: '7,38%' },
    { label: 'Retorno Acumulado', value: '43,55%' },
    { label: 'Índice de Sharpe', value: '3,60' },
    { label: 'Benchmark', value: 'IFIX' },
    { label: 'Alpha', value: '28,32%' },
    { label: 'PL Total', value: 'R$ 6,76MM' },
  ],
  tabela: {
    headers: ['Período', 'Tática', 'IFIX', 'CDI', 'Alpha'],
    rows: [
      ['01 M', '6,00', '3,13', '0,96', '2,86'],
      ['03 M', '7,91', '5,18', '3,01', '2,73'],
      ['Início', '43,55', '15,23', '14,43', '28,32'],
    ],
  },
  comentarios:
    'Fechamos o mês com rentabilidade líquida de 6,00%, com manutenção da estratégia e ajustes táticos.',
  chart: {
    type: 'line',
    title: 'Track Record +43,55%',
    data: [
      { label: 'Jan', value: 1.2 },
      { label: 'Fev', value: 2.4 },
      { label: 'Mar', value: 3.1 },
      { label: 'Abr', value: 3.9 },
      { label: 'Mai', value: 4.3 },
      { label: 'Jun', value: 5.1 },
    ],
  },
};

function normalizarTemplate(dados: LaminaTemplate): LaminaTemplate {
  return {
    ...TEMPLATE_PADRAO,
    ...dados,
    kpis: Array.isArray(dados.kpis) ? dados.kpis : TEMPLATE_PADRAO.kpis,
    tabela: {
      headers: dados.tabela?.headers || TEMPLATE_PADRAO.tabela.headers,
      rows: dados.tabela?.rows || TEMPLATE_PADRAO.tabela.rows,
    },
    chart: {
      type: dados.chart?.type === 'bar' ? 'bar' : 'line',
      title: dados.chart?.title || TEMPLATE_PADRAO.chart.title,
      data: dados.chart?.data || TEMPLATE_PADRAO.chart.data,
    },
  };
}

export default function LaminasJsonEditor() {
  const STORAGE_KEY = 'laminas_template_json_v1';
  const [template, setTemplate] = useState<LaminaTemplate>(TEMPLATE_PADRAO);
  const [jsonText, setJsonText] = useState(JSON.stringify(TEMPLATE_PADRAO, null, 2));
  const [jsonErro, setJsonErro] = useState('');
  const [salvoMensagem, setSalvoMensagem] = useState('');

  useEffect(() => {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (!salvo) return;
    setJsonText(salvo);
    aplicarJson(salvo);
  }, []);

  const aplicarJson = (texto: string) => {
    try {
      const parsed = JSON.parse(texto);
      const normalizado = normalizarTemplate(parsed);
      setTemplate(normalizado);
      setJsonErro('');
    } catch (error: any) {
      setJsonErro(error.message || 'JSON inválido.');
    }
  };

  const handleJsonChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const novoTexto = event.target.value;
    setJsonText(novoTexto);
    aplicarJson(novoTexto);
  };

  const atualizarCampo = (campo: keyof LaminaTemplate, valor: string) => {
    const novoTemplate = { ...template, [campo]: valor };
    setTemplate(novoTemplate);
    setJsonText(JSON.stringify(novoTemplate, null, 2));
  };

  const dadosGrafico = useMemo(() => template.chart.data, [template.chart.data]);

  const handleSalvar = () => {
    localStorage.setItem(STORAGE_KEY, jsonText);
    setSalvoMensagem('Alterações salvas.');
    setTimeout(() => setSalvoMensagem(''), 2000);
  };

  return (
    <div className="laminas-json">
      <div className="laminas-editor-panel">
        <h3>Campos rápidos</h3>
        <label>
          Título
          <input value={template.titulo} onChange={(e) => atualizarCampo('titulo', e.target.value)} />
        </label>
        <label>
          Subtítulo
          <input value={template.subtitulo} onChange={(e) => atualizarCampo('subtitulo', e.target.value)} />
        </label>
        <label>
          Período
          <input value={template.periodo} onChange={(e) => atualizarCampo('periodo', e.target.value)} />
        </label>
        <label>
          Destaque
          <input value={template.destaque} onChange={(e) => atualizarCampo('destaque', e.target.value)} />
        </label>
        <label>
          Descrição
          <textarea
            rows={3}
            value={template.descricao}
            onChange={(e) => atualizarCampo('descricao', e.target.value)}
          />
        </label>
        <label>
          Comentários
          <textarea
            rows={4}
            value={template.comentarios}
            onChange={(e) => atualizarCampo('comentarios', e.target.value)}
          />
        </label>

        <div className="json-area">
          <h4>JSON do template</h4>
          <textarea value={jsonText} onChange={handleJsonChange} />
          {jsonErro && <span className="json-error">{jsonErro}</span>}
          <div className="json-actions">
            <button type="button" className="btn-save" onClick={handleSalvar} disabled={!!jsonErro}>
              Salvar alterações
            </button>
            {salvoMensagem && <span className="json-saved">{salvoMensagem}</span>}
          </div>
          <p className="json-hint">
            Edite o JSON para ajustar KPIs, tabela e gráfico. O preview atualiza em tempo real.
          </p>
        </div>
      </div>

      <div className="laminas-preview-panel">
        <div className="lamina-preview a4">
          <header className="lamina-header">
            <div>
              <span className="lamina-kicker">UP</span>
              <h2>{template.titulo}</h2>
              <p>{template.subtitulo}</p>
            </div>
            <div className="lamina-periodo">
              <span>{template.periodo}</span>
              <strong>{template.destaque}</strong>
            </div>
          </header>

          <p className="lamina-descricao">{template.descricao}</p>

          <div className="lamina-body">
            <aside className="lamina-kpis">
              {template.kpis.map((kpi, index) => (
                <div key={`${kpi.label}-${index}`} className="lamina-kpi">
                  <span>{kpi.label}</span>
                  <strong>{kpi.value}</strong>
                </div>
              ))}
            </aside>

            <section className="lamina-conteudo">
              <div className="lamina-chart">
                <h4>{template.chart.title}</h4>
                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height={220}>
                    {template.chart.type === 'bar' ? (
                      <BarChart data={dadosGrafico}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    ) : (
                      <LineChart data={dadosGrafico}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={2} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="lamina-table">
                <h4>Performance</h4>
                <table>
                  <thead>
                    <tr>
                      {template.tabela.headers.map((header) => (
                        <th key={header}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {template.tabela.rows.map((row, index) => (
                      <tr key={`row-${index}`}>
                        {row.map((cell, cellIndex) => (
                          <td key={`cell-${cellIndex}`}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="lamina-comments">
                <h4>Comentários</h4>
                <p>{template.comentarios}</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

