import type { NightDigest } from '../digest/summary.js';
import type { Status } from '../status.js';

export function StatusBoard({ status, digests }: { status: Status; digests: NightDigest[] }) {
  return (
    <>
      <h1>status</h1>
      <table>
        <tbody>
          <tr><th>adapter</th><td>{status.adapter}</td></tr>
          <tr><th>installed</th><td>{status.installed}</td></tr>
          <tr>
            <th>last beat</th>
            <td>{status.lastBeat ? `${status.lastBeat.at} · pid ${status.lastBeat.pid}` : <span class="warn">none</span>}</td>
          </tr>
        </tbody>
      </table>
      <h2>nights on disk</h2>
      {digests.length === 0 ? (
        <p class="mute">nothing in runs/</p>
      ) : (
        <ul>
          {digests.map((d) => (
            <li>
              <a href={`/digest/${d.night}`}>{d.night}</a>
              {' · ok '}
              {d.ok}
              {' · retry '}
              {d.retry}
              {' · fail '}
              {d.fail > 0 ? <span class="warn">{d.fail}</span> : d.fail}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
