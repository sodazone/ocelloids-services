import { Subscription } from './services/monitoring/types.js';
import { jsonEncoded, prefixes } from './services/types.js';

import './testing/network.js';

import { FastifyInstance, InjectOptions } from 'fastify';

const testSubContent = {
  id: 'macatron',
  origin: 'urn:ocn:local:1000',
  senders: ['ALICE'],
  destinations: ['urn:ocn:local:2000'],
  channels: [
    {
      type: 'log',
    },
  ],
  events: '*',
} as Subscription;

const { createServer } = await import('./server.js');

describe('monitoring server API', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createServer({
      config: 'config/test.toml',
      db: '',
      scheduler: false,
      telemetry: true,
      sweepExpiry: 0,
      schedulerFrequency: 0,
      grace: 1000,
      host: 'localhost',
      port: 0,
      subscriptionMaxEphemeral: 10_000,
      subscriptionMaxPersistent: 10_000,
      wsMaxClients: 10_000,
      cors: false,
      corsCredentials: false,
      corsOrigin: true,
      distributed: false,
    });

    return server.ready();
  });

  afterAll(() => {
    return server.close();
  });

  describe('create resources', () => {
    it('should get the root resource', (done) => {
      server.inject(
        {
          method: 'GET',
          url: '/',
        },
        (_err, response) => {
          expect(response.statusCode).toStrictEqual(200);
          expect(response.headers['content-type']).toStrictEqual('text/plain; charset=utf-8');

          done();
        }
      );
    });

    it('should create a subscription', (done) => {
      server.inject(
        {
          method: 'POST',
          url: '/subs',
          body: testSubContent,
        },
        (_err, response) => {
          done();
          expect(response.statusCode).toStrictEqual(201);
        }
      );
    });

    it('should create a wildcard subscription', (done) => {
      server.inject(
        {
          method: 'POST',
          url: '/subs',
          body: {
            id: 'wild',
            origin: 'urn:ocn:local:1000',
            senders: '*',
            destinations: ['urn:ocn:local:2000'],
            channels: [
              {
                type: 'log',
              },
            ],
            events: '*',
          } as Subscription,
        },
        (_err, response) => {
          done();
          expect(response.statusCode).toStrictEqual(201);
        }
      );
    });

    it('should create a multiple subscriptions', (done) => {
      server.inject(
        {
          method: 'POST',
          url: '/subs',
          body: [
            {
              ...testSubContent,
              id: 'm1',
              senders: ['M1'],
            },
            {
              ...testSubContent,
              id: 'm2',
              senders: ['M2'],
            },
          ],
        },
        (_err, response) => {
          done();
          expect(response.statusCode).toStrictEqual(201);
        }
      );
    });
  });

  describe('modify resources', () => {
    it('should fail creating a subscription with an existing id', (done) => {
      server.inject(
        {
          method: 'POST',
          url: '/subs',
          body: testSubContent,
        },
        (_err, response) => {
          done();
          expect(response.statusCode).toStrictEqual(400);
        }
      );
    });

    it('should revert if a subscription fails in a batch create', (done) => {
      server.inject(
        {
          method: 'POST',
          url: '/subs',
          body: [
            {
              ...testSubContent,
              id: 'm3',
              senders: ['M3'],
            },
            {
              ...testSubContent,
              id: 'm1',
              senders: ['M1'],
            },
          ],
        },
        (_err, response) => {
          expect(response.statusCode).toStrictEqual(400);

          server.inject(
            {
              method: 'GET',
              url: '/subs/m3',
            },
            (_, r) => {
              done();
              expect(r.statusCode).toStrictEqual(404);
            }
          );
        }
      );
    });

    it('should delete an existing subscription', (done) => {
      server.inject(
        {
          method: 'DELETE',
          url: '/subs/m2',
        },
        (_err, response) => {
          done();
          expect(response.statusCode).toStrictEqual(200);
        }
      );
    });

    it('should retrieve an existing subscription', (done) => {
      server.inject(
        {
          method: 'GET',
          url: '/subs/macatron',
        },
        (_err, response) => {
          done();
          expect(response.statusCode).toStrictEqual(200);
          expect(JSON.parse(response.body)).toEqual(testSubContent);
        }
      );
    });

    it('should retrieve an existing wildcard subscription', (done) => {
      server.inject(
        {
          method: 'GET',
          url: '/subs/wild',
        },
        (_err, response) => {
          done();
          expect(response.statusCode).toStrictEqual(200);
          expect(JSON.parse(response.body).senders).toEqual('*');
        }
      );
    });

    it('should get a not found for non existent subscriptions', (done) => {
      server.inject(
        {
          method: 'GET',
          url: '/subs/non-existent',
        },
        (_err, response) => {
          done();
          expect(response.statusCode).toStrictEqual(404);
        }
      );
    });

    it('should not allow arbitrary operations', (done) => {
      server.inject(
        {
          method: 'PATCH',
          url: '/subs/macatron',
          body: [
            {
              op: 'replace',
              path: '/id',
              value: 'randid',
            },
            {
              op: 'add',
              path: '/senders/-',
              value: 'BOB',
            },
          ],
        },
        (_err, response) => {
          done();
          expect(response.statusCode).toStrictEqual(400);
        }
      );
    });

    it('should add a new sender', (done) => {
      server.inject(
        {
          method: 'PATCH',
          url: '/subs/macatron',
          body: [
            {
              op: 'add',
              path: '/senders/-',
              value: 'BOB',
            },
          ],
        },
        (_err, response) => {
          done();
          expect(response.statusCode).toStrictEqual(200);
          expect(JSON.parse(response.body).senders).toEqual(['ALICE', 'BOB']);
        }
      );
    });

    it('should validate the patched object', (done) => {
      server.inject(
        {
          method: 'PATCH',
          url: '/subs/macatron',
          body: [
            {
              op: 'remove',
              path: '/senders',
            },
          ],
        },
        (_err, response) => {
          done();
          expect(response.statusCode).toStrictEqual(200);
        }
      );
    });

    it('should add a new destination', (done) => {
      server.inject(
        {
          method: 'PATCH',
          url: '/subs/macatron',
          body: [
            {
              op: 'add',
              path: '/destinations/-',
              value: 'urn:ocn:local:3000',
            },
          ],
        },
        (_err, response) => {
          done();
          expect(response.statusCode).toStrictEqual(200);
          expect(JSON.parse(response.body).destinations).toEqual(['urn:ocn:local:2000', 'urn:ocn:local:3000']);
        }
      );
    });

    it('should replace the notification method', (done) => {
      server.inject(
        {
          method: 'PATCH',
          url: '/subs/macatron',
          body: [
            {
              op: 'replace',
              path: '/channels/0',
              value: {
                type: 'webhook',
                url: 'http://localhost:4444/path',
              },
            },
          ],
        },
        (_err, response) => {
          done();
          expect(response.statusCode).toStrictEqual(200);
          expect(JSON.parse(response.body).channels[0].type).toEqual('webhook');
        }
      );
    });
  });

  describe('admin api', () => {
    beforeAll(async () => {
      const { rootStore: root } = server;

      await root
        .sublevel<string, any>(prefixes.sched.tasks, jsonEncoded)
        .batch()
        .put('0000', { type: 'a', task: {} })
        .put('0001', { type: 'b', task: {} })
        .write();

      await root.sublevel<string, any>(prefixes.cache.tips, jsonEncoded).batch().put('0', {}).put('1', {}).write();
      for (let i = 0; i < 3; i++) {
        await root.sublevel<string, any>(prefixes.cache.family(i.toString()), jsonEncoded).put('0x0', {});
      }
    });
    function adminRq(url: string, method = 'GET') {
      return {
        method,
        url,
        headers: {
          authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.TUkHePbst2jnFffIGHbn-fFnZz36DfBjxsfptqFypaA',
        },
      } as InjectOptions;
    }

    it('should return unauthorized for invalid tokens', (done) => {
      server.inject(
        {
          method: 'GET',
          url: '/admin/sched',
          headers: {
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.VAxxu2QZ2pPsTFklm7IS1Qc7p0E6_FQoiibkDZc9cio',
          },
        },
        (_err, response) => {
          done();
          expect(response.statusCode).toStrictEqual(401);
        }
      );
    });

    it('should query tips cache', (done) => {
      server.inject(adminRq('/admin/cache/tips'), (_err, response) => {
        done();
        expect(response.statusCode).toStrictEqual(200);
        expect(JSON.parse(response.body).length).toBe(2);
      });
    });

    it('should clear tips cache', (done) => {
      server.inject(adminRq('/admin/cache/tips', 'DELETE'), (_err, response) => {
        done();
        expect(response.statusCode).toStrictEqual(200);
      });
    });

    it('should get cache data', (done) => {
      server.inject(adminRq('/admin/cache/urn:ocn:local:0'), (_err, response) => {
        done();
        expect(response.statusCode).toStrictEqual(200);
      });
    });

    it('should delete cache data', (done) => {
      server.inject(adminRq('/admin/cache/urn:ocn:local:1', 'DELETE'), (_err, response) => {
        done();
        expect(response.statusCode).toStrictEqual(200);
      });
    });

    it('should get pending messages', (done) => {
      server.inject(adminRq('/admin/xcm'), (_err, response) => {
        done();
        expect(response.statusCode).toStrictEqual(200);
      });
    });

    it('should get scheduled tasks', (done) => {
      server.inject(adminRq('/admin/sched'), (_err, response) => {
        done();
        expect(response.statusCode).toStrictEqual(200);
        expect(JSON.parse(response.body).length).toBe(2);
      });
    });

    it('should get an scheduled task', (done) => {
      server.inject(adminRq('/admin/sched?key=0000'), (_err, response) => {
        done();
        expect(response.statusCode).toStrictEqual(200);
      });
    });

    it('should delete an scheduled task', (done) => {
      server.inject(adminRq('/admin/sched?key=0001', 'DELETE'), (_err, response) => {
        done();
        expect(response.statusCode).toStrictEqual(200);
      });
    });
  });
});
