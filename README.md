<div align="center">

# ⇅ msg-navigator

**Stop scrolling. Jump straight to any prompt in your Claude Code session, and copy, summarize or translate the answer, with one keystroke.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-d97757)](https://code.claude.com)
![Version](https://img.shields.io/badge/version-1.0.0-blue)

</div>

---

Long Claude Code sessions turn into a wall of text. Finding *that* answer from twenty minutes ago means scrolling, squinting and scrolling again.

**msg-navigator** gives you a picker of every prompt you typed. Pick one and you are there, or grab the answer without ever scrolling to it.

<!-- Screenshots: add docs/picker.png and docs/card.png, then uncomment.
<p align="center">
  <img src="docs/picker.png" alt="The message picker" width="49%">
  <img src="docs/card.png" alt="A summary card above the prompt" width="49%">
</p>
-->

## ✨ Features

| Key | What it does |
| :---: | --- |
| **Enter** | **Jump** — scroll the transcript straight to that prompt |
| **`c`** | **Copy the response** — every text block the agent wrote for it, tool noise left out |
| **`a`** | **Copy all** — request and response as clean Markdown, ready to paste into a PR, doc or chat |
| **`r`** | **Summarize** — a detailed summary that keeps decisions, commands, paths and caveats, shown in a scrollable card and copied |
| **`t`** | **Translate** — English ⇄ Spanish, code and commands left untouched, shown and copied |
| **Esc** | Close the picker |

- 🗂️ **Every prompt, always** — the list comes from the conversation itself, so it survives plugin reloads and resumed sessions.
- ⌨️ **Keyboard first** — open it with your own shortcut (Option+U below) or `/jump`; the newest prompt is preselected.
- 🧼 **Out of your way** — a single `⇅` glyph in the footer, no extra rows.
- 🧠 **Uses your session** — summaries and translations run through your own Claude Code credentials, no API key to set up.

## 🚀 Install

At the prompt of a Claude Code session:

```
/plugin install msg-navigator --marketplace nmarmolejo/claude-code-msg-navigator
```

Or from a shell:

```sh
claude plugin install msg-navigator --marketplace nmarmolejo/claude-code-msg-navigator
```

Confirm adding the marketplace (`y`), pick a scope, and start a new session.

### Requirements

- **Claude Code 2.1.317 or newer**, with plugin hooks modules (built and tested on 2.1.317).
- **The fullscreen layout.** Jumping scrolls Claude Code's own transcript; in the main-screen layout the transcript lives in your terminal's scrollback, which no plugin can move. Copy, summarize and translate work in both.

## ⌨️ Keyboard shortcuts (recommended)

Plugins cannot register keys directly, so map two of Claude Code's own actions in `~/.claude/keybindings.json`:

```json
{
  "$schema": "https://www.schemastore.org/claude-code-keybindings.json",
  "$docs": "https://code.claude.com/docs/en/keybindings",
  "bindings": [
    {
      "context": "Global",
      "bindings": { "meta+u": "app:toggleReplTab" }
    },
    {
      "context": "Chat",
      "bindings": { "meta+i": "abovePrompt:focus" }
    }
  ]
}
```

| Shortcut | Action |
| --- | --- |
| **Option+U** | Open the picker (presses the `⇅` button in the footer) |
| **Option+I** | Focus the summary / translation card, then `j` / `k` to scroll and `x` to close |

> **macOS:** your terminal must send Option as Meta (Ghostty: `macos-option-as-alt = true`; iTerm2: *Profiles → Keys → Left Option key: Esc+*). Inside tmux, make sure `M-u` and `M-i` are not bound.

No shortcuts? `/jump` always opens the picker, `ctrl+x tab` focuses the card, and the mouse wheel scrolls it.

## 📖 Usage

1. Press **Option+U** (or type `/jump`).
2. Move with **↑ / ↓** — the newest prompt is selected.
3. Press **Enter** to jump, or **`c` / `a` / `r` / `t`** to copy, copy all, summarize or translate.

The summary / translation card appears above the prompt and its text is already on your clipboard. Typing in the prompt closes it.

## ⚙️ Configuration

Summaries and translations use **Sonnet** for fidelity on long technical answers. Each one is a single call billed to your session's account. Prefer faster and cheaper? Switch to Haiku:

| Setting | File |
| --- | --- |
| `SUMMARY_MODEL` | `hooks/summary.ts` |
| `TRANSLATION_MODEL` | `hooks/translation.ts` |
| `SHORTCUT_ACTION` (the action Option+U presses) | `hooks/register.tsx` |

## 🔍 How it works

- The picker reads your typed prompts from the conversation (`$.session.messages()`), slash commands left out.
- A jump scrolls the transcript to the message id the transcript drew that prompt under (`$.ui.scroll`).
- The `⇅` footer button carries an engine keybinding action, so its chord presses it from the prompt.
- Copy uses the same clipboard path as Claude Code's `/copy` (inside tmux, set `set -g set-clipboard on`).

## ⚠️ Limitations

- **Jumping needs the message to have been drawn** since the plugin loaded. After a reload or `--resume`, scroll near an older message once and it becomes jumpable; copy, summarize and translate always work.
- If you send the exact same prompt twice in a row, it is listed once.
- Plugins cannot tell `c` from `C`, so the copy actions use different letters.

## 🛠️ Development

```sh
git clone https://github.com/nmarmolejo/claude-code-msg-navigator
cd claude-code-msg-navigator
claude --plugin-dir .        # run a session with the plugin, hot-reloaded
claude plugin validate .     # manifest and hooks checks
claude plugin test .         # unit and render tests
```

Issues and pull requests are welcome.

## 📄 License

[MIT](LICENSE) © Nilson Marmolejo

<div align="center">

If msg-navigator saves you some scrolling, consider giving it a ⭐

</div>
