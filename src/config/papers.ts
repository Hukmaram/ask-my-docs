import { z } from 'zod';

export const paperConfigSchema = z.object({
  id: z.string().min(1),
});

export const papersConfigSchema = z.object({
  papers: z.array(paperConfigSchema).min(1),
});

export type PaperConfig = z.infer<typeof paperConfigSchema>;
export type PapersConfig = z.infer<typeof papersConfigSchema>;