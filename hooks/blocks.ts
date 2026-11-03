/**
 * Splits markdown into its top-level blocks (paragraphs, lists, tables,
 * headings, fenced code), on blank lines outside code fences, so each block
 * can be drawn and scrolled to on its own.
 */
export function markdownBlocks(text: string): string[] {
  const blocks: string[] = []
  let current: string[] = []
  let isInFence = false

  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) isInFence = !isInFence

    if (!isInFence && line.trim().length === 0) {
      if (current.length > 0) blocks.push(current.join('\n'))
      current = []
    } else {
      current.push(line)
    }
  }
  if (current.length > 0) blocks.push(current.join('\n'))

  return blocks
}

/** Drops the delimiter tags a model may echo back from the prompt. */
export function stripEchoedTags(text: string): string {
  return text.replace(/^\s*<answer>\s*/i, '').replace(/\s*<\/answer>\s*$/i, '').trim()
}
