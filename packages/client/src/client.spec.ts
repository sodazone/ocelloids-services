import { jest } from '@jest/globals';

import nock from 'nock';
import { Server, WebSocket } from 'mock-socket';

import samples from '../test/.data/samples.json';
import { Subscription } from './lib';

jest.unstable_mockModule('isows', () => {
  return {
    __esModule: true,
    WebSocket
  };
});

//[!] important: requires dynamic imports
const { OcelloidsClient } = await import('./client');

describe('OcelloidsClient', () => {
  it('should create a client instance', () => {
    expect(new OcelloidsClient({
      wsUrl: 'wss://ws.abc',
      httpUrl: 'https://rpc.abc'
    })).toBeDefined();
  });

  describe('ws', () => {
    let mockServer: Server;

    afterEach(() => {
      mockServer?.stop();
    });

    it('should connect to a subscription', done => {
      const wsUrl = 'ws://mock/ws/subs/subid';
      mockServer = new Server(wsUrl, { mock: false });
      const samplesNum = samples.length;

      mockServer.on('connection', socket => {
        for (const s of samples) {
          socket.send(JSON.stringify(s));
        }
      });

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'https://rpc.abc'
      });

      let called = 0;

      const ws = client.subscribe('subid', {
        onMessage: msg => {
          expect(ws.readyState).toBe(1);
          expect(msg).toBeDefined();
          called++;
          if (called === samplesNum) {
            done();
          }
        }
      });
    });

    it('should create on-demand subscription', done => {
      const wsUrl = 'ws://mock/ws/subs';
      mockServer = new Server(wsUrl, { mock: false });

      mockServer.on('connection', socket => {
        socket.on('message', data => {
          socket.send(JSON.stringify(data));
          socket.send(JSON.stringify(samples[0]));
        });
      });

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'https://rpc.abc'
      });

      const ws = client.subscribe({
        origin: '2004',
        senders: '*',
        events: '*',
        destinations: ['0','1000', '2000', '2034', '2104']
      }, {
        onMessage: msg => {
          expect(ws.readyState).toBe(1);
          expect(msg).toBeDefined();
          expect(msg.type).toBe('xcm.relayed');
          done();
        }
      }, {
        onSubscriptionCreated: sub => {
          expect(sub.origin).toBe('2004');
        }
      });
    });

    it('should handle on-demand subscription creation errors', done => {
      const wsUrl = 'ws://mock/ws/subs';
      mockServer = new Server(wsUrl, { mock: false });

      mockServer.on('connection', socket => {
        socket.on('message', _ => {
          socket.send(JSON.stringify({
            name: 'ZodError',
            issues: [
              {
                code: 'invalid_type',
                expected: 'string',
                received: 'undefined',
                path: [''],
                message: 'origin id is required'
              }
            ]}));
        });
      });

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'https://rpc.abc'
      });

      const ws = client.subscribe({
        origin: '2004',
        senders: '*',
        events: '*',
        destinations: ['0','1000', '2000', '2034', '2104']
      }, {
        onMessage: _ => {
          fail('should not receive messages');
        }
      }, {
        onSubscriptionError: err => {
          expect(ws.readyState).toBe(1);
          expect(err).toBeDefined();
          expect(err.name).toBe('ZodError');
          done();
        },
      }
      );
    });

    it('should handle socket closed', done => {
      const wsUrl = 'ws://mock/ws/subs/subid';
      mockServer = new Server(wsUrl, { mock: false });

      mockServer.on('connection', socket => {
        socket.close({
          code: 3004,
          reason: 'ouch',
          wasClean: false
        });
      });

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'https://rpc.abc'
      });

      client.subscribe('subid', {
        onMessage: _ => {
          fail('should not receive messages');
        },
        onError: _ => {
          fail('should not receive error');
        },
        onClose: e => {
          expect(e).toBeDefined();
          done();
        }
      });
    });

    it('should use ws auth', done => {
      const wsUrl = 'ws://mock/ws/subs/subid';
      mockServer = new Server(wsUrl, { mock: false });

      mockServer.on('connection', socket => {
        socket.close({
          code: 3004,
          reason: 'ouch',
          wasClean: false
        });
      });

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'https://rpc.abc'
      });

      client.subscribe('subid', {
        onMessage: _ => {
          fail('should not receive messages');
        },
        onError: _ => {
          fail('should not receive error');
        },
        onClose: e => {
          expect(e).toBeDefined();
          done();
        }
      });
    });
  });

  describe('http', () => {
    afterAll(() => {
      nock.restore();
    });

    it('should create a subscription', async () => {
      const sub = {
        id: 'my-subscription',
        origin: '2004',
        senders: '*',
        events: '*',
        destinations: ['0','1000', '2000', '2034', '2104'],
        channels: [{
          type: 'webhook',
          url: 'https://some.webhook'
        },
        {
          type: 'websocket'
        }]
      } as Subscription;

      const scope = nock('http://mock')
        .matchHeader('content-type', 'application/json')
        .post('/subs')
        .reply(201, JSON.stringify(sub));

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'http://mock'
      });

      await client.create(sub);

      scope.done();
    });

    it('should fetch data', async () => {
      const scope = nock('http://mock')
        .get('/health')
        .reply(200, '{}')
        .get('/subs')
        .reply(200, '[]')
        .get('/subs/id')
        .reply(200, '{}');

      const client = new OcelloidsClient({
        wsUrl: 'ws://mock',
        httpUrl: 'http://mock'
      });

      await client.health();
      await client.allSubscriptions();
      await client.getSubscription('id');

      scope.done();
    });
  });
});