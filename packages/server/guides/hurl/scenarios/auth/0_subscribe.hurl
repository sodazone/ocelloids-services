# Create Subscriptions
POST {{base-url}}/subs
Authorization: Bearer {{auth-token}}
Content-Type: application/json
file,subs.json;
HTTP 201

# Try override owner
POST {{base-url}}/subs
Authorization: Bearer {{auth-token}}
Content-Type: application/json
{
    "id": "override",
    "agent": "xcm",
    "owner": "ops",
    "args": {
      "origin": "urn:ocn:polkadot:1000",
      "senders": "*",
      "destinations": [
        "urn:ocn:polkadot:0"
      ],
      "events": "*"
    },
    "channels": [
      {
        "type": "websocket"
      }
    ]
}
HTTP 201