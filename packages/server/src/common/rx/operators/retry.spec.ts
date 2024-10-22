// Copyright 2023-2024 SO/DA zone
// SPDX-License-Identifier: Apache-2.0

import { defer, firstValueFrom, lastValueFrom, of, throwError } from 'rxjs'
import { retryWithTruncatedExpBackoff, truncatedExpBackoff } from './retry.js'

const errorUntil = (until: number) => {
  let c = 0
  return defer(() => (++c < until ? throwError(() => Error('some')) : of(c)))
}

describe('retry with truncated exponential backoff', () => {
  it('should not retry', async () => {
    expect(await firstValueFrom(of(1).pipe(retryWithTruncatedExpBackoff()))).toBe(1)
  })

  it('should retry 3 times', async () => {
    expect(await lastValueFrom(errorUntil(3).pipe(retryWithTruncatedExpBackoff({ baseDelay: 1 })))).toBe(3)
  })

  it('should truncate on infinity', async () => {
    expect(await firstValueFrom(truncatedExpBackoff(1, 10)(null, Infinity))).toBeDefined()
  })
})
