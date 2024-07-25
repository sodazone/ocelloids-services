# Ocelloids Offchain Agents

Ocelloids provides the infrastructure to develop, operate, and deploy offchain agents ([def.1](#d1-offchain-agents)). Each agent is implemented as an [ECMAScript Module](https://tc39.es/ecma262/#sec-modules) and conforms to the `Agent` interface. Currently, agents support two behaviors: `Subscribable` and `Queryable`.

Agents have access to essential services defined in the `AgentRuntimeContext` from the Ocelloids host.

The `AgentCatalog` implementation manages the lifecycle of the agents.

## 1. Runtime Context

The `AgentRuntimeContext` provides essential services to support agent operations:

- **Log**: Access to logging.
- **Egress**: Manages outbound communications from the agent to external systems.
- **Ingress**: Handles incoming blockchain data and messages.
- **DB**: Provides a key-value store for persistent data management.
- **Scheduler**: Executes tasks or actions at specified intervals.
- **Janitor**: Performs routine maintenance tasks to ensure smooth and efficient operations.

## 2. Agent Interface

The `Agent` interface defines the structure and behavior of an Ocelloid agent:

- **id**: Returns the unique identifier (`AgentId`) of the agent.
- **metadata**: Provides metadata about the agent, including capabilities, configuration, and status.
- **start(subscriptions?: Subscription[])**: Initializes the agent with optional subscriptions. These subscriptions are the ones already created in the event of a restart.
- **stop()**: Halts the agent's operations.
- **collectTelemetry()**: Gathers performance metrics and operational data for monitoring.

## 3. Queryable Interface

The `Queryable` interface enables agents to execute complex data queries in a request-response fashion exposed through an HTTP API:

- **querySchema**: A schema (`z.ZodSchema`) that validates query parameters.
- **query(params: QueryParams)**: Executes queries asynchronously, returning a `QueryResult`.

This interface supports data retrieval and aggregation.

## 4. Subscribable Interface

The `Subscribable` interface allows agents to manage dynamic subscriptions delivered over WebSockets and webhooks:

- **inputSchema**: A schema (`z.ZodSchema`) defining the structure for subscription inputs.
- **subscribe(subscription: Subscription)**: Adds a subscription to receive data updates.
- **unsubscribe(subscriptionId: string)**: Removes a subscription by its ID.
- **update(subscriptionId: string, patch: Operation[])**: Updates a subscription with specific modifications.

This interface enables agents to adapt to changing data conditions by managing continuous data updates.

## 5. AgentCatalog Interface

The `AgentCatalog` interface manages agents within the system and provides the following functionalities:

- **Egress Listeners**: Add or remove listeners for outgoing messages.
- **Agent Retrieval**: Get agents by their ID, including their input and query schemas.
- **Subscribable and Queryable Agents**: Fetch agents with subscription or query capabilities.
- **Start/Stop Agents**: Initialize or halt agents, with optional subscriptions.
- **Catalog Management**: Start or stop the `AgentCatalog` and all managed agents.
- **Telemetry Collection**: Gather operational data from agents.

Overall, it centralizes control and interaction with agents, supporting their lifecycle management and communication.

## Definitions

### D.1. Offchain Agents

Offchain agents operate outside the blockchain but interact with it to perform tasks such as:

- **Data Processing**: Handling large data volumes or computationally intensive tasks that are impractical on the blockchain.
- **Communication**: Facilitating interactions between different blockchain networks or external systems.
- **Interoperability**: Connecting blockchain ecosystems and enabling cross-chain transactions or interactions.

## Notes

> [!IMPORTANT]
> This runtime environment, i.e., Node.js, is intended to run **trusted** code.
> Rationale for not using `node:vm`. [Issue #85](https://github.com/sodazone/ocelloids-services/issues/85#issuecomment-2142605329)

For untrusted code execution, we are exploring:

1. Secure ECMAScript, e.g., [ses-shim](https://github.com/endojs/endo/tree/master/packages/ses)
2. WebAssembly, with proper isolation, etc.

Contributions are welcome! :rainbow:
