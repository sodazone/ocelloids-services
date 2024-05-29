// TBD agent web api
/*
// TO MOVE OUT to the XCM agent
    if (isXcmReceived(msg)) {
      this.#log.info(
        '[%s ➜ %s] NOTIFICATION %s subscription=%s, messageHash=%s, outcome=%s (o: #%s, d: #%s)',
        msg.origin.chainId,
        msg.destination.chainId,
        msg.type,
        sub.id,
        msg.waypoint.messageHash,
        msg.waypoint.outcome,
        msg.origin.blockNumber,
        msg.destination.blockNumber
      )
    } else if (isXcmHop(msg)) {
      this.#notifyHop(sub, msg)
    } else if (isXcmRelayed(msg) && msg.type === XcmNotificationType.Relayed) {
      this.#log.info(
        '[%s ↠ %s] NOTIFICATION %s subscription=%s, messageHash=%s, block=%s',
        msg.origin.chainId,
        msg.destination.chainId,
        msg.type,
        sub.id,
        msg.waypoint.messageHash,
        msg.waypoint.blockNumber
      )
    } else if (isXcmSent(msg)) {
      this.#log.info(
        '[%s ➜] NOTIFICATION %s subscription=%s, messageHash=%s, block=%s',
        msg.origin.chainId,
        msg.type,
        sub.id,
        msg.waypoint.messageHash,
        msg.origin.blockNumber
      )
    }
  }

  #notifyHop(sub: Subscription, msg: XcmHop) {
    if (msg.direction === 'out') {
      this.#log.info(
        '[%s ↷] NOTIFICATION %s-%s subscription=%s, messageHash=%s, block=%s',
        msg.waypoint.chainId,
        msg.type,
        msg.direction,
        sub.id,
        msg.waypoint.messageHash,
        msg.waypoint.blockNumber
      )
    } else if (msg.direction === 'in') {
      this.#log.info(
        '[↷ %s] NOTIFICATION %s-%s subscription=%s, messageHash=%s, block=%s',
        msg.waypoint.chainId,
        msg.type,
        msg.direction,
        sub.id,
        msg.waypoint.messageHash,
        msg.waypoint.blockNumber
      )
    }
*/
