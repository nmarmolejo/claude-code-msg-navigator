/** Which model task fills the floating card. */
export type CardKind = 'summary' | 'translation'

/** The floating card above the prompt; null while hidden. */
export type Card =
  | { kind: CardKind; status: 'loading'; label: string }
  | { kind: CardKind; status: 'ready'; label: string; text: string; isCopied: boolean }
  | { kind: CardKind; status: 'error'; label: string; reason: string }
  | null

declare module 'claude-code' {
  interface PluginState {
    'msg-navigator': { card: Shaped<Card> }
  }
}
