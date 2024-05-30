# Update Senders
PATCH {{base-url}}/subs/xcm/test-1
```json
[
  { "op": "add", "path": "/senders/-", "value": "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y" },
  { "op": "add", "path": "/senders/-", "value": "5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy" },
  { "op": "add", "path": "/senders/-", "value": "5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw" },
  { "op": "remove", "path": "/senders/0" }
]
```
HTTP 200

# Update Destinations
PATCH {{base-url}}/subs/xcm/test-1
```json
[
  { "op": "add", "path": "/destinations/-", "value": "urn:ocn:polkadot:2000" },
  { "op": "replace", "path": "/destinations/0", "value": "urn:ocn:polkadot:2004" }
]
```
HTTP 200

# Update Notify
PATCH {{base-url}}/subs/xcm/test-1
```json
[
  {
    "op": "replace",
    "path": "/channels/0",
    "value": {
      "type": "log"
    }
  }
]
```

# Check Updates
GET {{base-url}}/subs/xcm/test-1
HTTP 200
[Asserts]
jsonpath "$.args.destinations" count == 2
jsonpath "$.args.senders" count == 3
jsonpath "$.args.channels[0].type" == "log"
