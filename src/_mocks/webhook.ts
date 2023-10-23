import Fastify from 'fastify';

export function buildMockServer() {
  const fastify = Fastify();

  fastify.get('/xcm-notifications', function (request, reply) {
    console.log(request.body);
    reply.send({ hello: 'world' });
  });

  return fastify;
}