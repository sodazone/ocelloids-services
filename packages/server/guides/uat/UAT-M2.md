# User Acceptance Test Guide - Milestone 2

## Early Access Program

### Register for the Early Access Program

1. Go to [https://www.ocelloids.net](https://www.ocelloids.net).
2. Click **Get Early Access**.
3. Complete and submit the Early Access form.

**Acceptance Criteria:**

- The form is submitted successfully.
- A confirmation email is received at the provided email address (check spam if necessary).

## Public API

The following tests use the Swagger UI. Ensure authorization is set up before proceeding with the tests.

### Prerequisite: Set Up Authorization in Swagger UI

**API Token:**

```
eyJhbGciOiJFZERTQSIsImtpZCI6Im92SFVDU3hRM0NiYkJmc01STVh1aVdjQkNZcDVydmpvamphT2J4dUxxRDQ9In0.ewogICJpc3MiOiAiYXBpLm9jZWxsb2lkcy5uZXQiLAogICJqdGkiOiAiMDEwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAiLAogICJzdWIiOiAicHVibGljQG9jZWxsb2lkcyIKfQo.qKSfxo6QYGxzv40Ox7ec6kpt2aVywKmhpg6lue4jqmZyY6y3SwfT-DyX6Niv-ine5k23E0RKGQdm_MbtyPp9CA
```

1. Open [https://api.ocelloids.net/api-docs/](https://api.ocelloids.net/api-docs/).
2. Click the **Authorize** button (lock icon on the right).
3. Paste the API token into the `value` field in the authorization form pop-up.
4. Click **Authorize**.
5. Click **Close**.

### Get Current Account Information

1. Expand the `GET /myself` endpoint.
2. Click **Try it out**.
3. Click **Execute**.

**Acceptance Criteria:**

- The response displays the linked account information:

```json
{
  "id": 2,
  "status": "enabled",
  "subject": "public@ocelloids",
  "created_at": "2024-07-25 08:39:01"
}
```

### Check Authorization

1. Expand the `DELETE /myself` endpoint.
2. Click **Try it out**.
3. Click **Execute**.

**Acceptance Criteria:**

- The response indicates unauthorized access.

### List Available Agents

1. Expand the `GET /agents` endpoint.
2. Click **Try it out**.
3. Click **Execute**.

**Acceptance Criteria:**

- The response displays a list of available agent names.

### Get Input Schema for the XCM Agent

1. Expand the `GET /agents/{agentId}/inputs` endpoint.
2. Enter `xcm` in the agent name field.
3. Click **Try it out**.
4. Click **Execute**.

**Acceptance Criteria:**

- The response provides the JSON schema for expected inputs for the XCM agent.

### List Public XCM Agent Subscriptions

1. Expand the `GET /subs/{agentId}` endpoint.
2. Enter `xcm` in the agent name field.
3. Click **Try it out**.
4. Click **Execute**.

**Acceptance Criteria:**

- The response displays the current public subscriptions for the XCM agent.

## XCM Tracking Application

### Track XCM Interactions Across Chains

1. Go to [https://xcm-tracker.ocelloids.net](https://xcm-tracker.ocelloids.net).
2. Select **All Networks (\*)** from the `Select Network` dropdown.
3. Wait for messages to appear. _Note: Waiting time depends on real-time chain traffic._

**Acceptance Criteria:**

- The UI displays XCM interactions as they occur in the selected networks.

