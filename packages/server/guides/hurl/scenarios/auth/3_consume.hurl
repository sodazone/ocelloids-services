GET {{base-url}}/ws/nod
Authorization: Bearer {{auth-token-pub}}
Content-Type: application/json
HTTP 200
[Captures]
nod_token: jsonpath "$.token"

# NOTE: we send malformed WebSocket frames for testing the upgrade response
# Only the "nod" token in the query string is tested out

GET {{base-url}}/ws/subs/xcm/public
Content-Type: application/json
Connection: Upgrade
Upgrade: websocket
Origin: {{base-url}}
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
hex,00;
HTTP 401

GET {{base-url}}/ws/subs/xcm/public?nod=malformed
Content-Type: application/json
Connection: Upgrade
Upgrade: websocket
Origin: {{base-url}}
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
hex,00;
HTTP 401

GET {{base-url}}/ws/subs/xcm/public?nod={{nod_token}}
Content-Type: application/json
Connection: Upgrade
Upgrade: websocket
Origin: {{base-url}}
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
hex,BADE;
HTTP 101
[Asserts]
header "Sec-WebSocket-Accept" exists

GET {{base-url}}/ws/subs/xcm/default?nod={{nod_token}}
Content-Type: application/json
Connection: Upgrade
Upgrade: websocket
Origin: {{base-url}}
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
hex,BADE;
HTTP 101
[Asserts]
header "Sec-WebSocket-Accept" exists

GET {{base-url}}/ws/subs/xcm/private?nod={{nod_token}}
Content-Type: application/json
Connection: Upgrade
Upgrade: websocket
Origin: {{base-url}}
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
hex,BADE;
HTTP 101
[Asserts]
header "Sec-WebSocket-Accept" exists
