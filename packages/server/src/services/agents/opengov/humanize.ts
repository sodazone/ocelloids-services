type IconLabel = Record<string, { icon: string; label: string }>

const STATUS_MAP: IconLabel = {
  Ongoing: { icon: '⚡', label: 'Ongoing' },
  Rejected: { icon: '👎', label: 'Rejected' },
  Approved: { icon: '👍', label: 'Approved' },
  Cancelled: { icon: '❎', label: 'Cancelled' },
  TimedOut: { icon: '⌛', label: 'Timed Out' },
  Killed: { icon: '💀', label: 'Killed' },
  Finalized: { icon: '🏁', label: 'Finalized' },
}

const EVENT_STATUS_MAP: IconLabel = {
  'Referenda.Submitted': { icon: '👀', label: 'Submitted' },
  'Referenda.DecisionStarted': { icon: '🧐', label: 'Decision Started' },
  'Referenda.DecisionDepositPlaced': { icon: '💰', label: 'Decision Deposit' },
  'Referenda.DecisionDepositRefunded': { icon: '↩️', label: 'Decision Deposit Refunded' },
  'Referenda.DepositSlashed': { icon: '💸', label: 'Decision Deposit Slashed' },
  'Referenda.ConfirmStarted': { icon: '✅', label: 'Confirm Started' },
  'Referenda.ConfirmAborted': { icon: '❌', label: 'Confirm Aborted' },
  'Referenda.Confirmed': { icon: '👍', label: 'Confirmed' },
  'Referenda.TimedOut': { icon: '⌛', label: 'Timed Out' },
  'Referenda.Killed': { icon: '💀', label: 'Killed' },
  'Referenda.Rejected': { icon: '👎', label: 'Rejected' },
  'Referenda.Cancelled': { icon: '❎', label: 'Cancelled' },
  'Referenda.Executed': { icon: '🏁', label: 'Executed' },
}
export function humanizeReferendumStatus(payload: {
  status?: string
  execution?: { result: { success: boolean } }
  timeline?: { willExecuteAtUtc?: string }
  triggeredBy?: { name: string }
}) {
  if (!payload) {
    return ''
  }

  const evt = payload.triggeredBy?.name
  if (evt && EVENT_STATUS_MAP[evt]) {
    if (evt === 'Referenda.Confirmed') {
      if (payload.execution?.result) {
        const { success } = payload.execution.result
        if (success) {
          return '🤩 Executed Successfully'
        } else {
          return '😨 Execution Failed'
        }
      } else if (payload.timeline?.willExecuteAtUtc) {
        const { willExecuteAtUtc } = payload.timeline
        return `⏰ Secheduled for ${willExecuteAtUtc}`
      }
    }
    const { icon, label } = EVENT_STATUS_MAP[evt]
    return `${icon} ${label}`
  }

  const sys = payload.status
  if (sys && STATUS_MAP[sys]) {
    const { icon, label } = STATUS_MAP[sys]
    return `${icon} ${label}`
  }

  // fallback
  return sys || evt || 'unknown'
}
