# 🚀 Como Iniciar o Backend - Passo a Passo

## ✅ Você pode usar o terminal do Cursor mesmo!

Não precisa abrir o Prompt de Comando separado. Use o terminal integrado do Cursor.

---

## 📋 Passo a Passo

### 1️⃣ Abrir o Terminal no Cursor

- Pressione `` Ctrl + ` `` (Ctrl + crase) OU
- Menu: `Terminal` → `New Terminal`

### 2️⃣ Navegar até a Pasta do Backend

No terminal, digite:

```bash
cd server
```

### 3️⃣ Verificar se as Dependências Estão Instaladas

```bash
npm list
```

Se aparecer os pacotes (express, cors, dotenv, node-fetch), está tudo certo!

Se não aparecer, instale com:
```bash
npm install
```

### 4️⃣ Iniciar o Backend

```bash
npm run dev
```

### 5️⃣ Verificar se Funcionou

Você deve ver esta mensagem:
```
🚀 Servidor backend rodando na porta 3001
📡 Endpoint proxy: http://localhost:3001/api/asaas/proxy
💡 Configure a API Key do Asaas via variável de ambiente ASAAS_API_KEY ou header X-Asaas-Api-Key
```

---

## ✅ Testar se Está Funcionando

Abra no navegador: `http://localhost:3001/api/health`

Deve aparecer:
```json
{
  "status": "ok",
  "message": "Backend está funcionando!"
}
```

---

## ⚠️ Importante

**DEIXE O TERMINAL ABERTO!**

O backend precisa ficar rodando enquanto você usa o sistema. Se fechar o terminal, o backend para.

---

## 🔄 Se Precisar Parar o Backend

No terminal, pressione: `Ctrl + C`

---

## 🎯 Depois que o Backend Estiver Rodando

1. Abra OUTRO terminal (ou use o terminal do frontend)
2. Na raiz do projeto, execute: `npm run dev`
3. Acesse o sistema no navegador
4. Configure a API Key do Asaas

---

## 📝 Resumo dos Comandos

```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend (em outro terminal)
npm run dev
```

---

**Pronto!** 🎉




