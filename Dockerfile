# syntax=docker/dockerfile:1

FROM node:20-alpine AS frontend-builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY public ./public
COPY src ./src

RUN npm run build:cloud

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY server ./server
COPY --from=frontend-builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "server/index.js"]
