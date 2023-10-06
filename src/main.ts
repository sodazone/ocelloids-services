#!/usr/bin/env node

import 'dotenv/config';
import process from 'node:process';

import z from 'zod';
import { Option, Command, program, InvalidArgumentError } from 'commander';

import { version } from './consts.js';
import { createServer } from './server.js';
import { $ServerOptions } from './types.js';

/**
 * Start the server from the command line.
 */
function startServer(this: Command) {
  try {
    const opts = $ServerOptions.parse(this.opts());
    createServer(opts);
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error(err.issues);
      program.help();
    } else {
      console.error(err);
      process.exit(1);
    }
  }
}

function positiveInt(v: string) {
  const parsedValue = parseInt(v, 10);
  if (isNaN(parsedValue) || parsedValue < 0) {
    throw new InvalidArgumentError('Must be a positive integer');
  }
  return parsedValue;
}

function optionOf(
  name: string,
  description: string,
  env: string
) {
  return new Option(name, description).env(env);
}

program
  .name('xcm-mon')
  .description('XCM Monitoring Server')
  .version(version)
  .addOption(
    optionOf('-h, --host <address>',
      'host to bind to',
      'XCMON_HOST'
    ).default('localhost')
  )
  .addOption(
    optionOf('-p, --port <number>',
      'port number to listen on',
      'XCMON_PORT',
    ).default(3000).argParser(positiveInt)
  )
  .addOption(
    optionOf(
      '-c, --config <path>',
      'service configuration file path',
      'XCMON_CONFIG_PATH'
    ).makeOptionMandatory(true)
  )
  .addOption(
    optionOf(
      '-d, --db <path>',
      'database directory path',
      'XCMON_DB_PATH'
    ).default('./db')
  )
  .addOption(
    optionOf('-g, --grace',
      'milliseconds for the graceful close to finish',
      'XCMON_CLOSE_GRACE_DELAY',
    ).default(700).argParser(positiveInt)
  )
  .action(startServer);

program.parse();
