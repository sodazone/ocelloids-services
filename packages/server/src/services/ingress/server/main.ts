#!/usr/bin/env node

import 'dotenv/config'
import process from 'node:process'

import { Command, program } from 'commander'
import z from 'zod'

import { opt, optBool, optInt } from '../../../args.js'
import version from '../../../version.js'
import { $ServerOptions, createIngressServer } from './server.js'

/**
 * Starts an Ocelloids Ingress Server from the command line.
 */
async function startServer(this: Command) {
  try {
    const opts = $ServerOptions.parse(this.opts())
    const server = await createIngressServer(opts)
    server.listen(
      {
        port: opts.port,
        host: opts.address,
      },
      function (err, _) {
        if (err) {
          server.log.error(err)
          process.exit(1)
        }
      }
    )
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error(err.issues)
      program.help()
    } else {
      console.error(err)
      process.exit(1)
    }
  }
}

program
  .name('oc-ingress')
  .description('Ocelloids Ingress Node')
  .version(version)
  .addOption(opt('-a, --address <address>', 'address to bind to', 'OC_ADDRESS').default('localhost'))
  .addOption(optInt('-p, --port <number>', 'port number to listen on', 'OC_PORT').default(3011))
  .addOption(opt('-c, --config <file>', 'service configuration file', 'OC_CONFIG_FILE').makeOptionMandatory(true))
  .addOption(opt('-d, --data <dir>', 'database directory', 'OC_DATA_DIR').default('./db.ingress'))
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
  .addOption(opt('--redis <redis-url>', 'redis[s]://[[username][:password]@][host][:port][/db-number]', 'OC_REDIS_URL'))
  .action(startServer)

program.parse()
