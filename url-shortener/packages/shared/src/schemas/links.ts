import { z } from 'zod';

export const QR_MIN_SIZE = 128;
export const QR_MAX_SIZE = 1024;
export const QR_DEFAULT_SIZE = 512;

export const updateLinkSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

export const createLinkSchema = z.object({
  longUrl: z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((u) => /^https?:\/\//i.test(u), 'Only http or https URLs'),
});

export const qrQuerySchema = z.object({
  format: z.enum(['svg', 'png']).default('svg'),

  // Só vale para PNG (o SVG escala sozinho). Vem como string na URL, então precisa de coerce
  size: z.coerce.number().int().min(QR_MIN_SIZE).max(QR_MAX_SIZE).default(QR_DEFAULT_SIZE),

  // Não use z.coerce.boolean(): ele transforma a string 'false' em true
  download: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => v === 'true' || v === '1'),
});

export type QrQuery = z.infer<typeof qrQuerySchema>;

export type LinkStatus = 'active' | 'inactive';

export type LinkResponse = {
  id: string;
  shortCode: string;
  shortUrl: string;
  longUrl: string;
  status: LinkStatus;
  createdAt: string; // vem como string ISO no JSON
};

export type UpdateLinkInput = z.infer<typeof updateLinkSchema>;
export type CreateLinkInput = z.infer<typeof createLinkSchema>;