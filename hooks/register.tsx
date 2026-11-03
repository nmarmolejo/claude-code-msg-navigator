import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderSurface } from 'claude-code'

import type { Card, CardKind } from '../types'
import { markdownBlocks, stripEchoedTags } from './blocks'
import { exchangeAt, formatExchange, typedPrompts } from './exchange'
import type { Exchange } from './exchange'
import {
  SUMMARY_MAX_TOKENS,
  SUMMARY_MODEL,
  SUMMARY_SYSTEM,
  SUMMARY_TIMEOUT_MS,
  summaryPrompt,
} from './summary'
import {
  TRANSLATION_MAX_TOKENS,
  TRANSLATION_MODEL,
  TRANSLATION_SYSTEM,
  TRANSLATION_TIMEOUT_MS,
  translationPrompt,
} from './translation'

// What each card task asks the model, and how the card names it.
const CARD_TASKS = {
  summary: {
    title: 'Summary',
    verb: 'summarizing',
    model: SUMMARY_MODEL,
    system: SUMMARY_SYSTEM,
    prompt: summaryPrompt,
    maxTokens: SUMMARY_MAX_TOKENS,
    timeoutMs: SUMMARY_TIMEOUT_MS,
  },
  translation: {
    title: 'Translation',
    verb: 'translating',
    model: TRANSLATION_MODEL,
    system: TRANSLATION_SYSTEM,
    prompt: translationPrompt,
    maxTokens: TRANSLATION_MAX_TOKENS,
    timeoutMs: TRANSLATION_TIMEOUT_MS,
  },
} as const

const PANE = 'msg-navigator'
const COMMAND = 'jump'
// Engine keybinding action whose chord opens the picker from the prompt. It
// must be an action with no engine handler mounted, or the engine takes the
// chord; bind a key to it in ~/.claude/keybindings.json (see README).
const SHORTCUT_ACTION = 'app:toggleReplTab'
const MAX_DRAWN = 500
const LABEL_LENGTH = 100

// Transcript message ids of the prompts the transcript has drawn, with their
// labels, in draw order: the targets a jump scrolls to. Render hooks must be
// pure (no state writes), so this lives in module memory and is rebuilt as
// the transcript draws its rows again after a reload.
const drawn = new Map<string, string>()
// The picker row holding the focus ring, so the action keys act on it.
let focusedKey: string | undefined
// The card's first visible markdown block, moved by its scroll buttons, and
// the band instance it is drawn in.
let cardBlock = 0
let bandId: string | undefined

// Bump the shape tag when Card changes: it declines older stored values.
const card = atom({ plugin: 'msg-navigator', key: 'card' } as const, null as Card, {
  shape: 'card-2',
})
// Each card request gets a number, so a late reply never revives a card
// the person already dismissed or replaced.
let cardRun = 0

type CopyMode = 'response' | 'all'

/** One row of the picker: a typed prompt of the conversation. */
type Entry = { key: string; label: string; index: number; requestId?: string }

export function toLabel(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim()
  if (line.length === 0) return '(empty)'

  return line.length > LABEL_LENGTH ? `${line.slice(0, LABEL_LENGTH - 1)}…` : line
}

function remember(id: string, text: string) {
  if (drawn.has(id)) return

  const label = toLabel(text)
  // The transcript may draw a fresh prompt first under a provisional id and
  // then under its stored id; the provisional one is never drawn again, so a
  // repeat of the last label replaces it instead of keeping both.
  const lastId = [...drawn.keys()].at(-1)
  if (lastId !== undefined && drawn.get(lastId) === label) drawn.delete(lastId)

  drawn.set(id, label)
  if (drawn.size > MAX_DRAWN) {
    const oldest = drawn.keys().next().value
    if (oldest !== undefined) drawn.delete(oldest)
  }
}

/**
 * The picker rows: every typed prompt of the conversation (complete across
 * reloads and resumes), each matched to the id the transcript drew it under
 * when known. Repeats of one label pair up from the newest, the ones most
 * likely drawn since the last reload.
 */
function buildEntries(messages: Parameters<typeof typedPrompts>[0]): Entry[] {
  const typed = typedPrompts(messages).map(prompt => ({ ...prompt, label: toLabel(prompt.text) }))
  const idsByLabel = new Map<string, string[]>()
  for (const [id, label] of drawn) idsByLabel.set(label, [...(idsByLabel.get(label) ?? []), id])
  const totalByLabel = new Map<string, number>()
  for (const { label } of typed) totalByLabel.set(label, (totalByLabel.get(label) ?? 0) + 1)
  const seenByLabel = new Map<string, number>()

  return typed.map(({ index, label }) => {
    const ids = idsByLabel.get(label) ?? []
    const nth = seenByLabel.get(label) ?? 0
    seenByLabel.set(label, nth + 1)
    const offset = (totalByLabel.get(label) ?? 0) - ids.length

    return { key: `prompt-${index}`, label, index, requestId: ids[nth - offset] }
  })
}

