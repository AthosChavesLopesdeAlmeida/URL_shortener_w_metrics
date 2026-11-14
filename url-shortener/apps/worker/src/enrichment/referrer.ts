const MAX_LENGTH = 255;

// Reduz a URL de origem a um domínio. Sem referrer (acesso direto) devolve null.
export function parseReferrer(raw: string | null, ownHosts: string[] = []): string | null {
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null; // valor malformado
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!host) return null;

  // Navegação interna (vinda do próprio encurtador) não é uma origem de tráfego
  if (ownHosts.some((own) => own.toLowerCase().replace(/^www\./, '') === host)) return null;

  return host.slice(0, MAX_LENGTH);
}   