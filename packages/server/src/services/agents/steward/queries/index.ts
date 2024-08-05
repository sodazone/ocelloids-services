import { IngressConsumer } from '@/services/ingress/index.js'
import { LevelDB } from '@/services/types.js'

import { ValidationError } from '@/errors.js'
import { QueryParams, QueryResult } from '@/lib.js'
import { $StewardQueryArgs, StewardQueryArgs } from '../types.js'
import { AssetsQueryHandler } from './assets.js'
import { ChainsQueryHandler } from './chains.js'
import { LocationQueryHandler } from './location/handler.js'

export class Queries {
  readonly #assetsHandler
  readonly #chainsHandler
  readonly #assetsLocationHandler

  constructor(dbAssets: LevelDB, dbChains: LevelDB, ingress: IngressConsumer) {
    this.#assetsHandler = new AssetsQueryHandler(dbAssets)
    this.#chainsHandler = new ChainsQueryHandler(dbChains)
    this.#assetsLocationHandler = new LocationQueryHandler(dbAssets, ingress)
  }

  async dispatch(params: QueryParams<StewardQueryArgs>): Promise<QueryResult> {
    const { args, pagination } = params
    $StewardQueryArgs.parse(args)

    if (args.op === 'assets') {
      return await this.#assetsHandler.queryAsset(args.criteria)
    } else if (args.op === 'assets.list') {
      return await this.#assetsHandler.queryAssetList(args.criteria, pagination)
    } else if (args.op === 'assets.by_location') {
      return await this.#assetsLocationHandler.queryAssetByLocation(args.criteria)
    } else if (args.op === 'chains') {
      return await this.#chainsHandler.queryChains(args.criteria)
    } else if (args.op === 'chains.list') {
      return await this.#chainsHandler.queryChainList(pagination)
    }

    throw new ValidationError('Unknown query type')
  }
}
