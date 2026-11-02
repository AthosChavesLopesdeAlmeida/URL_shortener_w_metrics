import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  username: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;