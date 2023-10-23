import './test/network.js';

import { FastifyInstance } from 'fastify';

const testSubContent = {
  id: 'macatron',
  origin: 1000,
  senders: ['ALICE'],
  destinations: [
    2000
  ],
  notify: {
    type: 'log'
  }
};

const { createServer } = await import('./server.js');

describe('monitoring server API', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createServer({
      config: 'config/test.toml',
      db: '',
      janitor: false,
      sweepExpiry: 0,
      sweepInterval: 0,
      grace: 1000,
      host: 'localhost',
      port: 0
    });
    return server.ready();
  });

  afterAll(() => {
    return server.close();
  });

  describe('create resources', () => {
    it('should get the root resource', done => {
      server.inject({
        method: 'GET',
        url: '/'
      }, (_err, response) => {
        expect(response.statusCode)
          .toStrictEqual(200);
        expect(response.headers['content-type'])
          .toStrictEqual('text/plain; charset=utf-8');

        done();
      });
    });

    it('should create a subscription', done => {
      server.inject({
        method: 'POST',
        url: '/subs',
        body: testSubContent
      }, (_err, response) => {
        expect(response.statusCode)
          .toStrictEqual(201);

        done();
      });
    });
  });

  describe('modify resources', () => {
    it('should fail creating a subscription with an existing id', done => {
      server.inject({
        method: 'POST',
        url: '/subs',
        body: testSubContent
      }, (_err, response) => {
        expect(response.statusCode)
          .toStrictEqual(400);

        done();
      });
    });

    it('should retrieve an existing subscription', done => {
      server.inject({
        method: 'GET',
        url: '/subs/macatron'
      }, (_err, response) => {
        expect(response.statusCode)
          .toStrictEqual(200);
        expect(JSON.parse(response.body))
          .toEqual(testSubContent);

        done();
      });
    });

    it('should get a not found for non existent subscriptions', done => {
      server.inject({
        method: 'GET',
        url: '/subs/non-existent'
      }, (_err, response) => {
        expect(response.statusCode)
          .toStrictEqual(404);

        done();
      });
    });

    it('should not allow arbitrary operations', done => {
      server.inject({
        method: 'PATCH',
        url: '/subs/macatron',
        body: [
          {
            op: 'replace',
            path: '/id',
            value: 'randid'
          },
          {
            op: 'add',
            path: '/senders/-',
            value: 'BOB'
          }
        ]
      }, (_err, response) => {
        expect(response.statusCode)
          .toStrictEqual(400);
        done();
      });
    });

    it('should validate the patched object', done => {
      server.inject({
        method: 'PATCH',
        url: '/subs/macatron',
        body: [
          {
            op: 'remove',
            path: '/senders'
          }
        ]
      }, (_err, response) => {
        expect(response.statusCode)
          .toStrictEqual(400);
        done();
      });
    });

    it('should add a new sender', done => {
      server.inject({
        method: 'PATCH',
        url: '/subs/macatron',
        body: [
          {
            op: 'add',
            path: '/senders/-',
            value: 'BOB'
          }
        ]
      }, (_err, response) => {
        expect(response.statusCode)
          .toStrictEqual(200);
        expect(JSON.parse(response.body).senders)
          .toEqual(['ALICE', 'BOB']);

        done();
      });
    });

    it('should add a new destination', done => {
      server.inject({
        method: 'PATCH',
        url: '/subs/macatron',
        body: [
          {
            op: 'add',
            path: '/destinations/-',
            value: 3000
          }
        ]
      }, (_err, response) => {
        expect(response.statusCode)
          .toStrictEqual(200);
        expect(JSON.parse(response.body).destinations)
          .toEqual([2000, 3000]);

        done();
      });
    });
  });
});