# Create Subscription
POST {{base-url}}/subs
```json
{
  "id": "test-1",
  "origin": 0,
  "senders": ["5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"],
  "destinations": [1000],
  "channels": [{
    "type": "webhook",
    "url": "https://webhook.site/faf64821-cb4d-41ad-bb81-fd119e80ad02"
  }]
}
```
HTTP 201