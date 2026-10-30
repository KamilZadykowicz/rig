import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight, type Night } from './digest/types.js';
import { nightDigest, type NightDigest } from './digest/summary.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';
import { DigestPage } from './views/digest.js';

const nightPattern = /^\d{4}-\d{2}-\d{2}$/;

function digestsOnDisk(config: RigConfig): NightDigest[] {
  return readStatus(config)
    .nights.map((n) => readNight(config.runsDir, n))
    .filter((n): n is Night => n !== null)
    .map(nightDigest);
}

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} digests={digestsOnDisk(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const data = nightPattern.test(night) ? readNight(config.runsDir, night) : null;
    if (data === null) return c.text('night not found', 404);
    return c.html(
      <Layout title={`digest ${night}`} lane={lane()}>
        <DigestPage night={data} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    const data = nightPattern.test(night) ? readNight(config.runsDir, night) : null;
    if (data === null) return c.json({ error: 'night not found' }, 404);
    return c.json(data);
  });

  return app;
}
