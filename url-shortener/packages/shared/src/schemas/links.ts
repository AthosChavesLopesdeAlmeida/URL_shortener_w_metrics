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
  .refine((u) => /^https?:\/\//i.test(u), 'Apenas URLs http ou https'),
});

export type UpdateLinkInput = z.infer<typeof updateLinkSchema>;
export type CreateLinkInput = z.infer<typeof createLinkSchema>;