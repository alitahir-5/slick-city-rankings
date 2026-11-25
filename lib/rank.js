// Ranking rules shared by live checks and the weekly run.
export const SURFACE = 'dfs_local_finder';
export const weekId = (d = new Date()) => {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7;                 // Monday = 0
  x.setUTCDate(x.getUTCDate() - day);
  return x.toISOString().slice(0, 10);
};

export function places(result) {
  return ((result && result.items) || []).filter((i) => (i.type === 'local_pack' || i.type === 'maps_search') && !i.is_paid).slice(0, 20);
}

export function isPark(item, park) {
  const title = (item.title || '').toLowerCase();
  if (!title.includes('slick city')) return false;
  const blob = JSON.stringify(item).toLowerCase();
  const no = String(park.street_no || '').trim();
  if (no && new RegExp('(^|\\D)' + no + '\\s').test(blob)) return true;
  if (item.latitude && item.longitude) return Math.abs(item.latitude - park.lat) < 0.03 && Math.abs(item.longitude - park.lng) < 0.03;
  return blob.includes(park.park.split(',')[0].trim().toLowerCase());
}

export function rowFor(park, keyword, result, mode, week = weekId()) {
  const it = places(result);
  let rank;
  if (!result) rank = 'Error';
  else {
    const hit = it.findIndex((x) => isPark(x, park));
    rank = hit >= 0 ? String(hit + 1) : it.length >= 20 ? '20+' : 'Not listed';
  }
  return { week, park: park.park, keyword, rank, results: String(it.length), top3: it.slice(0, 3).map((x) => x.title || '').join(' | '),
    checked_at: new Date().toISOString().slice(0, 19) + 'Z', mode, surface: SURFACE };
}
