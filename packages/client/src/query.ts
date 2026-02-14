import { QueryableApi } from './core/types'
import { CrosschainAgent, StewardAgent, sourceSteward as st, sourceCrosschain as xc } from './lib'

type CamelCase<S extends string> = S extends `${infer P}.${infer R}`
  ? `${P}${Capitalize<CamelCase<R>>}`
  : S extends `${infer P}_${infer R}`
    ? `${P}${Capitalize<CamelCase<R>>}`
    : S

function camelize(str: string): string {
  return str
    .split(/[\._]/)
    .map((part, index) => (index === 0 ? part : capitalize(part)))
    .join('')
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function createTypedQueryApi<
  ArgsUnion extends { op: string; criteria?: unknown },
  OpMap extends Record<string, any>,
  AgentType extends QueryableApi<any, any>,
>(agent: AgentType, QueryOpMap: OpMap) {
  type OpKey = Extract<keyof OpMap, string>
  type ArgsForOp<Op extends OpKey> = Extract<ArgsUnion, { op: Op }>

  async function query<K extends OpKey>(op: K, criteria?: ArgsForOp<K>['criteria']): Promise<OpMap[K][]> {
    const payload = { op, criteria }

    const res = await agent.query(payload)
    return res.items as OpMap[K][]
  }

  const apiEntries = (Object.keys(QueryOpMap) as OpKey[]).map((op) => [
    camelize(op),
    (args?: any) => query(op, args),
  ])

  const api = Object.fromEntries(apiEntries) as {
    [K in OpKey as CamelCase<K>]: (criteria?: ArgsForOp<K>['criteria']) => Promise<OpMap[K][]>
  }

  return api
}

/**
 * @public
 */
export function crosschainQueryApi(agent: CrosschainAgent) {
  const QueryOpMap = {
    'assets.list': {} as xc.ListAsset,
    'journeys.list': {} as xc.FullJourneyResponse,
    'journeys.by_id': {} as xc.FullJourneyResponse,
  }

  return createTypedQueryApi<xc.XcQueryArgs, typeof QueryOpMap, CrosschainAgent>(agent, QueryOpMap)
}

/**
 * @public
 */
export function stewardQueryApi(agent: StewardAgent) {
  const QueryOpMap = {
    assets: {} as st.AssetMetadata,
    'assets.list': {} as st.AssetMetadata,
    'assets.by_location': {} as st.AssetMetadata,
    // TODO
    // chain infos
  }

  return createTypedQueryApi<st.StewardQueryArgs, typeof QueryOpMap, StewardAgent>(agent, QueryOpMap)
}
