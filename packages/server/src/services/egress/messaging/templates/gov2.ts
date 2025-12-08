export const Gov2Template = `
*Referendum {{payload.id}}*
{{#ifNested payload "content.title"}}
_{{escapeMarkdownV2 payload.content.title}}_
{{/ifNested}}

*{{payload.humanized.status}}*

{{chain payload.chainId}}
{{~#ifNested payload "info.origin.value.type"}}
 · {{payload.info.origin.value.type}}
{{/ifNested}}

{{~#unless payload.execution}}
{{~#ifNested payload "triggeredBy.name"}}
{{~#if (eq payload.triggeredBy.name "Referenda.Confirmed")}}
{{~#ifNested payload "timeline.willExecuteAtUtc"}}

ETA {{humanizeTime payload.timeline.willExecuteAtUtc}}
{{/ifNested}}
{{/if}}
{{/ifNested}}
{{/unless}}

{{#ifNested payload "content.link"}}
[Open in Subsquare]({{payload.content.link}})
{{/ifNested}}
`
