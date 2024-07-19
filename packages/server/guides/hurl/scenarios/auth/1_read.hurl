GET {{base-url}}/subs/xcm
Authorization: Bearer {{auth-token-pub}}
Content-Type: application/json
HTTP 200
[Asserts]
jsonpath "$" count == 1


GET {{base-url}}/subs/xcm
Authorization: Bearer {{auth-token}}
Content-Type: application/json
HTTP 200
[Asserts]
jsonpath "$" count == 4

GET {{base-url}}/subs/xcm/public
Authorization: Bearer {{auth-token-pub}}
Content-Type: application/json
HTTP 200
[Asserts]
jsonpath "$.owner" == "root@ocelloids"

GET {{base-url}}/subs/xcm/default
Authorization: Bearer {{auth-token}}
Content-Type: application/json
HTTP 200
[Asserts]
jsonpath "$.owner" == "root@ocelloids"

GET {{base-url}}/subs/xcm/private
Authorization: Bearer {{auth-token}}
Content-Type: application/json
HTTP 200
[Asserts]
jsonpath "$.owner" == "root@ocelloids"

GET {{base-url}}/subs/xcm/override
Authorization: Bearer {{auth-token}}
Content-Type: application/json
HTTP 200
[Asserts]
jsonpath "$.owner" == "root@ocelloids"

GET {{base-url}}/subs/xcm/public
Authorization: Bearer {{auth-token-pub}}
Content-Type: application/json
HTTP 200
[Asserts]
jsonpath "$.owner" == "root@ocelloids"

GET {{base-url}}/subs/xcm/default
Authorization: Bearer {{auth-token-pub}}
Content-Type: application/json
HTTP 401

GET {{base-url}}/subs/xcm/private
Authorization: Bearer {{auth-token-pub}}
Content-Type: application/json
HTTP 401

GET {{base-url}}/subs/xcm/override
Authorization: Bearer {{auth-token-pub}}
Content-Type: application/json
HTTP 401