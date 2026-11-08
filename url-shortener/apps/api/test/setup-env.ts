// Roda antes dos testes. O dotenv não sobrescreve variáveis já definidas,
// então estes valores vencem os do .env de desenvolvimento.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://shortener:shortener@localhost:5432/shortener_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.SHORT_URL_BASE = 'http://localhost:8080';