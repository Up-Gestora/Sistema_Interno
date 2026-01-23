# 🔄 Como Reiniciar o Backend

## Passo a Passo Simples

### 1. Parar o Backend (se estiver rodando)

No terminal onde o backend está rodando, pressione:
```
Ctrl + C
```

Isso vai parar o servidor.

### 2. Iniciar o Backend Novamente

Depois de parar, execute:

```bash
cd server
npm run dev
```

Ou, se você já estiver na pasta `server`:

```bash
npm run dev
```

### 3. Verificar se está funcionando

Você deve ver estas mensagens no terminal:

```
🚀 Servidor backend rodando na porta 3001
📡 Endpoint proxy: http://localhost:3001/api/asaas/proxy
💡 Configure a API Key do Asaas via variável de ambiente ASAAS_API_KEY ou header X-Asaas-Api-Key
```

## ⚠️ Se o Backend Não Parar

Se o `Ctrl + C` não funcionar:

1. Feche o terminal completamente
2. Abra um novo terminal
3. Execute os comandos novamente

## 📝 Dica

Se você quiser rodar o frontend e backend juntos em terminais separados:

**Terminal 1 (Backend):**
```bash
cd server
npm run dev
```

**Terminal 2 (Frontend):**
```bash
npm run dev
```

Assim você pode ver os logs de ambos separadamente!





