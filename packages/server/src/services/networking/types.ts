import { Observable } from 'rxjs'

export type NeutralHeader = {
  hash: string
  height: number
  parenthash: string
}

export interface ApiOps {
  followHeads$: Observable<NeutralHeader>
  getBlockHash(height: number): Promise<string>
  getNeutralBlockHeader(hash: string): Promise<NeutralHeader>
}

export interface ApiClient extends ApiOps {
  readonly chainId: string

  connect(): Promise<ApiClient>
  disconnect(): void
}
