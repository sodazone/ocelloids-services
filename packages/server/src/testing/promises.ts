import { jest } from '@jest/globals'

export const flushPromises = () => new Promise((resolve) => jest.requireActual<any>('timers').setImmediate(resolve))