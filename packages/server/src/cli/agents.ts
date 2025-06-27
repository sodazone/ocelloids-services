import { OptionValues } from 'commander'

function parseAgentConfigArgs(entries: string[]): Record<string, any> {
  const parsed: Record<string, any> = {}

  for (const entry of entries) {
    const [agentIdRaw, configRaw] = entry.split(':', 2)
    if (!agentIdRaw || !configRaw) {
      throw new Error(`Invalid --agent-config entry: ${entry}`)
    }

    const agentId = agentIdRaw.trim().toLowerCase()
    const config: Record<string, any> = {}

    for (const pair of configRaw.split(',')) {
      const eqIdx = pair.indexOf('=')
      if (eqIdx === -1) {
        throw new Error(`Invalid key=value in --agent-config for ${agentId}: ${pair}`)
      }

      const key = pair.slice(0, eqIdx).trim()
      const val = pair.slice(eqIdx + 1).trim()

      let parsedVal: any = val
      if (val === 'true') {
        parsedVal = true
      } else if (val === 'false') {
        parsedVal = false
      } else if (!isNaN(Number(val))) {
        parsedVal = Number(val)
      }

      config[key] = parsedVal
    }

    parsed[agentId] = config
  }

  return parsed
}

export function parseAgentConfigs(opts: OptionValues) {
  return parseAgentConfigArgs(opts.agentConfig ?? [])
}
