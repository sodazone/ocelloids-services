/**
 * @public
 */
export type RequestOptions = RequestInit & {
  hooks?: {
    beforeRetry?: Array<(retryOptions: { attempt: number; delay: number }) => void>
  }
}

export type DoFetchOptions = {
  fetchOptions?: RequestOptions
  maxRetries?: number
  retryStatusCodes?: number[]
}

export type DoFetch = <T>(url: string, options?: DoFetchOptions) => Promise<T>

/**
 * Performs an HTTP fetch with robust retry handling.
 *
 * - Retries on 429 and 503 using Retry-After or X-RateLimit-Reset headers
 * - Retries on custom status codes via `retryStatusCodes`
 * - Uses exponential backoff with jitter between attempts
 */
export async function ocFetch<T>(url: string, ops?: DoFetchOptions): Promise<T> {
  const fetchOptions = ops?.fetchOptions ?? {}
  const maxRetries = ops?.maxRetries ?? 3
  const retryStatusCodes = ops?.retryStatusCodes ?? [429, 503]
  const headers = new Headers(fetchOptions.headers)

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, { ...fetchOptions, headers })

    if (response.ok) {
      const contentType = response.headers.get('content-type')
      if (contentType == null || contentType?.includes('application/json')) {
        return response.json() as Promise<T>
      }
      return (await response.text()) as unknown as T
    }

    // Retry if status code is in the configured list
    if (retryStatusCodes.includes(response.status)) {
      const retryAfterMs = parseRetryAfterHeaders(response.headers)
      const delay = retryAfterMs ?? exponentialBackoff(attempt)

      if (attempt < maxRetries) {
        await sleep(delay)
        if (fetchOptions?.hooks?.beforeRetry) {
          for (const hook of fetchOptions.hooks.beforeRetry) {
            hook({ attempt, delay })
          }
        }
        // retry
        continue
      }
    }

    // Non-retryable or exhausted retries
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`)
}

/**
 * Parses supported rate-limit headers into milliseconds.
 * Supported:
 *  - Retry-After (seconds or HTTP date)
 *  - X-RateLimit-Reset (epoch seconds)
 */
function parseRetryAfterHeaders(headers: Headers): number | null {
  const retryAfter = headers.get('Retry-After')
  const rateLimitReset = headers.get('X-RateLimit-Reset')

  if (retryAfter) {
    const parsed = parseRetryAfter(retryAfter)
    if (parsed !== null) {
      return parsed
    }
  }

  if (rateLimitReset) {
    const parsed = parseRateLimitReset(rateLimitReset)
    if (parsed !== null) {
      return parsed
    }
  }

  return null
}

/** Parses Retry-After header (seconds or HTTP date) into ms delay. */
function parseRetryAfter(value: string): number | null {
  const seconds = Number(value)
  if (!isNaN(seconds)) {
    return seconds * 1000
  }

  const date = Date.parse(value)
  if (!isNaN(date)) {
    const delay = date - Date.now()
    return delay > 0 ? delay : null
  }

  return null
}

/** Parses X-RateLimit-Reset (epoch seconds) into ms delay. */
function parseRateLimitReset(value: string): number | null {
  const epoch = Number(value)
  if (!isNaN(epoch)) {
    const delay = epoch * 1000 - Date.now()
    return delay > 0 ? delay : null
  }
  return null
}

/** Simple exponential backoff with jitter. */
function exponentialBackoff(attempt: number): number {
  const base = 500 // base delay in ms
  const max = 10_000 // cap delay at 10s
  const delay = Math.min(max, base * 2 ** attempt)
  const jitter = Math.random() * 200
  return delay + jitter
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
