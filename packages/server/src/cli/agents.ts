import { OptionValues } from 'commander'

/**
 * Parse agent configuration args.
 *
 * Format:
 *   <agent>:<key>=<value>[,<agent>:<key>=<value>...]
 *
 * Example:
 *   parseAgentConfigArgs(
 *     'xcm:explorer=true,xcm:balances=false,xcm:limit=10,steward:asset=true'
 *   )
 *
 * Returns:
 *   {
 *     xcm: { explorer: true, balances: false, limit: 10 },
 *     steward: { asset: true }
 *   }
 */
function parseAgentConfigArgs(str?: string): Record<string, any> {
  const parsed: Record<string, any> = {}
  if (str !== undefined) {
    const tokens = str.split(',')
    for (const token of tokens) {
      const [agentIdRaw, rest] = token.split(':', 2)
      if (!agentIdRaw || !rest) {
        throw new Error(`Invalid --agent-config entry: ${token}`)
      }

      const agentId = agentIdRaw.trim().toLowerCase()
      const eqIdx = rest.indexOf('=')
      if (eqIdx === -1) {
        throw new Error(`Invalid key=value for agent ${agentId} in --agent-config: ${rest}`)
      }

      const key = rest.slice(0, eqIdx).trim()
      const val = rest.slice(eqIdx + 1).trim()

      let parsedVal: any = val
      if (val === 'true') {
        parsedVal = true
      } else if (val === 'false') {
        parsedVal = false
      } else if (!isNaN(Number(val)) && val !== '') {
        parsedVal = Number(val)
      }

      if (!parsed[agentId]) {
        parsed[agentId] = {}
      }
      parsed[agentId][key] = parsedVal
    }
  }

  return parsed
}

export function parseAgentConfigs(opts: OptionValues) {
  return parseAgentConfigArgs(opts.agentConfig)
}
