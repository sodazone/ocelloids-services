# Observability with Prometheus

The Ocelloids Service Node emits metrics related to subscriptions, notifications, XCM activity, and ingress. This guide will walk you through the process of setting up Prometheus to collect these metrics and Grafana to display them conveniently on a dashboard.

## Running

We've provided an example [Docker Compose](https://github.com/sodazone/ocelloids-services/tree/main/packages/server/guides/telemetry/docker-compose.yml) file and sample configurations to facilitate the setup of Prometheus, Grafana, and Alertmanager.

To run, navigate to the directory containing the Docker Compose file:

```shell
# from project root
cd packages/server/guides/telemetry
```

```shell
docker compose up
```

> [!NOTE]
> Remember to map `host.docker.internal` to the host address where the service node is running for Prometheus.

## Grafana

Once the services are up and running, you can access Grafana at `http://localhost:3001`. On your first access, you'll be prompted to log in. Provide the username and password set in [`config.monitoring`](https://github.com/sodazone/ocelloids-services/tree/main/packages/server/guides/telemetry/grafana/config.monitoring).

Configure Prometheus as the data source.

Now you can run metric queries and start building your dashboards. All metrics exposed by the Ocelloids Service Node are prefixed with `oc_` in the metric names, making them easy to search for in the metric explorer.

You can also import the sample [Grafana dashboard](https://github.com/sodazone/ocelloids-services/tree/main/packages/server/guides/telemetry/grafana/xcmon_dashboard.yml) that we have prepared.

## Alertmanager

If you wish to receive Prometheus alerts, please configure the [alert rules](https://github.com/sodazone/ocelloids-services/tree/main/packages/server/guides/telemetry/prometheus/alert.rules) and set up receivers in the Alertmanager [configuration file](https://github.com/sodazone/ocelloids-services/tree/main/packages/server/guides/telemetry/alertmanager/config.yml). For more information on configuring alerting in Prometheus, refer to the [Prometheus Alerting Guide](https://prometheus.io/docs/alerting/latest/overview/).