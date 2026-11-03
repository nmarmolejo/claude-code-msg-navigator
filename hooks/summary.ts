import type { Exchange } from './exchange'

// Sonnet over Haiku: the summary must keep every important detail of long
// technical answers (commands, paths, decisions, caveats), where fidelity
// matters more than the few seconds and cents Haiku would save.
export const SUMMARY_MODEL = 'sonnet'
export const SUMMARY_MAX_TOKENS = 4096
export const SUMMARY_TIMEOUT_MS = 120_000

export const SUMMARY_SYSTEM = `You summarize an AI coding assistant's answer for the person who asked.
Write a detailed, well-structured summary in Markdown, in the same language as the answer.
Keep every important detail: decisions and their reasons, findings, commands, file paths, code identifiers, numbers, warnings, caveats, open questions and next steps.
Drop only repetition, filler and conversational framing.
Use short headings and bullet points; keep commands and code in backticks or code blocks.
Do not add information that is not in the answer, and do not comment on the answer itself.`

export function summaryPrompt({ request, response }: Exchange): string {
  return `<request>\n${request}\n</request>\n\n<answer>\n${response}\n</answer>\n\nSummarize the answer.`
}
