#!/usr/bin/env node

import 'dotenv/config';
import process from 'node:process';

import z from 'zod';
import { Command, program } from 'commander';

import version from './version.js';
import { optArr, optInt, opt, optBool } from './args.js';
import { createServer, $ServerOptions } from './server.js';

/**
 * Starts an Ocelloids Execution Server from the command line.
 */
async function startServer(this: Command) {
  try {
    const opts = $ServerOptions.parse(this.opts());
    if (opts.config === undefined && !opts.distributed) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          fatal: true,
          message:
            'Service configuration file option `-c --config <file>` is mandatory while running in integrated mode',
          path: ['config'],
        },
      ]);
    }
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
  .name('oc-node')
  .description('Ocelloids Service Node')
  .version(version)
  .addOption(opt('-h, --host <address>', 'host to bind to', 'OC_HOST').default('localhost'))
  .addOption(optInt('-p, --port <number>', 'port number to listen on', 'OC_PORT').default(3000))
  .addOption(opt('-c, --config <file>', 'service configuration file', 'OC_CONFIG_FILE'))
  .addOption(opt('-d, --db <dir>', 'database directory', 'OC_DB_DIR').default('./db'))
  .addOption(
    optBool('--scheduler <boolean>', 'enables or disables the task scheduler', 'OC_DB_SCHEDULER_ENABLE').default(true)
  )
  .addOption(
    optInt(
      '--scheduler-frequency <milliseconds>',
      'milliseconds to wait before each tick',
      'OC_DB_SCHEDULER_FREQUENCY'
    ).default(5_000) // 5 secs
  )
  .addOption(
    optInt(
      '--sweep-expiry <milliseconds>',
      'milliseconds before a task is swept',
      'OC_DB_JANITOR_SWEEP_EXPIRY'
    ).default(25 * 60_000) // 25 minutes
  )
  .addOption(
    optInt(
      '-g, --grace <milliseconds>',
      'milliseconds for the graceful close to finish',
      'OC_CLOSE_GRACE_DELAY'
    ).default(5_000)
  )
  .addOption(
    optBool('-t --telemetry <boolean>', 'enables or disables the telemetry exporter', 'OC_TELEMETRY_ENABLE').default(
      true
    )
  )
  .addOption(
    optInt('--ws-max-clients <number>', 'maximum number of websocket clients', 'OC_WS_MAX_CLIENTS').default(10_000)
  )
  .addOption(
    optInt(
      '--subscription-max-persistent <number>',
      'maximum number of persistent subscriptions',
      'OC_SUBSCRIPTION_MAX_PERSISTENT'
    ).default(5_000)
  )
  .addOption(
    optInt(
      '--subscription-max-ephemeral <number>',
      'maximum number of ephemeral subscriptions',
      'OC_SUBSCRIPTION_MAX_EPHEMERAL'
    ).default(5_000)
  )
  .addOption(optBool('--cors', 'enables CORS support', 'OC_CORS').default(false))
  .addOption(
    optBool(
      '--cors-credentials <boolean>',
      'configures the Access-Control-Allow-Credentials CORS header',
      'OC_CORS_CREDENTIALS'
    ).default(true)
  )
  .addOption(
    optArr(
      '--cors-origin [origin]',
      'configures the Access-Control-Allow-Origin CORS header\n' +
        '"true" for wildcard, "string" or "/regexp/"\n' +
        'repeat this argument for multiple origins',
      'OC_CORS_ORIGIN'
    ).default(['/https?://localhost.*/'])
  )
  .addOption(opt('--distributed', 'distributed mode', 'OC_DISTRIBUTED').default(false))
  .addOption(opt('--redis <redis-url>', 'redis[s]://[[username][:password]@][host][:port][/db-number]', 'OC_REDIS_URL'))
  .action(startServer);

program.parse();
