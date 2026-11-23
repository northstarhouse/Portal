// Admin > House Operations > Human Resources. A placeholder page until its content is decided.
const GOLD = '#886c44';

export function HumanResourcesView({ navigate }) {
  return <div style={{ maxWidth: 820, paddingBottom: 40 }}>
    <div style={{ borderBottom: '1.5px solid ' + GOLD, paddingBottom: 14, marginBottom: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 2 }}>House operations</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#2c2418', fontFamily: "'Cardo', Georgia, serif", marginTop: 2 }}>Human Resources</div>
    </div>
    <div style={{ background: '#fff', border: '0.5px solid #e6dfd3', borderRadius: 14, padding: '34px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(60,45,20,0.04)' }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#2c2418', fontFamily: "'Cardo', Georgia, serif", marginBottom: 6 }}>Nothing here yet</div>
      <div style={{ fontSize: 13, color: '#8a7e6b', lineHeight: 1.5 }}>This page is ready for its content.</div>
    </div>
  </div>;
}
