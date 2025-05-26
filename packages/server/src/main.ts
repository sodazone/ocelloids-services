#!/usr/bin/env node

import 'dotenv/config'
import process from 'node:process'

import { Command, program } from 'commander'
import z from 'zod'

import { addServerOptions, opt, optArr, optBool, optInt } from '@/cli/index.js'
import { $ServerOptions, createServer } from '@/server.js'
import version from '@/version.js'
import closeWithGrace from 'close-with-grace'

/**
 * Starts an Ocelloids Execution Server from the command line.
 */
async function startServer(this: Command) {
  try {
    const opts = $ServerOptions.parse(this.opts())
    if (opts.config === undefined && !opts.distributed) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          fatal: true,
          message:
            'Service configuration file option `-c --config <file>` is mandatory while running in integrated mode',
          path: ['config'],
        },
      ])
    }
    const server = await createServer(opts)
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
      },
    )

    /* c8 ignore next */
    closeWithGrace(
      {
        delay: opts.grace,
      },
      async function ({ err }) {
        if (err) {
          server.log.error(err)
        }

        server.log.info('Closing with grace')

        await server.close()
      },
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

addServerOptions(program)
  .name('oc-node')
  .description('Ocelloids Service Node')
  .version(version)
  .addOption(
    opt('--agents <agentIds>', 'agents to activate, comma separated list or wildcard for all', 'OC_AGENTS').default('*'),
  )
  .addOption(
    optInt('--ws-max-clients <number>', 'maximum number of websocket clients', 'OC_WS_MAX_CLIENTS').default(
      10_000,
    ),
  )
  .addOption(
    optInt(
      '--subscription-max-persistent <number>',
      'maximum number of persistent subscriptions',
      'OC_SUBSCRIPTION_MAX_PERSISTENT',
    ).default(5_000),
  )
  .addOption(
    optInt(
      '--subscription-max-ephemeral <number>',
      'maximum number of ephemeral subscriptions',
      'OC_SUBSCRIPTION_MAX_EPHEMERAL',
    ).default(5_000),
  )
  .addOption(opt('--cors', 'enables CORS support', 'OC_CORS').default(false))
  .addOption(
    optBool(
      '--cors-credentials <boolean>',
      'configures the Access-Control-Allow-Credentials CORS header',
      'OC_CORS_CREDENTIALS',
    ).default(true),
  )
  .addOption(
    optArr(
      '--cors-origin [origin]',
      'configures the Access-Control-Allow-Origin CORS header\n' +
        '"true" for wildcard, "string" or "/regexp/"\n' +
        'repeat this argument for multiple origins',
      'OC_CORS_ORIGIN',
    ).default(['/https?://localhost.*/']),
  )
  .addOption(opt('--jwt-auth', 'enables the JWT authentication', 'OC_JWT_AUTH').default(false))
  .addOption(
    opt('--jwt-sig-key-file <path>', 'path to the EdDSA key in JWK or PEM format', 'OC_JWT_SIG_KEY_FILE'),
  )
  .addOption(opt('--jwt-iss <issuer>', 'identity of the issuer', 'OC_JWT_ISSUER').default('localhost'))
  .addOption(
    optArr(
      '--jwt-allowed-iss [issuer]',
      'allowed issuers, accepts regular expressions',
      'OC_JWT_ALLOWED_ISSUERS',
    ).default(['localhost']),
  )
  .addOption(
    opt(
      '--redis <redis-url>',
      'redis[s]://[[username][:password]@][host][:port][/db-number]',
      'OC_REDIS_URL',
    ),
  )
  .addOption(opt('--distributed', 'distributed mode', 'OC_DISTRIBUTED').default(false))
  .addOption(opt('--analytics', 'enables analytics database (experimental)', 'OC_ANALYTICS').default(false))
  .addOption(opt('--archive', 'enables historical archiving', 'OC_ARCHIVE').default(false))
  .addOption(
    optBool(
      '--archive-retention <boolean>',
      'enables or disables archive pruning',
      'OC_ARCHIVE_RETENTION',
    ).default(true),
  )
  .addOption(
    opt(
      '--archive-retention-period <expression>',
      'sets the pruning period',
      'OC_ARCHIVE_RETENTION_PERIOD',
    ).default('1_months'),
  )
  .addOption(
    opt('--archive-tick <milliseconds>', 'tick frequency', 'OC_ARCHIVE_TICK').default(24 * 3_600_000),
  )
  .action(startServer)

program.parse()
