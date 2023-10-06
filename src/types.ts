import { z } from 'zod';

export const $ServerOptions = z.object({
  config: z.string({
    required_error: 'Configuration file path is required'
  }).min(1),
  db: z.string({
    required_error: 'Database directory path is required'
  }).min(1),
  port: z.number().min(0),
  host: z.string().min(1),
  grace: z.number().min(1)
});

export type ServerOptions = z.infer<typeof $ServerOptions>;
