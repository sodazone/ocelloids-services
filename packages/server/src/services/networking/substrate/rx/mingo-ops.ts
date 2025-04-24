import { asPublicKey } from '@/common/util.js'
import { OpType, Options, QueryOperator, useOperators } from 'mingo/core'
import { Any, AnyObject, Predicate } from 'mingo/types'
import { ensureArray, resolve } from 'mingo/util'

// import all operators
import 'mingo/init/system'

function addressEq(a: string, b: string) {
  return a === b || asPublicKey(a) === asPublicKey(b)
}

function bn(x: Any) {
  switch (typeof x) {
    case 'number':
    case 'string':
    case 'bigint':
      return BigInt(x)
    default:
      throw new Error(`unable to convert ${typeof x} to BN`)
  }
}

function compare(a: Any, b: Any, f: Predicate<Any>): boolean {
  return ensureArray(a).some((x) => f(x, b))
}

function $bn_lt(a: Any, b: Any): boolean {
  return compare(a, b, (x: Any, y: Any) => bn(x) < bn(y))
}

function $bn_lte(a: Any, b: Any): boolean {
  return compare(a, b, (x: Any, y: Any) => bn(x) <= bn(y))
}

function $bn_gt(a: Any, b: Any): boolean {
  return compare(a, b, (x: Any, y: Any) => bn(x) > bn(y))
}

function $bn_gte(a: Any, b: Any): boolean {
  return compare(a, b, (x: Any, y: Any) => bn(x) >= bn(y))
}

function $bn_eq(a: Any, b: Any): boolean {
  return compare(a, b, (x: Any, y: Any) => bn(x) === bn(y))
}

function $bn_neq(a: Any, b: Any): boolean {
  return compare(a, b, (x: Any, y: Any) => bn(x) !== bn(y))
}

function $address_eq(a: Any, b: Any): boolean {
  if (typeof a === 'string' && typeof b === 'string') {
    try {
      return addressEq(a, b)
    } catch (_) {
      return false
    }
  }
  return false
}

function $address_neq(a: Any, b: Any): boolean {
  if (typeof a === 'string' && typeof b === 'string') {
    try {
      return !addressEq(a, b)
    } catch (_) {
      return true
    }
  }
  return true
}

function createQueryOperator(predicate: Predicate<Any>): QueryOperator {
  const f = (selector: string, value: Any, options: Options) => {
    const opts = { unwrapArray: true }
    const depth = Math.max(1, selector.split('.').length - 1)
    return (obj: AnyObject): boolean => {
      // value of field must be fully resolved.
      const lhs = resolve(obj, selector, opts)
      return predicate(lhs, value, { ...options, depth })
    }
  }
  f.op = 'query'
  return f // as QueryOperator;
}

let installed = false

export function installOperators() {
  // Register query operators
  if (!installed) {
    useOperators(OpType.QUERY, {
      $bn_lt: createQueryOperator($bn_lt),
      $bn_lte: createQueryOperator($bn_lte),
      $bn_gt: createQueryOperator($bn_gt),
      $bn_gte: createQueryOperator($bn_gte),
      $bn_eq: createQueryOperator($bn_eq),
      $bn_neq: createQueryOperator($bn_neq),
      $address_eq: createQueryOperator($address_eq),
      $address_neq: createQueryOperator($address_neq),
    })
  }
  installed = true
}
