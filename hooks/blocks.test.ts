import { expect, test } from 'claude-code/testing'

import { markdownBlocks, stripEchoedTags } from './blocks'

test('splits markdown on blank lines, keeping code fences whole', () => {
  const text = '# Title\n\nFirst paragraph\nstill first\n\n```js\nconst a = 1\n\nconst b = 2\n```\n\n- one\n- two\n'
  expect(markdownBlocks(text)).toEqual([
    '# Title',
    'First paragraph\nstill first',
    '```js\nconst a = 1\n\nconst b = 2\n```',
    '- one\n- two',
  ])
})

test('drops answer tags a model echoes back', () => {
  expect(stripEchoedTags('<answer>\nHola\n</answer>')).toBe('Hola')
  expect(stripEchoedTags('Hola <answer> dentro')).toBe('Hola <answer> dentro')
})
