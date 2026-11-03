import type { SessionMessage } from 'claude-code'

export type Exchange = { request: string; response: string }

const REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g

function clean(text: string): string {
  return text.replace(REMINDER, '').trim()
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** A user message the person typed: no tool results, visible text. */
function isTypedPrompt(message: SessionMessage): boolean {
  if (message.role !== 'user' || (message.toolResults?.length ?? 0) > 0) return false
  const text = clean(message.text)

  return text.length > 0 && !text.startsWith('<')
}

function matches(message: SessionMessage, label: string): boolean {
  const prefix = label.endsWith('…') ? label.slice(0, -1) : label

  return normalize(clean(message.text)).startsWith(prefix)
}

/** A prompt the person typed, by its position in the conversation. */
export type TypedPrompt = { index: number; text: string }

/** Every prompt the person typed, in order; slash commands left out. */
export function typedPrompts(messages: readonly SessionMessage[]): TypedPrompt[] {
  return messages.flatMap((message, index) => {
    if (!isTypedPrompt(message)) return []
    const text = clean(message.text)

    return text.startsWith('/') ? [] : [{ index, text }]
  })
}

/** The prompt at `index` and the assistant text after it, up to the next typed prompt. */
export function exchangeAt(messages: readonly SessionMessage[], index: number): Exchange {
  const replies: string[] = []
  for (const message of messages.slice(index + 1)) {
    if (isTypedPrompt(message)) break
    if (message.role === 'assistant' && message.text.trim().length > 0) {
      replies.push(message.text.trim())
    }
  }

  return { request: clean(messages[index].text), response: replies.join('\n\n') }
}

/**
 * Finds the prompt shown under `label` (its `occurrence`-th repeat, 0-based)
 * and the assistant text that answered it, up to the next typed prompt.
 */
export function findExchange(
  messages: readonly SessionMessage[],
  label: string,
  occurrence: number,
): Exchange | undefined {
  const starts = messages.flatMap((message, index) =>
    isTypedPrompt(message) && matches(message, label) ? [index] : [],
  )
  const start = starts[occurrence] ?? starts.at(-1)

  return start === undefined ? undefined : exchangeAt(messages, start)
}

export function formatExchange({ request, response }: Exchange): string {
  return `## Request\n\n${request}\n\n## Response\n\n${response}`
}
