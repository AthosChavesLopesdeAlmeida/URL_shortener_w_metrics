import { z } from 'zod';

export const createClickEventSchema = z.object({
    eventId: z.uuid(),
    linkId: z.uuid(),
    clickedAt: z.iso.datetime(),
    ip: z.string().nullable(),
    userAgent: z.string().max(512).nullable(),
    referrer: z.string().max(2048).nullable()
});

export type CreateClickEventInput = z.infer<typeof createClickEventSchema>;