async function conversation($: EngineInterface) {
  const messages = await $.session.messages()

  return 'deny' in messages ? [] : messages
}

async function openPicker($: EngineInterface) {
  focusedKey = undefined
  const opened = await $.ui.open({
    id: PANE,
    title: 'Messages',
    focus: true,
    closeOnEscape: true,
  })
  if (!opened.isPlaced) $.ui.toast(`msg-navigator: ${opened.reason}`)
}

async function jumpTo($: EngineInterface, entry: Entry) {
  if (entry.requestId === undefined) {
    await $.ui.close({ id: PANE })
    $.ui.toast('Cannot jump: that message has not been drawn since the plugin loaded; scroll near it once')
    return
  }

  const scrolled = await $.ui.scroll({ to: { requestId: entry.requestId }, block: 'start' })
  await $.ui.close({ id: PANE })
  if (scrolled.deny) $.ui.toast(`Cannot jump: ${scrolled.deny}`)
}

type Selected = { label: string; exchange: Exchange }

/** The focused row's prompt and the agent's answer to it, or a toast why not. */
async function selectedExchange($: EngineInterface): Promise<Selected | undefined> {
  const messages = await conversation($)
  const entries = buildEntries(messages)
  const entry = entries.find(one => one.key === focusedKey) ?? entries.at(-1)
  if (entry === undefined) {
    $.ui.toast('No message selected')
    return undefined
  }

  return { label: entry.label, exchange: exchangeAt(messages, entry.index) }
}

async function copyExchange($: EngineInterface, mode: CopyMode, surface?: RenderSurface) {
  const selected = await selectedExchange($)
  if (selected === undefined) return
  const { exchange } = selected

  const text = mode === 'all' ? formatExchange(exchange) : exchange.response
  const copied = await $.ui.copy({ text, surface })
  await $.ui.close({ id: PANE })
  $.ui.toast(
    copied.isCopied
      ? mode === 'all' ? 'Copied request and response' : 'Copied response'
      : `Cannot copy: ${copied.reason}`,
  )
}

async function showCard($: EngineInterface, next: Card) {
  cardBlock = 0
  await update($, card, () => next)
}

async function runCardTask($: EngineInterface, kind: CardKind, surface?: RenderSurface) {
  const task = CARD_TASKS[kind]
  const selected = await selectedExchange($)
  if (selected === undefined) return
  const { label, exchange } = selected
  if (exchange.response.length === 0) {
    $.ui.toast('That message has no response')
    return
  }

  const run = ++cardRun
  await $.ui.close({ id: PANE })
  await showCard($, { kind, status: 'loading', label })

  const reply = await $.model.complete({
    model: task.model,
    system: task.system,
    prompt: task.prompt(exchange),
    maxTokens: task.maxTokens,
    timeoutMs: task.timeoutMs,
  })
  const isCurrent = run === cardRun && (await read($, card)) !== null

  if (!reply.isAnswered) {
    if (isCurrent) await showCard($, { kind, status: 'error', label, reason: reply.reason })
    else $.ui.toast(`${task.title} failed: ${reply.reason}`)
    return
  }

  const text = stripEchoedTags(reply.text)
  const copied = await $.ui.copy({ text, surface })
  if (isCurrent) {
    await showCard($, { kind, status: 'ready', label, text, isCopied: copied.isCopied })
  }
  $.ui.toast(copied.isCopied ? `${task.title} copied` : `Cannot copy: ${copied.reason}`)
}

/** Moves the card's window by `delta` markdown blocks, as its buttons ask. */
async function scrollCard($: EngineInterface, delta: number) {
  const shown = await read($, card)
  if (shown === null || shown.status !== 'ready') return

  const blocks = markdownBlocks(shown.text).length
  cardBlock = Math.min(Math.max(cardBlock + delta, 0), blocks - 1)
  const scrolled =
    cardBlock === 0 && bandId !== undefined
      ? await $.ui.scroll({ in: bandId, to: 'start' })
      : await $.ui.scroll({ to: { key: `block-${cardBlock}` }, block: 'start' })
  if (scrolled.deny) $.ui.log(`msg-navigator: card scroll: ${scrolled.deny}`)
}

