import { z } from 'zod'

import { LevelEngine } from '@/services/types.js'

export const $BaseServerOptions = z.object({
  port: z.number().min(0),
  address: z.string().min(1),
  grace: z.number().min(1),
  telemetry: z.boolean().default(true),
  rateLimitMax: z.number().default(120),
  rateLimitWindow: z.number().default(60_000),
})

export const $RedisServerOptions = z.object({
  redisUrl: z.string().optional(),
})

export const $DatabaseOptions = z.object({
  data: z
    .string({
      required_error: 'Data directory path is required',
    })
    .min(1),
})

export const $LevelServerOptions = z.object({
  levelEngine: z.nativeEnum(LevelEngine).default(LevelEngine.classic),
  scheduler: z.boolean().default(true),
  schedulerFrequency: z.number().min(1000),
  sweepExpiry: z.number().min(20000),
})

export const $KyselyServerOptions = z.object({})

export const $ConfigServerOptions = z.object({
  config: z.string().min(1).optional(),
})

export const $CorsServerOptions = z.object({
  cors: z.boolean().default(false),
  corsCredentials: z.boolean().default(true),
  corsOrigin: z.optional(z.array(z.string()).or(z.boolean())),
})

export const $JwtServerOptions = z.object({
  jwtAuth: z.boolean(),
  jwtSigKeyFile: z.string().optional(),
  jwtIss: z.string(),
  jwtAllowedIss: z.array(z.string()),
})

export const $SubscriptionServerOptions = z.object({
  wsMaxClients: z.number().min(0).optional(),
  subscriptionMaxEphemeral: z.number().min(0).optional(),
  subscriptionMaxPersistent: z.number().min(0).optional(),
})

export enum AgentServiceMode {
  local = 'local',
}

export const $AgentCatalogOptions = z.object({
  agentServiceMode: z.nativeEnum(AgentServiceMode).default(AgentServiceMode.local),
  agents: z.string().default('*'),
  agentConfigs: z.record(z.string(), z.any()).default({}),
})

export const $ArchiveOptions = z.object({
  archive: z.boolean().default(false),
  archiveRetention: z.boolean().default(true),
  archiveRetentionPeriod: z.string().default('3_months'),
  archiveTick: z.number().default(24 * 3_600_000), // daily
})

export const $AnalyticsOptions = z.object({
  analytics: z.boolean().default(false),
})

export type CorsServerOptions = z.infer<typeof $CorsServerOptions>
export type JwtServerOptions = z.infer<typeof $JwtServerOptions>
export type ConfigServerOptions = z.infer<typeof $ConfigServerOptions>
export type RedisServerOptions = z.infer<typeof $RedisServerOptions>
export type KyselyServerOptions = z.infer<typeof $KyselyServerOptions>
export type LevelServerOptions = z.infer<typeof $LevelServerOptions>
export type DatabaseOptions = z.infer<typeof $DatabaseOptions>
export type IngressOptions = {
  distributed?: boolean
} & RedisServerOptions
export type AgentCatalogOptions = z.infer<typeof $AgentCatalogOptions>
export type ArchiveOptions = z.infer<typeof $ArchiveOptions>
export type AnalyticsOptions = z.infer<typeof $AnalyticsOptions>
