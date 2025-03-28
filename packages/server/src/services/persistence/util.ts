import path from 'path'

export function resolveDataPath(filename: string, data?: string) {
  return data && data.length > 0 ? path.join(data, filename) : ':memory:'
}
