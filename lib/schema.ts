import { z } from 'zod';

export const RecSchema = z.object({
  id: z.string().nullable(),
  title: z.string(),
  sommelierPitch: z.string(),
  whyItFits: z.array(z.string()).min(2).max(4),
  specs: z.object({
    players: z.string().nullable(),
    playtime: z.string().nullable(),
    complexity: z.number().nullable().optional(),
  }),
  mechanics: z.array(z.string()).optional().default([]),
  theme: z.string().optional().default(''),
  price: z.object({
    amount: z.number().nullable().optional(),
    store: z.string().nullable().optional(),
    url: z.string().nullable().optional()
  }).optional(),
  alternates: z.array(z.string()).optional().default([])
});

export const ResponseSchema = z.object({
  followUps: z.array(z.string()).max(3).optional().default([]),
  recommendations: z.array(RecSchema).length(3),
  metadata: z.object({
    interpretedNeeds: z.array(z.string()).optional().default([]),
    notes: z.string().optional().default('')
  }).optional().default({})
});

export type SommelierResponse = z.infer<typeof ResponseSchema>;
