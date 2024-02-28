import { Option, InvalidArgumentError } from 'commander';

import { ServerOptions } from './types.js';
import { FastifyCorsOptions } from '@fastify/cors';

function positiveInt(v: string) {
  const parsedValue = parseInt(v, 10);
  if (isNaN(parsedValue) || parsedValue < 0) { // includes 0
    throw new InvalidArgumentError('Must be a positive integer');
  }
  return parsedValue;
}

function collect(value: string, previous: string[] | boolean = []) {
  if (typeof previous === 'boolean') {
    return previous;
  }

  if (value === 'true' || value === 'false') {
    return value === 'true';
  }

  return previous.concat([value]);
}

export function toCorsOpts(
  { corsOrigin, corsCredentials }: ServerOptions
): FastifyCorsOptions {
  return {
    credentials: corsCredentials,
    origin: Array.isArray(corsOrigin) ? corsOrigin.map(o => {
      if (o.startsWith('/') && o.endsWith('/')) {
        return new RegExp(o.substring(1, o.length - 1));
      }
      return o;
    }) : corsOrigin
  };
}

export function opt(
  name: string,
  description: string,
  env: string
): Option {
  return new Option(name, description).env(env);
}

export function optInt(
  name: string,
  description: string,
  env: string
) {
  return opt(name, description, env).argParser(positiveInt);
}

export function optBool(
  name: string,
  description: string,
  env: string
) {
  return opt(name, description, env).argParser(
    v => v === 'true'
  );
}

export function optArr(
  name: string,
  description: string,
  env: string
) {
  return opt(name, description, env).argParser(collect);
}