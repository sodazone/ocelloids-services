import { Observable } from 'rxjs'
import { z } from 'zod'

export type Finality = 'finalized' | 'new'
export type BlockStatus = 'new' | 'finalized' | 'pruned'

export type NeutralHeader = {
  hash: string
  parenthash: string
  height: number
  status?: BlockStatus
}

export interface ApiOps {
  followHeads$(finality: Finality): Observable<NeutralHeader>
  getBlockHash(height: number): Promise<string>
  getNeutralBlockHeader(hash: string): Promise<NeutralHeader>
}

export interface ApiClient extends ApiOps {
  readonly chainId: string

  connect(): Promise<ApiClient>
  disconnect(): Promise<void>
}

export const BackfillConfigSchema = z.object({
  start: z.number(),
  end: z.number(),
  emissionRate: z.number().default(12_000),
  paraIds: z.array(z.string()).optional(),
})
export const BackfillConfigsSchema = z.record(z.string(), BackfillConfigSchema)

export type BackfillConfig = z.infer<typeof BackfillConfigSchema>
export type BackfillConfigs = z.infer<typeof BackfillConfigsSchema>
