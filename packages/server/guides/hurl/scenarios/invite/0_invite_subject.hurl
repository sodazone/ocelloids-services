GET {{base-url}}/accounts/invite
Authorization: Bearer {{auth-token}}
[QueryStringParams]
subject: baba@yaga.super
HTTP 200
[Captures]
api_token: jsonpath "$.token"

GET {{base-url}}/myself
Authorization: Bearer {{api_token}}
HTTP 200
[Asserts]
jsonpath "$.subject" == "baba@yaga.super"

# Cannot duplicate
GET {{base-url}}/accounts/invite
Authorization: Bearer {{auth-token}}
[QueryStringParams]
subject: baba@yaga.super
HTTP 400

DELETE {{base-url}}/myself
Authorization: Bearer {{api_token}}
HTTP 200
