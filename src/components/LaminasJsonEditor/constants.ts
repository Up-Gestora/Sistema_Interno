import type { LaminaBlockItem, LaminaTemplate } from './types';

export const DIAS_UTEIS_ANO = 252;
export const STRATEGY_DATA_KEY = 'estrategia_diaria_por_estrategia';
export const STRATEGY_ID_KEY = 'estrategia_diaria_id';
export const LAMINA_STRATEGY_KEY = 'lamina_estrategia_id';
export const LAMINA_LAYOUT_KEY = 'lamina_layout_v1';
export const LAMINA_LAYOUT_MODE_KEY = 'lamina_layout_mode_v1';
export const LAMINA_LOGOS_KEY = 'lamina_logo_assets_v1';
export const LAMINA_HIDDEN_KEY = 'lamina_hidden_blocks_v1';

export const LAMINA_BLOCKS: LaminaBlockItem[] = [
  { id: 'topbar', label: 'Cabeçalho' },
  { id: 'intro', label: 'Introdução' },
  { id: 'divider', label: 'Divisor' },
  { id: 'left', label: 'Coluna esquerda' },
  { id: 'atribuicao', label: 'Drawdown (gráfico)' },
  { id: 'chart', label: 'Gráfico' },
  { id: 'tables', label: 'Tabelas (Resumo + Performance)' },
  { id: 'mes', label: 'Mês/título' },
  { id: 'comentarios', label: 'Comentários' },
  { id: 'operacional', label: 'Operacional' },
  { id: 'footer', label: 'Rodapé' },
];

