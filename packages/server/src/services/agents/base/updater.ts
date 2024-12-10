import { Operation, applyPatch } from 'rfc6902'

import { ZodSchema } from 'zod'

import { NotFound, ValidationError } from '@/errors.js'
import { $Subscription, Subscription } from '@/services/subscriptions/types.js'
import { NetworkURN } from '@/services/types.js'

import { IngressConsumers } from '@/services/ingress/consumer/types.js'
import { SubscriptionHandler } from '../types.js'

export function hasOp(patch: Operation[], path: string) {
  return patch.some((op) => op.path.startsWith(path))
}

/**
 * Deep copy function for TypeScript.
 * @param T Generic type of target/copied value.
 * @param target Target value to be copied.
 * @see Source project, ts-deepcopy https://github.com/ykdr2017/ts-deepcopy
 * @see Code pen https://codepen.io/erikvullings/pen/ejyBYg
 */
const deepCopy = <T>(target: T): T => {
  if (target === null) {
    return target
  }
  if (target instanceof Date) {
    return new Date(target.getTime()) as any
  }
  if (target instanceof Array) {
    const cp = [] as any[]
    ;(target as any[]).forEach((v) => {
      cp.push(v)
    })
    return cp.map((n: any) => deepCopy<any>(n)) as any
  }
  if (typeof target === 'object') {
    const cp = { ...(target as { [key: string]: any }) } as { [key: string]: any }
    Object.keys(cp).forEach((k) => {
      cp[k] = deepCopy<any>(cp[k])
    })
    return cp as T
  }
  return target
}

export class SubscriptionUpdater {
  readonly #ingress: IngressConsumers
  readonly #allowedPaths: string[]

  constructor(ingress: IngressConsumers, allowedPaths: string[]) {
    this.#ingress = ingress
    this.#allowedPaths = allowedPaths
  }

  prepare<T>({
    handler,
    patch,
    argsSchema,
  }: {
    handler: SubscriptionHandler
    patch: Operation[]
    argsSchema: ZodSchema
  }): Subscription<T> {
    if (handler === undefined) {
      throw new NotFound('subscription not found')
    }

    const descriptor = deepCopy(handler.subscription) as Subscription<T>

    // Check allowed patch ops
    const allowedOps = patch.every((op) => this.#allowedPaths.some((s) => op.path.startsWith(s)))

    if (allowedOps) {
      applyPatch(descriptor, patch)

      $Subscription.parse(descriptor)
      argsSchema.parse(descriptor.args)

      return descriptor
    } else {
      throw new ValidationError('Only operations on these paths are allowed: ' + this.#allowedPaths.join(','))
    }
  }

  validateNetworks(networks: string[]) {
    const consumers = Object.values(this.#ingress)
    if (!networks.every((n) => consumers.find((c) => c.isNetworkDefined(n as NetworkURN)))) {
      throw new ValidationError('Invalid network URN')
    }
  }
}
