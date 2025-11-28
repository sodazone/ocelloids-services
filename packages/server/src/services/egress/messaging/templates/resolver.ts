import { Message } from '@/lib.js'
import { Gov2Template } from './gov2.js'

const DEFAULT_TEMPLATE = `
{{metadata.type}} from **{{metadata.agentId}}**
\`\`\`
{{json this}}
\`\`\`
`

export function resolveTemplate(msg: Message) {
  switch (msg.metadata.agentId) {
    case 'opengov':
      return Gov2Template
    default:
      return DEFAULT_TEMPLATE
  }
}
