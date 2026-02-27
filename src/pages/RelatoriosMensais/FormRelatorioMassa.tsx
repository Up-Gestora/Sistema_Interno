import { useState, useMemo, useEffect, useRef } from 'react';
import { Cliente } from '../../types';
import { RelatorioMensal } from '../../types/relatorio';
import { useEstrategias } from '../../hooks/useEstrategias';
import { buscarCDI } from '../../services/cdiIfixService';
import Card from '../../components/Card/Card';
import YearSelect from '../../components/YearSelect/YearSelect';
import { formatDecimalInput, parseDecimalInput } from '../../utils/numberInput';
import './FormRelatorioMassa.css';

interface FormRelatorioMassaProps {
  clientes: Cliente[];
  onGerarPDFs: (relatorios: RelatorioMensal[]) => void;
}

interface ClienteSelecionado {
  clienteId: string;
  selecionado: boolean;
  estrategias: EstrategiaSelecionada[];
}

interface EstrategiaSelecionada {
  estrategiaId: string;
  titulo: string;
  tituloPersonalizado: string;
  patrimonioTotal: string;
  resultadoPercentual: string;
  resultadoValor: string;
  comentario: string;
  comentarioImagens: Array<{ id: string; src: string }>;
}

export default function FormRelatorioMassa({ clientes, onGerarPDFs }: FormRelatorioMassaProps) {
  const { estrategias } = useEstrategias();
  const [formData, setFormData] = useState({
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    resumoMacro: '',
    cdiMensal: '',
    textoAcimaCDI: '',
    textoAbaixoCDI: '',
  });

  const [clientesSelecionados, setClientesSelecionados] = useState<Record<string, ClienteSelecionado>>({});
  const [estrategiaSelecionada, setEstrategiaSelecionada] = useState<string>('');
  const [carregandoCDI, setCarregandoCDI] = useState(false);
  const [erroCDI, setErroCDI] = useState<string>('');
  const [uploadContexto, setUploadContexto] = useState<{
    clienteId: string;
    estrategiaIndex: number;
    selectionStart: number;
    selectionEnd: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const comentarioRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const formatDateIso = (date: Date) => {
    const ano = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  };

  const obterNomeEstrategia = (estrategiaId?: string) => {
    if (!estrategiaId) return 'Estratégia principal';
    return estrategias.find(estrategia => estrategia.id === estrategiaId)?.nome || 'Estratégia principal';
  };

  const criarEstrategiaPadrao = (cliente?: Cliente): EstrategiaSelecionada => {
    const estrategiaId = cliente?.estrategiaId || '';
    return {
      estrategiaId,
      titulo: obterNomeEstrategia(estrategiaId),
      tituloPersonalizado: '',
      patrimonioTotal: '',
      resultadoPercentual: '',
      resultadoValor: '',
      comentario: '',
      comentarioImagens: [],
    };
  };

  // Buscar CDI automaticamente quando mês/ano mudar
  useEffect(() => {
    const buscarCDIMensal = async () => {
      if (!formData.mes || !formData.ano) return;

      setCarregandoCDI(true);
      setErroCDI('');

      try {
        // Calcular data início e fim do mês
        const dataInicio = new Date(formData.ano, formData.mes - 1, 1);
        const dataFim = new Date(formData.ano, formData.mes, 0); // Último dia do mês

        const dataInicioStr = formatDateIso(dataInicio);
        const dataFimStr = formatDateIso(dataFim);

        const cdiMensal = await buscarCDI(dataInicioStr, dataFimStr);

        if (cdiMensal !== null) {
          setFormData(prev => ({ ...prev, cdiMensal: formatDecimalInput(cdiMensal) }));
        } else {
          setErroCDI('CDI não encontrado para o período selecionado. Preencha manualmente.');
        }
      } catch (error) {
        console.error('Erro ao buscar CDI:', error);
        setErroCDI('Erro ao buscar CDI. Preencha manualmente.');
      } finally {
        setCarregandoCDI(false);
      }
    };

    // Debounce para evitar muitas requisições
    const timeoutId = setTimeout(buscarCDIMensal, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.mes, formData.ano]);

  // Quando a estratégia mudar, atualizar automaticamente os clientes selecionados
  const handleEstrategiaChange = (estrategiaId: string) => {
    setEstrategiaSelecionada(estrategiaId);
    
    if (!estrategiaId) {
      // Se não houver estratégia selecionada, limpar seleção
      setClientesSelecionados({});
      return;
    }
    
    // Selecionar todos os clientes da estratégia
    const clientesEstrategia = clientes.filter(c => c.estrategiaId === estrategiaId);
    const novosSelecionados: Record<string, ClienteSelecionado> = {};
    
    clientesEstrategia.forEach(cliente => {
      novosSelecionados[cliente.id] = {
        clienteId: cliente.id,
        selecionado: true,
        estrategias: [criarEstrategiaPadrao(cliente)],
      };
    });
    
    setClientesSelecionados(novosSelecionados);
  };

  // Obter clientes da estratégia selecionada
  const clientesEstrategiaSelecionada = useMemo(() => {
    if (!estrategiaSelecionada) return [];
    return clientes.filter(c => c.estrategiaId === estrategiaSelecionada);
  }, [clientes, estrategiaSelecionada]);

  const atualizarDadosCliente = (
    clienteId: string,
    estrategiaIndex: number,
    campo: keyof EstrategiaSelecionada,
    valor: string
  ) => {
    setClientesSelecionados(prev => {
      const cliente = prev[clienteId];
      if (!cliente) return prev;

      const estrategiasAtualizadas = cliente.estrategias.map((estrategia, index) => {
        if (index !== estrategiaIndex) return estrategia;
        return { ...estrategia, [campo]: valor };
      });

      return {
        ...prev,
        [clienteId]: {
          ...cliente,
          estrategias: estrategiasAtualizadas,
        },
      };
    });
  };

  const atualizarComentarioCliente = (clienteId: string, estrategiaIndex: number, comentario: string) => {
    setClientesSelecionados(prev => {
      const cliente = prev[clienteId];
      if (!cliente) return prev;
      return {
        ...prev,
        [clienteId]: {
          ...cliente,
          estrategias: cliente.estrategias.map((estrategia, index) => (
            index === estrategiaIndex
              ? { ...estrategia, comentario }
              : estrategia
          )),
        },
      };
    });
  };

  const atualizarEstrategiaCliente = (clienteId: string, estrategiaIndex: number, estrategiaId: string) => {
    const titulo = obterNomeEstrategia(estrategiaId);
    setClientesSelecionados(prev => {
      const cliente = prev[clienteId];
      if (!cliente) return prev;
      return {
        ...prev,
        [clienteId]: {
          ...cliente,
          estrategias: cliente.estrategias.map((estrategia, index) => (
            index === estrategiaIndex
              ? { ...estrategia, estrategiaId, titulo }
              : estrategia
          )),
        },
      };
    });
  };

  const adicionarEstrategiaCliente = (clienteId: string) => {
    setClientesSelecionados(prev => {
      const cliente = prev[clienteId];
      if (!cliente) return prev;
      return {
        ...prev,
        [clienteId]: {
          ...cliente,
          estrategias: [
            ...cliente.estrategias,
            {
              estrategiaId: '',
              titulo: 'Estratégia manual',
              tituloPersonalizado: '',
              patrimonioTotal: '',
              resultadoPercentual: '',
              resultadoValor: '',
              comentario: '',
              comentarioImagens: [],
            },
          ],
        },
      };
    });
  };

  const removerEstrategiaCliente = (clienteId: string, estrategiaIndex: number) => {
    setClientesSelecionados(prev => {
      const cliente = prev[clienteId];
      if (!cliente) return prev;
      return {
        ...prev,
        [clienteId]: {
          ...cliente,
          estrategias: cliente.estrategias.filter((_, index) => index !== estrategiaIndex),
        },
      };
    });
  };

  const toggleClienteSelecionado = (clienteId: string) => {
    setClientesSelecionados(prev => {
      const cliente = prev[clienteId];
      if (!cliente) return prev;
      return {
        ...prev,
        [clienteId]: {
          ...cliente,
          selecionado: !cliente.selecionado,
        },
      };
    });
  };

  const adicionarImagemComentario = (
    clienteId: string,
    estrategiaIndex: number,
    dataUrl: string,
    selectionStart?: number,
    selectionEnd?: number
  ) => {
    const idImagem = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const token = `[[img:${idImagem}]]`;
    setClientesSelecionados(prev => {
      const cliente = prev[clienteId];
      if (!cliente) return prev;
      return {
        ...prev,
        [clienteId]: {
          ...cliente,
          estrategias: cliente.estrategias.map((estrategia, index) => (
            index === estrategiaIndex
              ? {
                ...estrategia,
                comentarioImagens: [...(estrategia.comentarioImagens || []), { id: idImagem, src: dataUrl }],
                comentario: (() => {
                  const comentarioAtual = estrategia.comentario || '';
                  const start = selectionStart ?? comentarioAtual.length;
                  const end = selectionEnd ?? comentarioAtual.length;
                  const before = comentarioAtual.slice(0, start);
                  const after = comentarioAtual.slice(end);
                  const prefix = before && !before.endsWith('\n') ? '\n' : '';
                  const suffix = after && !after.startsWith('\n') ? '\n' : '';
                  return `${before}${prefix}${token}${suffix}${after}`;
                })(),
              }
              : estrategia
          )),
        },
      };
    });
  };

  const inserirTokenNoComentario = (clienteId: string, estrategiaIndex: number, token: string) => {
    const key = `${clienteId}-${estrategiaIndex}`;
    const textarea = comentarioRefs.current[key];
    const selectionStart = textarea?.selectionStart ?? (textarea?.value.length || 0);
    const selectionEnd = textarea?.selectionEnd ?? (textarea?.value.length || 0);

    setClientesSelecionados(prev => {
      const cliente = prev[clienteId];
      if (!cliente) return prev;
      return {
        ...prev,
        [clienteId]: {
          ...cliente,
          estrategias: cliente.estrategias.map((estrategia, index) => {
            if (index !== estrategiaIndex) return estrategia;
            const comentarioAtual = estrategia.comentario || '';
            const before = comentarioAtual.slice(0, selectionStart);
            const after = comentarioAtual.slice(selectionEnd);
            const prefix = before && !before.endsWith('\n') ? '\n' : '';
            const suffix = after && !after.startsWith('\n') ? '\n' : '';
            return {
              ...estrategia,
              comentario: `${before}${prefix}${token}${suffix}${after}`,
            };
          }),
        },
      };
    });

    if (textarea) {
      textarea.focus();
    }
  };

  const removerImagemComentario = (clienteId: string, estrategiaIndex: number, imagemIndex: number) => {
    setClientesSelecionados(prev => {
      const cliente = prev[clienteId];
      if (!cliente) return prev;
      return {
        ...prev,
        [clienteId]: {
          ...cliente,
          estrategias: cliente.estrategias.map((estrategia, index) => {
            if (index !== estrategiaIndex) return estrategia;
            const imagensAtualizadas = (estrategia.comentarioImagens || []).filter((_, idx) => idx !== imagemIndex);
            const imagemRemovida = (estrategia.comentarioImagens || [])[imagemIndex];
            const tokenRemover = imagemRemovida ? `[[img:${imagemRemovida.id}]]` : '';
            const comentarioAtualizado = tokenRemover
              ? (estrategia.comentario || '').replaceAll(tokenRemover, '').replace(/\n{3,}/g, '\n\n').trim()
              : estrategia.comentario;
            return {
              ...estrategia,
              comentarioImagens: imagensAtualizadas,
              comentario: comentarioAtualizado,
            };
          }),
        },
      };
    });
  };

  const abrirSeletorImagem = (clienteId: string, estrategiaIndex: number) => {
    const key = `${clienteId}-${estrategiaIndex}`;
    const textarea = comentarioRefs.current[key];
    const selectionStart = textarea?.selectionStart ?? (textarea?.value.length || 0);
    const selectionEnd = textarea?.selectionEnd ?? (textarea?.value.length || 0);
    setUploadContexto({ clienteId, estrategiaIndex, selectionStart, selectionEnd });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleImagemSelecionada = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uploadContexto) return;
    if (!file.type.startsWith('image/')) {
      alert('Selecione um arquivo de imagem.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (dataUrl) {
        adicionarImagemComentario(
          uploadContexto.clienteId,
          uploadContexto.estrategiaIndex,
          dataUrl,
          uploadContexto.selectionStart,
          uploadContexto.selectionEnd
        );
      }
      setUploadContexto(null);
    };
    reader.onerror = () => {
      alert('Não foi possível carregar a imagem.');
      setUploadContexto(null);
    };
    reader.readAsDataURL(file);
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.resumoMacro) {
      alert('Por favor, preencha o Resumo Macro.');
      return;
    }

    if (!formData.textoAcimaCDI || !formData.textoAbaixoCDI) {
      alert('Por favor, preencha os textos para resultado acima e abaixo do CDI.');
      return;
    }

    if (!estrategiaSelecionada) {
      alert('Por favor, selecione uma estratégia.');
      return;
    }

    const clientesIds = Object.keys(clientesSelecionados).filter(
      id => clientesSelecionados[id]?.selecionado
    );
    if (clientesIds.length === 0) {
      alert('Nenhum cliente encontrado para a estratégia selecionada.');
      return;
    }

    const relatorios: RelatorioMensal[] = clientesIds.map(clienteId => {
      const dados = clientesSelecionados[clienteId];
      const cliente = clientes.find(c => c.id === clienteId);

      const cdiMensal = parseDecimalInput(formData.cdiMensal);
      const estrategiasRelatorio = dados.estrategias.map((estrategia) => {
        const tituloResolvido =
          estrategia.tituloPersonalizado?.trim() ||
          estrategia.titulo ||
          obterNomeEstrategia(estrategia.estrategiaId) ||
          'Estratégia manual';
        const resultadoPercentual = parseDecimalInput(estrategia.resultadoPercentual);
        const patrimonioTotal = parseDecimalInput(estrategia.patrimonioTotal);
        const resultadoValor = parseDecimalInput(estrategia.resultadoValor);
        const resumoTextoPadrao = resultadoPercentual > cdiMensal
          ? formData.textoAcimaCDI
          : formData.textoAbaixoCDI;
        const comentarioIndividual = estrategia.comentario?.trim();
        const resumoTextoFinal = comentarioIndividual
          ? (resumoTextoPadrao ? `${resumoTextoPadrao}\n\n${comentarioIndividual}` : comentarioIndividual)
          : (resumoTextoPadrao || '');

        return {
          titulo: tituloResolvido,
          patrimonioTotal,
          resultadoMes: resultadoValor,
          resultadoPercentual,
          resumoTexto: resumoTextoFinal,
          resumoImagens: estrategia.comentarioImagens,
        };
      });
      const estrategiaPrincipal = estrategiasRelatorio[0];

      return {
        clienteId,
        clienteNome: cliente?.nome,
        mes: formData.mes,
        ano: formData.ano,
        resumoMacro: formData.resumoMacro,
        patrimonioTotal: estrategiaPrincipal?.patrimonioTotal || 0,
        resultadoMes: estrategiaPrincipal?.resultadoMes || 0,
        resultadoPercentual: estrategiaPrincipal?.resultadoPercentual || 0,
        resumoTexto: estrategiaPrincipal?.resumoTexto || '',
        cdiMensal,
        textoAcimaCDI: formData.textoAcimaCDI,
        textoAbaixoCDI: formData.textoAbaixoCDI,
        estrategias: estrategiasRelatorio,
        dataGeracao: new Date().toISOString(),
      };
    });

    onGerarPDFs(relatorios);
  };

  const clientesSelecionadosList = useMemo(() => {
    return Object.keys(clientesSelecionados).map(id => {
      const cliente = clientes.find(c => c.id === id);
      return { id, cliente, dados: clientesSelecionados[id] };
    });
  }, [clientesSelecionados, clientes]);

  const totalSelecionados = useMemo(() => {
    return Object.values(clientesSelecionados).filter(c => c.selecionado).length;
  }, [clientesSelecionados]);

  const anosDisponiveis = Array.from({ length: 81 }, (_, index) => 2020 + index);

  return (
    <Card title="Geração em Massa de Relatórios" className="form-relatorio-massa">
      <form onSubmit={handleSubmit} className="relatorio-massa-form">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImagemSelecionada}
          style={{ display: 'none' }}
        />
        <div className="form-section">
          <h3>Período e Resumos Padrão</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="mes">Mês *</label>
              <select
                id="mes"
                value={formData.mes}
                onChange={(e) => setFormData({ ...formData, mes: parseInt(e.target.value) })}
                required
              >
                {meses.map((mes, index) => (
                  <option key={index} value={index + 1}>
                    {mes}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="ano">Ano *</label>
              <YearSelect
                id="ano"
                value={Number(formData.ano) || new Date().getFullYear()}
                years={anosDisponiveis}
                onChange={(ano) => setFormData({ ...formData, ano })}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="resumoMacro">Resumo Macro (Padrão para todos) *</label>
            <textarea
              id="resumoMacro"
              value={formData.resumoMacro}
              onChange={(e) => setFormData({ ...formData, resumoMacro: e.target.value })}
              rows={3}
              placeholder="Digite o resumo macro da carteira..."
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="cdiMensal">
                CDI Mensal (%) 
                {carregandoCDI && <span className="loading-indicator">Carregando...</span>}
              </label>
              <input
                type="text"
                inputMode="decimal"
                id="cdiMensal"
                value={formData.cdiMensal}
                onChange={(e) => setFormData({ ...formData, cdiMensal: e.target.value })}
                placeholder="Será preenchido automaticamente"
                disabled={carregandoCDI}
              />
              {erroCDI && <p className="error-message">{erroCDI}</p>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="textoAcimaCDI">Texto quando Resultado maior que CDI *</label>
            <textarea
              id="textoAcimaCDI"
              value={formData.textoAcimaCDI}
              onChange={(e) => setFormData({ ...formData, textoAcimaCDI: e.target.value })}
              rows={5}
              placeholder="Texto que será usado quando o resultado do mês for superior ao CDI..."
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="textoAbaixoCDI">Texto quando Resultado menor ou igual ao CDI *</label>
            <textarea
              id="textoAbaixoCDI"
              value={formData.textoAbaixoCDI}
              onChange={(e) => setFormData({ ...formData, textoAbaixoCDI: e.target.value })}
              rows={5}
              placeholder="Texto que será usado quando o resultado do mês for igual ou inferior ao CDI..."
              required
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Seleção de Clientes</h3>
          
          <div className="estrategia-selection-section">
            <div className="form-group">
              <label htmlFor="estrategiaSelecionada">Selecionar Estratégia *</label>
              <select
                id="estrategiaSelecionada"
                value={estrategiaSelecionada}
                onChange={(e) => handleEstrategiaChange(e.target.value)}
                className="form-select"
                required
              >
                <option value="">Selecione uma estratégia</option>
                {estrategias.map((estrategia) => {
                  const clientesEstrategia = clientes.filter(c => c.estrategiaId === estrategia.id);
                  return (
                    <option key={estrategia.id} value={estrategia.id}>
                      {estrategia.nome} ({clientesEstrategia.length} cliente{clientesEstrategia.length !== 1 ? 's' : ''})
                    </option>
                  );
                })}
              </select>
            </div>
            
            {estrategiaSelecionada && (
              <div className="estrategia-info">
                <p className="selected-count">
                  <strong>{Object.keys(clientesSelecionados).length}</strong> cliente(s) da estratégia "<strong>{estrategias.find(e => e.id === estrategiaSelecionada)?.nome}</strong>" serão incluídos no relatório.
                </p>
                <p className="selected-count selected-count--computed">
                  <strong>{totalSelecionados}</strong> de <strong>{clientesEstrategiaSelecionada.length}</strong> cliente(s) selecionado(s) da estrategia "<strong>{estrategias.find(e => e.id === estrategiaSelecionada)?.nome}</strong>".
                </p>
                {clientesEstrategiaSelecionada.length === 0 && (
                  <p className="warning-message">
                    ⚠️ Nenhum cliente encontrado para esta estratégia.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {clientesSelecionadosList.length > 0 && (
          <div className="form-section">
            <h3>Dados dos Clientes Selecionados</h3>
            
            <div className="clientes-dados">
              {clientesSelecionadosList.map(({ id, cliente, dados }) => (
                <div key={id} className={`cliente-dados-card${dados.selecionado ? '' : ' is-disabled'}`}>
                  <div className="cliente-dados-header">
                    <label className="cliente-toggle">
                      <input
                        type="checkbox"
                        checked={dados.selecionado}
                        onChange={() => toggleClienteSelecionado(id)}
                      />
                      <span>{cliente?.nome}</span>
                    </label>
                    <button
                      type="button"
                      className="btn-add-estrategia"
                      onClick={() => adicionarEstrategiaCliente(id)}
                      disabled={!dados.selecionado}
                    >
                      + Estratégia
                    </button>
                  </div>
                  {dados.estrategias.map((estrategia, estrategiaIndex) => {
                    const tituloExibido =
                      estrategia.tituloPersonalizado?.trim() ||
                      estrategia.titulo ||
                      'Estratégia manual';
                    return (
                    <div key={`${id}-estrategia-${estrategiaIndex}`} className="cliente-estrategia-block">
                      <div className="cliente-estrategia-header">
                        <div className="cliente-estrategia-title">
                          {tituloExibido}
                        </div>
                        {estrategiaIndex > 0 && (
                          <button
                            type="button"
                            className="btn-remove-estrategia"
                            onClick={() => removerEstrategiaCliente(id, estrategiaIndex)}
                            disabled={!dados.selecionado}
                          >
                            Remover
                          </button>
                        )}
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Estratégia *</label>
                          <select
                            value={estrategia.estrategiaId}
                            onChange={(e) => atualizarEstrategiaCliente(id, estrategiaIndex, e.target.value)}
                            disabled={!dados.selecionado}
                          >
                            <option value="">Selecione uma estratégia</option>
                            {estrategias.map((estrategiaDisponivel) => (
                              <option key={estrategiaDisponivel.id} value={estrategiaDisponivel.id}>
                                {estrategiaDisponivel.nome}
                              </option>
                            ))}
                          </select>
                          <label>Título personalizado (opcional)</label>
                          <input
                            type="text"
                            value={estrategia.tituloPersonalizado}
                            onChange={(e) => atualizarDadosCliente(id, estrategiaIndex, 'tituloPersonalizado', e.target.value)}
                            placeholder="Ex.: Carteira Balanceada - RF"
                            disabled={!dados.selecionado}
                          />
                        </div>
                        <div className="form-group">
                          <label>Patrimônio Total (R$) *</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={estrategia.patrimonioTotal}
                            onChange={(e) => atualizarDadosCliente(id, estrategiaIndex, 'patrimonioTotal', e.target.value)}
                            required
                            disabled={!dados.selecionado}
                          />
                          <label htmlFor={`comentario-${id}-${estrategiaIndex}`}>Comentário individual (opcional)</label>
                          <textarea
                            id={`comentario-${id}-${estrategiaIndex}`}
                            value={estrategia.comentario}
                            onChange={(e) => atualizarComentarioCliente(id, estrategiaIndex, e.target.value)}
                            rows={3}
                            placeholder="Observação específica para este cliente..."
                            disabled={!dados.selecionado}
                            ref={(el) => {
                              comentarioRefs.current[`${id}-${estrategiaIndex}`] = el;
                            }}
                          />
                          <div className="comentario-actions">
                            <button
                              type="button"
                              className="btn-anexo"
                              onClick={() => abrirSeletorImagem(id, estrategiaIndex)}
                              disabled={!dados.selecionado}
                            >
                              Adicionar imagem
                            </button>
                            {estrategia.comentarioImagens?.length ? (
                              <span className="comentario-count">
                                {estrategia.comentarioImagens.length} imagem(ns)
                              </span>
                            ) : null}
                          </div>
                          <p className="comentario-hint">
                            Posicione o marcador <code>[[img:ID]]</code> no texto para inserir a imagem antes/depois do comentário desejado.
                          </p>
                          {estrategia.comentarioImagens?.length ? (
                            <div className="comentario-imagens">
                              {estrategia.comentarioImagens.map((imagem, imagemIndex) => (
                                <div
                                  key={`comentario-imagem-${id}-${estrategiaIndex}-${imagemIndex}`}
                                  className="comentario-imagem"
                                >
                                  <img src={imagem.src} alt={`Comentário imagem ${imagemIndex + 1}`} />
                                  <div className="comentario-imagem-meta">
                                    <span className="comentario-token">[[img:{imagem.id}]]</span>
                                    <button
                                      type="button"
                                      className="btn-inserir-token"
                                      onClick={() => inserirTokenNoComentario(id, estrategiaIndex, `[[img:${imagem.id}]]`)}
                                      disabled={!dados.selecionado}
                                    >
                                      Inserir no texto
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    className="btn-remover-imagem"
                                    onClick={() => removerImagemComentario(id, estrategiaIndex, imagemIndex)}
                                    disabled={!dados.selecionado}
                                  >
                                    Remover
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="form-group">
                          <label>Resultado do Mês (%) *</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={estrategia.resultadoPercentual}
                            onChange={(e) => atualizarDadosCliente(id, estrategiaIndex, 'resultadoPercentual', e.target.value)}
                            required
                            disabled={!dados.selecionado}
                          />
                        </div>
                        <div className="form-group">
                          <label>Resultado do Mês (R$)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={estrategia.resultadoValor}
                            onChange={(e) => atualizarDadosCliente(id, estrategiaIndex, 'resultadoValor', e.target.value)}
                            disabled={!dados.selecionado}
                          />
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="form-actions">
          <button
            type="submit"
            className="btn-primary btn-action btn-action--report"
            disabled={totalSelecionados === 0}
            aria-label={`Gerar ${totalSelecionados} relatório(s) em PDF`}
          >
            Relatório
          </button>
        </div>
      </form>
    </Card>
  );
}
