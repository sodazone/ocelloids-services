import { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

import { CAP_ADMIN } from '../auth.js'
import { NetworkURN, jsonEncoded, prefixes } from '../types.js'

type chainIdParam = {
  Params: {
    chainId: NetworkURN
  }
}

const itOps = {
  limit: 10_000,
}

async function AdminRoutes(api: FastifyInstance) {
  const { db: rootStore, scheduler } = api

  const opts = {
    config: {
      caps: [CAP_ADMIN],
    },
    schema: {
      hide: true,
    },
  }

  const tipsDB = rootStore.sublevel<string, any>(prefixes.cache.tips, jsonEncoded)

  api.get('/admin/cache/tips', opts, async (_, reply) => {
    reply.send(await tipsDB.iterator(itOps).all())
  })

  api.delete('/admin/cache/tips', opts, async (_, reply) => {
    await tipsDB.clear()
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
