export type QuerySubscription = {
  id: string
  origin: string | number
  senders: string[]
  notify: {
    endpoint: string
  }
}