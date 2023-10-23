import Fastify, { FastifyRequest } from 'fastify';
import { XcmMessageNotify } from '../services/monitoring/types';

export type XcmMessageRequest = FastifyRequest<{
  Body: XcmMessageNotify
}>;

export function buildMockServer(
  onNotification: (
    request: XcmMessageRequest
  ) => void = () => {}
) {
  const fastify = Fastify();

  fastify.post<{
    Body: XcmMessageNotify
  }>('/xcm-notifications', function (request, reply) {
    onNotification(request);
    reply.send();
  });

  return fastify;
}