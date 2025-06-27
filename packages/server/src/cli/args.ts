import { InvalidArgumentError, Option } from 'commander'

import { FastifyCorsOptions } from '@fastify/cors'
import { CorsServerOptions } from '../types.js'

function positiveInt(v: string) {
  const parsedValue = parseInt(v, 10)
  if (isNaN(parsedValue) || parsedValue < 0) {
    // includes 0
    throw new InvalidArgumentError('Must be a positive integer')
  }
  return parsedValue
}

function collect(value: string, previous: string[] | boolean = []) {
  if (typeof previous === 'boolean') {
    return previous
  }

  if (value === 'true' || value === 'false') {
    return value === 'true'
  }

  return previous.concat([value])
}

export function expandRegExps(arr: any) {
  return Array.isArray(arr)
    ? arr.map((o) => {
        if (o.startsWith('/') && o.endsWith('/')) {
          return new RegExp(o.substring(1, o.length - 1))
        }
        return o
      })
    : arr
}

export function toCorsOpts({ corsOrigin, corsCredentials }: CorsServerOptions): FastifyCorsOptions {
  return {
    credentials: corsCredentials,
    origin: expandRegExps(corsOrigin),
  }
}

export function opt(name: string, description: string, env?: string): Option {
  const opt = new Option(name, description)
  return env === undefined ? opt : opt.env(env)
}

export function optInt(name: string, description: string, env?: string) {
  return opt(name, description, env).argParser(positiveInt)
}

export function optBool(name: string, description: string, env?: string) {
  return opt(name, description, env).argParser((v) => v === 'true')
}

export function optArr(name: string, description: string, env?: string) {
  return opt(name, description, env).argParser(collect)
}
