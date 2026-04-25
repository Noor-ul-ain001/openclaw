import { minimatch } from "minimatch";
import type { PluginLogger } from "openclaw/plugin-sdk/plugin-entry";
import { parseDuration } from "./config.js";

export type SessionYoloState = {
  active: boolean;
  expiresAtMs: number | null;
};

const sessionState: SessionYoloState = {
  active: false,
  expiresAtMs: null,
};

let yoloTimer: ReturnType<typeof setTimeout> | null = null;

export function getSessionState(): Readonly<SessionYoloState> {
  if (
    sessionState.active &&
    sessionState.expiresAtMs !== null &&
    Date.now() >= sessionState.expiresAtMs
  ) {
    disableYoloMode();
  }
  return { ...sessionState };
}

export function enableYoloMode(duration?: string): {
  ok: boolean;
  expiresAtMs: number | null;
  error?: string;
} {
  if (yoloTimer) {
    clearTimeout(yoloTimer);
    yoloTimer = null;
  }

  let expiresAtMs: number | null = null;

  if (duration) {
    const ms = parseDuration(duration);
    if (ms === null) {
      return {
        ok: false,
        expiresAtMs: null,
        error: `Invalid duration: "${duration}". Use formats like 30m, 1h, 2d.`,
      };
    }
    expiresAtMs = Date.now() + ms;
    yoloTimer = setTimeout(() => {
      disableYoloMode();
    }, ms);
  }

  sessionState.active = true;
  sessionState.expiresAtMs = expiresAtMs;
  return { ok: true, expiresAtMs };
}

export function disableYoloMode(): void {
  if (yoloTimer) {
    clearTimeout(yoloTimer);
    yoloTimer = null;
  }
  sessionState.active = false;
  sessionState.expiresAtMs = null;
}

export function isCommandAutoApproved(
  command: string,
  allowlist: readonly string[],
  logger: PluginLogger,
): boolean {
  const state = getSessionState();
  if (state.active) {
    logger.info(`[autoapprove] YOLO mode active — auto-approved: ${command}`);
    return true;
  }

  if (allowlist.length === 0) {
    return false;
  }

  const executable = command.trim();
  if (!executable) {
    return false;
  }

  if (allowlist.some((pattern) => minimatch(executable, pattern))) {
    logger.info(`[autoapprove] Allowlist match — auto-approved: ${executable}`);
    return true;
  }

  return false;
}

export type PendingApproval = {
  id: string;
  command: string;
  createdAtMs: number;
  resolve: (decision: string) => void;
};

const pendingApprovals = new Map<string, PendingApproval>();

export function addPendingApproval(approval: PendingApproval): void {
  pendingApprovals.set(approval.id, approval);
}

export function removePendingApproval(id: string): void {
  pendingApprovals.delete(id);
}

export function getPendingApprovals(): PendingApproval[] {
  return Array.from(pendingApprovals.values());
}

export function approveAllPending(logger: PluginLogger): number {
  const pending = getPendingApprovals();
  let count = 0;
  for (const approval of pending) {
    logger.info(`[autoapprove] Bulk approved: ${approval.command} (id: ${approval.id})`);
    approval.resolve("allow-once");
    pendingApprovals.delete(approval.id);
    count++;
  }
  return count;
}

export function clearAllPending(): void {
  pendingApprovals.clear();
}
