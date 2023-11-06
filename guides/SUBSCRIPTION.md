# Subscription HTTP API

This API allows you to create and manage subscriptions to XCM interactions of your interest.

Access the OpenAPI documentation at
[http://{{your_host}}/documentation](http://localhost:3000/documentation).

The available API methods are listed below.

Create subscription:

```shell
curl --location 'http://127.0.0.1:3000/subs' \
--data '{
    "id": "S1",
    "origin": 0,
    "senders": ["5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"],
    "destinations": [1000],
    "notify": {
      "type": "webhook",
      "url": "https://webhook.site/faf64821-cb4d-41ad-bb81-fd119e80ad02"
    }
}'
```

List subscriptions:

```shell
curl --location 'http://127.0.0.1:3000/subs'
```

Get subscription:

```shell
curl --location 'http://127.0.0.1:3000/subs/S1'
```

Update subscription:

```shell
curl --location --request PATCH 'http://127.0.0.1:3000/subs/S1' \
--data '[
  { "op": "add", "path": "/senders/-", "value": "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y" },
  { "op": "add", "path": "/destinations/-", "value": 2000 },
  { "op": "replace", "path": "/notify", "value": { "type": "log" } }
]'
```

Delete subscription:

```shell
curl --location --request DELETE 'http://127.0.0.1:3000/subs/S1'
```