function dismissCard($: EngineInterface) {
  cardRun += 1
  return update($, card, () => null)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'Pick one of your previous messages to jump to it, copy, summarize or translate its response',
    })

    return next(e)
  })

  on('command.run', { command: COMMAND }, async $ => {
    await openPicker($)

    return {}
  })

  // Learn the id of every prompt the person typed as the transcript draws it.
  on('ui.render', { component: 'UserMessage' }, ($, e, next) => {
    const { origin, text } = e.props
    if (origin.kind === 'composer' && !text.trimStart().startsWith('/')) {
      remember(e.requestId, text)
    }

    return next(e)
  })

  // A one-glyph button among the footer's mode labels, so it takes no row of
  // its own: the keybinding chord bound to SHORTCUT_ACTION presses it.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const { Box, Button } = $.ui.resolve(e)
    const modes = await next(e)

    return (
      <Box key="msg-navigator-mode">
        {modes}
        <Button
          key="jump"
          label="⇅"
          plain
          action={SHORTCUT_ACTION}
          onPress={() => openPicker($)}
        />
      </Box>
    )
  })

  // Typing in the prompt dismisses the card.
  on('prompt.change', async ($, e, next) => {
    if (e.text.length > 0 && (await read($, card)) !== null) await dismissCard($)

    return next(e)
  })

  // The summary/translation card: a framed block above the prompt. A tree
  // taller than the band scrolls there: with the wheel, or with the ↑/↓
  // buttons, whose hotkeys (j, k, x) work once the band has the keyboard:
  // a plugin cannot focus it, the person does (abovePrompt:focus, ctrl+x tab).
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const shown = await read($, card)
    if (shown === null || e.props.hasSurvey) return next(e)

    bandId = e.requestId
    const { Box, Button, Markdown, Text } = $.ui.resolve(e)
    const task = CARD_TASKS[shown.kind]
    const status =
      shown.status === 'loading'
        ? `${task.verb} with ${task.model}…`
        : shown.status === 'error'
          ? 'failed'
          : shown.isCopied
            ? 'copied to clipboard'
            : 'not copied'

    return (
      <Box key="summary-card" flexDirection="column" borderStyle="round" paddingX={1}>
        <Box columnGap={2}>
          <Text bold wrap="truncate">
            {task.title} <Text dimColor>· {status}</Text>
          </Text>
          <Box flexGrow={1} />
          <Button key="card-up" hotkey="k" label="↑" plain onPress={() => scrollCard($, -1)} />
          <Button key="card-down" hotkey="j" label="↓" plain onPress={() => scrollCard($, 1)} />
          <Button key="close-summary" hotkey="x" label="close" plain onPress={() => dismissCard($)} />
        </Box>
        <Text dimColor wrap="truncate">
          {shown.label}
        </Text>
        <Text dimColor wrap="truncate">
          opt+i or ctrl+x tab to focus · j/k scroll · x or typing closes
        </Text>
        {shown.status === 'loading' && <Text dimColor>Waiting for the model…</Text>}
        {shown.status === 'error' && <Text color="error">Failed: {shown.reason}</Text>}
        {shown.status === 'ready' &&
          markdownBlocks(shown.text).map((block, index) => (
            <Box key={`block-${index}`} marginTop={1}>
              <Markdown text={block} />
            </Box>
          ))}
      </Box>
    )
  })

  on('ui.focus', { requestId: PANE }, ($, e, next) => {
    if (e.element?.startsWith('prompt-')) focusedKey = e.element

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const entries = buildEntries(await conversation($))

    if (entries.length === 0) {
      return <Text dimColor>No messages yet.</Text>
    }

    return (
      <Box flexDirection="column">
        {entries.map((entry, index) => (
          <Button
            key={entry.key}
            label={`${index + 1}. ${entry.label}`}
            plain
            autoFocus={index === entries.length - 1 ? true : undefined}
            onPress={() => jumpTo($, entry)}
          />
        ))}
        <Box marginTop={1} flexWrap="wrap" columnGap={2}>
          <Text dimColor>enter: jump</Text>
          <Button
            key="copy-response"
            hotkey="c"
            label="copy response"
            plain
            onPress={press => copyExchange($, 'response', press.surface)}
          />
          <Button
            key="copy-all"
            hotkey="a"
            label="copy request + response"
            plain
            onPress={press => copyExchange($, 'all', press.surface)}
          />
          <Button
            key="summarize"
            hotkey="r"
            label="summarize"
            plain
            onPress={press => runCardTask($, 'summary', press.surface)}
          />
          <Button
            key="translate"
            hotkey="t"
            label="translate"
            plain
            onPress={press => runCardTask($, 'translation', press.surface)}
          />
          <Text dimColor>esc: close</Text>
        </Box>
      </Box>
    )
  })
}
