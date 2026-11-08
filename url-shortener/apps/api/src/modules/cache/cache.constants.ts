export const LINK_CACHE_TTL_SECONDS = 60 * 60; // 1 hora
export const NEGATIVE_CACHE_TTL_SECONDS = 60; // 404 e links expirados

export const linkKey = (code: string) => `link:${code}`;