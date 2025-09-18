import path from 'path'

/**
 * Resolve a file path for data, or return ":memory:" if no path is provided.
 */
export function resolveDataPath(filename: string, data?: string) {
  return data && data.length > 0 ? (data === ':memory:' ? data : path.join(data, filename)) : ':memory:'
}
