# Subscription Guide

An Ocelloids subscription has the following fields:

| Field        | Description                                                                                          | Required   | Type                       |
| ------------ | ---------------------------------------------------------------------------------------------------- | ---------- | -------------------------- |
| id           | The subscription ID.                                                                                 | Yes        | String                     |
| origin       | The network ID of the chain where XCM messages will be sent out.                                     | Yes        | NetworkId[^1]              |
| destinations | Network IDs of the chains where XCM messages will be received.                                       | Yes        | Array<NetworkId>           |
| channels     | Delivery channels for notifications. See [Supported Delivery Channels](#supported-delivery-channels) | Yes        | Array<NotificationChannel> |
| senders      | Filter for senders by account ID or public key.                                                      | No         | Array<String>              |
| events       | Filter for event types in notification. See [Notification Event Types](#notification-event-types)    | No         | Array<EventType>           |
| ephemeral    | Flag to indicate if subscription is ephemeral. Applies only to WebSocket notifications.              | No         | Boolean                    |

[^1]: Network ID format `urn:ocn:[consensus]:[chainId]`, where `consensus` is one of the values in [XCM NetworkId](https://paritytech.github.io/polkadot-sdk/master/staging_xcm/v4/enum.NetworkId.html) or `local`.

## Supported Delivery Channels

### Webhook

Delivers notification messages to the configured webhook. A template can be applied to transform the message before delivery.

| Field       | Description                                                                                          | Required | Default            |
| ----------- | ---------------------------------------------------------------------------------------------------- | -------- | ------------------ |        
| type        | Type of notification channel. Always set to `webhook`.                                               | n/a      | n/a                |
| url         | Webhook endpoint URL.                                                                                | Yes      | -                  |
| contentType | Content type of the resource.                                                                        | No       | `application/json` |
| events      | Overrides subscription level filter for event types in notification. See [Notification Event Types](#notification-event-types).                                                                                         | No       | -                  |
| template    | Template to be applied to notification messages before delivery. See [Templates](#templates).        | No       | -                  |
| bearer      | Bearer token for webhook authentication.                                                             | No       | -                  |
| limit       | Max number of retries in case of delivery error.                                                     | No       | 5                  |

### WebSocket

Delivers notification messages through a WebSocket stream.

| Field    | Description                                              |
| ---------| -------------------------------------------------------- |
| type     | Type of notification channel. Always set to `websocket`. |

### Log

Logs the notification message to `stdout`.

| Field    | Description                                         |
| ---------| --------------------------------------------------- |
| type     | Type of notification channel. Always set to `log`.  |

## Notification Event Types

## Templates

## HTTP API

The Subscription HTTP API allows you to create and manage subscriptions to XCM interactions of your interest.

The OpenAPI documentation is published at the path [/documentation](http://localhost:3000/documentation) in your running server.

Examples of request for the available API methods are listed below.
You can check the [Hurl requests](https://github.com/sodazone/xcm-monitoring/tree/main/guides/hurl) for usage examples.

**Create Subscriptions**

> [!NOTE]
> You can also specify '*' as the value of senders or events to receive all the notification messages regardless of the sender address or event type.

`POST /subs`

```shell
curl 'http://127.0.0.1:3000/subs' \
--data '{
    "id": "test-sub",
    "origin": "urn:ocn:polkadot:0",
    "senders": ["5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"],
    "destinations": ["urn:ocn:polkadot:1000"],
    "events": ["xcm.received"],
    "channels": [{
      "type": "webhook",
      "url": "https://webhook.site/faf64821-cb4d-41ad-bb81-fd119e80ad02"
    }]
}'
```

**List Subscriptions**

`GET /subs`

```shell
curl 'http://127.0.0.1:3000/subs'
```

**Get a Subscription**

`GET /subs/:id`

```shell
curl 'http://127.0.0.1:3000/subs/test-sub'
```

**Update Subscription**

`PATCH /subs/:id`

The request expects an [RFC 6902 JSON patch](https://www.rfc-editor.org/rfc/rfc6902.html) payload.

```shell
curl -X PATCH 'http://127.0.0.1:3000/subs/test-sub' \
--data '[
  { "op": "add", "path": "/senders/-", "value": "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y" },
  { "op": "add", "path": "/destinations/-", "value": "urn:ocn:polkadot:2000" },
  { "op": "replace", "path": "/channels/0", "value": { "type": "log" } }
]'
```

**Delete Subscription**

`DELETE /subs/:id`

```shell
curl -X DELETE 'http://127.0.0.1:3000/subs/test-sub'
```