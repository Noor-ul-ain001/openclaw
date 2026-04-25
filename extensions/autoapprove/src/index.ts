import { definePluginEntry, buildPluginConfigSchema } from "openclaw/plugin-sdk/plugin-entry";
import { isCommandAutoApproved, clearAllPending } from "./autoApprove.js";
import { registerCommands } from "./commands.js";
import { AutoApproveConfigSchema, type AutoApproveConfig } from "./config.js";

let activeConfig: AutoApproveConfig = AutoApproveConfigSchema.parse({});

export default definePluginEntry({
  id: "autoapprove",
  name: "Auto-Approve",
  description:
    "Allowlist-based auto-approval, session YOLO mode, and bulk approval for exec requests",
  configSchema: buildPluginConfigSchema(AutoApproveConfigSchema),

  register(api) {
    const pluginConfig = api.pluginConfig as Partial<AutoApproveConfig> | undefined;
    activeConfig = AutoApproveConfigSchema.parse(pluginConfig ?? {});

    registerCommands(api, () => activeConfig);

    api.on("before_tool_call", (event, _ctx) => {
      if (!activeConfig.enabled) {
        return;
      }

      const toolName = event.toolName;
      if (
        toolName !== "exec" &&
        toolName !== "shell" &&
        toolName !== "bash" &&
        toolName !== "terminal"
      ) {
        return;
      }

      const command = (event.params.command as string | undefined) ?? "";
      if (!command) {
        return;
      }

      if (isCommandAutoApproved(command, activeConfig.allowlist, api.logger)) {
        return { params: event.params };
      }
    });

    api.on("session_end", () => {
      clearAllPending();
    });
  },
});
