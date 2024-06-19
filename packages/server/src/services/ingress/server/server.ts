import process from 'node:process'

import { z } from 'zod'

import closeWithGrace from 'close-with-grace'
import Fastify from 'fastify'

import FastifyHealthcheck from 'fastify-healthcheck'

import { logger } from '../../../environment.js'
import { errorHandler } from '../../../errors.js'
import {
  $BaseServerOptions,
  $ConfigServerOptions,
  $LevelServerOptions,
  $RedisServerOptions,
} from '../../../types.js'
import { Auth, Configuration, Connector, Persistence, Root, Telemetry } from '../../index.js'

import Ingress from '../producer/plugin.js'

export const $ServerOptions = z
  .object({
    distributed: z.boolean().default(false),
  })
  .merge($BaseServerOptions)
  .merge($ConfigServerOptions)
  .merge($LevelServerOptions)
  .merge($RedisServerOptions)

type ServerOptions = z.infer<typeof $ServerOptions>

/**
 * Creates and starts an Ocelloids Ingress Server process with specified options.
 *
 * @param {ServerOptions} opts - Options for configuring the server.
 */
export async function createIngressServer(opts: ServerOptions) {
  const server = Fastify({
    logger,
  })

  server.setErrorHandler(errorHandler)

  /* istanbul ignore next */
  const closeListeners = closeWithGrace(
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

  /* istanbul ignore next */
  process.once('SIGUSR2', function () {
    server.close().then(() => {
      // Controlled shutdown for Nodemon
      // https://github.com/remy/nodemon?tab=readme-ov-file#controlling-shutdown-of-your-script
      process.kill(process.pid, 'SIGUSR2')
    })
  })

  server.addHook('onClose', function (_, done) {
    closeListeners.uninstall()
    done()
  })

  await server.register(FastifyHealthcheck, {
    exposeUptime: true,
  })

  await server.register(Auth)
  await server.register(Root)
  await server.register(Configuration, opts)
  await server.register(Connector)
  await server.register(Persistence, opts)
  await server.register(Ingress, opts)
  await server.register(Telemetry, opts)

  return server
}
