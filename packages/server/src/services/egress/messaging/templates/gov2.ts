export const Gov2Template = `
*Referendum {{payload.id}} – {{payload.humanized.status}}*
{{#if payload.content.title}}
_{{escapeMarkdownV2 payload.content.title}}_
{{/if}}
\\({{chain payload.chainId}}\\)

{{#if payload.content.link}}
[Open in Subsquare]({{payload.content.link}})
{{/if}}
`
