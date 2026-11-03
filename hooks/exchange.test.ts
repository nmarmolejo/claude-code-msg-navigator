import { expect, test } from 'claude-code/testing'

import { findExchange, formatExchange } from './exchange'

const user = (text: string) => ({ role: 'user' as const, text, toolUses: [] })
const assistant = (text: string) => ({ role: 'assistant' as const, text, toolUses: [] })
const toolResult = () => ({
  role: 'user' as const,
  text: '',
  toolUses: [],
  toolResults: [{ tool_use_id: 't1', text: 'ok', isError: false }],
})

const LOG = [
  user('first question'),
  assistant('Looking.'),
  toolResult(),
  assistant('Here is the answer.'),
  user('second question<system-reminder>hidden</system-reminder>'),
  assistant('Second answer.'),
  user('first question'),
  assistant('Repeated answer.'),
] as never

test('collects every assistant text up to the next typed prompt', () => {
  expect(findExchange(LOG, 'first question', 0)).toEqual({
    request: 'first question',
    response: 'Looking.\n\nHere is the answer.',
  })
})

test('picks the repeat the row stands for and strips reminders', () => {
  expect(findExchange(LOG, 'first question', 1)?.response).toBe('Repeated answer.')
  expect(findExchange(LOG, 'second question', 0)?.request).toBe('second question')
})

test('matches a truncated label by its prefix', () => {
  expect(findExchange(LOG, 'second que…', 0)?.response).toBe('Second answer.')
  expect(findExchange(LOG, 'unknown', 0)).toBeUndefined()
})

test('formats request and response as two sections', () => {
  expect(formatExchange({ request: 'q', response: 'r' })).toBe(
    '## Request\n\nq\n\n## Response\n\nr',
  )
})