export const TEMPLATE_PADRAO: LaminaTemplate = {
  header: {
    logo: 'UP',
    titulo: 'Carteira UP FIIs',
    subtitulo: 'INTELIGÊNCIA ARTIFICIAL A SERVIÇO DO SEU DINHEIRO',
    periodo: 'Dezembro/25',
    destaque: '+6,00%',
  },
  intro: [
    {
      texto:
        'A Carteira Tática UP se encontra aberta para captação, buscando gerar alpha junto ao IFIX e monitorar o mercado e oportunidades do agronegócio e infraestrutura. Esta é uma estratégia focada em fundos imobiliários, agro e infra que identifica movimentos de mercado e oportunidades geradas por eventos distorções nos núcleos de um acompanhamento próximo da classe de ativos.',
      destaques: ['estratégia focada', 'fundos imobiliários', 'agro e infra'],
    },
    {
      texto:
        'Para fins de esclarecimento, o núcleo de gestão de retorno vem da estratégia de fundos listados, mas também é possível estar exposto a esse ativo via ETFs e outros tipos de oportunidades no mercado de renda variável.',
      destaques: ['gestão de retorno', 'ETFs'],
    },
    {
      texto:
        'Por questões de equilíbrio no modelo estatístico, a capacidade de alocação é limitada para preservar eficiência de execução. Portanto, novas entradas estão sendo recebidas enquanto há espaço.',
      destaques: ['novas entradas', 'espaço'],
    },
  ],
  publicoAlvo: 'Qualquer investidor com perfil de risco moderado/arrojado.',
  kpis: [
    { label: 'Drawdown máximo', value: '-3,24%' },
    { label: 'Volatilidade anualizada', value: '7,38%' },
    { label: 'Retorno acumulado', value: '43,55%' },
    { label: 'Índice de Sharpe', value: '3,60' },
    { label: 'Benchmark', value: 'IFIX' },
    { label: 'Alpha sobre IFIX', value: '28,32%' },
    { label: 'Investimento mínimo', value: 'R$ 50.000,00' },
    { label: 'Cota de resgate', value: 'Imediata' },
    { label: 'Prazo de resgate', value: 'D+5' },
    { label: 'Taxa de gestão', value: '0,60% a 2,00%' },
    { label: 'Taxa de performance', value: '30%' },
    { label: 'Gestão', value: 'UP GCA' },
    { label: 'PL total', value: 'R$ 6,76MM' },
  ],
  chart: {
    title: 'Track Record',
    subtitle: '+43,55%',
    data: [
      { label: 'Abr/23', tatica: -4, ifix: -3, cdi: 0.2 },
      { label: 'Jul/23', tatica: 2, ifix: 0.6, cdi: 1.0 },
      { label: 'Out/23', tatica: 9, ifix: 4, cdi: 2.2 },
      { label: 'Jan/24', tatica: 16, ifix: 8, cdi: 3.5 },
      { label: 'Abr/24', tatica: 22, ifix: 11, cdi: 4.8 },
      { label: 'Jul/24', tatica: 29, ifix: 15, cdi: 6.1 },
      { label: 'Out/24', tatica: 35, ifix: 18, cdi: 7.3 },
      { label: 'Jan/25', tatica: 39, ifix: 21, cdi: 8.5 },
      { label: 'Abr/25', tatica: 43.6, ifix: 24.4, cdi: 9.8 },
    ],
  },
  resumoMensal: [
    { label: 'Total de operações', value: '124' },
    { label: 'Operações com ganhos', value: '84,68% (03 M)' },
    { label: 'Fator de lucro', value: '+25% (Início)' },
    { label: 'Dias no período', value: '0' },
  ],
  tabelaPerformance: {
    headers: ['Período', 'Tática', 'IFIX', 'CDI', 'Alpha'],
    rows: [
      ['01 M', '6,00', '3,13', '0,96', '2,86'],
      ['03 M', '7,91', '5,18', '3,01', '2,73'],
      ['Início', '43,55', '15,23', '14,43', '28,32'],
    ],
  },
  mesTitulo: 'Dezembro de 2025',
  comentarios: [
    {
      texto:
        'Fechamos o mês com rentabilidade líquida de 6,00%, frente a 3,13% do IFIX e 0,96% do CDI. Podemos aproveitar bom e breve rally no fim do ano e, em risco, deixamos de performar em alguns meses da carteira. Além disso, para o ano de 2026 seguiremos desenvolvendo estratégias e aprimorando o sistema de negociações para melhor aproveitar as distorções de mercado e dos fundos listados. Para isso, iniciamos a reestruturação da nossa plataforma com o objetivo de trazer mais agilidade com o sistema UP 5.0.',
      destaques: ['rentabilidade líquida', 'IFIX', 'CDI', 'UP 5.0'],
    },
    {
      texto:
        'Até o momento, mantemos um retorno líquido de 43,55% desde o início da carteira, que representa um alpha de 28,32% em relação ao IFIX e 26,57% em relação ao CDI.',
      destaques: ['retorno líquido', 'desde o início', 'alpha', 'IFIX', 'CDI'],
    },
    {
      texto:
        'Atuamos via carteira administrada, com execução direta no custo do investidor. Investimento exclusivamente via BTG - contato Igor: WhatsApp (11) 97440-3788.',
      destaques: ['BTG', 'WhatsApp'],
    },
  ],
  atribuicao: {
    title: 'Atribuição de Resultados',
    itens: [
      { label: 'FIIs', value: 98.09, color: 'var(--primary-color)' },
      { label: 'Ações e ETFs', value: 1.91, color: 'var(--secondary-color, #8ea4bf)' },
    ],
  },
  operacional: {
    titulo: 'Operacional',
    itens: [
      'Estratégia sistemática em ETFs.',
      'Gestão de risco dinâmica e automatizada via sistema interno.',
      'Controle de drawdown e stop técnico com mecanismos de segurança ágil.',
      'Exploração de padrões de retorno com núcleos externos.',
      'Revisão mensal de parâmetros e performance.',
      'Monitoramento contínuo de mercado em tempo real 24/7.',
    ],
  },
  rodape: {
    texto: 'UP Carteiras Administradas',
    codigo: '58.450.405/0001-01',
    logo: 'UP',
  },
};























