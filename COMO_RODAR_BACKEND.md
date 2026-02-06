# 🚀 Como Rodar o Backend - Integração Asaas

## 📋 Pré-requisitos

- Node.js instalado (versão 14 ou superior)
- NPM instalado

---

## 🔧 Passo a Passo

### 1️⃣ Abrir Terminal na Pasta do Backend

```bash
cd server
```

### 2️⃣ Instalar Dependências (se ainda não instalou)

```bash
npm install
```

Isso vai instalar:
- `express` - servidor web
- `cors` - permite requisições do frontend
- `dotenv` - gerencia variáveis de ambiente
- `node-fetch` - faz requisições HTTP

### 3️⃣ (Opcional) Configurar Variáveis de Ambiente

Crie um arquivo `.env` na pasta `server/`:

```env
PORT=3001
NODE_ENV=development
ASAAS_API_KEY=sua_api_key_aqui
ASAAS_AMBIENTE=production
```

**Nota:** Você NÃO precisa criar esse arquivo se preferir configurar a API Key diretamente no frontend (via modal). O backend aceita a API Key via header também.

### 4️⃣ Iniciar o Backend

```bash
npm run dev
```

Você deve ver esta mensagem:
```
🚀 Servidor backend rodando na porta 3001
📡 Endpoint proxy: http://localhost:3001/api/asaas/proxy
💡 Configure a API Key do Asaas via variável de ambiente ASAAS_API_KEY ou header X-Asaas-Api-Key
```

### 5️⃣ Deixar o Backend Rodando

**IMPORTANTE:** Deixe esse terminal aberto enquanto usar o sistema!

O backend precisa estar rodando para o frontend conseguir fazer requisições à API do Asaas.

---

## ✅ Verificar se Está Funcionando

Abra no navegador: `http://localhost:3001/api/health`

Deve retornar:
```json
{
  "status": "ok",
  "message": "Backend está funcionando!"
}
```

---

## 🔄 Reiniciar o Backend

Se precisar reiniciar:

1. Pare o backend (Ctrl + C no terminal)
2. Execute novamente: `npm run dev`

---

## ⚠️ Problemas Comuns

### Erro: "Porta 3001 já está em uso"

**Solução:**
1. Feche outros processos usando a porta 3001
2. Ou mude a porta no arquivo `.env`: `PORT=3002`

### Erro: "Cannot find module 'express'"

**Solução:**
Execute: `npm install` na pasta `server/`

### Erro: "ECONNREFUSED" no frontend

**Causa:** Backend não está rodando

**Solução:**
1. Verifique se o backend está rodando
2. Verifique se está na porta 3001
3. Teste: `http://localhost:3001/api/health`

---

## 📝 Scripts Disponíveis

- `npm run dev` - Inicia o backend em modo desenvolvimento (com auto-reload)
- `npm start` - Inicia o backend em modo produção

---

## 🎯 Próximo Passo

Depois que o backend estiver rodando:

1. Abra OUTRO terminal
2. Execute: `npm run dev` (na raiz do projeto)
3. Acesse o sistema no navegador
4. Configure a API Key do Asaas no modal

---

**Tudo pronto!** 🎉






