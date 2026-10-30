// Copies the agreement signing page (and the small files it imports) from the Portal into the client site
// (venue.northstarhouse.org), so couples sign on their own event page with the exact same page and rules.
// The Portal is the source: edit there, run  node scripts/sync-venue-portal-signing.mjs , then rebuild the venue site.
// (`--check` fails if the copy has drifted.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dest = path.resolve(root, '../venue-portal/src');
const files = ['venue-contracts.jsx', 'venue-contract-terms.js', 'venue-agreement-template.js', 'venue-code.js'];
const banner = (f) => '// GENERATED from north-star-portal/src/' + f + ' by scripts/sync-venue-portal-signing.mjs. Do not edit here.\n';
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
let drift = false;
for (const f of files) {
  if (f === 'venue-code.js') continue; // identical file already lives in the venue site
  const content = banner(f) + read(path.join(root, 'src', f));
  const target = path.join(dest, f);
  if (process.argv.includes('--check')) { if (!fs.existsSync(target) || read(target) !== content) { console.error('Drifted:', f); drift = true; } }
  else { fs.writeFileSync(target, content); console.log('wrote venue-portal/src/' + f); }
}
if (process.argv.includes('--check')) { if (drift) process.exit(1); console.log('Venue site copy matches the Portal.'); }
