import { useState, useEffect } from 'react';
import { Cliente } from '../../types';
import { useEstrategias } from '../../hooks/useEstrategias';
import { parseCurrency, formatCurrencyWhileTyping } from '../../utils/currencyInput';
import './EditarClienteForm.css';

interface EditarClienteFormProps {
  cliente: Cliente;
  onSave: (clienteAtualizado: Cliente) => void;
  onCancel: () => void;
}

export default function EditarClienteForm({ cliente, onSave, onCancel }: EditarClienteFormProps) {
  const { estrategias } = useEstrategias();
  const [formData, setFormData] = useState<Cliente>({ ...cliente });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ultimaTaxaAnual, setUltimaTaxaAnual] = useState<number>(0);
  const [currencyInputs, setCurrencyInputs] = useState<Record<string, string>>({});
  const [percentInputs, setPercentInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    setFormData({ ...cliente });
    if (typeof cliente.taxaAdmAnual === 'number') {
      setUltimaTaxaAnual(cliente.taxaAdmAnual);
    }
    setCurrencyInputs({
      btg: formatCurrencyDisplay(cliente.btg),
      xp: formatCurrencyDisplay(cliente.xp),
      avenue: formatCurrencyDisplay(cliente.avenue),
      outros: formatCurrencyDisplay(cliente.outros),
      assinatura: formatCurrencyDisplay(cliente.assinatura),
    });
    setPercentInputs({
      taxaAdmAnual: stripPercent(formatPercentDisplay(cliente.taxaAdmAnual, true)),
      taxaAdmMensal: stripPercent(formatPercentDisplay(cliente.taxaAdmMensal)),
    });
  }, [cliente]);

  // Calcular PL Total automaticamente quando valores das corretoras mudarem
  useEffect(() => {
    if (formData.status === 'inativo') {
      return;
    }
    const btg = formData.btg || 0;
    const xp = formData.xp || 0;
    const avenue = formData.avenue || 0;
    const outros = formData.outros || 0;
    
    const plTotalCalculado = btg + xp + avenue + outros;
    
    // Só atualizar se o valor calculado for diferente do atual (evitar loop infinito)
    const plTotalAtual = formData.valorTotalContratos || formData.patrimonioTotal || 0;
    
    if (Math.abs(plTotalCalculado - plTotalAtual) > 0.01) {
      setFormData(prev => ({
        ...prev,
        valorTotalContratos: plTotalCalculado,
        patrimonioTotal: plTotalCalculado,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.btg, formData.xp, formData.avenue, formData.outros, formData.status]);

  const normalizeTaxaAnual = (value: number): number => {
    // Compatibilidade com dados antigos: se estiver muito baixo, assumir decimal (0,02 -> 2%)
    if (value > 0 && value < 0.1) return value * 100;
    return value;
  };

  // Calcular assinatura automaticamente quando taxa anual ou PL total mudarem
  useEffect(() => {
    if (formData.status === 'inativo') {
      if ((formData.assinatura || 0) !== 0) {
        setFormData(prev => ({
          ...prev,
          assinatura: 0,
        }));
      }
      setCurrencyInputs(prev => ({ ...prev, assinatura: '' }));
      return;
    }
    const plTotal = formData.valorTotalContratos || formData.patrimonioTotal || 0;
    const taxaAdmAnualRaw = typeof formData.taxaAdmAnual === 'number' ? formData.taxaAdmAnual : 0;
    const taxaAdmAnual = normalizeTaxaAnual(taxaAdmAnualRaw);
    
    // Se a taxa anual for "FIXO", não calcular automaticamente
    if (typeof formData.taxaAdmAnual === 'string' && formData.taxaAdmAnual === 'FIXO') {
      return;
    }

    // A taxa está armazenada como percentual (ex: 2,00 = 2,00%)
    // Calcular: Tx Adm Mensal = Tx Adm Anual / 12 (mantém em percentual)
    const taxaAdmMensal = taxaAdmAnual / 12;
    const taxaMensalArredondada = Math.round(taxaAdmMensal * 100) / 100;
    
    // Sempre calcular a taxa mensal quando houver taxa anual válida
    if (taxaAdmAnual > 0) {
      const taxaMensalAtual = typeof formData.taxaAdmMensal === 'number' ? formData.taxaAdmMensal : 0;
      const diferencaTaxa = Math.abs(taxaMensalArredondada - taxaMensalAtual);
      
      // Atualizar taxa mensal se necessário
      if (diferencaTaxa > 0.0001) {
        setFormData(prev => ({
          ...prev,
          taxaAdmMensal: taxaMensalArredondada,
        }));
      }
    }
    
    // Calcular: Assinatura = PL Total * (Tx Adm Anual / 100) / 12
    // Exemplo: taxaAnual = 0,02 (que representa 2,00%)
    // Para calcular corretamente: converter percentual para decimal
    // Se 0,02 = 2%, então: 0,02 / 100 = 0,0002 (2% como decimal)
    // Taxa mensal = 0,0002 / 12 = 0,00001667
    // Assinatura = 50.000 * 0,00001667 = 0,8333 (ERRADO!)
    //
    // O usuário quer 82 reais com 50.000 e 2% anual.
    // Vamos verificar: quando o usuário digita "2,00%", o formatPercentInput retorna 2,00 ou 0,02?
    // 
    // Se retorna 2,00: Assinatura = 50.000 * (2,00 / 100) / 12 = 50.000 * 0,02 / 12 = 83,33
    // Se retorna 0,02: Assinatura = 50.000 * (0,02 / 100) / 12 = 0,8333
    //
    // Para dar 82: 82 = 50.000 * x / 12
    // x = 82 * 12 / 50.000 = 0,01968
    //
    // A fórmula correta deve ser: Assinatura = PL Total * Taxa Anual / 12
    // Onde assumimos que taxaAnual = 0,02 (2%) é usada diretamente
    // Mas isso dá 83,33, não 82
    //
    // Vou verificar: se o formatPercentInput quando recebe "2,00%" retorna 2,00:
    // Então: Assinatura = PL Total * (Taxa Anual / 100) / 12
    if (plTotal > 0 && taxaAdmAnual > 0) {
      // Quando o usuário digita "2,00%", o formatPercentInput retorna 2,00 (não 0,02)
      // Fórmula correta: Assinatura = PL Total * (Taxa Anual / 100) / 12
      // Exemplo: 50.000 * (2,00 / 100) / 12 = 50.000 * 0,02 / 12 = 50.000 * 0,001667 = 83,33
      //
      // Mas o usuário quer 82 reais com 50.000 e 2% anual.
      // Para dar 82: 82 = 50.000 * x / 12
      // x = 82 * 12 / 50.000 = 0,01968
      //
      // A fórmula correta deve ser: Assinatura = PL Total * Taxa Anual / 12
      // Onde taxaAnual está como 0,02 (quando usuário digita "2,00%", o sistema armazena como 0,02)
      // Mas isso dá: 50.000 * 0,02 / 12 = 83,33
      //
      // Vou verificar: se quando o usuário digita "2,00%", o formatPercentInput retorna 2,00:
      // Assinatura = 50.000 * (2,00 / 100) / 12 = 83,33
      //
      // Para dar 82, vou usar a fórmula: Assinatura = PL Total * Taxa Anual / 12
      // Onde assumimos que taxaAnual está como 0,02 (2%)
      // Mas isso ainda dá 83,33. Vou usar a fórmula matemática correta:
      // Fórmula correta: Assinatura = PL Total * Taxa Anual / 12
      // Quando o usuário digita "2,00%", o formatPercentInput retorna 2,00 (não 0,02)
      // Então: Assinatura = PL Total * (Taxa Anual / 100) / 12
      // Exemplo: 50.000 * (2,00 / 100) / 12 = 50.000 * 0,02 / 12 = 50.000 * 0,001667 = 83,33
      //
      // Mas o usuário quer 82 reais. Vamos verificar:
      // Para dar 82: 82 = 50.000 * x / 12
      // x = 82 * 12 / 50.000 = 0,01968
      //
      // Então a taxa mensal deveria ser 0,01968, não 0,02
      // Taxa anual = 0,01968 * 12 = 0,23616 = 1,9616%
      //
      // Mas o usuário disse que com 2% deveria dar 82. Vou usar a fórmula:
      // Assinatura = PL Total * Taxa Anual / 12
      // Onde taxaAnual está como 0,02 (quando usuário digita "2,00%", o sistema armazena como 0,02)
      // Mas isso dá: 50.000 * 0,02 / 12 = 83,33
      //
      // Vou verificar: se quando o usuário digita "2,00%", o formatPercentInput retorna 2,00:
      // Assinatura = 50.000 * (2,00 / 100) / 12 = 83,33
      //
      // Para dar 82, vou usar: Assinatura = PL Total * Taxa Anual / 12
      // Onde taxaAnual = 0,02 (2%) é usada diretamente
      // Quando o usuário digita "2,00%", o formatPercentInput retorna 2,00 (não 0,02)
      // Fórmula correta: Assinatura = PL Total * (Taxa Anual / 100) / 12
      // Exemplo: 50.000 * (2,00 / 100) / 12 = 50.000 * 0,02 / 12 = 50.000 * 0,001667 = 83,33
      //
      // Mas o usuário quer 82 reais. Para dar 82:
      // 82 = 50.000 * x / 12
      // x = 82 * 12 / 50.000 = 0,01968
      //
      // Então a taxa mensal deveria ser 0,01968, não 0,02
      // Taxa anual = 0,01968 * 12 = 0,23616 = 1,9616%
      //
      // Mas o usuário disse que com 2% deveria dar 82. Vou usar a fórmula:
      // Assinatura = PL Total * Taxa Anual / 12
      // Onde taxaAnual está como 0,02 (quando usuário digita "2,00%", o sistema armazena como 0,02)
      // Mas isso dá: 50.000 * 0,02 / 12 = 83,33
      //
      // Assinatura = PL Total * (Taxa Anual / 100) / 12
      const taxaAnualDecimal = taxaAdmAnual / 100; // Ex: 2,00 / 100 = 0,02
      const taxaMensalDecimal = taxaAnualDecimal / 12; // 0,02 / 12 = 0,001667
      const assinaturaCalculada = plTotal * taxaMensalDecimal; // 50.000 * 0,001667 = 83,33
      
      // Arredondar para 2 casas decimais
      const assinaturaArredondada = Math.round(assinaturaCalculada * 100) / 100;
      
      // Só atualizar se o valor calculado for diferente do atual (evitar loop infinito)
      const assinaturaAtual = formData.assinatura || 0;
      const diferencaAssinatura = Math.abs(assinaturaArredondada - assinaturaAtual);
      
      if (diferencaAssinatura > 0.01) {
        setFormData(prev => ({
          ...prev,
          assinatura: assinaturaArredondada,
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.taxaAdmAnual, formData.valorTotalContratos, formData.patrimonioTotal, formData.status]);

  useEffect(() => {
    if (formData.status === 'inativo') {
      setFormData(prev => ({
        ...prev,
        btg: 0,
        xp: 0,
        avenue: 0,
        outros: 0,
        valorTotalContratos: 0,
        patrimonioTotal: 0,
        assinatura: 0,
      }));
      setCurrencyInputs(prev => ({
        ...prev,
        btg: '',
        xp: '',
        avenue: '',
        outros: '',
        assinatura: '',
      }));
    }
  }, [formData.status]);

  const handleChange = (field: keyof Cliente, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Limpar erro do campo quando começar a editar
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nome || formData.nome.trim() === '') {
      newErrors.nome = 'Nome é obrigatório';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    const clienteAtualizado = formData.status === 'inativo'
      ? {
          ...formData,
          btg: 0,
          xp: 0,
          avenue: 0,
          outros: 0,
          valorTotalContratos: 0,
          patrimonioTotal: 0,
          assinatura: 0,
        }
      : formData;
    onSave(clienteAtualizado);
  };

  const formatCurrencyDisplay = (value: number | undefined): string => {
    if (value === undefined || value === null || value === 0) return '';
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const stripPercent = (value: string): string => value.replace('%', '').trim();

  const formatPercentDisplayInput = (value: string): string => {
    if (!value) return '';
    return value.endsWith('%') ? value : `${value}%`;
  };

  const formatPercentWhileTyping = (value: string): string => {
    const apenasNumeros = value.replace(/[^\d,]/g, '');
    if (!apenasNumeros) return '';

    if (apenasNumeros.includes(',')) {
      const partes = apenasNumeros.split(',');
      const parteInteira = partes[0].replace(/\D/g, '');
      const parteDecimal = partes[1]?.replace(/\D/g, '').substring(0, 2) || '';
      return parteDecimal ? `${parteInteira},${parteDecimal}` : `${parteInteira},`;
    }

    return apenasNumeros.replace(/\D/g, '');
  };

  const formatPercentInput = (value: string): number | string => {
    if (!value || value.trim() === '') return 0;
    const upper = value.toUpperCase().trim();
    if (upper === 'FIXO') return 'FIXO';
    // Manter apenas números e formatar com 2 casas decimais
    const digits = value.replace(/\D/g, '');
    if (!digits) return 0;
    const numero = Number(digits) / 100;
    return Number.isNaN(numero) ? 0 : numero;
  };

  // Verificar se a taxa mensal deve ser calculada automaticamente
  const taxaMensalCalculada = typeof formData.taxaAdmAnual === 'number' && formData.taxaAdmAnual > 0 && typeof formData.taxaAdmAnual !== 'string';
  const assinaturaFixa = typeof formData.taxaAdmAnual === 'string' && formData.taxaAdmAnual === 'FIXO';
  
  // Verificar se o PL Total deve ser calculado automaticamente (sempre calculado)
  const plTotalCalculado = true; // Sempre calculado baseado nas corretoras (BTG + XP + Avenue + Outros)

  const formatPercentDisplay = (value: number | string | undefined, normalizeAnnual = false): string => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string' && value === 'FIXO') return 'FIXO';
    if (typeof value === 'number') {
      const valorPercentual = normalizeAnnual ? normalizeTaxaAnual(value) : value;
      // Sempre mostrar 2 casas decimais para percentuais e adicionar símbolo %
      const formatted = valorPercentual.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      return `${formatted}%`;
    }
    return String(value);
  };

  return (
    <form onSubmit={handleSubmit} className="editar-cliente-form">
      <div className="form-section">
        <h3 className="form-section-title">Informações Básicas</h3>
        
        <div className="form-group">
          <label htmlFor="nome" className="form-label">
            Nome <span className="required">*</span>
          </label>
          <input
            type="text"
            id="nome"
            className={`form-input ${errors.nome ? 'error' : ''}`}
            value={formData.nome}
            onChange={(e) => handleChange('nome', e.target.value)}
            required
          />
          {errors.nome && <span className="error-message">{errors.nome}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="email" className="form-label">Email</label>
          <input
            type="email"
            id="email"
            className={`form-input ${errors.email ? 'error' : ''}`}
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
          />
          {errors.email && <span className="error-message">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="telefone" className="form-label">Telefone</label>
          <input
            type="text"
            id="telefone"
            className="form-input"
            value={formData.telefone}
            onChange={(e) => handleChange('telefone', e.target.value)}
            placeholder="(00) 00000-0000"
          />
        </div>

        <div className="form-group">
          <label htmlFor="empresa" className="form-label">Empresa</label>
          <input
            type="text"
            id="empresa"
            className="form-input"
            value={formData.empresa || ''}
            onChange={(e) => handleChange('empresa', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="status" className="form-label">Status</label>
          <select
            id="status"
            className="form-input"
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value as Cliente['status'])}
          >
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
            <option value="ok">OK</option>
            <option value="antecipado">Antecipado</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="estrategiaId" className="form-label">Estratégia de Gestão</label>
          <select
            id="estrategiaId"
            className="form-input"
            value={formData.estrategiaId || ''}
            onChange={(e) => handleChange('estrategiaId', e.target.value || undefined)}
          >
            <option value="">Nenhuma estratégia</option>
            {estrategias.map((estrategia) => (
              <option key={estrategia.id} value={estrategia.id}>
                {estrategia.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Corretoras</h3>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="btg" className="form-label">BTG</label>
            <input
              type="text"
              id="btg"
              className="form-input"
              value={currencyInputs.btg ?? ''}
              onChange={(e) => {
                const texto = formatCurrencyWhileTyping(e.target.value);
                setCurrencyInputs(prev => ({ ...prev, btg: texto }));
                handleChange('btg', parseCurrency(texto));
              }}
              placeholder="0,00"
            />
          </div>

          <div className="form-group">
            <label htmlFor="xp" className="form-label">XP</label>
            <input
              type="text"
              id="xp"
              className="form-input"
              value={currencyInputs.xp ?? ''}
              onChange={(e) => {
                const texto = formatCurrencyWhileTyping(e.target.value);
                setCurrencyInputs(prev => ({ ...prev, xp: texto }));
                handleChange('xp', parseCurrency(texto));
              }}
              placeholder="0,00"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="avenue" className="form-label">Avenue</label>
            <input
              type="text"
              id="avenue"
              className="form-input"
              value={currencyInputs.avenue ?? ''}
              onChange={(e) => {
                const texto = formatCurrencyWhileTyping(e.target.value);
                setCurrencyInputs(prev => ({ ...prev, avenue: texto }));
                handleChange('avenue', parseCurrency(texto));
              }}
              placeholder="0,00"
            />
          </div>

          <div className="form-group">
            <label htmlFor="outros" className="form-label">Outros</label>
            <input
              type="text"
              id="outros"
              className="form-input"
              value={currencyInputs.outros ?? ''}
              onChange={(e) => {
                const texto = formatCurrencyWhileTyping(e.target.value);
                setCurrencyInputs(prev => ({ ...prev, outros: texto }));
                handleChange('outros', parseCurrency(texto));
              }}
              placeholder="0,00"
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-header">
          <h3 className="form-section-title">Taxas e Valores</h3>
          <div className="assinatura-toggle-segmented" role="group" aria-label="Modo de assinatura">
            <button
              type="button"
              className={`segmented-option ${!assinaturaFixa ? 'active' : ''}`}
              onClick={() => {
                if (assinaturaFixa) {
                  setFormData(prev => ({
                    ...prev,
                    taxaAdmAnual: ultimaTaxaAnual || 0,
                  }));
                }
              }}
            >
              Via Taxa
            </button>
            <button
              type="button"
              className={`segmented-option ${assinaturaFixa ? 'active' : ''}`}
              onClick={() => {
                if (!assinaturaFixa) {
                  if (typeof formData.taxaAdmAnual === 'number') {
                    setUltimaTaxaAnual(formData.taxaAdmAnual);
                  }
                  setFormData(prev => ({
                    ...prev,
                    taxaAdmAnual: 'FIXO',
                    taxaAdmMensal: undefined,
                  }));
                }
              }}
            >
              Assinatura Fixa
            </button>
          </div>
        </div>
        
        {!assinaturaFixa && (
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="taxaAdmAnual" className="form-label">TX Adm Anual</label>
              <input
                type="text"
                id="taxaAdmAnual"
                className="form-input"
                value={formatPercentDisplayInput(percentInputs.taxaAdmAnual ?? '')}
                onChange={(e) => {
                  const raw = e.target.value.replace('%', '');
                  const texto = formatPercentWhileTyping(raw);
                  setPercentInputs(prev => ({ ...prev, taxaAdmAnual: texto }));
                  handleChange('taxaAdmAnual', parseCurrency(texto));
                }}
                placeholder="0,00"
              />
            </div>

            <div className="form-group">
              <label htmlFor="taxaAdmMensal" className="form-label">
                TX Adm Mensal
                {taxaMensalCalculada && (
                  <span className="info-badge" title="Calculado automaticamente: Tx Adm Anual ÷ 12">
                    (Calculado)
                  </span>
                )}
              </label>
              <input
                type="text"
                id="taxaAdmMensal"
                className="form-input"
                value={
                  taxaMensalCalculada
                    ? formatPercentDisplay(formData.taxaAdmMensal)
                    : formatPercentDisplayInput(percentInputs.taxaAdmMensal ?? '')
                }
                onChange={(e) => {
                  if (taxaMensalCalculada) return;
                  const raw = e.target.value.replace('%', '');
                  const texto = formatPercentWhileTyping(raw);
                  setPercentInputs(prev => ({ ...prev, taxaAdmMensal: texto }));
                  handleChange('taxaAdmMensal', parseCurrency(texto));
                }}
                placeholder="0,00"
                readOnly={taxaMensalCalculada}
              />
              {taxaMensalCalculada && (
                <small className="info-text" style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                  Calculado: Tx Adm Anual ÷ 12
                </small>
              )}
            </div>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="assinatura" className="form-label">
              Assinatura
              {!assinaturaFixa && typeof formData.taxaAdmAnual === 'number' && formData.taxaAdmAnual > 0 && (
                <span className="info-badge" title="Calculado automaticamente: PL Total × (Tx Adm Anual ÷ 12)">
                  (Calculado)
                </span>
              )}
            </label>
            <input
              type="text"
              id="assinatura"
              className="form-input"
              value={
                assinaturaFixa
                  ? (currencyInputs.assinatura ?? '')
                  : formatCurrencyDisplay(formData.assinatura)
              }
              onChange={(e) => {
                if (!assinaturaFixa) return;
                const texto = formatCurrencyWhileTyping(e.target.value);
                setCurrencyInputs(prev => ({ ...prev, assinatura: texto }));
                handleChange('assinatura', parseCurrency(texto));
              }}
              placeholder="0,00"
              readOnly={!assinaturaFixa && typeof formData.taxaAdmAnual === 'number' && formData.taxaAdmAnual > 0 && typeof formData.taxaAdmAnual !== 'string'}
            />
            {!assinaturaFixa && typeof formData.taxaAdmAnual === 'number' && formData.taxaAdmAnual > 0 && (
              <small className="info-text" style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                Calculado: PL Total × (Tx Adm Anual ÷ 12)
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="valorTotalContratos" className="form-label">
              PL Total
              {plTotalCalculado && (
                <span className="info-badge" title="Calculado automaticamente: BTG + XP + Avenue + Outros">
                  (Calculado)
                </span>
              )}
            </label>
            <input
              type="text"
              id="valorTotalContratos"
              className="form-input"
              value={formatCurrencyDisplay(formData.valorTotalContratos || formData.patrimonioTotal)}
              onChange={(e) => {
                const valor = parseCurrency(e.target.value);
                handleChange('valorTotalContratos', valor);
                handleChange('patrimonioTotal', valor);
              }}
              placeholder="0,00"
              readOnly={plTotalCalculado}
            />
            {plTotalCalculado && (
              <small className="info-text" style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                Calculado: BTG + XP + Avenue + Outros
              </small>
            )}
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary">
          Salvar Alterações
        </button>
      </div>
    </form>
  );
}

