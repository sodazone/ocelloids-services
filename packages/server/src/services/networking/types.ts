import { Observable } from 'rxjs'

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
  disconnect(): void
}
