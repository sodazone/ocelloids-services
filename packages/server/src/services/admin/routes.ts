import { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { WormholeAgent } from '../agents/wormhole/agent.js'
import { CAP_ADMIN } from '../auth/index.js'
import { Scheduled } from '../persistence/level/index.js'
import { jsonEncoded, NetworkURN, prefixes } from '../types.js'

type chainIdParam = {
  Params: {
    chainId: NetworkURN
  }
}

const itOps = {
  limit: 10_000,
}

async function AdminRoutes(api: FastifyInstance) {
  const { levelDB: rootStore, scheduler, agentCatalog } = api

  const opts = {
    config: {
      caps: [CAP_ADMIN],
    },
    schema: {
      hide: true,
    },
  }

  api.post<{ Body: { ops: string[] } }>('/admin/wormhole/backfill', opts, (request, reply) => {
    const wh = agentCatalog.getAgentById('wormhole') as WormholeAgent
    const { ops } = request.body
    if (ops && ops.length > 0) {
      for (const op of ops) {
        wh.backfill(op)
      }
    }
    reply.send()
  })

  api.delete<{
    Params: {
      prefix: string
    }
  }>('/admin/level/:prefix', opts, async (request, reply) => {
    await rootStore.sublevel(request.params.prefix).clear()
    reply.send()
  })

  api.get<chainIdParam>('/admin/cache/:chainId', opts, async (request, reply) => {
    const db = rootStore.sublevel<string, any>(prefixes.cache.family(request.params.chainId), jsonEncoded)
    reply.send(await db.iterator(itOps).all())
  })

  api.delete<chainIdParam>('/admin/cache/:chainId', opts, async (request, reply) => {
    const db = rootStore.sublevel<string, any>(prefixes.cache.family(request.params.chainId), jsonEncoded)
    await db.clear()
    reply.send()
  })

  api.post<{
    Body: Scheduled
  }>('/admin/sched', opts, async (request, reply) => {
    const task = request.body
    await scheduler.schedule(task)
    reply.send()
  })

  api.get<{
    Querystring: { key?: string }
  }>('/admin/sched', opts, async (request, reply) => {
    const { key } = request.query
    reply.send(key === undefined ? await scheduler.allTaskTimes() : await scheduler.getById(key))
  })

  api.delete<{
    Querystring: { key: string }
  }>('/admin/sched', opts, async (request, reply) => {
    await scheduler.remove(request.query.key)
    reply.send()
  })
}

export default fp(AdminRoutes)
