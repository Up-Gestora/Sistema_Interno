import { useState, useEffect, useCallback } from 'react';
import { Cliente, Aplicacao, SaldoCliente } from '../types';
import { mockClientes, mockAplicacoes, mockSaldos } from '../data/mockData';

export function useClientes() {
  const [clientes, setClientesState] = useState<Cliente[]>(() => {
    const saved = localStorage.getItem('clientes');
    return saved ? JSON.parse(saved) : mockClientes;
  });

  const [aplicacoes] = useState<Aplicacao[]>(mockAplicacoes);
  const [saldos] = useState<SaldoCliente[]>(mockSaldos);

  // Função para atualizar clientes e salvar no localStorage
  const setClientes = useCallback((novosClientes: Cliente[]) => {
    try {
      // Criar uma cópia profunda para garantir que não há referências compartilhadas
      const clientesParaSalvar = JSON.parse(JSON.stringify(novosClientes));
      
      // Atualizar o estado
      setClientesState(clientesParaSalvar);
      
      // Salvar no localStorage
      const dadosSerializados = JSON.stringify(clientesParaSalvar);
      localStorage.setItem('clientes', dadosSerializados);
      
      // Verificar se foi salvo corretamente
      const verificado = localStorage.getItem('clientes');
      if (verificado) {
        const clientesVerificados = JSON.parse(verificado);
        console.log(`✅ Dados salvos no localStorage: ${clientesVerificados.length} cliente(s)`);
        
        if (clientesVerificados.length !== clientesParaSalvar.length) {
          console.warn('⚠️ Aviso: Número de clientes não corresponde. Tentando salvar novamente...');
          localStorage.setItem('clientes', dadosSerializados);
        }
      } else {
        console.error('❌ Erro: Falha ao salvar no localStorage!');
        // Tentar novamente
        localStorage.setItem('clientes', dadosSerializados);
      }
      
      // Disparar evento customizado para sincronizar outras instâncias do hook
      window.dispatchEvent(new Event('clientes-updated'));
    } catch (error) {
      console.error('❌ Erro ao salvar clientes no localStorage:', error);
      // Mesmo com erro, atualizar o estado para que a UI funcione
      setClientesState(novosClientes);
      // Tentar salvar novamente
      try {
        localStorage.setItem('clientes', JSON.stringify(novosClientes));
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
        setClientesState(parsed);
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
          setClientesState(parsed);
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

