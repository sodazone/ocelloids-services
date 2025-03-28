import { LevelEngine } from '../services/types.js'
import { AgentServiceMode } from '../types.js'

const { createServer } = await import('../server.js')

export function mockServer(overrides?: Record<string, any>) {
  return createServer({
    config: 'config/test.toml',
    data: '',
    analytics: false,
    scheduler: false,
    archive: true,
    archiveRetention: false,
    archiveRetentionPeriod: '0_days',
    agents: '*',
    archiveTick: 0,
    telemetry: true,
    sweepExpiry: 0,
    schedulerFrequency: 0,
    grace: 500,
    address: 'localhost',
    port: 0,
    subscriptionMaxEphemeral: 10_000,
    subscriptionMaxPersistent: 10_000,
    wsMaxClients: 10_000,
    cors: false,
    corsCredentials: false,
    corsOrigin: true,
    distributed: false,
    levelEngine: LevelEngine.mem,
    agentServiceMode: AgentServiceMode.local,
    rateLimitMax: 10_000,
    rateLimitWindow: 10_000,
    jwtAuth: false,
    jwtIss: 'test',
    jwtAllowedIss: ['test'],
    ...overrides,
  })
}
