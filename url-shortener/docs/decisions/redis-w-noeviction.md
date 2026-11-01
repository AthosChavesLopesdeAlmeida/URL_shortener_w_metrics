# 001. Uma instância de Redis, política noeviction

## Contexto
O Redis cumpre três papéis: cache de redirects, fila (BullMQ) e contadores do rate limiter.

## Decisão
Uma instância só, com `maxmemory-policy noeviction`, e TTL obrigatório em todas as chaves de cache.

## Motivo
O BullMQ exige noeviction para não perder jobs. Uma instância reduz a complexidade operacional.

## Consequências
Se a memória encher, escritas falham em vez de descartar chaves. Evolução possível: separar
cache (allkeys-lru) e fila (noeviction) em duas instâncias.