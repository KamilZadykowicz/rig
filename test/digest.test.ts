import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/types.js';

const tmpDirs: string[] = [];

function tmpRuns(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  tmpDirs.push(dir);
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

describe('readNight on the real fixture', () => {
  const night = readNight('runs', '2026-10-28');

  it('reads five jobs and counts one bad line', () => {
    expect(night).not.toBeNull();
    expect(night!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night!.badLines).toBe(1);
  });

  it('aggregates runs, retries and times per job', () => {
    const sync = night!.rows.find((r) => r.job === 'lane/sync')!;
    expect(sync.owner).toBe('rook');
    expect(sync.runs).toBe(8);
    expect(sync.retries).toBe(1);
    expect(sync.lastStatus).toBe('ok');
    expect(sync.lastError).toBeNull();
    expect(sync.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(sync.lastAt).toBe('2026-10-29T05:00:04+01:00');
  });

  it('keeps the last status and error of a failing job', () => {
    const backup = night!.rows.find((r) => r.job === 'notes/backup')!;
    expect(backup.runs).toBe(1);
    expect(backup.lastStatus).toBe('fail');
    expect(backup.lastError).toBe('quota exceeded');
  });

  it('shows a null owner as an em dash', () => {
    const render = night!.rows.find((r) => r.job === 'digest/render')!;
    expect(render.owner).toBe('—');
  });
});

describe('readNight on synthetic fixtures', () => {
  it('counts a bad line and still renders the night', () => {
    const dir = tmpRuns({
      '2026-01-01.jsonl': [
        '{"at":"2026-01-01T01:00:00+01:00","job":"a/job","status":"ok","owner":"rook"}',
        'not json at all',
        '{"at":"2026-01-01T02:00:00+01:00","job":"a/job","status":"fail","owner":"rook","error":"boom"}',
      ].join('\n'),
    });
    const night = readNight(dir, '2026-01-01')!;
    expect(night.badLines).toBe(1);
    expect(night.rows).toHaveLength(1);
    expect(night.rows[0].runs).toBe(2);
    expect(night.rows[0].lastStatus).toBe('fail');
  });

  it('renders an empty file as a night with no rows', () => {
    const dir = tmpRuns({ '2026-01-02.jsonl': '' });
    const night = readNight(dir, '2026-01-02')!;
    expect(night.rows).toEqual([]);
    expect(night.badLines).toBe(0);
  });

  it('returns null for a night that does not exist', () => {
    const dir = tmpRuns({});
    expect(readNight(dir, '1999-12-31')).toBeNull();
  });
});
