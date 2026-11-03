import { expect, test } from 'claude-code/testing'

const USER_MESSAGE = {
  plugin: 'msg-navigator',
  component: 'UserMessage',
  surface: 'terminal',
} as const

const PANE = {
  plugin: 'msg-navigator',
  component: 'Pane',
  requestId: 'msg-navigator',
  surface: 'terminal',
  props: {
    title: 'Jump to message',
    isFocused: true,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

function userMessage(requestId: string, text: string, kind = 'composer') {
  return {
    ...USER_MESSAGE,
    requestId,
    props: { text, origin: { kind }, isExpanded: false },
  } as never
}

const messages = (...texts: string[]) =>
  texts.flatMap(text => [
    { role: 'user' as const, text, toolUses: [] },
    { role: 'assistant' as const, text: `answer to ${text}`, toolUses: [] },
  ])

// The jump itself ($.ui.scroll on a transcript row) is not answerable from the
// test kit, so it is checked by hand in a fullscreen session.
test('lists every typed prompt of the conversation oldest first, skipping slash commands', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  on('session.messages', () => ({
    value: messages('first prompt', '/jump', 'second\n  prompt', 'never drawn yet'),
  }))

  for (const [id, text] of [
    ['m1', 'first prompt'],
    ['m3', 'second\n  prompt'],
  ] as const) {
    const row = await $.ui.mount(userMessage(id, text))
    await row.unmount()
  }

  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ key: 'prompt-0' }))?.text).toBe('1. first prompt')
  expect((await ui.find({ key: 'prompt-4' }))?.text).toBe('2. second prompt')
  expect((await ui.find({ key: 'prompt-6' }))?.text).toBe('3. never drawn yet')
  expect(await ui.find({ key: 'prompt-2' })).toBeUndefined()
  await ui.unmount()
})

test('the empty picker says so', async ($, on) => {
  on('session.messages', () => ({ value: [] }))
  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text' }))?.text).toBe('No messages yet.')
  await ui.unmount()
})

test('a prompt redrawn under a new id is listed once', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  on('session.messages', () => ({ value: messages('same prompt') }))

  for (const id of ['provisional', 'stored']) {
    const row = await $.ui.mount(userMessage(id, 'same prompt'))
    await row.unmount()
  }

  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ key: 'prompt-0' }))?.text).toBe('1. same prompt')
  expect(await ui.find({ key: 'prompt-2' })).toBeUndefined()
  await ui.unmount()
})

test('the footer mode labels carry the one-glyph jump button', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>auto mode on</Text>
  })

  const ui = await $.ui.mount({
    plugin: 'msg-navigator',
    component: 'SessionMode',
    requestId: 'mode',
    surface: 'terminal',
    props: { modes: ['auto mode on'] },
  } as never)
  expect((await ui.find({ key: 'jump' }))?.text).toBe('⇅')
  expect(await ui.find({ type: 'Text', text: /auto mode on/ })).toBeDefined()
  await ui.unmount()
})

test('a copies the request and response of the focused row', async ($, on) => {
  const copied: string[] = []
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  on('session.messages', () => ({
    value: [
      { role: 'user', text: 'what is 2+2', toolUses: [] },
      { role: 'assistant', text: '4', toolUses: [] },
    ],
  }))
  on('ui.copy', (_, e) => {
    copied.push(e.text)

    return { value: { isCopied: true } }
  })
  on('ui.close', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))

  const row = await $.ui.mount(userMessage('m1', 'what is 2+2'))
  await row.unmount()

  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'copy-all' })
  expect(copied).toEqual(['## Request\n\nwhat is 2+2\n\n## Response\n\n4'])
  await ui.unmount()
})

test('r summarizes the focused response, copies it and shows the card', async ($, on) => {
  const copied: string[] = []
  const asked: string[] = []
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  on('session.messages', () => ({
    value: [
      { role: 'user', text: 'explain the plan', toolUses: [] },
      { role: 'assistant', text: 'A long and detailed plan.', toolUses: [] },
    ],
  }))
  on('model.complete', (_, e) => {
    asked.push(e.model)

    return { value: { isAnswered: true, text: '- the plan, summarized', usage: {} } } as never
  })
  on('ui.copy', (_, e) => {
    copied.push(e.text)

    return { value: { isCopied: true } }
  })
  on('ui.close', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))

  const row = await $.ui.mount(userMessage('m1', 'explain the plan'))
  await row.unmount()
  const picker = await $.ui.mount(PANE)
  await picker.press({ key: 'summarize' })
  await picker.unmount()

  expect(asked).toEqual(['sonnet'])
  expect(copied).toEqual(['- the plan, summarized'])

  const band = await $.ui.mount({
    plugin: 'msg-navigator',
    component: 'AbovePrompt',
    requestId: 'band',
    surface: 'terminal',
    props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 80, scroll: { offset: 0, bodyRows: 19 } },
  } as never)
  expect(await band.find({ type: 'Text', text: /the plan, summarized/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /copied to clipboard/ })).toBeDefined()
  expect((await band.find({ key: 'card-down' }))?.text).toBe('↓')
  expect((await band.find({ key: 'card-up' }))?.text).toBe('↑')
  await band.press({ key: 'close-summary' })
  expect(await band.find({ type: 'Text', text: /the plan, summarized/ })).toBeUndefined()
  await band.unmount()
})

test('t translates the focused response and shows it in the card', async ($, on) => {
  const prompts: string[] = []
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  on('session.messages', () => ({
    value: [
      { role: 'user', text: 'hola', toolUses: [] },
      { role: 'assistant', text: 'Hola, ¿en qué te ayudo?', toolUses: [] },
    ],
  }))
  on('model.complete', (_, e) => {
    prompts.push(String(e.prompt))

    return { value: { isAnswered: true, text: 'Hi, how can I help?', usage: {} } } as never
  })
  on('ui.copy', () => ({ value: { isCopied: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))

  const row = await $.ui.mount(userMessage('m1', 'hola'))
  await row.unmount()
  const picker = await $.ui.mount(PANE)
  await picker.press({ key: 'translate' })
  await picker.unmount()

  expect(prompts[0]).toContain('Hola, ¿en qué te ayudo?')

  const band = await $.ui.mount({
    plugin: 'msg-navigator',
    component: 'AbovePrompt',
    requestId: 'band',
    surface: 'terminal',
    props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 80, scroll: { offset: 0, bodyRows: 19 } },
  } as never)
  expect(await band.find({ type: 'Text', text: /^Translation/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /Hi, how can I help\?/ })).toBeDefined()
  await band.unmount()
})
