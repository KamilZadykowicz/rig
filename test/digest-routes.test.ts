import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const tmpDirs: string[] = [];

function tmpRuns(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  tmpDirs.push(dir);
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

function app(runsDir: string) {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

const oneNight = [
  '{"at":"2026-01-01T01:00:00+01:00","job":"a/job","status":"ok","owner":"rook"}',
  '{"at":"2026-01-01T02:00:00+01:00","job":"a/job","status":"fail","owner":"rook","error":"boom"}',
].join('\n');

describe('GET /digest/:night', () => {
  it('renders an existing night with its rows', async () => {
    const res = await app(tmpRuns({ '2026-01-01.jsonl': oneNight })).request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest · 2026-01-01');
    expect(html).toContain('a/job');
    expect(html).toContain('boom');
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app(tmpRuns({})).request('/digest/1999-12-31');
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('night not found');
  });

  it('returns 404 for a night name that is not a date', async () => {
    const res = await app(tmpRuns({})).request('/digest/evil');
    expect(res.status).toBe(404);
  });

  it('renders the empty night as nothing ran', async () => {
    const res = await app(tmpRuns({ '2026-01-02.jsonl': '' })).request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('renders a night with a bad line and says it was skipped', async () => {
    const res = await app(tmpRuns({ '2026-01-03.jsonl': `${oneNight}\nnot json at all` })).request(
      '/digest/2026-01-03',
    );
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('a/job');
    expect(html).toContain('1 bad line skipped');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the rows of an existing night', async () => {
    const res = await app(tmpRuns({ '2026-01-01.jsonl': oneNight })).request('/api/digest/2026-01-01');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      night: '2026-01-01',
      badLines: 0,
      rows: [
        {
          job: 'a/job',
          owner: 'rook',
          runs: 2,
          retries: 0,
          lastStatus: 'fail',
          lastError: 'boom',
          firstAt: '2026-01-01T01:00:00+01:00',
          lastAt: '2026-01-01T02:00:00+01:00',
        },
      ],
    });
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app(tmpRuns({})).request('/api/digest/1999-12-31');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'night not found' });
  });

  it('returns an empty night with no rows', async () => {
    const res = await app(tmpRuns({ '2026-01-02.jsonl': '' })).request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-01-02', badLines: 0, rows: [] });
  });

  it('counts a bad line and still returns the night', async () => {
    const res = await app(tmpRuns({ '2026-01-03.jsonl': `${oneNight}\nnot json at all` })).request(
      '/api/digest/2026-01-03',
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.badLines).toBe(1);
    expect(data.rows).toHaveLength(1);
  });
});
