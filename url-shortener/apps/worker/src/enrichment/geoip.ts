import { existsSync } from 'node:fs';
import { open, validate, type CountryResponse } from 'maxmind';

export type GeoLookup = { country(ip: string | null): string | null };

export async function createGeoLookup(dbPath: string): Promise<GeoLookup> {
  // Sem o arquivo, o worker sobe mesmo assim e grava país null
  if (!existsSync(dbPath)) {
    console.warn(`[worker] GeoIp file not found in ${dbPath}. The country will be recorded as null `);
    return { country: () => null };
  }

  // Abre uma vez na inicialização, não por evento
  const reader = await open<CountryResponse>(dbPath);

  return {
    country(ip) {
      if (!ip || !validate(ip)) return null;
      try {
        return reader.get(ip)?.country?.iso_code ?? null;
      } catch {
        return null;
      }
    },
  };
}