// Runs after every build. Stamps a fresh cache-busting version into index.html's
// app.js script tag and sw.js's CACHE name, so a deploy is never accidentally served
// stale (previously this was a manually-maintained "?v=NNN" number that kept getting
// forgotten across deploys, causing the Portal to require a hard refresh to update).
const fs = require('fs');
const path = require('path');

const version = Date.now().toString();
const root = path.join(__dirname, '..');

const indexPath = path.join(root, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');
indexHtml = indexHtml.replace(/assets\/app\.js(\?v=[^"]*)?/, 'assets/app.js?v=' + version);
fs.writeFileSync(indexPath, indexHtml);

const swPath = path.join(root, 'sw.js');
let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replace(/var CACHE = '[^']*';/, "var CACHE = 'nsh-v" + version + "';");
sw = sw.replace(/'\/Portal\/assets\/app\.js(\?v=[^']*)?'/, "'/Portal/assets/app.js?v=" + version + "'");
fs.writeFileSync(swPath, sw);

console.log('Stamped cache-busting version ' + version + ' into index.html and sw.js');
