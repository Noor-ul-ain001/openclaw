# @openclaw/plugin-autoapprove

OpenClaw plugin that simplifies the exec approval process (Issue #59510).

## Features

- **Allowlist-based auto-approval** — define trusted command patterns in your config. Matching commands are auto-approved without prompting.
- **Session-scoped YOLO mode** — temporarily disable all approval prompts for the current session.
- **Bulk approval** — approve all pending exec requests in one action.

## Configuration

Add to your `openclaw.json`:

```json
{
  "plugins": {
    "autoapprove": {
      "enabled": true,
      "allowlist": ["git *", "npm run *", "ls *", "cat *", "echo *"],
      "sessionYoloDuration": "1h"
    }
  }
}
```

### Config fields

| Field                 | Type       | Default | Description                              |
| --------------------- | ---------- | ------- | ---------------------------------------- |
| `enabled`             | `boolean`  | `true`  | Master switch for the plugin             |
| `allowlist`           | `string[]` | `[]`    | Glob patterns for auto-approved commands |
| `sessionYoloDuration` | `string`   | `"1h"`  | Default duration for YOLO mode           |

Patterns use [minimatch](https://github.com/isaacs/minimatch) glob syntax.

## Slash commands

| Command                      | Description                               |
| ---------------------------- | ----------------------------------------- |
| `/autoapprove on [duration]` | Enable YOLO mode (e.g. `1h`, `30m`)       |
| `/autoapprove off`           | Disable YOLO mode                         |
| `/autoapprove status`        | Show current mode, allowlist, and pending |
| `/autoapprove add <pattern>` | Add a pattern to the session allowlist    |
| `/approve-all`               | Approve all pending exec requests         |

## Security

Every auto-approved command is logged to the gateway log with the `[autoapprove]` prefix, including which rule matched (allowlist pattern or YOLO mode).

## How it works

The plugin hooks into `before_tool_call` and intercepts exec/shell/bash/terminal tool calls. If the command matches an allowlist pattern or YOLO mode is active, the plugin returns immediately without requesting approval. Otherwise, the normal approval flow proceeds.
