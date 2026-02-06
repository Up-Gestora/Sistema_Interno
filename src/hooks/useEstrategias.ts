import { useState, useEffect, useCallback } from 'react';
import { Estrategia } from '../types';

// Estratégias padrão
const DEFAULT_BENCHMARK = 'IFIX';

const normalizarEstrategia = (estrategia: Estrategia): Estrategia => ({
  ...estrategia,
  benchmark: estrategia.benchmark?.trim() ? estrategia.benchmark : DEFAULT_BENCHMARK,
});

const normalizarEstrategias = (lista: Estrategia[]) => lista.map(normalizarEstrategia);

const estrategiasIniciais: Estrategia[] = [
  {
    id: '1',
    nome: 'Carteira Tática',
    descricao: 'Estratégia focada em movimentações táticas de curto prazo, ajustando posições conforme condições de mercado.',
    benchmark: DEFAULT_BENCHMARK,
    dataCriacao: new Date().toISOString().split('T')[0],
    dataAtualizacao: new Date().toISOString().split('T')[0],
  },
  {
    id: '2',
    nome: 'Carteira Multimercado',
    descricao: 'Diversificação em múltiplos mercados e classes de ativos para reduzir risco e potencializar retornos.',
    benchmark: DEFAULT_BENCHMARK,
    dataCriacao: new Date().toISOString().split('T')[0],
    dataAtualizacao: new Date().toISOString().split('T')[0],
  },
  {
    id: '3',
    nome: 'Consultoria',
    descricao: 'Serviço de consultoria personalizada para orientação estratégica e tomada de decisões de investimento.',
    benchmark: DEFAULT_BENCHMARK,
    dataCriacao: new Date().toISOString().split('T')[0],
    dataAtualizacao: new Date().toISOString().split('T')[0],
  },
  {
    id: '4',
    nome: 'Carteira Completa',
    descricao: 'Gestão completa de patrimônio com acompanhamento integral e estratégias abrangentes.',
    benchmark: DEFAULT_BENCHMARK,
    dataCriacao: new Date().toISOString().split('T')[0],
    dataAtualizacao: new Date().toISOString().split('T')[0],
  },
];

export function useEstrategias() {
  const [estrategias, setEstrategiasState] = useState<Estrategia[]>(() => {
    const saved = localStorage.getItem('estrategias');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Estrategia[];
        return normalizarEstrategias(parsed);
      } catch {
        return estrategiasIniciais;
      }
    }
    return estrategiasIniciais;
  });

  // Função para atualizar estratégias e salvar no localStorage
  const setEstrategias = useCallback((novasEstrategias: Estrategia[]) => {
    try {
      const estrategiasParaSalvar = JSON.parse(JSON.stringify(normalizarEstrategias(novasEstrategias)));
      setEstrategiasState(estrategiasParaSalvar);
      const dadosSerializados = JSON.stringify(estrategiasParaSalvar);
      localStorage.setItem('estrategias', dadosSerializados);
      
      const verificado = localStorage.getItem('estrategias');
      if (verificado) {
        const estrategiasVerificadas = JSON.parse(verificado);
        console.log(`✅ Estratégias salvas: ${estrategiasVerificadas.length} estratégia(s)`);
      }
      
      window.dispatchEvent(new Event('estrategias-updated'));
    } catch (error) {
      console.error('❌ Erro ao salvar estratégias:', error);
      const normalizadas = normalizarEstrategias(novasEstrategias);
      setEstrategiasState(normalizadas);
      try {
        localStorage.setItem('estrategias', JSON.stringify(normalizadas));
      } catch (retryError) {
        console.error('❌ Erro ao tentar salvar novamente:', retryError);
      }
    }
  }, []);

  // Sincronizar com localStorage quando estratégias mudarem externamente
  useEffect(() => {
    const handleEstrategiasUpdate = () => {
      const saved = localStorage.getItem('estrategias');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Estrategia[];
          setEstrategiasState(normalizarEstrategias(parsed));
        } catch (error) {
          console.error('Erro ao ler estratégias do localStorage:', error);
        }
      }
    };

    window.addEventListener('estrategias-updated', handleEstrategiasUpdate);
    window.addEventListener('storage', handleEstrategiasUpdate);

    const interval = setInterval(() => {
      const saved = localStorage.getItem('estrategias');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Estrategia[];
          const normalizadas = normalizarEstrategias(parsed);
          if (JSON.stringify(normalizadas) !== JSON.stringify(estrategias)) {
            setEstrategiasState(normalizadas);
          }
        } catch (error) {
          console.error('Erro ao verificar estratégias:', error);
        }
      }
    }, 500);

    return () => {
      window.removeEventListener('estrategias-updated', handleEstrategiasUpdate);
      window.removeEventListener('storage', handleEstrategiasUpdate);
      clearInterval(interval);
    };
  }, [estrategias]);

  return { estrategias, setEstrategias };
}







