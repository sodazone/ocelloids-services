import ky from 'ky'

import { WormholeOperation } from './types.js'

export class WormholescanClient {
  private api

  constructor(baseUrl = 'https://api.wormholescan.io') {
    this.api = ky.create({ prefixUrl: baseUrl, timeout: 10000 })
  }

  async fetchOperationById(
    chainId: string | number,
    emitterAddress: string,
    sequence: string | number,
  ): Promise<WormholeOperation> {
    const op = await this.api
      .get(`api/v1/operations/${chainId}/${emitterAddress}/${sequence}`)
      .json<WormholeOperation>()

    return op
  }
}
