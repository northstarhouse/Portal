// Venue code = the wedding date written like DEC-28-2026. Formats what a client types as they type:
// capitalizes, drops stray characters, and inserts the hyphens. Numeric dates (12/28/2026) become 12-28-2026,
// and a pasted year-first date (2026-12-28) becomes DEC-28-2026.
// `typingForward` is false when the field just got shorter (backspace), so a trailing hyphen isn't re-added.
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function formatVenueCode(raw, typingForward = true) {
  const iso = String(raw || '').trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso && MONTHS[+iso[2] - 1]) return MONTHS[+iso[2] - 1] + '-' + iso[3].padStart(2, '0') + '-' + iso[1];
  const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const lead = (s.match(/^[A-Z]*/) || [''])[0];
  const digits = s.slice(lead.length).replace(/[^0-9]/g, '');
  const [a, b, c] = lead
    ? [lead.slice(0, 3), digits.slice(0, 2), digits.slice(2, 6)]
    : [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)];
  let out = a;
  if (b) out += '-' + b; else if (typingForward && a.length === (lead ? 3 : 2)) out += '-';
  if (c) out += '-' + c; else if (b && typingForward && b.length === 2) out += '-';
  return out;
}
