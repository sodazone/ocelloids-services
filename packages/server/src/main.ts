#!/usr/bin/env node

import 'dotenv/config';
import process from 'node:process';

import z from 'zod';
import { Command, program } from 'commander';

import version from './version.js';
import { optArr, optInt, opt, optBool } from './args.js';
import { createServer } from './server.js';
import { $ServerOptions } from './types.js';

/**
 * Starts the server from the command line.
 */
async function startServer(this: Command) {
  try {
    const opts = $ServerOptions.parse(this.opts());
    const server = await createServer(opts);
    server.listen(
      {
        port: opts.port,
        host: opts.host,
      },
      function (err, _) {
        if (err) {
          server.log.error(err);
          process.exit(1);
        }
      }
    );
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

program
  .name('xcm-mon')
  .description('XCM Monitoring Server')
  .version(version)
  .addOption(opt('-h, --host <address>', 'host to bind to', 'XCMON_HOST').default('localhost'))
  .addOption(optInt('-p, --port <number>', 'port number to listen on', 'XCMON_PORT').default(3000))
  .addOption(opt('-c, --config <file>', 'service configuration file', 'XCMON_CONFIG_FILE').makeOptionMandatory(true))
  .addOption(opt('-d, --db <dir>', 'database directory', 'XCMON_DB_DIR').default('./db'))
  .addOption(optBool('--scheduler <boolean>', 'enables or disables the task scheduler', 'XCMON_DB_SCHEDULER_ENABLE').default(true))
  .addOption(
    optInt('--scheduler-frequency <milliseconds>', 'milliseconds to wait before each tick', 'XCMON_DB_SCHEDULER_FREQUENCY').default(5000) // 5 secs
  )
  .addOption(
    optInt('--sweep-expiry <milliseconds>', 'milliseconds before a task is swept', 'XCMON_DB_JANITOR_SWEEP_EXPIRY').default(25 * 60000) // 25 minutes
  )
  .addOption(optInt('-g, --grace <milliseconds>', 'milliseconds for the graceful close to finish', 'XCMON_CLOSE_GRACE_DELAY').default(5000))
  .addOption(optBool('-t --telemetry <boolean>', 'enables or disables the telemetry exporter', 'XCMON_TELEMETRY_ENABLE').default(true))
  .addOption(optInt('--ws-max-clients <number>', 'maximum number of websocket clients', 'XCMON_WS_MAX_CLIENTS').default(10_000))
  .addOption(
    optInt(
      '--subscription-max-persistent <number>',
      'maximum number of persistent subscriptions',
      'XCMON_SUBSCRIPTION_MAX_PERSISTENT'
    ).default(5_000)
  )
  .addOption(
    optInt(
      '--subscription-max-ephemeral <number>',
      'maximum number of ephemeral subscriptions',
      'XCMON_SUBSCRIPTION_MAX_EPHEMERAL'
    ).default(5_000)
  )
  .addOption(optBool('--cors <boolean>', 'enables or disables CORS support', 'XCMON_CORS_ENABLE').default(false))
  .addOption(
    optBool(
      '--cors-credentials <boolean>',
      'configures the Access-Control-Allow-Credentials CORS header',
      'XCMON_CORS_CREDENTIALS'
    ).default(true)
  )
  .addOption(
    optArr(
      '--cors-origin [origin]',
      'configures the Access-Control-Allow-Origin CORS header\n' +
        '"true" for wildcard, "string" or "/regexp/"\n' +
        'repeat this argument for multiple origins',
      'XCMON_CORS_ORIGIN'
    ).default(['/https?://localhost.*/'])
  )
  .action(startServer);

program.parse();
