import { z } from 'zod'

export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>
export const $NetworkString = z.string().regex(/urn:ocn:[a-z:0-9]+/, 'The network ID must be a valid URN')
