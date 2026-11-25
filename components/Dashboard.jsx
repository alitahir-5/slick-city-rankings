'use client';
import { useEffect, useMemo, useState } from 'react';
import { downloadXlsx } from '@/lib/xlsx';

// ---------- helpers ----------
const isRank = (v) => /^\d+$/.test(String(v ?? ''));
const num = (v) => (isRank(v) ? +v : 21);                     // 20+ and Not listed count as 21
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const fmt1 = (v) => (isFinite(v) ? v.toFixed(1) : '—');
const cls = (v) => { const n = isRank(v) ? +v : 99; return n <= 3 ? 'r1' : n <= 10 ? 'r2' : n <= 20 ? 'r3' : 'r4'; };
const clsAvg = (v) => (v <= 3 ? 'r1' : v <= 10 ? 'r2' : v <= 20 ? 'r3' : 'r4');
const TYPES = [['birthday party', 'Birthday party places'], ['date idea', 'Fun date ideas'], ['with kids', 'Things to do with kids'],
  ['fun things to do', 'Fun things to do'], ['indoor playground', 'Indoor playground'], ['amusement park', 'Amusement park']];
const GENERIC = new Set(['amusement park', 'indoor playground', 'birthday party places', 'fun date ideas']);
function classify(park, kw) {
  const k = kw.toLowerCase().trim();
  const type = (TYPES.find(([s]) => k.includes(s)) || [, 'Other'])[1];
  if (GENERIC.has(k)) return [type, 'Generic'];
  const city = park.split(',')[0].trim().toLowerCase().split(' ')[0];
  return [type, k.includes(city) ? 'City' : 'Metro'];
}
const dateLabel = (w) => new Date(w + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

// ---------- model ----------
function buildModel(rows, parks, history) {
  const order = new Map(); parks.forEach((p) => p.keywords.forEach((k, i) => order.set(p.park + '|' + k, i + 1)));
  const valid = rows.filter((r) => r.rank !== 'Error' && order.has(r.park + '|' + r.keyword));
  const byKey = new Map();
  for (const r of valid) { const k = r.park + '|' + r.keyword; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(r); }
  const current = [];
  for (const [k, list] of byKey) {
    list.sort((a, b) => a.checked_at.localeCompare(b.checked_at));
    const cur = list[list.length - 1];
    const prev = [...list].reverse().find((r) => r.week < cur.week);
    const [type, scope] = classify(cur.park, cur.keyword);
    current.push({ ...cur, key: k, order: order.get(k), type, scope, n: num(cur.rank), prev: prev ? prev.rank : null });
  }
  const weeks = [...new Set(valid.map((r) => r.week))].sort();
  const latestWeek = weeks[weeks.length - 1] || null;
  const parkRows = new Map(); current.forEach((r) => { if (!parkRows.has(r.park)) parkRows.set(r.park, []); parkRows.get(r.park).push(r); });
  const leaderboard = [...parkRows].map(([park, rs]) => ({
    park, id: parks.find((p) => p.park === park)?.id, avg: mean(rs.map((r) => r.n)), n1: rs.filter((r) => r.rank === '1').length,
    top3: rs.filter((r) => r.n <= 3).length, top20: rs.filter((r) => isRank(r.rank)).length, total: rs.length,
    prevAvg: rs.every((r) => r.prev !== null) ? mean(rs.map((r) => num(r.prev))) : null,
  })).sort((a, b) => a.avg - b.avg);
  const types = TYPES.map(([, t]) => t).map((t) => { const rs = current.filter((r) => r.type === t); return { type: t, avg: mean(rs.map((r) => r.n)), n1: rs.filter((r) => r.rank === '1').length, total: rs.length }; })
    .filter((t) => t.total).sort((a, b) => a.avg - b.avg);
  const comp = new Map();
  current.forEach((r) => (r.top3 || '').split(' | ').filter(Boolean).forEach((name) => {
    if (/slick city/i.test(name)) return;
    const e = comp.get(name) || { name, spots: 0, parks: new Set() }; e.spots++; e.parks.add(r.park); comp.set(name, e);
  }));
  const competitors = [...comp.values()].map((e) => ({ name: e.name, spots: e.spots, markets: e.parks.size })).sort((a, b) => b.spots - a.spots).slice(0, 25);
  // weekly trend per park: average of that week's checks
  const trend = new Map();
  valid.forEach((r) => { const k = r.park + '|' + r.week; if (!trend.has(k)) trend.set(k, new Map()); trend.get(k).set(r.keyword, num(r.rank)); });
  const parkTrend = (park) => weeks.map((w) => { const m = trend.get(park + '|' + w); return m ? { week: w, avg: mean([...m.values()]) } : null; }).filter(Boolean);
  // monthly averages (weeks starting in that month)
  const monthly = [];
  const mm = new Map();
  valid.forEach((r) => { const k = r.week.slice(0, 7) + '|' + r.park + '|' + r.keyword; if (!mm.has(k)) mm.set(k, new Map()); mm.get(k).set(r.week, r.rank); });
  for (const [k, wk] of mm) {
    const [month, park, keyword] = k.split('|'); const vals = [...wk.values()];
    const avg = vals.every((v) => v === 'Not listed') ? 'Not listed' : vals.every((v) => !isRank(v)) ? '20+' : mean(vals.map(num)).toFixed(1);
    monthly.push({ month, park, keyword, order: order.get(park + '|' + keyword), avg, weeks: vals.length, at1: vals.filter((v) => v === '1').length });
  }
  const oct = new Map(history.map((h) => [h.park + '|' + h.keyword, h.avg_rank]));
  const all = current.map((r) => r.n);
  return {
    current, leaderboard, types, competitors, parkTrend, monthly, oct, latestWeek, weeks,
    summary: { avg: mean(all), n1: current.filter((r) => r.rank === '1').length, top3: current.length ? Math.round(100 * current.filter((r) => r.n <= 3).length / current.length) : 0,
      top20: current.length ? Math.round(100 * current.filter((r) => isRank(r.rank)).length / current.length) : 0, parks: parkRows.size, searches: current.length,
      lastCheck: valid.reduce((m, r) => (r.checked_at > m ? r.checked_at : m), '') },
  };
}

// ---------- small components ----------
function Spark({ points }) {
  if (points.length < 2) return <span className="muted small">Trend appears after two weekly checks</span>;
  const W = 220, H = 48, max = 21, min = 1;
  const x = (i) => 4 + (i * (W - 8)) / (points.length - 1), y = (v) => 4 + ((v - min) * (H - 8)) / (max - min);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.avg).toFixed(1)}`).join(' ');
  return (<svg width={W} height={H} role="img" aria-label="Average rank by week (lower is better)"><path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
    {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.avg)} r="3"><title>{`${dateLabel(p.week)}: ${p.avg.toFixed(1)}`}</title></circle>)}</svg>);
}

function Change({ prev, cur }) {
  if (prev === null || prev === undefined) return <span className="muted">new</span>;
  const d = num(prev) - num(cur);
  if (!d) return <span className="muted">0</span>;
  return <span className={d > 0 ? 'up' : 'down'}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}</span>;
}

// ---------- dashboard ----------
export default function Dashboard() {
  const [data, setData] = useState(null); const [err, setErr] = useState('');
  const [tab, setTab] = useState('overview'); const [park, setPark] = useState(''); const [checking, setChecking] = useState(''); const [msg, setMsg] = useState('');
  const [user, setUser] = useState(''); const [q, setQ] = useState('');
  const load = () => fetch('/api/data', { cache: 'no-store' }).then((r) => (r.status === 401 ? (location.href = '/login') : r.json())).then(setData).catch(() => setErr('Could not load data.'));
  useEffect(() => { load(); try { setUser(localStorage.getItem('sc_user') || ''); } catch {} }, []);
  const m = useMemo(() => (data ? buildModel(data.rows, data.parks, data.history) : null), [data]);
  useEffect(() => { if (m && !park && m.leaderboard[0]) setPark(m.leaderboard[0].park); }, [m, park]);

  async function checkNow(p) {
    const target = data.parks.find((x) => x.park === p); if (!target) return;
    setChecking(p); setMsg('');
    const r = await fetch('/api/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parkId: target.id }) });
    const j = await r.json().catch(() => ({}));
    setChecking('');
    if (!r.ok) { setMsg(j.error || 'The check failed.'); return; }
    setMsg(`${p} checked: ${j.rows.length} keywords (cost $${j.cost}).`); setPark(p); setTab('park'); load();
  }
  async function logout() { await fetch('/api/logout', { method: 'POST' }); location.href = '/login'; }
  function exportXlsx() {
    const weekly = [['Week', 'Park', 'Keyword', 'Rank', 'Rank (20+ = 21)', 'Results', 'Top 3 in Google Places', 'Checked at (UTC)', 'Mode']]
      .concat(data.rows.filter((r) => r.rank !== 'Error').map((r) => [r.week, r.park, r.keyword, isRank(r.rank) ? +r.rank : r.rank, num(r.rank), +r.results || 0, r.top3, r.checked_at, r.mode]));
    const mon = [['Month', 'Park', 'Keyword', 'Avg rank', 'Weekly checks', 'Weeks at #1']]
      .concat([...m.monthly].sort((a, b) => a.month.localeCompare(b.month) || a.park.localeCompare(b.park) || a.order - b.order).map((r) => [r.month, r.park, r.keyword, isNaN(+r.avg) ? r.avg : +r.avg, r.weeks, r.at1]));
    const sum = [['Park', 'Avg rank', '#1', 'Top 3', 'Top 20', 'Keywords']].concat(m.leaderboard.map((r) => [r.park, +r.avg.toFixed(1), r.n1, r.top3, r.top20, r.total]));
    const lastMonth = m.monthly.reduce((x, r) => (r.month > x ? r.month : x), '');
    const byPark = new Map(); m.monthly.filter((r) => r.month === lastMonth).forEach((r) => { if (!byPark.has(r.park)) byPark.set(r.park, []); byPark.get(r.park).push(r); });
    const matrix = [['Park', 'All Keywords (Map Pack)', `Map Pack Avg Rank (${lastMonth})`, 'Map Pack Rank #1 Count']]
      .concat(data.parks.filter((p) => byPark.has(p.park)).map((p) => { const rs = byPark.get(p.park).sort((a, b) => a.order - b.order); return [p.park, rs.map((r) => r.keyword).join('\n'), rs.map((r) => r.avg).join('\n'), rs.filter((r) => r.avg === '1.0').length]; }));
    downloadXlsx(`Slick City Local Pack Rankings ${new Date().toISOString().slice(0, 10)}.xlsx`, [{ name: 'Weekly Log', rows: weekly }, { name: 'Monthly Averages', rows: mon }, { name: 'Park Summary', rows: sum }, { name: 'Matrix Column', rows: matrix }]);
  }

  if (err) return <main className="wrap"><p className="err">{err}</p></main>;
  if (!m) return <main className="wrap"><p className="muted">Loading rankings...</p></main>;
  const s = m.summary;
  const cols = [...new Set(m.current.map((r) => r.order))].sort((a, b) => a - b).map((o) => {
    const rs = m.current.filter((r) => r.order === o); const counts = new Map(); rs.forEach((r) => counts.set(r.type + '|' + r.scope, (counts.get(r.type + '|' + r.scope) || 0) + 1));
    const [type, scope] = [...counts].sort((a, b) => b[1] - a[1])[0][0].split('|'); return { o, type, scope };
  });
  const cell = new Map(m.current.map((r) => [r.park + '|' + r.order, r]));
  const lb = m.leaderboard.filter((r) => !q || r.park.toLowerCase().includes(q.toLowerCase()));
  const detail = m.current.filter((r) => r.park === park).sort((a, b) => a.order - b.order);
  const best = m.types[0], worst = m.types[m.types.length - 1];
  const unchecked = data.parks.filter((p) => !m.leaderboard.some((l) => l.park === p.park));

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <div className="brand"><span className="dot" />Admate &middot; Slick City</div>
          <h1>Local Pack Rankings</h1>
          <p className="muted">Google Search local pack position (1 to 3 is the map pack) for every park and keyword, searched from each park&apos;s location.
            {m.latestWeek && <> Latest week: <b>{dateLabel(m.latestWeek)}</b>.</>}</p>
        </div>
        <div className="actions">
          {user && <span className="muted small">Signed in as {user}</span>}
          <button className="btn" onClick={exportXlsx}>Download Excel</button>
          <button className="btn ghost" onClick={logout}>Sign out</button>
        </div>
      </header>

      {(!data.storage || !data.apiKey) && <div className="banner">Setup needed: {!data.apiKey && 'add DATAFORSEO_AUTH in Vercel settings. '}{!data.storage && 'connect a Vercel Blob store (showing starter data). '}</div>}
      {data.pending && data.pending.left > 0 && <div className="banner info">Weekly run in progress for {dateLabel(data.pending.week)}: {data.pending.left} searches still being collected.</div>}
      {msg && <div className="banner info">{msg}</div>}

      {best && <p className="lead">Slick City is <b>#1 for {s.n1}</b> of {s.searches} tracked searches across {s.parks} parks. Strongest: <b>{best.type}</b> (avg {fmt1(best.avg)}). Weakest: <b>{worst.type}</b> (avg {fmt1(worst.avg)}).</p>}

      <section className="tiles">
        <div className="card tile"><div className="lbl">Average rank</div><div className="big">{fmt1(s.avg)}</div><div className="small muted">Lower is better; 20+ counts as 21</div></div>
        <div className="card tile"><div className="lbl">Keywords at #1</div><div className="big">{s.n1}</div><div className="small muted">of {s.searches}</div></div>
        <div className="card tile"><div className="lbl">In the map pack (top 3)</div><div className="big">{s.top3}%</div><div className="small muted">of searches</div></div>
        <div className="card tile"><div className="lbl">In the top 20</div><div className="big">{s.top20}%</div><div className="small muted">of searches</div></div>
        <div className="card tile"><div className="lbl">Parks with data</div><div className="big">{s.parks}</div><div className="small muted">of {data.parks.length} live parks</div></div>
      </section>

      <nav className="tabs">
        {[['overview', 'Overview'], ['park', 'Park detail'], ['competitors', 'Competitors'], ['about', 'How it works']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'tab on' : 'tab'} onClick={() => setTab(k)}>{l}</button>))}
      </nav>

      {tab === 'overview' && (<>
        <section className="card">
          <h2>Every park, every keyword</h2>
          <p className="muted small">Current position. Click a park to open its detail. Hover a cell to see who ranks in the top 3.</p>
          <div className="scroll"><table className="heat"><thead><tr><th />{cols.map((c) => <th key={c.o}>{c.type}<div className="muted">{c.scope}</div></th>)}</tr></thead>
            <tbody>{m.leaderboard.map((l) => (<tr key={l.park}><td className="park"><button className="link" onClick={() => { setPark(l.park); setTab('park'); }}>{l.park}</button></td>
              {cols.map((c) => { const r = cell.get(l.park + '|' + c.o); return <td key={c.o} className={r ? cls(r.rank) : ''} title={r ? `${r.keyword}: ${r.rank}\nTop 3: ${r.top3}` : ''}>{r ? (r.rank === 'Not listed' ? 'NL' : r.rank) : ''}</td>; })}</tr>))}</tbody></table></div>
          <div className="legend"><span><i className="sw r1" />1 to 3 (map pack)</span><span><i className="sw r2" />4 to 10</span><span><i className="sw r3" />11 to 20</span><span><i className="sw r4" />20+ / not listed</span></div>
        </section>
        <div className="two">
          <section className="card">
            <div className="row between"><h2>Park leaderboard</h2><input className="search" placeholder="Filter parks" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="scroll"><table><thead><tr><th>Park</th><th className="num">Avg rank</th><th className="num">vs last week</th><th className="num">#1</th><th className="num">Top 3</th><th className="num">Top 20</th></tr></thead>
              <tbody>{lb.map((r) => (<tr key={r.park}><td><button className="link" onClick={() => { setPark(r.park); setTab('park'); }}>{r.park}</button></td>
                <td className="num"><span className={'pill ' + clsAvg(r.avg)}>{fmt1(r.avg)}</span></td>
                <td className="num">{r.prevAvg === null ? <span className="muted">new</span> : <span className={r.prevAvg - r.avg > 0 ? 'up' : r.prevAvg - r.avg < 0 ? 'down' : 'muted'}>{(r.prevAvg - r.avg > 0 ? '▲ ' : r.prevAvg - r.avg < 0 ? '▼ ' : '') + Math.abs(r.prevAvg - r.avg).toFixed(1)}</span>}</td>
                <td className="num">{r.n1}/{r.total}</td><td className="num">{r.top3}/{r.total}</td><td className="num">{r.top20}/{r.total}</td></tr>))}</tbody></table></div>
            {unchecked.length > 0 && <p className="muted small">{unchecked.length} parks not checked yet. They fill in after the first weekly run, or use Check now in Park detail.</p>}
          </section>
          <section className="card">
            <h2>Average rank by keyword type</h2><p className="muted small">All parks. Shorter bar is better.</p>
            <div className="bars">{m.types.map((t) => (<div key={t.type} className="bar"><span className="blabel">{t.type}</span>
              <span className="btrack"><span className={'bfill ' + clsAvg(t.avg)} style={{ width: `${(t.avg / 21) * 100}%` }} /></span><span className="bval">{fmt1(t.avg)}</span></div>))}</div>
          </section>
        </div>
      </>)}

      {tab === 'park' && (
        <section className="card">
          <div className="row between">
            <div><h2>{park || 'Pick a park'}</h2><p className="muted small">Each keyword&apos;s current position, change since the previous week, and October&apos;s value from the old tool.</p></div>
            <div className="row">
              <select value={park} onChange={(e) => setPark(e.target.value)}>{data.parks.map((p) => <option key={p.id} value={p.park}>{p.id}. {p.park}</option>)}</select>
              <button className="btn primary" disabled={!!checking || !park} onClick={() => checkNow(park)}>{checking === park ? 'Checking... (about 20s)' : 'Check now'}</button>
            </div>
          </div>
          {park && <div className="row" style={{ margin: '12px 0' }}><span className="muted small">Weekly average:</span><Spark points={m.parkTrend(park)} /></div>}
          {detail.length ? (<div className="scroll"><table><thead><tr><th>Keyword</th><th className="num">Rank</th><th className="num">Change</th><th className="num">Oct 2026 (old tool)</th><th>Top 3 in Google Places</th><th className="num">Checked</th></tr></thead>
            <tbody>{detail.map((r) => (<tr key={r.keyword}><td>{r.keyword}</td><td className="num"><span className={'pill ' + cls(r.rank)}>{r.rank}</span></td><td className="num"><Change prev={r.prev} cur={r.rank} /></td>
              <td className="num muted">{m.oct.get(r.park + '|' + r.keyword) || '—'}</td><td>{r.top3}</td><td className="num muted small">{r.checked_at.slice(0, 10)}</td></tr>))}</tbody></table></div>)
            : <p className="muted">No checks for this park yet. Press Check now to run its {data.parks.find((p) => p.park === park)?.keywords.length || 12} keywords.</p>}
        </section>)}

      {tab === 'competitors' && (
        <section className="card"><h2>Who shows up in the top 3</h2><p className="muted small">Businesses other than Slick City holding top-3 spots across current results.</p>
          <div className="scroll"><table><thead><tr><th>Business</th><th className="num">Top-3 spots</th><th className="num">Markets</th></tr></thead>
            <tbody>{m.competitors.map((c) => <tr key={c.name}><td>{c.name}</td><td className="num">{c.spots}</td><td className="num">{c.markets}</td></tr>)}</tbody></table></div></section>)}

      {tab === 'about' && (
        <section className="card prose"><h2>How the numbers work</h2><ul>
          <li>Each keyword is checked as a Google search from the park&apos;s coordinates, using DataForSEO&apos;s Google local finder data (desktop, top 20). Positions 1 to 3 are the map pack shown in search results; 4 to 20 are the rest of the Places list. Ads are skipped.</li>
          <li>Recorded value: 1 to 20; &quot;20+&quot; when 20 places show and the park isn&apos;t among them; &quot;Not listed&quot; when fewer than 20 show and the park isn&apos;t among them. Averages count both as 21.</li>
          <li>A full run of all {data.parks.length} parks happens every Monday morning (Pakistan time); results are collected over the following hours. Check now runs one park live.</li>
          <li>Monthly averages in the Excel file use every weekly check that started in that month. The Matrix Column sheet is ready to paste into the Local SEO Performance Matrix.</li>
          <li>&quot;Oct 2026 (old tool)&quot; comes from the Local SEO Performance Matrix and used a different method, so compare trends rather than exact numbers.</li>
        </ul>{s.lastCheck && <p className="muted small">Most recent check: {s.lastCheck.replace('T', ' ').slice(0, 16)} UTC.</p>}</section>)}
    </main>
  );
}
