import { FastifyInstance } from 'fastify';

import { jsonEncoded, prefixes, OcnURN } from '../types.js';

type chainIdParam = {
  Params: {
    chainId: OcnURN;
  };
};

const itOps = {
  limit: 10_000,
};

export default async function Administration(api: FastifyInstance) {
  const { rootStore, scheduler } = api;

  const opts = {
    onRequest: [api.auth],
    schema: {
      hide: true,
    },
  };

  const inDB = rootStore.sublevel<string, any>(prefixes.matching.inbound, jsonEncoded);
  const outDB = rootStore.sublevel<string, any>(prefixes.matching.inbound, jsonEncoded);
  const tipsDB = rootStore.sublevel<string, any>(prefixes.cache.tips, jsonEncoded);

  api.get('/admin/cache/tips', opts, async (_, reply) => {
    reply.send(await tipsDB.iterator(itOps).all());
  });

  api.delete('/admin/cache/tips', opts, async (_, reply) => {
    await tipsDB.clear();
    reply.send();
  });

  api.get<chainIdParam>('/admin/cache/:chainId', opts, async (request, reply) => {
    const db = rootStore.sublevel<string, any>(prefixes.cache.family(request.params.chainId), jsonEncoded);
    reply.send(await db.iterator(itOps).all());
  });

  api.delete<chainIdParam>('/admin/cache/:chainId', opts, async (request, reply) => {
    const db = rootStore.sublevel<string, any>(prefixes.cache.family(request.params.chainId), jsonEncoded);
    await db.clear();
    reply.send();
  });

  api.get('/admin/xcm', opts, async (_, reply) => {
    const outbound = await inDB.keys(itOps).all();
    const inbound = await outDB.keys(itOps).all();
    reply.send({
      outbound,
      inbound,
    });
  });

  api.delete<{
    Querystring: { key: string };
  }>('/admin/xcm/inbound', opts, async (request, reply) => {
    await inDB.del(request.query.key);
    reply.send();
  });

  api.delete<{
    Querystring: { key: string };
  }>('/admin/xcm/outbound', opts, async (request, reply) => {
    await outDB.del(request.query.key);
    reply.send();
  });

  api.get<{
    Querystring: { key?: string };
  }>('/admin/sched', opts, async (request, reply) => {
    const { key } = request.query;
    reply.send(key === undefined ? await scheduler.allTaskTimes() : await scheduler.getById(key));
  });

  api.delete<{
    Querystring: { key: string };
  }>('/admin/sched', opts, async (request, reply) => {
    await scheduler.remove(request.query.key);
    reply.send();
  });
}
