import { LevelEngine } from '../services/types.js'
import { AgentServiceMode } from '../types.js'

const { createServer } = await import('../server.js')

export function mockServer() {
  return createServer({
    config: 'config/test.toml',
    data: '',
    scheduler: false,
    telemetry: true,
    sweepExpiry: 0,
    schedulerFrequency: 0,
    grace: 1000,
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
    mode: AgentServiceMode.local,
  })
}
