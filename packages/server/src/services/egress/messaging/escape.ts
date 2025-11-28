const ESCAPE_MAP_TEXT: Record<string, string> = {
  _: '\\_',
  '*': '\\*',
  '[': '\\[',
  ']': '\\]',
  '(': '\\(',
  ')': '\\)',
  '~': '\\~',
  '`': '\\`',
  '>': '\\>',
  '#': '\\#',
  '+': '\\+',
  '-': '\\-',
  '=': '\\=',
  '|': '\\|',
  '{': '\\{',
  '}': '\\}',
  '.': '\\.',
  '!': '\\!',
}

const ESCAPE_MAP_CODE: Record<string, string> = {
  '\\': '\\\\',
  '`': '\\`',
}

const ESCAPE_MAP_LINK: Record<string, string> = {
  '\\': '\\\\',
  '(': '\\(',
  ')': '\\)',
}

/**
 * Escapes symbols for Telegram MarkdownV2
 */
export function escapeMarkdownV2(text: string, textType: 'text' | 'code' | 'link' = 'text'): string {
  if (!text) {
    return text
  }

  let map: Record<string, string>
  switch (textType) {
    case 'code':
      map = ESCAPE_MAP_CODE
      break
    case 'link':
      map = ESCAPE_MAP_LINK
      break
    default:
      map = ESCAPE_MAP_TEXT
  }

  const pattern = new RegExp(
    `[${Object.keys(map)
      .map((c) => `\\${c}`)
      .join('')}]`,
    'g',
  )
  return text.replace(pattern, (char) => map[char])
}
