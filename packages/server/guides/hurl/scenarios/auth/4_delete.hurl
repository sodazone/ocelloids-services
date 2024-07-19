DELETE {{base-url}}/subs/xcm/public
Authorization: Bearer {{auth-token}}
HTTP 200
DELETE {{base-url}}/subs/xcm/public
Authorization: Bearer {{auth-token-pub}}
HTTP 401
DELETE {{base-url}}/subs/xcm/default
Authorization: Bearer {{auth-token}}
HTTP 200
DELETE {{base-url}}/subs/xcm/default
Authorization: Bearer {{auth-token-pub}}
HTTP 401
DELETE {{base-url}}/subs/xcm/private
Authorization: Bearer {{auth-token}}
HTTP 200
DELETE {{base-url}}/subs/xcm/private
Authorization: Bearer {{auth-token-pub}}
HTTP 401
DELETE {{base-url}}/subs/xcm/override
Authorization: Bearer {{auth-token}}
HTTP 200
