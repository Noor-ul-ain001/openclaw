import { z } from "zod";

export const AutoApproveConfigSchema = z.object({
  enabled: z.boolean().default(true),
  allowlist: z.array(z.string()).default([]),
  sessionYoloDuration: z.string().default("1h"),
});

export type AutoApproveConfig = z.infer<typeof AutoApproveConfigSchema>;

const DURATION_RE = /^(\d+)(ms|s|m|h|d)$/;

const DURATION_MULTIPLIERS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseDuration(input: string): number | null {
  const match = DURATION_RE.exec(input.trim());
  if (!match) {
    return null;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  return value * DURATION_MULTIPLIERS[unit];
}
