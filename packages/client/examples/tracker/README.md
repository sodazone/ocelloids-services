# XCM Tracker Demo

A demonstration web application for tracking XCM executions over WebSockets.

## What it shows

1. Connecting to subscriptions on the XCM Monitoring Server.
2. Reception and correlation of XCM executions across multiple chains.
3. Visualization of XCM journeys from origin to destination with waypoints.
4. Dummy humanization of the XCM intent.

## How it looks

![Asset Hub transfer](https://github.com/sodazone/xcm-monitoring/blob/main/packages/client/examples/tracker/.misc/assets/ah-transfer.png)
![Mixed Interactions](https://github.com/sodazone/xcm-monitoring/blob/main/packages/client/examples/tracker/.misc/assets/mix-capture.png)

## Running

> [!NOTE]
> Ensure that you have built the client package.

Run the web app.

```shell
yarn && yarn dev
```