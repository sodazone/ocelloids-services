# Subscription HTTP API

This API allows you to create and manage subscriptions to XCM interactions of your interest.

The OpenAPI documentation is published at the path [/documentation](http://localhost:3000/documentation) in your running server.

Examples of request for the available API methods are listed below.
You can check the [Hurl requests](https://github.com/sodazone/xcm-monitoring/tree/main/guides/hurl) for usage examples.

**Create a Subscription**

> [!NOTE]
> You can specify '*' as the value of senders to receive all the messages regardless of the sender address.

`POST /subs`

```shell
curl 'http://127.0.0.1:3000/subs' \
--data '{
    "id": "test-sub",
    "origin": 0,
    "senders": ["5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"],
    "destinations": [1000],
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
  { "op": "add", "path": "/destinations/-", "value": 2000 },
  { "op": "replace", "path": "/channels/0", "value": { "type": "log" } }
]'
```

**Delete Subscription**

`DELETE /subs/:id`

```shell
curl -X DELETE 'http://127.0.0.1:3000/subs/test-sub'
```