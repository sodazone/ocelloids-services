#!/usr/bin/env node

import 'dotenv/config';
import process from 'node:process';

import z from 'zod';
import { Option, Command, program, InvalidArgumentError } from 'commander';

import version from './version.js';
import { createServer } from './server.js';
import { $ServerOptions } from './types.js';

/**
 * Starts the server from the command line.
 */
async function startServer(this: Command) {
  try {
    const opts = $ServerOptions.parse(this.opts());
    const server = await createServer(opts);
    server.listen({
      port: opts.port,
      host: opts.host
    }, function (err, _) {
      if (err) {
        server.log.error(err);
        process.exit(1);
      }
    });
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
      '-c, --config <file>',
      'service configuration file',
      'XCMON_CONFIG_FILE'
    ).makeOptionMandatory(true)
  )
  .addOption(
    optionOf(
      '-d, --db <dir>',
      'database directory',
      'XCMON_DB_DIR'
    ).default('./db')
  )
  .addOption(
    optionOf(
      '-j, --janitor <boolean>',
      'enables or disables the db janitor',
      'XCMON_DB_JANITOR_ENABLE'
    ).default(true)
  )
  .addOption(
    optionOf(
      '--sweep-interval <milliseconds>',
      'milliseconds to wait before each sweeping',
      'XCMON_DB_JANITOR_SWEEP_INTERVAL'
    ).default(300000).argParser(positiveInt) // 5 minutes
  )
  .addOption(
    optionOf(
      '--sweep-expiry <milliseconds>',
      'milliseconds before a task is swept',
      'XCMON_DB_JANITOR_SWEEP_EXPIRY'
    ).default(25 * 60000).argParser(positiveInt) // 25 minutes
  )
  .addOption(
    optionOf('-g, --grace',
      'milliseconds for the graceful close to finish',
      'XCMON_CLOSE_GRACE_DELAY',
    ).default(700).argParser(positiveInt)
  )
  .action(startServer);

program.parse();
