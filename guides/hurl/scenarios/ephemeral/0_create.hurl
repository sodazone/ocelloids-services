# Create Ephemeral Subscription
POST {{base-url}}/subs
```json
{
  "id": "test-ws",
  "origin": 0,
  "ephemeral": true,
  "senders": ["5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"],
  "destinations": [1000],
  "notify": {
    "type": "websocket"
  }
}
```
HTTP 201