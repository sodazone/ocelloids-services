export interface ApiClient {
  readonly chainId: string

  connect(): Promise<ApiClient>
  disconnect(): void
}
