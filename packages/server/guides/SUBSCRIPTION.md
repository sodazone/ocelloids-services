# Ocelloids Subscription Guide

Ocelloids subscriptions allow users to subscribe to onchain activities of interest and receive notifications through preferred delivery channels.

> [!NOTE]
> Ocelloids is transitioning to a generalized execution model. Presently, the Ocelloids Node exclusively supports XCM monitoring logic, and the subscriptions detailed in this guide are tailored to XCM activity.

An Ocelloids subscription has the following fields:

| Field        | Description                                                                                          | Required | Type                               |
| ------------ | ---------------------------------------------------------------------------------------------------- | -------- | ---------------------------------- |
| id           | The subscription ID.                                                                                 | Yes      | String                             |
| origin       | The network ID of the chain where XCM messages will be sent out.                                     | Yes      | NetworkId[^1]                      |
| destinations | Network IDs of the chains where XCM messages will be received.                                       | Yes      | Array<NetworkId>                   |
| channels     | Delivery channels for notifications. See [Supported Delivery Channels](#supported-delivery-channels) | Yes      | Array<NotificationChannel>         |
| senders      | Filter for senders by account ID or public key.                                                      | No       | Array<String> or * for wildcard    |
| events       | Filter for event types in notification. See [Notification Event Types](#notification-event-types)    | No       | Array<EventType> or * for wildcard |
| ephemeral    | Flag to indicate if subscription is ephemeral. Applies only to WebSocket notifications.              | No       | Boolean                            |

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
| limit       | Maximum number of retries in case of delivery error.                                                 | No       | 5                  |

### WebSocket

Delivers notification messages through a WebSocket stream. Detailed usage example of the WebSocket notification channel can be seen in the Ocelloids XCM Tracker demo application.

| Field    | Description                                              |
| ---------| -------------------------------------------------------- |
| type     | Type of notification channel. Always set to `websocket`. |

### Log

Logs the notification message to `stdout`.

| Field    | Description                                         |
| ---------| --------------------------------------------------- |
| type     | Type of notification channel. Always set to `log`.  |

## Notification Event Types

The Ocelloids subscription allows configuring the types of XCM events you want to receive. The supported event types are:

| Type           | Description                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| `xcm.sent`     | An XCM was sent out from the origin chain.                                                                     |
| `xcm.received` | An XCM was received on the destination chain.                                                                  |
| `xcm.relay`    | An XCM using HRMP was relayed by the relay chain.                                                              |
| `xcm.hop`      | A multi-hop XCM was executed on intermediate chains.                                                           |
| `xcm.timeout`  | An XCM execution that was expected on the destination chain was not detected within the configured timeframe.  |

## Templates

For Webhook delivery channels, you can configure a template to transform the notification message before delivery. Ocelloids uses [handlebars](https://handlebarsjs.com/guide/) under the hood to evaluate the templates. A simple example template applied to an XCM received message would look like this:

```
"Received XCM with hash {{waypoint.messageHash}} on chain {{waypoint.chainId}}. Sent from chain {{origin.chainId}} by {{sender.signer.id}}."
```

You may find some example template configurations in the [hurl template example](https://github.com/sodazone/ocelloids-services/tree/main/packages/server/guides/hurl/scenarios/templates).

## HTTP API

The Subscription HTTP API allows you to create and manage subscriptions to XCM interactions of your interest.

The OpenAPI documentation is published at the path [/documentation](http://localhost:3000/documentation) in your running server.

Examples of request for the available API methods are listed below.
You can check the [Hurl requests](https://github.com/sodazone/xcm-monitoring/tree/main/guides/hurl) for usage examples.

**Create Subscriptions**

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