# Get Pending XCM
GET {{base-url}}/admin/xcm
Authorization: Bearer {{auth-token}}
HTTP 200

# Get Unique Paths
GET {{base-url}}/admin/subs/paths
Authorization: Bearer {{auth-token}}
HTTP 200

# Get Scheduled Tasks
GET {{base-url}}/admin/sched
Authorization: Bearer {{auth-token}}
HTTP 200