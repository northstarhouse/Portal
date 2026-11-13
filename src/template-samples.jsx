// Venue Policies & Resources > Templates: "View sample" shows the real document each template produces, filled in for a
// made-up couple, using the same code the Portal uses for real clients (so the sample can never drift from the real thing).
import { prepareAgreementDraft, ContractPreview, contractPreviewStyle } from './venue-contracts.jsx';
import { openSamplePacket } from './site-packet.js';

// The reply sent when someone uses the docent (history) tour form to ask about a wedding or event.
// Used by the tour requests page to send it, and here for the sample.
export function docentVenueReplyText(first, isWedding) {
  return 'Hi' + (first ? ' ' + first : '') + ',\n\n' +
    'Thank you for your interest in North Star House! The form you filled out is for our historic docent tours, which focus on the history and architecture of the house.\n\n' +
    'To see North Star House as a ' + (isWedding ? 'wedding' : 'event') + ' venue, please book a free venue tour with our venue team instead. You\'ll see the spaces, talk through your plans, and we can check date availability for you. You can choose a time that works for you here:\n\n' +
    'https://www.northstarhouse.org/book-a-tour\n\n' +
    'We\'d love to show you around!\n\n' +
    'Warmly,\nThe North Star House Venue Team';
}

const isoIn = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toLocaleDateString('en-CA'); };

function sampleContract() {
  const eventDate = isoIn(240);
  const client = {
    name: 'Alex Sample & Jordan Sample',
    eventDate,
    contacts: [
      { id: 'form-0', full_name: 'Alex Sample', email: 'alex.sample@example.com' },
      { id: 'form-1', full_name: 'Jordan Sample', email: 'jordan.sample@example.com' },
    ],
    signatures: null,
    maxGuests: '150',
    total: 580000,
    currency: 'USD',
    schedule: [
      { label: 'Booking payment', cents: 80000, currency: 'USD' },
      { label: 'Second payment', cents: 210000, currency: 'USD', due: isoIn(240 - 150) },
      { label: 'Final payment', cents: 210000, currency: 'USD', due: isoIn(240 - 90) },
      { label: 'Refundable Security Deposit', cents: 80000, currency: 'USD', due: isoIn(240 - 30), deposit: true },
    ],
  };
  return prepareAgreementDraft(client, { guestCount: '150' });
}

// Which sample a template row gets: data.sample if set, otherwise matched from its title.
export function sampleKindFor(r) {
  const d = r.data || {};
  if (d.sample) return d.sample;
  const t = String(r.title || '');
  if (/site manager packet/i.test(t)) return 'site-packet';
  if (/contract|agreement/i.test(t)) return 'contract';
  if (/docent tour request/i.test(t)) return 'docent-reply';
  return null;
}

// Opens the sample: the Site Manager packet opens in its own printable window, the others in a modal.
export function openTemplateSample(kind, setModal) {
  if (kind === 'site-packet') { openSamplePacket(); return; }
  setModal(kind);
}

export function TemplateSampleModal({ kind, onClose }) {
  const GOLD = '#886c44';
  let title = 'Sample', content = null;
  if (kind === 'contract') {
    const draft = sampleContract();
    title = 'Sample wedding rental agreement';
    content = <><style>{contractPreviewStyle}</style><ContractPreview body={draft.body} /></>;
  } else if (kind === 'docent-reply') {
    title = 'Sample email: docent tour request → venue tour reply';
    content = (
      <div>
        <div style={{ fontSize: 12, color: '#777', marginBottom: 10, lineHeight: 1.7 }}>
          <div><b>From:</b> venue@northstarhouse.org</div>
          <div><b>To:</b> alex.sample@example.com</div>
          <div><b>Subject:</b> Your North Star House tour request</div>
        </div>
        <div style={{ background: '#fdfbf7', border: '1px solid #ece4d8', borderRadius: 8, padding: '18px 20px', fontSize: 14, lineHeight: 1.65, color: '#333', whiteSpace: 'pre-wrap' }}>{docentVenueReplyText('Alex', true)}</div>
      </div>
    );
  }
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(40,30,15,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-label={title} style={{ background: '#fff', borderRadius: 14, maxWidth: 820, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#2a2a2a', fontFamily: "'Cardo', serif" }}>{title}</div>
          <a onClick={onClose} style={{ cursor: 'pointer', color: GOLD, fontSize: 13, fontWeight: 600 }}>Close ×</a>
        </div>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 14 }}>Filled in for a made-up couple, using the same template real clients get.</div>
        {content}
      </div>
    </div>
  );
}
