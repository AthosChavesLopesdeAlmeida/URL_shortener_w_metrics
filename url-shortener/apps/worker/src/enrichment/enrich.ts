import type { CreateClickEventInput } from '@shortener/shared';
import { parseDevice, type DeviceType } from './device';
import type { GeoLookup } from './geoip';
import { parseReferrer } from './referrer';

export type EnrichedClick = {
  country: string | null;
  deviceType: DeviceType;
  referrer: string | null;
};

export function enrichClick(event: CreateClickEventInput, geo: GeoLookup, ownHosts: string[] = []): EnrichedClick {
  return {
    country: geo.country(event.ip), // o IP só serve para isso e nunca é gravado
    deviceType: parseDevice(event.userAgent),
    referrer: parseReferrer(event.referrer, ownHosts),
  };
}