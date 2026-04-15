import { useState, useEffect, useCallback } from 'react';
import { Cliente, Aplicacao, SaldoCliente } from '../types';
import { mockClientes, mockAplicacoes, mockSaldos } from '../data/mockData';
import { savePortSharedStorageValue } from '../services/portSharedStorage';

export function useClientes() {
  const normalizarStatus = (status?: string) => {
    const normalizado = (status || '').toLowerCase();
    if (normalizado === 'ok') return 'ativo';
    if (normalizado === 'ativo' || normalizado === 'inativo' || normalizado === 'antecipado') {
      return normalizado;
    }
    return 'ativo';
  };

  const normalizarClientes = (lista: Cliente[]) =>
    lista.map((cliente) => ({
      ...cliente,
      status: normalizarStatus(cliente.status) as Cliente['status'],
    }));

  const [clientes, setClientesState] = useState<Cliente[]>(() => {
    const saved = localStorage.getItem('clientes');
    const base = saved ? JSON.parse(saved) : mockClientes;
    return normalizarClientes(base);
  });

  const [aplicacoes] = useState<Aplicacao[]>(mockAplicacoes);
  const [saldos] = useState<SaldoCliente[]>(mockSaldos);

  // Função para atualizar clientes e salvar no localStorage
  const setClientes = useCallback((novosClientes: Cliente[]) => {
    try {
      // Criar uma cópia profunda para garantir que não há referências compartilhadas
      const clientesParaSalvar = normalizarClientes(JSON.parse(JSON.stringify(novosClientes)));
      
      // Atualizar o estado
      setClientesState(clientesParaSalvar);
      
      // Salvar no localStorage
      const dadosSerializados = JSON.stringify(clientesParaSalvar);
      localStorage.setItem('clientes', dadosSerializados);
      void savePortSharedStorageValue('clientes', clientesParaSalvar);
      
      // Verificar se foi salvo corretamente
      const verificado = localStorage.getItem('clientes');
      if (verificado) {
        const clientesVerificados = JSON.parse(verificado);
        console.log(`✅ Dados salvos no localStorage: ${clientesVerificados.length} cliente(s)`);
        
        if (clientesVerificados.length !== clientesParaSalvar.length) {
          console.warn('⚠️ Aviso: Número de clientes não corresponde. Tentando salvar novamente...');
          localStorage.setItem('clientes', dadosSerializados);
          void savePortSharedStorageValue('clientes', clientesParaSalvar);
        }
      } else {
        console.error('❌ Erro: Falha ao salvar no localStorage!');
        // Tentar novamente
        localStorage.setItem('clientes', dadosSerializados);
        void savePortSharedStorageValue('clientes', clientesParaSalvar);
      }
      
      // Disparar evento customizado para sincronizar outras instâncias do hook
      window.dispatchEvent(new Event('clientes-updated'));
    } catch (error) {
      console.error('❌ Erro ao salvar clientes no localStorage:', error);
      // Mesmo com erro, atualizar o estado para que a UI funcione
      setClientesState(normalizarClientes(novosClientes));
      // Tentar salvar novamente
      try {
        const clientesNormalizados = normalizarClientes(novosClientes);
        localStorage.setItem('clientes', JSON.stringify(clientesNormalizados));
        void savePortSharedStorageValue('clientes', clientesNormalizados);
      } catch (retryError) {
        console.error('❌ Erro ao tentar salvar novamente:', retryError);
      }
    }
  }, []);

  // Sincronizar com localStorage quando clientes mudarem externamente
  useEffect(() => {
    const handleClientesUpdate = () => {
      const saved = localStorage.getItem('clientes');
      if (saved) {
        const parsed = JSON.parse(saved);
        const normalizados = normalizarClientes(parsed);
        setClientesState(normalizados);
        if (JSON.stringify(parsed) !== JSON.stringify(normalizados)) {
          localStorage.setItem('clientes', JSON.stringify(normalizados));
        }
      }
    };

    // Escutar evento customizado
    window.addEventListener('clientes-updated', handleClientesUpdate);
    
    // Escutar mudanças no localStorage de outras abas
    window.addEventListener('storage', handleClientesUpdate);
    
    // Verificar periodicamente (para mudanças na mesma aba)
    const interval = setInterval(() => {
      const saved = localStorage.getItem('clientes');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Só atualizar se realmente mudou
        if (JSON.stringify(parsed) !== JSON.stringify(clientes)) {
          const normalizados = normalizarClientes(parsed);
          setClientesState(normalizados);
          if (JSON.stringify(parsed) !== JSON.stringify(normalizados)) {
            localStorage.setItem('clientes', JSON.stringify(normalizados));
          }
        }
      }
    }, 500);

    return () => {
      window.removeEventListener('clientes-updated', handleClientesUpdate);
      window.removeEventListener('storage', handleClientesUpdate);
      clearInterval(interval);
    };
  }, [clientes]);

  return { clientes, aplicacoes, saldos, setClientes };
}
