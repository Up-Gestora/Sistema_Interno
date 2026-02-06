# 🔧 Solução para Erro de Conexão (ECONNREFUSED)

## O Problema

O erro `[vite] http proxy error: /api/asaas/proxy AggregateError [ECONNREFUSED]` significa que:

**O frontend está tentando se conectar ao backend, mas o backend não está rodando!**

## ✅ Solução

Você precisa ter **DOIS terminais abertos**:

### Terminal 1: Backend (IMPORTANTE - deve estar rodando primeiro)

1. Abra um terminal
2. Execute:
   ```bash
   cd server
   npm run dev
   ```

3. Você deve ver:
   ```
   🚀 Servidor backend rodando na porta 3001
   📡 Endpoint proxy: http://localhost:3001/api/asaas/proxy
   ```

### Terminal 2: Frontend

1. Abra **OUTRO terminal** (deixe o primeiro rodando)
2. Execute:
   ```bash
   npm run dev
   ```

3. O frontend vai rodar na porta 5173

## 📋 Ordem Correta

1. **PRIMEIRO**: Inicie o backend (`cd server` → `npm run dev`)
2. **DEPOIS**: Inicie o frontend (`npm run dev`)

## ⚠️ Se o Erro Continuar

### Verificar se o backend está rodando

Abra no navegador:
```
http://localhost:3001/api/health
```

Se retornar `{"status":"ok"}`, o backend está funcionando!

### Verificar a porta

Se a porta 3001 estiver ocupada, você pode:

1. Mudar a porta no arquivo `server/.env`:
   ```env
   PORT=3002
   ```

2. Atualizar o `vite.config.ts`:
   ```typescript
   proxy: {
     '/api': {
       target: 'http://localhost:3002',  // Nova porta
       changeOrigin: true,
       secure: false,
     },
   },
   ```

## 🎯 Resumo

**O erro acontece porque o backend não está rodando!**

Solução: Abra 2 terminais e rode o backend primeiro, depois o frontend.







