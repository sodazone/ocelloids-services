import { FullJourneyResponse, ListAsset, XcQueryArgs } from './crosschain/types'
import { CrosschainAgent, QueryableApi, StewardAgent } from './lib'
import { AssetMetadata, StewardQueryArgs } from './steward/types'

type CamelCase<S extends string> = S extends `${infer P}.${infer R}`
  ? `${P}${Capitalize<CamelCase<R>>}`
  : S extends `${infer P}_${infer R}`
    ? `${P}${Capitalize<CamelCase<R>>}`
    : S

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

  const apiEntries = (Object.keys(QueryOpMap) as OpKey[]).map((op) => [op, (args?: any) => query(op, args)])

  const api = Object.fromEntries(apiEntries) as {
    [K in OpKey as CamelCase<K>]: (criteria?: ArgsForOp<K>['criteria']) => Promise<OpMap[K][]>
  }

  return api
}

export function crosschainQueryApi(agent: CrosschainAgent) {
  const QueryOpMap = {
    'assets.list': {} as ListAsset,
    'journeys.list': {} as FullJourneyResponse,
    'journeys.by_id': {} as FullJourneyResponse,
  }

  return createTypedQueryApi<XcQueryArgs, typeof QueryOpMap, CrosschainAgent>(agent, QueryOpMap)
}

export function stewardQueryApi(agent: StewardAgent) {
  const QueryOpMap = {
    assets: {} as AssetMetadata,
    'assets.list': {} as AssetMetadata,
    'assets.by_location': {} as AssetMetadata,
    // TODO
    // chain infos
  }

  return createTypedQueryApi<StewardQueryArgs, typeof QueryOpMap, StewardAgent>(agent, QueryOpMap)
}
