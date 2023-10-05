import { z } from 'zod';
import { config, SubstrateApis } from '@sodazone/ocelloids';
import { AbstractLevel } from 'abstract-level';

export type DB = AbstractLevel<Buffer | Uint8Array | string, string, any>;

export type DefaultSubstrateApis = SubstrateApis<
config.Configuration, config.ApiNames<config.Configuration>
>;

export const $QuerySubscription = z.object({
  id: z.string({
    required_error: 'id is required'
  }).min(1),
  origin: z.string({
    required_error: 'origin id is required',
    coerce: true
  }).regex(/[0-9]+/, 'origin id must be numeric'),
  senders: z.array(z.string()).min(
    1, 'at least 1 sender address is required'
  ),
  destinations: z.array(z.string({
    required_error: 'destination id is required',
    coerce: true
  }).regex(/[0-9]+/, 'destination id must be numeric')),
  followAllDestinations: z.boolean().default(false),
  // TODO union...
  notify: z.object({
    endpoint: z.string()
  })
});

export type QuerySubscription = z.infer<typeof $QuerySubscription>;

