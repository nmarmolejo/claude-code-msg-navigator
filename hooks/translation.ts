import type { Exchange } from './exchange'

// Sonnet keeps technical terms, code and Markdown intact across long answers.
export const TRANSLATION_MODEL = 'sonnet'
export const TRANSLATION_MAX_TOKENS = 16000
export const TRANSLATION_TIMEOUT_MS = 180_000

export const TRANSLATION_SYSTEM = `You translate an AI coding assistant's answer between English and Spanish.
If the answer is mostly in English, translate it to neutral Spanish; if it is mostly in Spanish, translate it to English.
Translate everything, keeping the meaning, tone, structure and Markdown formatting exactly.
Never translate code, code blocks, commands, file paths, identifiers, URLs or text inside backticks.
Output only the translation, with no notes or preamble.`

export function translationPrompt({ response }: Exchange): string {
  return `<answer>\n${response}\n</answer>\n\nTranslate the answer.`
}
