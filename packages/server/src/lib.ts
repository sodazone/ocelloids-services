/**
 * Types for client libraries.
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
export type QuerySubscription =
  {
    id: string;
    origin: string;
    senders?: ('*' | string[]) | undefined;
    destinations: string[];
    ephemeral?: boolean | undefined;
    channels: ({
        type: 'webhook';
        url: string;
        contentType?: string | undefined;
        events?: ('*' | unknown[]) | undefined;
        template?: string | undefined;
        bearer?: string | undefined;
        limit?: number | undefined;
    } | {
        type: 'log';
    } | {
        type: 'websocket';
    })[];
    events?: ('*' | unknown[]) | undefined;
}

