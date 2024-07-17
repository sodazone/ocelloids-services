#!/usr/bin/env node

import 'dotenv/config'
import process from 'node:process'

import { Command, program } from 'commander'
import z from 'zod'

import closeWithGrace from 'close-with-grace'
import { addServerOptions, opt } from '@/cli/index.js'
import version from '@/version.js'
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
      },
    )

    /* istanbul ignore next */
    closeWithGrace(
      {
        delay: opts.grace,
      },
      async function ({ err }) {
        if (err) {
          server.log.error(err)
        }

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
  .name('oc-ingress')
  .description('Ocelloids Ingress Node')
  .version(version)
  .addOption(
    opt(
      '--redis <redis-url>',
      'redis[s]://[[username][:password]@][host][:port][/db-number]',
      'OC_REDIS_URL',
    ),
  )
  .action(startServer)

program.parse()
