import process from 'node:process'

import { z } from 'zod'

import Fastify from 'fastify'

import FastifyCors from '@fastify/cors'
import FastifySwagger from '@fastify/swagger'
import FastifySwaggerUI from '@fastify/swagger-ui'
import FastifyWebsocket from '@fastify/websocket'
import FastifyHealthcheck from 'fastify-healthcheck'

import { logger } from '@/environment.js'
import { errorHandler } from '@/errors.js'
import {
  Accounts,
  Administration,
  Agents,
  Auth,
  Configuration,
  Connector,
  Ingress,
  Kysely,
  LevelDB,
  Limit,
  Root,
  Subscriptions,
  Telemetry,
} from '@/services/index.js'
import version from '@/version.js'

import { toCorsOpts } from '@/cli/args.js'
import {
  $AgentCatalogOptions,
  $BaseServerOptions,
  $ConfigServerOptions,
  $CorsServerOptions,
  $JwtServerOptions,
  $KyselyServerOptions,
  $LevelServerOptions,
  $RedisServerOptions,
  $SubscriptionServerOptions,
} from '@/types.js'

const WS_MAX_PAYLOAD = 1048576 // 1MB

export const $ServerOptions = z
  .object({
    distributed: z.boolean().default(false),
  })
  .merge($BaseServerOptions)
  .merge($CorsServerOptions)
  .merge($JwtServerOptions)
  .merge($SubscriptionServerOptions)
  .merge($ConfigServerOptions)
  .merge($LevelServerOptions)
  .merge($KyselyServerOptions)
  .merge($RedisServerOptions)
  .merge($AgentCatalogOptions)

type ServerOptions = z.infer<typeof $ServerOptions>

/**
 * Creates and starts the Ocelloids Execution Server with specified options.
 *
 * @param {ServerOptions} opts - Options for configuring the server.
 */
export async function createServer(opts: ServerOptions) {
  const server = Fastify({
    logger,
  })

  /* istanbul ignore next */
  process.once('SIGUSR2', async function () {
    await server.close()
    // Controlled shutdown for Nodemon
    // https://github.com/remy/nodemon?tab=readme-ov-file#controlling-shutdown-of-your-script
    process.kill(process.pid, 'SIGUSR2')
  })

  if (opts.cors) {
    server.log.info('Enable CORS')

    const corsOpts = toCorsOpts(opts)
    server.log.info('- origin: %s', corsOpts.origin)
    server.log.info('- credentials: %s', corsOpts.credentials)

    await server.register(FastifyCors, corsOpts)
  }

  await server.register(async function publicContext(childServer) {
    await childServer.register(FastifyHealthcheck, {
      exposeUptime: true,
    })
  })

  await server.register(async function authenticatedContext(childServer) {
    childServer.setErrorHandler(errorHandler)

    await childServer.register(Limit, opts)
    await childServer.register(Root)

    await childServer.register(FastifyWebsocket, {
      options: {
        // we don't need to negotiate subprotocols
        handleProtocols: undefined,
        maxPayload: WS_MAX_PAYLOAD,
        perMessageDeflate: false,
        // https://elixir.bootlin.com/linux/v4.15.18/source/Documentation/networking/ip-sysctl.txt#L372
        // backlog: 511 // # default
      },
      // override default pre-close
      // we explicitly handle it with terminate
      preClose: () => {
        /* empty */
      },
    })

    await childServer.register(FastifySwagger, {
      openapi: {
        info: {
          title: 'Ocelloids Execution Node',
          version,
        },
      },
    })

    await childServer.register(FastifySwaggerUI, {
      routePrefix: '/documentation',
    })

    if (!opts.distributed) {
      await childServer.register(Configuration, opts)
      await childServer.register(Connector)
    }

    await childServer.register(LevelDB, opts)
    await childServer.register(Kysely, opts)
    await childServer.register(Ingress, opts)
    await childServer.register(Agents, opts)
    await childServer.register(Subscriptions, opts)
    await childServer.register(Administration)
    await childServer.register(Telemetry, opts)
    await childServer.register(Accounts, opts)
    await childServer.register(Auth, opts)

    childServer.addHook('onClose', function (_, done) {
      const { websocketServer } = childServer
      if (websocketServer.clients) {
        for (const client of websocketServer.clients) {
          client.close(1001, 'server shutdown')
          if (client.readyState !== client.CLOSED) {
            // Websocket clients could ignore the close acknowledge
            // breaking the clean shutdown of the server.
            // To prevent it we terminate the socket.
            client.terminate()
          }
        }
        childServer.log.info('Closing websockets: OK')
      }
      done()
    })
  })

  return server
}
