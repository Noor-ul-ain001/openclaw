import type {
  OpenClawPluginApi,
  OpenClawPluginCommandDefinition,
} from "openclaw/plugin-sdk/plugin-entry";
import {
  approveAllPending,
  disableYoloMode,
  enableYoloMode,
  getPendingApprovals,
  getSessionState,
} from "./autoApprove.js";
import type { AutoApproveConfig } from "./config.js";

function formatExpiry(expiresAtMs: number | null): string {
  if (expiresAtMs === null) {
    return "no expiry (until `/autoapprove off`)";
  }
  const remaining = expiresAtMs - Date.now();
  if (remaining <= 0) {
    return "expired";
  }
  const minutes = Math.ceil(remaining / 60_000);
  if (minutes < 60) {
    return `${minutes}m remaining`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m remaining` : `${hours}h remaining`;
}

export function registerCommands(api: OpenClawPluginApi, getConfig: () => AutoApproveConfig): void {
  const autoapproveCommand: OpenClawPluginCommandDefinition = {
    name: "autoapprove",
    description: "Manage auto-approval: on/off/status/add pattern",
    acceptsArgs: true,
    handler: (ctx) => {
      const args = (ctx.args ?? "").trim();
      const config = getConfig();

      if (!args || args === "status") {
        return handleStatus(config);
      }

      const [subcommand, ...rest] = args.split(/\s+/);
      const subArgs = rest.join(" ").trim();

      switch (subcommand.toLowerCase()) {
        case "on":
          return handleOn(subArgs || config.sessionYoloDuration);
        case "off":
          return handleOff();
        case "add":
          return handleAdd(subArgs, config);
        case "status":
          return handleStatus(config);
        default:
          return {
            text: `Unknown subcommand: \`${subcommand}\`. Use \`on\`, \`off\`, \`status\`, or \`add <pattern>\`.`,
          };
      }
    },
  };

  const approveAllCommand: OpenClawPluginCommandDefinition = {
    name: "approve-all",
    description: "Approve all currently pending exec requests",
    acceptsArgs: false,
    handler: () => {
      const count = approveAllPending(api.logger);
      if (count === 0) {
        return { text: "No pending approval requests." };
      }
      return { text: `Approved ${count} pending request${count === 1 ? "" : "s"}.` };
    },
  };

  api.registerCommand(autoapproveCommand);
  api.registerCommand(approveAllCommand);
}

function handleOn(durationStr: string): { text: string } {
  const result = enableYoloMode(durationStr);
  if (!result.ok) {
    return { text: result.error! };
  }
  const expiryText = formatExpiry(result.expiresAtMs);
  return { text: `Auto-approve YOLO mode **enabled** (${expiryText}).` };
}

function handleOff(): { text: string } {
  disableYoloMode();
  return { text: "Auto-approve YOLO mode **disabled**." };
}

function handleAdd(pattern: string, config: AutoApproveConfig): { text: string } {
  if (!pattern) {
    return { text: "Usage: `/autoapprove add <pattern>` (e.g. `git *`, `npm run *`)." };
  }
  if (config.allowlist.includes(pattern)) {
    return { text: `Pattern \`${pattern}\` is already in the allowlist.` };
  }
  config.allowlist.push(pattern);
  return {
    text: `Added \`${pattern}\` to the session allowlist. (${config.allowlist.length} pattern${config.allowlist.length === 1 ? "" : "s"} total)`,
  };
}

function handleStatus(config: AutoApproveConfig): { text: string } {
  const state = getSessionState();
  const pending = getPendingApprovals();

  const lines: string[] = [
    `**Auto-approve status**`,
    `- Enabled: ${config.enabled ? "yes" : "no"}`,
    `- YOLO mode: ${state.active ? `active (${formatExpiry(state.expiresAtMs)})` : "off"}`,
    `- Allowlist (${config.allowlist.length}):`,
  ];

  if (config.allowlist.length > 0) {
    for (const pattern of config.allowlist) {
      lines.push(`  - \`${pattern}\``);
    }
  } else {
    lines.push("  _(empty)_");
  }

  lines.push(`- Pending approvals: ${pending.length}`);
  if (pending.length > 0) {
    for (const p of pending) {
      lines.push(`  - \`${p.command}\` (id: ${p.id})`);
    }
  }

  return { text: lines.join("\n") };
}
