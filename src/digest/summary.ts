import type { Night } from './types.js';

export type NightDigest = { night: string; ok: number; retry: number; fail: number };

export function nightDigest(night: Night): NightDigest {
  return {
    night: night.night,
    ok: night.rows.filter((r) => r.lastStatus === 'ok').length,
    retry: night.rows.filter((r) => r.lastStatus === 'retry').length,
    fail: night.rows.filter((r) => r.lastStatus === 'fail').length,
  };
}
