import { z } from 'zod';

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