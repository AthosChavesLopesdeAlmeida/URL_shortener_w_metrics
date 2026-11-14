import { UAParser } from 'ua-parser-js';

// Poucas categorias fixas: cabem em varchar(20) e agrupam bem nos gráficos
export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'other';

// A v1 do ua-parser-js não detecta bots, então usamos uma lista de padrões comuns.
// Inclui os geradores de pré-visualização de link (WhatsApp, Slack, Facebook...),
// que fazem uma requisição ao link quando ele é colado numa conversa.
const BOT_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|slack|discord|telegram|preview|curl|wget|python-requests|headless/i;

export function parseDevice(userAgent: string | null): DeviceType {
  if (!userAgent) return 'other';
  if (BOT_PATTERN.test(userAgent)) return 'bot';

  const { type } = new UAParser(userAgent).getDevice();
  if (type === 'mobile') return 'mobile';
  if (type === 'tablet') return 'tablet';
  // Em desktops o parser não define o tipo; só o tratamos como desktop se reconheceu o sistema
  if (type === undefined && new UAParser(userAgent).getOS().name) return 'desktop';
  return 'other';
}