import process from 'node:process'

import { z } from 'zod'

import Fastify from 'fastify'

import FastifyCors from '@fastify/cors'
import FastifySwagger from '@fastify/swagger'
import FastifyWebsocket from '@fastify/websocket'
import FastifyScalarUI from '@scalar/fastify-api-reference'
import FastifyHealthcheck from 'fastify-healthcheck'

import { logger } from '@/environment.js'
import { errorHandler } from '@/errors.js'
import {
  Accounts,
  Administration,
  Agents,
  Analytics,
  Archive,
  Auth,
  Configuration,
  Connector,
  Egress,
  Ingress,
  LevelDB,
  Limit,
  Root,
  Scheduling,
  Subscriptions,
  Telemetry,
} from '@/services/index.js'
import version from '@/version.js'

import { toCorsOpts } from '@/cli/args.js'
import {
  $AgentCatalogOptions,
  $AnalyticsOptions,
  $ArchiveOptions,
  $BaseServerOptions,
  $ConfigServerOptions,
  $CorsServerOptions,
  $DatabaseOptions,
  $JwtServerOptions,
  $KyselyServerOptions,
  $LevelServerOptions,
  $RedisServerOptions,
  $SubscriptionServerOptions,
} from '@/types.js'

const WS_MAX_PAYLOAD = 1048576 // 1MB

const $DatabaseGroup = $DatabaseOptions
  .merge($AnalyticsOptions)
  .merge($LevelServerOptions)
  .merge($KyselyServerOptions)
  .merge($RedisServerOptions)
  .merge($ArchiveOptions)

export const $ServerOptions = z
  .object({
    distributed: z.boolean().default(false),
  })
  .merge($BaseServerOptions)
  .merge($CorsServerOptions)
  .merge($JwtServerOptions)
  .merge($SubscriptionServerOptions)
  .merge($ConfigServerOptions)
  .merge($AgentCatalogOptions)
  .merge($DatabaseGroup)

type ServerOptions = z.infer<typeof $ServerOptions>

const pluginTimeout = process.env.FASTIFY_PLUGIN_TIMEOUT ? Number(process.env.FASTIFY_PLUGIN_TIMEOUT) : 45_000

/**
 * Creates and starts the Ocelloids Execution Server with specified options.
 *
 * @param {ServerOptions} opts - Options for configuring the server.
 */
export async function createServer(opts: ServerOptions) {
  const server = Fastify({
    logger,
    pluginTimeout,
  })

  /* c8 ignore next */
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

  await server.register(FastifyHealthcheck, {
    exposeUptime: true,
  })

  server.setErrorHandler(errorHandler)

  await server.register(Limit, opts)
  await server.register(Root)

  await server.register(FastifyWebsocket, {
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

  await server.register(FastifySwagger, {
    openapi: {
      info: {
        title: 'Ocelloids Execution Node',
        version,
      },
      externalDocs: {
        url: 'https://ocelloids.net',
        description: 'Ocelloids Website',
      },
      components: {
        securitySchemes: {
          BearerAuth: {
            description: 'Ed25519 JWT signed by private key, with account subject and token id in payload',
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      tags: [
        {
          name: 'accounts',
          description: 'Account-related endpoints',
        },
        {
          name: 'subscriptions',
          description: 'Subscription-related endpoints',
        },
        {
          name: 'agents',
          description: 'Agent-related endpoints',
        },
        {
          name: 'ingress',
          description: 'Ingress-related endpoints',
        },
      ],
    },
  })

  await server.register(FastifyScalarUI, {
    routePrefix: '/api-docs',
    configuration: {
      theme: 'solarized',
    },
  })

  await server.get(
    '/openapi.json',
    {
      schema: {
        hide: true,
      },
    },
    () => {
      return server.swagger()
    },
  )

  if (!opts.distributed) {
    await server.register(Configuration, opts)
    await server.register(Connector)
  }

  await server.register(LevelDB, opts)
  await server.register(Scheduling, opts)
  await server.register(Archive, opts)
  await server.register(Analytics, opts)
  await server.register(Ingress, opts)
  await server.register(Egress, opts)
  await server.register(Agents, opts)
  await server.register(Subscriptions, opts)
  await server.register(Administration)
  await server.register(Telemetry, opts)
  await server.register(Accounts, opts)
  await server.register(Auth, opts)

  server.addHook('onClose', function (_, done) {
    server.log.info('Closing websockets')

    const { websocketServer } = server
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
      server.log.info('Closing websockets: OK')
    }
    done()
  })

  return server
}
