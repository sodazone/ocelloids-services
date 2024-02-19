/**
 * Export types for client libraries.
 */

export type {
  XcmReceived,
  XcmRelayed,
  XcmSent,
  XcmNotifyMessage,
  XcmNotificationType,
  isXcmReceived,
  isXcmSent,
  isXcmRelayed
} from './services/monitoring/types.js';

// @warn this needs to be manually updated
// avoid zod dependency in clients
export type QuerySubscription = {
  id: string;
  origin: string;
  senders?: ('*' | string[]);
  destinations: string[];
  ephemeral?: boolean;
  channels: ({
    type: 'webhook';
    url: string;
    contentType?: string;
    events?: ('*' | string[]);
    template?: string;
    bearer?: string;
    limit?: number;
  } | {
    type: 'log';
  } | {
    type: 'websocket';
  })[];
  events?: ('*' | string[]);
}

