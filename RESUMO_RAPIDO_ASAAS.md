# ⚡ Resumo Rápido - Integração Asaas

## 🚀 Comandos para Rodar

### Terminal 1 - Backend
```bash
cd server
npm install          # (só na primeira vez)
npm run dev
```

### Terminal 2 - Frontend
```bash
npm run dev
```

---

## ✅ Verificar se Funcionou

1. Backend: `http://localhost:3001/api/health` → deve retornar `{"status":"ok"}`
2. Frontend: Acesse a aba "Asaas" e configure a API Key

---

## 📝 Código do Backend

O código já está pronto em `server/index.js`. Ele:
- ✅ Aceita requisições do frontend
- ✅ Adiciona a API Key do Asaas automaticamente
- ✅ Faz requisições à API do Asaas
- ✅ Retorna os dados para o frontend

---

## 🔑 Configurar API Key

**Opção 1:** Via Frontend (Recomendado)
1. Acesse a aba "Asaas"
2. Clique em "⚙️ Configurar API"
3. Cole sua API Key
4. Salve

**Opção 2:** Via Arquivo .env
1. Crie `server/.env`
2. Adicione: `ASAAS_API_KEY=sua_chave_aqui`
3. Reinicie o backend

---

## ⚠️ Se Der Erro

### "Failed to fetch"
→ Backend não está rodando. Inicie com `npm run dev` na pasta `server/`

### "401 Unauthorized"
→ API Key incorreta. Verifique se está correta no modal

### "ECONNREFUSED"
→ Backend não está rodando ou porta 3001 está ocupada

---

## 📚 Documentação Completa

- `GUIA_COMPLETO_ASAAS.md` - Guia detalhado
- `COMO_RODAR_BACKEND.md` - Instruções passo a passo
- `server/README.md` - Documentação do backend

---

**Pronto para usar!** 🎉




