import { Subject } from 'rxjs'

let hasShutdown = false

export const shutdown$ = new Subject<void>()

export function triggerShutdown() {
  hasShutdown = true
  shutdown$.next()
  shutdown$.complete()
}

export function isShuttingDown() {
  return hasShutdown
}
