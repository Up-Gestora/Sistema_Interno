import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/Card/Card';
import YearSelect from '../../components/YearSelect/YearSelect';
import {
  CreditoFundoInput,
  CreditoGptConfig,
  CreditoResumoResponse,
  CreditoResumoUsage,
  gerarResumosFundosCredito,
  getCreditoGptConfig,
  getCreditoGptDefaultConfig,
  getCreditoWorkspaceSnapshot,
  saveCreditoWorkspaceSnapshot,
  saveCreditoGptConfig,
  validarFundosCredito,
} from '../../services/creditoUpdateService';
import './AtualizacaoCreditoPage.css';

type FundoStatus = 'nao-validado' | 'confirmado' | 'revisar';

type FundoLinha = {
  id: string;
  nome: string;
  cnpj: string;
  selecionado: boolean;
  status: FundoStatus;
  nomeNormalizado: string;
  confianca: number | null;
  resumoLinhas: string[];
  resumoTexto: string;
  performanceMesPct: number | null;
  cdiMesPct: number | null;
  excessoCdiPct: number | null;
  fatoresAlta: string[];
  fatoresBaixa: string[];
  principalFator: string;
  textoDescritivo: string;
  devedoresMaisImpactaramPositivo: string[];
  devedoresMaisImpactaramNegativo: string[];
  ativosMaisSubiram: string[];
  ativosMenosSubiram: string[];
  carteiraAbertaResumo: string;
};

type CustoModeloPreset = {
  pattern: RegExp;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

const FUNDOS_SUGERIDOS = [
  'Fundo de Credito Privado',
  'Debentures Incentivadas',
  'Fundo High Grade',
  'Fundo High Yield',
  'FIDC',
  'Fundo de Infraestrutura',
];

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Marco',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const normalizarTexto = (valor: string): string => (
  valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
);

const normalizarCnpj = (valor: string): string => valor.replace(/\D/g, '').slice(0, 14);

const formatarCnpj = (valor: string): string => {
  const digits = normalizarCnpj(valor);
  const p1 = digits.slice(0, 2);
  const p2 = digits.slice(2, 5);
  const p3 = digits.slice(5, 8);
  const p4 = digits.slice(8, 12);
  const p5 = digits.slice(12, 14);

  if (digits.length <= 2) return p1;
  if (digits.length <= 5) return `${p1}.${p2}`;
  if (digits.length <= 8) return `${p1}.${p2}.${p3}`;
  if (digits.length <= 12) return `${p1}.${p2}.${p3}/${p4}`;
  return `${p1}.${p2}.${p3}/${p4}-${p5}`;
};

const cnpjValido = (valor: string): boolean => normalizarCnpj(valor).length === 14;

