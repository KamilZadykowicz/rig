import { readFileSync } from 'node:fs';

export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  rows: DigestRow[];
  badLines: number;
};

export function readNight(runsDir: string, night: string): Night | null {
  let text: string;
  try {
    text = readFileSync(`${runsDir}/${night}.jsonl`, 'utf8');
  } catch {
    return null;
  }

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;

  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const entry = parseLine(line);
    if (entry === null) {
      badLines += 1;
      continue;
    }
    const row = byJob.get(entry.job);
    if (row) {
      row.runs += 1;
      if (entry.status === 'retry') row.retries += 1;
      row.lastStatus = entry.status;
      row.lastError = entry.error;
      row.lastAt = entry.at;
    } else {
      byJob.set(entry.job, {
        job: entry.job,
        owner: entry.owner ?? '—',
        runs: 1,
        retries: entry.status === 'retry' ? 1 : 0,
        lastStatus: entry.status,
        lastError: entry.error,
        firstAt: entry.at,
        lastAt: entry.at,
      });
    }
  }

  return {
    night,
    rows: [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0)),
    badLines,
  };
}

type Entry = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error: string | null;
};

function parseLine(line: string): Entry | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { at, job, status, owner, error } = value as Record<string, unknown>;
  if (typeof at !== 'string' || at === '') return null;
  if (typeof job !== 'string' || job === '') return null;
  if (status !== 'ok' && status !== 'retry' && status !== 'fail') return null;
  if (typeof owner !== 'string' && owner !== null) return null;
  if (typeof error !== 'string' && error !== undefined) return null;
  return { at, job, status, owner, error: typeof error === 'string' ? error : null };
}
