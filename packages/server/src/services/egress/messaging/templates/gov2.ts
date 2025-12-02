export const Gov2Template = `
*Referendum {{payload.id}}*
{{#if payload.content.title}}
_{{escapeMarkdownV2 payload.content.title}}_
{{/if}}

*{{payload.humanized.status}}*

{{chain payload.chainId}}
{{~#if payload.info.origin.value.type}}
 · {{payload.info.origin.value.type}}
{{/if}}

{{#if payload.content.link}}
[Open in Subsquare]({{payload.content.link}})
{{/if}}
`