const criarIdFundo = (): string => `fundo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const RESUMO_MIN_LINHAS = 5;
const RESUMO_MAX_LINHAS = 7;
const RESUMO_FALLBACK_LINHAS = [
  'Resultado do mes: desempenho em linha com o carrego esperado da carteira de credito.',
  'Micro (emissores/carteira): nao houve evento idiossincratico relevante nos principais emissores.',
  'Micro (setores/spreads): alocacao seletiva no primario e secundario, com ajuste tatico de risco.',
  'Macro (juros/inflacao): movimento da curva local influenciou a marcacao a mercado e os premios.',
  'Risco e liquidez: carteira manteve perfil defensivo, foco em qualidade e controle de concentracao.',
  'Perspectiva: estrategia segue disciplinada, priorizando ativos com melhor relacao risco-retorno.',
  'Monitoramento: seguimos atentos a atividade, politica monetaria e eventos corporativos.',
];

const formatarConfianca = (valor: number | null): string => {
  if (valor === null) return '--';
  return `${Math.round(valor * 100)}%`;
};

const classificarConfianca = (valor: number | null): string => {
  if (valor === null) return 'Sem dado';
  if (valor >= 0.9) return 'Alta';
  if (valor >= 0.7) return 'Media';
  return 'Baixa';
};

const formatarPercentual = (valor: number | null): string => {
  if (valor === null) return '--';
  const sinal = valor > 0 ? '+' : '';
  return `${sinal}${valor.toFixed(2)}%`;
};

const formatarPontosPercentuais = (valor: number | null): string => {
  if (valor === null) return '--';
  const sinal = valor > 0 ? '+' : '';
  return `${sinal}${valor.toFixed(2)} pp`;
};

const calcularExcessoCdi = (
  excessoCdiPct: number | null,
  performanceMesPct: number | null,
  cdiMesPct: number | null,
): number | null => {
  if (excessoCdiPct !== null) return excessoCdiPct;
  if (performanceMesPct === null || cdiMesPct === null) return null;
  return performanceMesPct - cdiMesPct;
};

const formatarFatores = (fatores: string[]): string => {
  if (!fatores.length) return '--';
  return fatores.join(' | ');
};

const CUSTO_MODELO_PRESETS: CustoModeloPreset[] = [
  { pattern: /^gpt-5\.4-mini$/i, inputUsdPerMillion: 0.75, outputUsdPerMillion: 4.5 },
  { pattern: /^gpt-5\.4-nano$/i, inputUsdPerMillion: 0.2, outputUsdPerMillion: 1.25 },
  { pattern: /^gpt-5\.4$/i, inputUsdPerMillion: 2.5, outputUsdPerMillion: 15 },
  { pattern: /^gpt-5$/i, inputUsdPerMillion: 2.5, outputUsdPerMillion: 15 },
];

const buscarPresetCustoModelo = (model: string): CustoModeloPreset | null => {
  const modelTrim = model.trim();
  if (!modelTrim) return null;
  return CUSTO_MODELO_PRESETS.find((preset) => preset.pattern.test(modelTrim)) || null;
};

const formatarMoeda = (valor: number): string => valor.toFixed(4);

const extrairLinhasResumo = (texto: string): string[] => (
  texto
    .split('\n')
    .map((linha) => linha.replace(/^[\-\*\u2022]\s*/, '').trim())
    .filter(Boolean)
);

const normalizarLinhasEstruturadasResumo = (linhas: string[], textoFallback: string): string[] => {
  const base = linhas
    .map((linha) => linha.replace(/^[\-\*\u2022]\s*/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (base.length < RESUMO_MIN_LINHAS && textoFallback.trim()) {
    extrairLinhasResumo(textoFallback).forEach((linha) => {
      const limpa = linha.replace(/\s+/g, ' ').trim();
      if (!limpa || base.includes(limpa)) return;
      if (base.length < RESUMO_MAX_LINHAS) {
        base.push(limpa);
      }
    });
  }

  if (base.length < RESUMO_MIN_LINHAS) {
    RESUMO_FALLBACK_LINHAS.forEach((linha) => {
      if (base.length < RESUMO_MIN_LINHAS && !base.includes(linha)) {
        base.push(linha);
      }
    });
  }

  return base.slice(0, RESUMO_MAX_LINHAS);
};

const nomeMesEmMinusculo = (mes: number): string => {
  const nomes = [
    'janeiro',
    'fevereiro',
    'marco',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];
  return nomes[mes - 1] || `mes ${mes}`;
};

const montarResumoConsolidadoPadrao = (
  mes: number,
  itens: Array<{
    nome: string;
    resumoLinhas: string[];
    resumoTexto: string;
    devedoresMaisImpactaramPositivo?: string[];
    devedoresMaisImpactaramNegativo?: string[];
    ativosMaisSubiram?: string[];
    ativosMenosSubiram?: string[];
    textoDescritivo?: string;
  }>
): string => {
  const linhas: string[] = [];

  itens.forEach((item) => {
    const nome = item.nome.trim();
    if (!nome) return;

    const resumoBase = item.resumoLinhas.length
      ? item.resumoLinhas
      : extrairLinhasResumo(item.resumoTexto);
    const resumoEstruturado = normalizarLinhasEstruturadasResumo(resumoBase, item.resumoTexto);

    linhas.push(`- *${nome}:*`);
    if (item.devedoresMaisImpactaramPositivo?.length) {
      linhas.push(`  - Devedores/emissores que mais contribuíram: ${item.devedoresMaisImpactaramPositivo.join('; ')}`);
    }
    if (item.devedoresMaisImpactaramNegativo?.length) {
      linhas.push(`  - Devedores/emissores que mais pressionaram: ${item.devedoresMaisImpactaramNegativo.join('; ')}`);
    }
    if (item.ativosMaisSubiram?.length) {
      linhas.push(`  - Ativos que mais subiram: ${item.ativosMaisSubiram.join('; ')}`);
    }
    if (item.ativosMenosSubiram?.length) {
      linhas.push(`  - Ativos que menos subiram/caíram: ${item.ativosMenosSubiram.join('; ')}`);
    }
    if (item.textoDescritivo?.trim()) {
      linhas.push(`  - Leitura descritiva: ${item.textoDescritivo.trim()}`);
    }
    if (!resumoEstruturado.length) {
      linhas.push('  - Resumo ainda nao disponivel.');
      return;
    }

    resumoEstruturado.forEach((linha) => {
      linhas.push(`  - ${linha}`);
    });
  });

  if (!linhas.length) return '';
  return [`*resumo dos fundos de credito em ${nomeMesEmMinusculo(mes)}:*`, ...linhas].join('\n');
};

export default function AtualizacaoCreditoPage() {
  const [configForm, setConfigForm] = useState<CreditoGptConfig>(() => getCreditoGptDefaultConfig());
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());

  const [novoFundoNome, setNovoFundoNome] = useState('');
  const [novoFundoCnpj, setNovoFundoCnpj] = useState('');
  const [fundos, setFundos] = useState<FundoLinha[]>([]);

  const [resumoConsolidado, setResumoConsolidado] = useState('');
  const [ultimaUsage, setUltimaUsage] = useState<CreditoResumoUsage | null>(null);
  const [ultimoModelo, setUltimoModelo] = useState('');
  const [painelCustoAberto, setPainelCustoAberto] = useState(true);
  const [precoInputUsdPorMilhao, setPrecoInputUsdPorMilhao] = useState(2.5);
  const [precoOutputUsdPorMilhao, setPrecoOutputUsdPorMilhao] = useState(15);
  const [cotacaoUsdBrl, setCotacaoUsdBrl] = useState(5.6);
  const [projecaoChamadasMes, setProjecaoChamadasMes] = useState(80);
  const [carregandoValidacao, setCarregandoValidacao] = useState(false);
  const [carregandoGeracao, setCarregandoGeracao] = useState(false);
  const [processandoFundos, setProcessandoFundos] = useState<Record<string, 'validando' | 'gerando'>>({});
  const [workspacePronto, setWorkspacePronto] = useState(false);
  const [mostrarConfigApi, setMostrarConfigApi] = useState(true);

  const anosDisponiveis = useMemo(() => {
    const anoAtual = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, index) => anoAtual + 1 - index);
  }, []);

  useEffect(() => {
    const saved = getCreditoGptConfig();
    if (saved) {
      setConfigForm(saved);
      if (saved.apiKey.trim()) {
        setMostrarConfigApi(false);
      }
    }

    const workspace = getCreditoWorkspaceSnapshot();
    if (workspace) {
      setMes(workspace.mes);
      setAno(workspace.ano);
      setFundos(
        workspace.fundos.map((fundo) => ({
          ...fundo,
          cnpj: formatarCnpj(fundo.cnpj || ''),
          selecionado: fundo.selecionado,
          textoDescritivo: fundo.textoDescritivo || '',
          devedoresMaisImpactaramPositivo: fundo.devedoresMaisImpactaramPositivo || [],
          devedoresMaisImpactaramNegativo: fundo.devedoresMaisImpactaramNegativo || [],
          ativosMaisSubiram: fundo.ativosMaisSubiram || [],
          ativosMenosSubiram: fundo.ativosMenosSubiram || [],
          carteiraAbertaResumo: fundo.carteiraAbertaResumo || '',
        })),
      );
      setResumoConsolidado(workspace.resumoConsolidado);
    }

    setWorkspacePronto(true);
  }, []);

  useEffect(() => {
    if (!workspacePronto) return;

    const timeoutId = window.setTimeout(() => {
      void saveCreditoWorkspaceSnapshot({
        mes,
        ano,
        fundos,
        resumoConsolidado,
      }).catch((error) => {
        console.error('Erro ao salvar workspace de Atualizacao de Credito:', error);
      });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [workspacePronto, mes, ano, fundos, resumoConsolidado]);

  useEffect(() => {
    const preset = buscarPresetCustoModelo(ultimoModelo || configForm.model);
    if (!preset) return;
    setPrecoInputUsdPorMilhao(preset.inputUsdPerMillion);
    setPrecoOutputUsdPorMilhao(preset.outputUsdPerMillion);
  }, [ultimoModelo, configForm.model]);

  const textoFinal = useMemo(() => {
    if (resumoConsolidado.trim()) {
      return resumoConsolidado.trim();
    }

    return montarResumoConsolidadoPadrao(
      mes,
      fundos
        .filter((fundo) => fundo.selecionado && (fundo.resumoLinhas.length || fundo.resumoTexto.trim()))
        .map((fundo) => ({
          nome: fundo.nomeNormalizado || fundo.nome,
          resumoLinhas: fundo.resumoLinhas,
          resumoTexto: fundo.resumoTexto,
          devedoresMaisImpactaramPositivo: fundo.devedoresMaisImpactaramPositivo,
          devedoresMaisImpactaramNegativo: fundo.devedoresMaisImpactaramNegativo,
          ativosMaisSubiram: fundo.ativosMaisSubiram,
          ativosMenosSubiram: fundo.ativosMenosSubiram,
          textoDescritivo: fundo.textoDescritivo,
        })),
    );
  }, [fundos, mes, resumoConsolidado]);

  const limparFeedback = () => {
    setErro('');
    setMensagem('');
  };

  const marcarFundosComoProcessando = (ids: string[], tipo: 'validando' | 'gerando') => {
    setProcessandoFundos((prev) => {
      const proximo = { ...prev };
      ids.forEach((id) => {
        proximo[id] = tipo;
      });
      return proximo;
    });
  };

  const limparFundosProcessando = (ids: string[]) => {
    setProcessandoFundos((prev) => {
      const proximo = { ...prev };
      ids.forEach((id) => {
        delete proximo[id];
      });
      return proximo;
    });
  };

  const validarConfig = (): boolean => {
    if (!configForm.apiKey.trim()) {
      setErro('Informe a API Key do GPT.');
      return false;
    }
    if (!configForm.baseUrl.trim()) {
      setErro('Informe a Base URL da API GPT.');
      return false;
    }
    if (!configForm.model.trim()) {
      setErro('Informe o modelo da API GPT.');
      return false;
    }
    return true;
  };

  const obterFundosSelecionados = (): CreditoFundoInput[] | null => {
    const selecionados = fundos.filter((fundo) => fundo.selecionado);
    if (!selecionados.length) {
      setErro('Selecione ao menos um fundo.');
      return null;
    }

    const invalidos = selecionados.filter((fundo) => !fundo.nome.trim() || !cnpjValido(fundo.cnpj));
    if (invalidos.length) {
      setErro('Preencha nome e CNPJ valido (14 digitos) para todos os fundos selecionados.');
      return null;
    }

    return selecionados.map((fundo) => ({
      id: fundo.id,
      name: fundo.nome.trim(),
      cnpj: normalizarCnpj(fundo.cnpj),
    }));
  };

  const aplicarRespostaNosFundos = (resposta: CreditoResumoResponse, incluirResumo: boolean) => {
    const itemsMap = new Map(resposta.items.map((item) => [item.id, item]));
    setFundos((prev) => prev.map((fundo) => {
      const item = itemsMap.get(fundo.id);
      if (!item) return fundo;

      const status: FundoStatus = item.recognized ? 'confirmado' : 'revisar';
      const linhasFromSummary = extrairLinhasResumo(item.summary || '');
      const resumoLinhas = incluirResumo
        ? (item.summaryLines.length ? item.summaryLines.slice(0, 10) : linhasFromSummary.slice(0, 10))
        : fundo.resumoLinhas;
      const resumoTexto = incluirResumo
        ? (item.summary || item.summaryLines.join('\n'))
        : fundo.resumoTexto;
      const excessoCdiPct = item.excessoCdiPct !== null
        ? item.excessoCdiPct
        : calcularExcessoCdi(item.excessoCdiPct, item.performanceMesPct, item.cdiMesPct);

      return {
        ...fundo,
        status,
        nomeNormalizado: item.normalizedName || fundo.nome,
        cnpj: item.normalizedCnpj ? formatarCnpj(item.normalizedCnpj) : fundo.cnpj,
        confianca: Number.isFinite(item.confidence) ? item.confidence : null,
        resumoLinhas,
        resumoTexto,
        performanceMesPct: item.performanceMesPct,
        cdiMesPct: item.cdiMesPct,
        excessoCdiPct,
        fatoresAlta: (item.fatoresAlta || []).slice(0, 5),
        fatoresBaixa: (item.fatoresBaixa || []).slice(0, 5),
        principalFator: item.principalFator || '',
        textoDescritivo: item.textoDescritivo || '',
        devedoresMaisImpactaramPositivo: (item.devedoresMaisImpactaramPositivo || []).slice(0, 5),
        devedoresMaisImpactaramNegativo: (item.devedoresMaisImpactaramNegativo || []).slice(0, 5),
        ativosMaisSubiram: (item.ativosMaisSubiram || []).slice(0, 5),
        ativosMenosSubiram: (item.ativosMenosSubiram || []).slice(0, 5),
        carteiraAbertaResumo: item.portfolioContextUsed || '',
      };
    }));

    if (incluirResumo) {
      const groupSummary = resposta.groupSummary.trim();
      if (groupSummary) {
        setResumoConsolidado(groupSummary);
      } else {
        setResumoConsolidado(
          montarResumoConsolidadoPadrao(
            mes,
            resposta.items.map((item) => ({
              nome: item.normalizedName || item.inputName,
              resumoLinhas: item.summaryLines || [],
              resumoTexto: item.summary || '',
              devedoresMaisImpactaramPositivo: item.devedoresMaisImpactaramPositivo || [],
              devedoresMaisImpactaramNegativo: item.devedoresMaisImpactaramNegativo || [],
              ativosMaisSubiram: item.ativosMaisSubiram || [],
              ativosMenosSubiram: item.ativosMenosSubiram || [],
              textoDescritivo: item.textoDescritivo || '',
            })),
          ),
        );
      }
    }
  };

  const handleSalvarConfig = () => {
    limparFeedback();
    if (!validarConfig()) return;

    saveCreditoGptConfig(configForm);
    setMensagem('Configuracao da API salva com sucesso.');
    setMostrarConfigApi(false);
  };

  const handleAdicionarFundo = () => {
    limparFeedback();
    const nome = novoFundoNome.trim();
    const cnpj = normalizarCnpj(novoFundoCnpj);

    if (!nome) {
      setErro('Informe o nome do fundo.');
      return;
    }
    if (cnpj.length !== 14) {
      setErro('Informe um CNPJ valido com 14 digitos.');
      return;
    }

    const nomeNormalizado = normalizarTexto(nome);
    const jaExiste = fundos.some(
      (fundo) => normalizarTexto(fundo.nome) === nomeNormalizado || normalizarCnpj(fundo.cnpj) === cnpj,
    );
    if (jaExiste) {
      setErro('Este fundo/CNPJ ja foi adicionado.');
      return;
    }

    setFundos((prev) => [
      ...prev,
      {
        id: criarIdFundo(),
        nome,
        cnpj: formatarCnpj(cnpj),
        selecionado: true,
        status: 'nao-validado',
        nomeNormalizado: '',
        confianca: null,
        resumoLinhas: [],
        resumoTexto: '',
        performanceMesPct: null,
        cdiMesPct: null,
        excessoCdiPct: null,
        fatoresAlta: [],
        fatoresBaixa: [],
        principalFator: '',
        textoDescritivo: '',
        devedoresMaisImpactaramPositivo: [],
        devedoresMaisImpactaramNegativo: [],
        ativosMaisSubiram: [],
        ativosMenosSubiram: [],
        carteiraAbertaResumo: '',
      },
    ]);
    setResumoConsolidado('');
    setNovoFundoNome('');
    setNovoFundoCnpj('');
  };

  const handleRemoverFundo = (id: string) => {
    setFundos((prev) => prev.filter((fundo) => fundo.id !== id));
    setProcessandoFundos((prev) => {
      const proximo = { ...prev };
      delete proximo[id];
      return proximo;
    });
    setResumoConsolidado('');
  };

  const handleAtualizarNomeFundo = (id: string, nome: string) => {
    setFundos((prev) => prev.map((fundo) => {
      if (fundo.id !== id) return fundo;
      return {
        ...fundo,
        nome,
        status: 'nao-validado',
        nomeNormalizado: '',
        confianca: null,
        resumoLinhas: [],
        resumoTexto: '',
        performanceMesPct: null,
        cdiMesPct: null,
        excessoCdiPct: null,
        fatoresAlta: [],
        fatoresBaixa: [],
        principalFator: '',
        textoDescritivo: '',
        devedoresMaisImpactaramPositivo: [],
        devedoresMaisImpactaramNegativo: [],
        ativosMaisSubiram: [],
        ativosMenosSubiram: [],
        carteiraAbertaResumo: '',
      };
    }));
    setResumoConsolidado('');
  };

  const handleAtualizarCnpjFundo = (id: string, cnpj: string) => {
    setFundos((prev) => prev.map((fundo) => {
      if (fundo.id !== id) return fundo;
      return {
        ...fundo,
        cnpj: formatarCnpj(cnpj),
        status: 'nao-validado',
        nomeNormalizado: '',
        confianca: null,
        resumoLinhas: [],
        resumoTexto: '',
        performanceMesPct: null,
        cdiMesPct: null,
        excessoCdiPct: null,
        fatoresAlta: [],
        fatoresBaixa: [],
        principalFator: '',
        textoDescritivo: '',
        devedoresMaisImpactaramPositivo: [],
        devedoresMaisImpactaramNegativo: [],
        ativosMaisSubiram: [],
        ativosMenosSubiram: [],
        carteiraAbertaResumo: '',
      };
    }));
    setResumoConsolidado('');
  };

  const handleAlternarSelecao = (id: string, selecionado: boolean) => {
    setFundos((prev) => prev.map((fundo) => (
      fundo.id === id ? { ...fundo, selecionado } : fundo
    )));
    setResumoConsolidado('');
  };

  const handleValidarSelecionados = async () => {
    limparFeedback();
    if (!validarConfig()) return;

    const selecionados = obterFundosSelecionados();
    if (!selecionados) return;

    const ids = selecionados.map((fundo) => fundo.id);
    marcarFundosComoProcessando(ids, 'validando');
    setCarregandoValidacao(true);
    setUltimaUsage(null);
    try {
      const resposta = await validarFundosCredito(mes, ano, selecionados, configForm);
      aplicarRespostaNosFundos(resposta, false);
      setUltimaUsage(resposta.usage);
      setUltimoModelo(resposta.model);
      setMensagem('Validacao concluida.');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao validar fundos.');
    } finally {
      limparFundosProcessando(ids);
      setCarregandoValidacao(false);
    }
  };

  const handleGerarResumoSelecionados = async () => {
    limparFeedback();
    if (!validarConfig()) return;

    const selecionados = obterFundosSelecionados();
    if (!selecionados) return;

    const ids = selecionados.map((fundo) => fundo.id);
    marcarFundosComoProcessando(ids, 'gerando');
    setCarregandoGeracao(true);
    setUltimaUsage(null);
    setResumoConsolidado('');
    try {
      const resposta = await gerarResumosFundosCredito(mes, ano, selecionados, configForm);
      aplicarRespostaNosFundos(resposta, true);
      setUltimaUsage(resposta.usage);
      setUltimoModelo(resposta.model);
      setMensagem('Resumo unico gerado com sucesso.');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao gerar resumos.');
    } finally {
      limparFundosProcessando(ids);
      setCarregandoGeracao(false);
    }
  };

  const handleAlternarTodos = (selecionado: boolean) => {
    setFundos((prev) => prev.map((fundo) => ({ ...fundo, selecionado })));
    setResumoConsolidado('');
  };

  const handleCopiarTextoFinal = async () => {
    limparFeedback();
    if (!textoFinal.trim()) {
      setErro('Nenhum texto disponivel para copiar.');
      return;
    }

    try {
      await navigator.clipboard.writeText(textoFinal);
      setMensagem('Texto copiado para a area de transferencia.');
    } catch {
      setErro('Nao foi possivel copiar automaticamente.');
    }
  };

  const totalSelecionados = fundos.filter((fundo) => fundo.selecionado).length;
  const todosSelecionados = fundos.length > 0 && totalSelecionados === fundos.length;
  const custoUltimaChamadaUsd = ultimaUsage
    ? (
      ((ultimaUsage.promptTokens * precoInputUsdPorMilhao) / 1_000_000) +
      ((ultimaUsage.completionTokens * precoOutputUsdPorMilhao) / 1_000_000)
    )
    : 0;
  const custoUltimaChamadaBrl = custoUltimaChamadaUsd * cotacaoUsdBrl;
  const custoProjetadoMesUsd = custoUltimaChamadaUsd * projecaoChamadasMes;
  const custoProjetadoMesBrl = custoProjetadoMesUsd * cotacaoUsdBrl;

  return (
    <div className="credito-update-page">
      <div className="page-header">
        <div>
          <h1>Atualizacao de Credito</h1>
          <p className="page-subtitle">
            Cadastre os fundos com nome + CNPJ, gere um texto unificado do fechamento e copie o TXT final.
          </p>
        </div>
      </div>

      {(mensagem || erro) && (
        <div className={`credito-update-banner ${erro ? 'error' : 'success'}`}>
          {erro || mensagem}
        </div>
      )}

      <Card title="Fechamento" className="credito-update-card">
        <div className="credito-fechamento-row">
          <span className="credito-fechamento-label">Selecione o fechamento:</span>
          <div className="credito-fechamento-controls">
            <select
              value={mes}
              onChange={(event) => {
                setMes(Number(event.target.value));
                setResumoConsolidado('');
              }}
            >
              {MESES.map((mesLabel, index) => (
                <option key={mesLabel} value={index + 1}>
                  {mesLabel}
                </option>
              ))}
            </select>
            <YearSelect
              id="credito-update-ano"
              value={ano}
              years={anosDisponiveis}
              onChange={(value) => {
                setAno(value);
                setResumoConsolidado('');
              }}
            />
          </div>
        </div>
      </Card>

      <Card title="Fundos selecionados" className="credito-update-card">
        <div className="credito-fundo-add">
          <input
            type="text"
            list="credito-fundos-sugeridos"
            value={novoFundoNome}
            onChange={(event) => setNovoFundoNome(event.target.value)}
            placeholder="Nome do fundo"
          />
          <input
            type="text"
            value={novoFundoCnpj}
            onChange={(event) => setNovoFundoCnpj(formatarCnpj(event.target.value))}
            placeholder="CNPJ (00.000.000/0000-00)"
          />
          <button type="button" className="btn-primary" onClick={handleAdicionarFundo}>
            + Incluir fundo
          </button>
          <datalist id="credito-fundos-sugeridos">
            {FUNDOS_SUGERIDOS.map((fundo) => (
              <option key={fundo} value={fundo} />
            ))}
          </datalist>
        </div>

        <div className="credito-update-actions credito-update-actions--top">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleValidarSelecionados}
            disabled={carregandoValidacao || !fundos.length}
          >
            {carregandoValidacao ? 'Validando...' : 'Validar selecionados'}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleGerarResumoSelecionados}
            disabled={carregandoGeracao || !fundos.length}
          >
            {carregandoGeracao ? 'Gerando...' : 'Gerar TXT unificado'}
          </button>
          <button type="button" className="btn-secondary" onClick={handleCopiarTextoFinal}>
            Copiar texto
          </button>
          <label className="credito-check-all">
            <input
              type="checkbox"
              checked={todosSelecionados}
              onChange={(event) => handleAlternarTodos(event.target.checked)}
              disabled={!fundos.length}
            />
            Selecionar todos
          </label>
          <span className="credito-info-inline">
            {totalSelecionados} selecionado(s)
          </span>
        </div>

        {fundos.length === 0 ? (
          <div className="empty-state">Nenhum fundo adicionado.</div>
        ) : (
          <div className="credito-fundos-lista">
            {fundos.map((fundo) => {
              const processando = processandoFundos[fundo.id];
              const statusLabel = processando === 'validando'
                ? 'Validando'
                : processando === 'gerando'
                  ? 'Gerando'
                  : fundo.status === 'confirmado'
                    ? 'Confirmado'
                    : fundo.status === 'revisar'
                      ? 'Revisar'
                      : 'Nao validado';

              const statusClass = processando
                ? 'status-processando'
                : fundo.status === 'confirmado'
                  ? 'status-ok'
                  : fundo.status === 'revisar'
                    ? 'status-warning'
                    : 'status-pending';

              return (
                <div key={fundo.id} className="credito-fundo-row">
                  <div className="credito-fundo-main">
                    <label className="credito-check">
                      <input
                        type="checkbox"
                        checked={fundo.selecionado}
                        onChange={(event) => handleAlternarSelecao(fundo.id, event.target.checked)}
                      />
                    </label>

                    <input
                      type="text"
                      value={fundo.nome}
                      onChange={(event) => handleAtualizarNomeFundo(fundo.id, event.target.value)}
                      placeholder="Nome do fundo"
                    />

                    <input
                      type="text"
                      value={fundo.cnpj}
                      onChange={(event) => handleAtualizarCnpjFundo(fundo.id, event.target.value)}
                      placeholder="CNPJ"
                    />

                    <span className={`credito-status ${statusClass}`}>{statusLabel}</span>

                    <button
                      type="button"
                      className="btn-danger-inline"
                      onClick={() => handleRemoverFundo(fundo.id)}
                    >
                      Remover
                    </button>
                  </div>

                  <div className="credito-fundo-meta">
                    <span>
                      Entendido como: <strong>{fundo.nomeNormalizado || '--'}</strong>
                    </span>
                    <span>
                      CNPJ: <strong>{formatarCnpj(fundo.cnpj) || '--'}</strong>
                    </span>
                    <span title="Confianca vem da API GPT (0 a 1) e representa a aderencia entre nome/CNPJ informado e o reconhecimento do fundo. Faixas: >=90% alta, 70% a 89% media, abaixo de 70% revisar.">
                      Confianca: <strong>{formatarConfianca(fundo.confianca)}</strong> ({classificarConfianca(fundo.confianca)})
                    </span>
                    <span>
                      Performance mes: <strong>{formatarPercentual(fundo.performanceMesPct)}</strong> | CDI mes: <strong>{formatarPercentual(fundo.cdiMesPct)}</strong> | Acima do CDI: <strong>{formatarPontosPercentuais(calcularExcessoCdi(fundo.excessoCdiPct, fundo.performanceMesPct, fundo.cdiMesPct))}</strong>
                    </span>
                    <span>
                      Vetores de alta: <strong>{formatarFatores(fundo.fatoresAlta)}</strong>
                    </span>
                    <span>
                      Vetores de baixa: <strong>{formatarFatores(fundo.fatoresBaixa)}</strong>
                    </span>
                    <span>
                      Devedores que mais contribuíram: <strong>{formatarFatores(fundo.devedoresMaisImpactaramPositivo)}</strong>
                    </span>
                    <span>
                      Devedores que mais pressionaram: <strong>{formatarFatores(fundo.devedoresMaisImpactaramNegativo)}</strong>
                    </span>
                    <span>
                      Ativos que mais subiram: <strong>{formatarFatores(fundo.ativosMaisSubiram)}</strong>
                    </span>
                    <span>
                      Ativos que menos subiram/caíram: <strong>{formatarFatores(fundo.ativosMenosSubiram)}</strong>
                    </span>
                    <span>
                      Fator-chave do mes: <strong>{fundo.principalFator || '--'}</strong>
                    </span>
                    <span className="credito-descricao-span">
                      Leitura descritiva: <strong>{fundo.textoDescritivo || '--'}</strong>
                    </span>
                    <span className="credito-descricao-span">
                      Contexto da ultima carteira aberta usada automaticamente: <strong>{fundo.carteiraAbertaResumo || '--'}</strong>
                    </span>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Texto final (formato TXT para copiar)" className="credito-update-card">
        {textoFinal.trim() ? (
          <pre className="credito-consolidado">{textoFinal}</pre>
        ) : (
          <div className="empty-state">Gere o TXT unificado para montar o texto final.</div>
        )}
      </Card>

      <Card title="Conexao da API GPT" className="credito-update-card credito-update-card--full">
        <div className="credito-config-toggle">
          <span className="credito-fechamento-label">
            {mostrarConfigApi ? 'Configuracao expandida' : 'Configuracao recolhida'}
          </span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setMostrarConfigApi((prev) => !prev)}
          >
            {mostrarConfigApi ? 'Recolher' : 'Expandir'}
          </button>
        </div>

        {mostrarConfigApi && (
          <>
            <div className="credito-form-grid">
              <label>
                API Key *
                <input
                  type="password"
                  value={configForm.apiKey}
                  onChange={(event) => setConfigForm((prev) => ({ ...prev, apiKey: event.target.value }))}
                  placeholder="Cole sua chave da API GPT"
                />
              </label>
              <label>
                Base URL *
                <input
                  type="text"
                  value={configForm.baseUrl}
                  onChange={(event) => setConfigForm((prev) => ({ ...prev, baseUrl: event.target.value }))}
                  placeholder="https://api.openai.com/v1"
                />
              </label>
              <label>
                Modelo *
                <input
                  type="text"
                  value={configForm.model}
                  onChange={(event) => setConfigForm((prev) => ({ ...prev, model: event.target.value }))}
                  placeholder="gpt-5"
                />
              </label>
            </div>
            <div className="credito-update-actions">
              <button type="button" className="btn-primary" onClick={handleSalvarConfig}>
                Salvar configuracao
              </button>
            </div>
          </>
        )}
      </Card>

      <div className={`credito-cost-box ${painelCustoAberto ? 'open' : 'collapsed'}`}>
        <button
          type="button"
          className="credito-cost-toggle"
          onClick={() => setPainelCustoAberto((prev) => !prev)}
        >
          {painelCustoAberto ? 'Fechar custo' : 'Abrir custo'}
        </button>
        {painelCustoAberto && (
          <div className="credito-cost-content">
            <h3>Controle de custo</h3>
            <p className="credito-cost-modelo">
              Modelo base: <strong>{(ultimoModelo || configForm.model || '--').trim() || '--'}</strong>
            </p>
            <div className="credito-cost-grid">
              <label>
                Input (USD / 1M tokens)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={Number.isFinite(precoInputUsdPorMilhao) ? precoInputUsdPorMilhao : 0}
                  onChange={(event) => setPrecoInputUsdPorMilhao(Math.max(0, Number(event.target.value) || 0))}
                />
              </label>
              <label>
                Output (USD / 1M tokens)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={Number.isFinite(precoOutputUsdPorMilhao) ? precoOutputUsdPorMilhao : 0}
                  onChange={(event) => setPrecoOutputUsdPorMilhao(Math.max(0, Number(event.target.value) || 0))}
                />
              </label>
              <label>
                Cotacao USD/BRL
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={Number.isFinite(cotacaoUsdBrl) ? cotacaoUsdBrl : 0}
                  onChange={(event) => setCotacaoUsdBrl(Math.max(0, Number(event.target.value) || 0))}
                />
              </label>
              <label>
                Chamadas no mes
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={Number.isFinite(projecaoChamadasMes) ? projecaoChamadasMes : 0}
                  onChange={(event) => setProjecaoChamadasMes(Math.max(0, Math.round(Number(event.target.value) || 0)))}
                />
              </label>
            </div>
            {ultimaUsage ? (
              <div className="credito-cost-resultados">
                <p>Tokens ultima chamada: prompt <strong>{ultimaUsage.promptTokens}</strong> | completion <strong>{ultimaUsage.completionTokens}</strong> | total <strong>{ultimaUsage.totalTokens}</strong></p>
                <p>Custo ultima chamada: <strong>US$ {formatarMoeda(custoUltimaChamadaUsd)}</strong> | <strong>R$ {formatarMoeda(custoUltimaChamadaBrl)}</strong></p>
                <p>Projecao mensal ({projecaoChamadasMes} chamadas): <strong>US$ {formatarMoeda(custoProjetadoMesUsd)}</strong> | <strong>R$ {formatarMoeda(custoProjetadoMesBrl)}</strong></p>
              </div>
            ) : (
              <div className="credito-cost-empty">Gere uma chamada (Validar ou Gerar) para calcular custo real.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
