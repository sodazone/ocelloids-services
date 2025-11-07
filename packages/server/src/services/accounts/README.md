# Ocelloids Accounts Service

The Ocelloids Account Service provides HTTP API endpoints for managing user accounts and API tokens.

## Key Entities

The relation of accounts and API tokens is illustrated below:

```
+-------------+
|  ACCOUNT    |
|             |
|  subject    |  = Unique identifier of the account
|  status     |  = Enabled or disabled
+------+------+
       |
       | 0..N
+------+------+
|  API TOKEN  |
|             |
|  id         |  = Unique token ID (ULID)
|  scope      |  = Granted scopes/permissions
|  status     |  = Enabled or disabled
+-------------+
```

## API Tokens

- **Token Format**: The service uses JSON Web Tokens (JWTs) with Ed25519 signatures.
- **Authorization**: Tokens do not include authorization details (e.g., scopes or permissions). Instead, they are associated with a unique token ID (`jti`) and an account (`sub`), which are managed by the account service and stored in a database.
- **Storage**: Signed tokens are not stored in the database. Instead, tokens can be re-issued by signing the API tokens stored in the database.
- **Revocation**: Tokens can be revoked by updating their status in the database or removing them. Similarly, accounts can be disabled to prevent the use of any issued tokens.
- **Scope Modification**: Token scopes or permissions can be updated in the database without re-issuing the token.

## Database Fixtures

The database schema, located in `./migrations`, is initialized using Kysely migrations.
By default, three accounts are created: the Root Administrative Account, the Read-only Public Account, and the Telemetry Account.

## Keys

Generate an ED25519 private key encoded in PEM format:

```shell
openssl genpkey -algorithm ed25519 -out private.pem
```

> [!TIP]
> To generate a public key: `openssl pkey -in private.pem -pubout > public.pem`
