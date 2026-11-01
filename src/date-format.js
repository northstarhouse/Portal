// Shows every plain date on the page written out, like "October 3, 2027", instead of 2027-10-03.
// Works on visible text only (never on inputs, text boxes, or anything being edited), and keeps watching as the page changes.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ISO_ALL = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const ISO_ONE = /\b\d{4}-\d{2}-\d{2}\b/;
const SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|CODE|PRE|NOSCRIPT)$/;

export function prettyDates(text) {
  return String(text).replace(ISO_ALL, (m, y, mo, d) => {
    const i = Number(mo) - 1, day = Number(d);
    return i < 0 || i > 11 || day < 1 || day > 31 ? m : MONTHS[i] + ' ' + day + ', ' + y;
  });
}

function sweep(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const hits = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (ISO_ONE.test(n.nodeValue)) hits.push(n);
  }
  for (const n of hits) {
    const el = n.parentElement;
    if (!el || SKIP.test(el.tagName) || el.isContentEditable || el.closest('[data-keep-iso]')) continue;
    n.nodeValue = prettyDates(n.nodeValue);
  }
}

export function installDateFormatter() {
  if (typeof window === 'undefined' || !window.MutationObserver || window.__nshDateFormatter) return;
  window.__nshDateFormatter = true;
  let queued = false;
  const run = () => { queued = false; try { sweep(document.body); } catch (e) { /* never break the page over a date */ } };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(run); } };
  const start = () => { new MutationObserver(queue).observe(document.body, { childList: true, subtree: true, characterData: true }); queue(); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
}
