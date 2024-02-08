import { FastifyInstance } from 'fastify';

import { jsonEncoded, prefixes } from '../types.js';

type keyParam = {
  Params: {
    key: string
  }
};

const itOps = {
  limit: 10_000
};

export default async function Administration(
  api: FastifyInstance
) {
  const { storage: { root }, scheduler } = api;

  const opts = {
    onRequest: [api.auth],
    schema: {
      hide: true
    }
  };

  const inDB = root.sublevel<string, any>(
    prefixes.matching.inbound, jsonEncoded
  );
  const outDB = root.sublevel<string, any>(
    prefixes.matching.inbound, jsonEncoded
  );
  const tipsDB = root.sublevel<string, any>(
    prefixes.cache.tips, jsonEncoded
  );

  api.get('/admin/cache/tips', opts, async (_, reply) => {
    reply.send(await tipsDB.iterator(itOps).all());
  });

  api.delete('/admin/cache/tips', opts, async (_, reply) => {
    await tipsDB.clear();
    reply.send();
  });

  api.get<keyParam>('/admin/cache/:key', opts, async (request, reply) => {
    const db = root.sublevel<string, any>(
      prefixes.cache.family(request.params.key), jsonEncoded
    );
    reply.send(await db.iterator(itOps).all());
  });

  api.delete<keyParam>('/admin/cache/:key', opts, async (request, reply) => {
    const db = root.sublevel<string, any>(
      prefixes.cache.family(request.params.key), jsonEncoded
    );
    await db.clear();
    reply.send();
  });

  api.get('/admin/xcm', opts, async (_, reply) => {
    const outbound = await inDB.iterator(itOps).all();
    const inbound = await outDB.iterator(itOps).all();
    reply.send({
      outbound,
      inbound
    });
  });

  api.delete<keyParam>(
    '/admin/xcm/inbound/:key', opts, async (request, reply) => {
      await inDB.del(request.params.key);
      reply.send();
    }
  );

  api.delete<keyParam>(
    '/admin/xcm/outbound/:key', opts, async (request, reply) => {
      await outDB.del(request.params.key);
      reply.send();
    }
  );

  api.get('/admin/sched', opts , async (_, reply) => {
    reply.send(await scheduler.allTaskTimes());
  });

  api.get<keyParam>(
    '/admin/sched/:key', opts, async (request, reply) => {
      reply.send(
        await scheduler.getById(request.params.key)
      );
    }
  );

  api.delete<keyParam>(
    '/admin/sched/:key', opts, async (request, reply) => {
      await scheduler.remove(request.params.key);
      reply.send();
    }
  );
}