# Deploy em nuvem (front + backend hoje)

## Rota recomendada

Subir o sistema em **um unico servico Docker**:

- O backend (`server/index.js`) serve os endpoints `/api/*`
- O frontend (`dist`) e servido pelo proprio backend em producao
- Tudo fica no mesmo dominio (sem dor de CORS)

## 1) O que ja foi preparado no projeto

- `Dockerfile`: build do frontend + runtime do backend
- `render.yaml`: configuracao pronta para Render
- `server/.env.example`: variaveis de ambiente
- Backend com suporte a `STORAGE_ROOT_DIR` para persistir:
  - `uploads/report-covers`
  - `data/*.json`

## 2) Deploy rapido no Render (recomendado)

1. Suba este repositorio no GitHub.
2. No Render, use **Blueprint** e selecione o repo (ele le o `render.yaml`).
3. Defina os secrets:
   - `ASAAS_API_KEY`
   - `ASSINAFY_API_KEY` (se usar Assinafy)
4. Deploy.
5. Teste:
   - `GET https://SEU_DOMINIO/api/health`
   - Abra `https://SEU_DOMINIO`

Observacao: sem disco persistente, uploads e arquivos locais serao perdidos em restart/redeploy.

## 3) Deploy rapido no Railway (alternativa)

1. Crie projeto via GitHub.
2. Railway detecta `Dockerfile`.
3. Configure variaveis:
   - `NODE_ENV=production`
   - `STORAGE_ROOT_DIR=/app/storage`
   - `ASAAS_API_KEY`
   - `ASAAS_AMBIENTE=production`
   - `ASSINAFY_API_KEY` (se usar)
4. Anexe um volume em `/app/storage`.
5. Deploy e valide `/api/health`.

## 4) Checklist de go-live

- Backend responde `/api/health`
- Asaas conecta sem erro
- Upload de capa funciona e persiste apos restart
- Front carrega sem chamada para `localhost`
- Dominio final com HTTPS
