import Fastify, { FastifyRequest } from 'fastify';
import { XcmMessageNotify } from '../services/monitoring/types.js';

type XcmReqDef = {
  Body: XcmMessageNotify,
  Params: {
    id: string
  }
};
export type XcmMessageRequest = FastifyRequest<XcmReqDef>;

export function buildMockServer(
  routes: {
    ok: (request: XcmMessageRequest) => void
  }
) {
  const fastify = Fastify();

  fastify.post<XcmReqDef>('/ok/:id', function (request, reply) {
    routes.ok(request);
    reply.send();
  });

  return fastify;
}