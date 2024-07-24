# Administration Guide

This guide provides an overview of the Ocelloids Service Node administration.

## HTTP API

The server exposes administration functionality through an HTTP API. Generally, you won't need to use this API under normal circumstances.

### Authorization

The administration API uses bearer token authorization. You will need an account with administrative privileges.

To authenticate with the `admin/` endpoints, you should pass an HTTP authorization header with a valid JWT token signed with the configured private key linked to an account with administrative privileges.

Example using the development account:
```
Authorization: Bearer eyJhbGciOiJFZERTQSIsImtpZCI6InkyN2VjLVpwakVjV1NBYkd6Nnp0XzA4bldrSjE4RGIyMXZMS2x3a0x4U1k9In0.ewogICJpc3MiOiAibG9jYWxob3N0IiwKICAianRpIjogIjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwIiwKICAic3ViIjogInJvb3RAb2NlbGxvaWRzIgp9Cg.Q3cvoZtZ68Lr1sceY2Iz7Qw5uf7niDVaHGRt5Zoi-ARRzErRYmazkxPQUJTJAm4PgItmkQypCkaJriR-XhCDDQ
```

### Caches

> [!NOTE]
> The cache endpoints only work when running the node in integrated mode i.e. without Redis.

You can list the cached items, blocks, and messages by making a GET request to `/admin/cache/:network_id_urn`.
You can clear a cache with a DELETE request to the same endpoint.
The chain tips, i.e. the latest known block header, can be listed using `/admin/cache/tips` and can also be deleted.

### Scheduler

Some operations require expiration for cached entries, such as cached messages. To achieve this, the system supports persistent scheduled tasks.
You can list the scheduled tasks by making a GET request to `/admin/sched`, which will return all the keys of the current scheduled tasks.
You can retrieve the content of a scheduled task using GET `/admin/sched?key=<key>` and remove it using the DELETE operation.


