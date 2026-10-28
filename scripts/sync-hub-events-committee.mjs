// Mirrors the Volunteer Hub's Events Committee page into the Portal, so the two sister apps show and edit the same
// thing from the same database. The Hub is the source: edit it there, then run
//     node scripts/sync-hub-events-committee.mjs
// and rebuild the Portal. (`--check` fails if the copy has drifted.)
//
// Copied as-is (src/hub/...): the page, its area-planning tab, and the Hub's data layer.
// Adapters only: the Hub's Vite env variables become the Portal's Supabase URL and key, and the Hub's stylesheet is
// scoped under .hub-scope so it cannot touch the rest of the Portal.
// Hand-written stand-ins live next to them: react-shim.js, supabase.js, App.jsx, pages/EventOverviews.jsx, entry.jsx.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hub = path.resolve(root, '../volunteerhub/src');
const out = path.join(root, 'src/hub');
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const SUPABASE_URL = 'https://uvzwhhwzelaelfhfkvdb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do';
const banner = (file) => `// GENERATED from volunteerhub/src/${file} by scripts/sync-hub-events-committee.mjs. Do not edit here: change it in the Hub, then re-run the script.\n`;

const files = {};

files['pages/EventsCommittee.jsx'] = banner('pages/EventsCommittee.jsx') + read(path.join(hub, 'pages/EventsCommittee.jsx'));
files['pages/eventsCommitteeAreas.jsx'] = banner('pages/eventsCommitteeAreas.jsx') + read(path.join(hub, 'pages/eventsCommitteeAreas.jsx'));

let db = read(path.join(hub, 'lib/db.js'));
const envUrl = 'import.meta.env.VITE_SUPABASE_URL';
const envKey = 'import.meta.env.VITE_SUPABASE_ANON_KEY';
if (!db.includes(envUrl) || !db.includes(envKey)) throw new Error('db.js env variables not found; update the adapter.');
db = db.replace(envUrl, JSON.stringify(SUPABASE_URL)).replace(envKey, JSON.stringify(SUPABASE_KEY));
if (db.includes('import.meta.env')) throw new Error('db.js uses another import.meta.env value; update the adapter.');
files['lib/db.js'] = banner('lib/db.js') + db;

// Hub stylesheet -> .hub-scope (variables, base text, and the shared classes). Media queries and the Hub's own
// dashboard / Event Overviews layout rules are not needed here.
function scopedCss(css) {
  css = css.replace(/@import[^;]*;/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  css = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const rules = [];
  css.replace(/([^{}]+)\{([^{}]*)\}/g, (_, sel, body) => {
    sel = sel.trim();
    if (!sel || /portal-event|dashboard-grid/.test(sel)) return '';
    if (sel === ':root') { rules.push(`.hub-scope {${body}}`); return ''; }
    if (sel === 'body') { rules.push(`.hub-scope {${body}}`); return ''; }
    if (sel === '*') { rules.push('.hub-scope, .hub-scope * { box-sizing: border-box; }'); return ''; }
    const scoped = sel.split(',').map((s) => `.hub-scope ${s.trim()}`).join(', ');
    rules.push(`${scoped} {${body}}`);
    return '';
  });
  return rules.join('\n');
}
files['hubStyles.js'] = `${banner('index.css')}export default ${JSON.stringify(scopedCss(read(path.join(hub, 'index.css'))))};\n`;

let drift = false;
for (const [rel, content] of Object.entries(files)) {
  const dest = path.join(out, rel);
  if (process.argv.includes('--check')) {
    const have = fs.existsSync(dest) ? read(dest) : '';
    if (have !== content) { console.error('Drifted from the Hub:', rel); drift = true; }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
    console.log('wrote src/hub/' + rel);
  }
}
if (process.argv.includes('--check')) {
  if (drift) process.exit(1);
  console.log('Portal copy matches the Volunteer Hub source.');
}
