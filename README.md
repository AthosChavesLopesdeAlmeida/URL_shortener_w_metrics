# URL Shortener

Encurtador de links com painel de métricas, expiração e QR code.
Projeto de estudo focado em System Design: cache, rate limiting, filas e particionamento.

## Status
Em desenvolvimento. Fase atual: 0 (fundação).

## Rodando localmente
    cp .env.example .env
    npm install
    npm run infra:up
    npm run build:packages

## Estrutura
- `apps/web`: front-end (Next.js)
- `apps/api`: API e redirect (Nest.js)
- `apps/worker`: processamento assíncrono de cliques
- `packages/db`: schema Drizzle compartilhado
- `packages/shared`: tipos e constantes compartilhados
- `docs/decisions`: registros de decisões de arquitetura