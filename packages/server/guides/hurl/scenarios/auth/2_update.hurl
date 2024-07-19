PATCH {{base-url}}/subs/xcm/public
Authorization: Bearer {{auth-token-pub}}
Content-Type: application/json
[ { "op": "remove", "path": "/channels/0" } ]
HTTP 401

PATCH {{base-url}}/subs/xcm/public
Authorization: Bearer {{auth-token}}
Content-Type: application/json
[ { "op": "replace", "path": "/channels/0", "value": { "type": "websocket" } } ]
HTTP 200

PATCH {{base-url}}/subs/xcm/public
Authorization: Bearer {{auth-token}}
Content-Type: application/json
[ { "op": "remove", "path": "/owner" } ]
HTTP 400