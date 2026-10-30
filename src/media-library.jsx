// Website photo library for the Portal (Cloudflare Images via the site-media function).
// Photos are shrunk in the browser before upload, and the website asks Cloudflare for the size each page needs.
const GOLD = '#886c44';
const MAX_SIDE = 2400;

export function mediaClient(supabaseUrl, supabaseKey) {
  const headers = { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey };
  async function call(init) {
    const r = await fetch(supabaseUrl + '/functions/v1/site-media', { method: 'POST', ...init });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || out.error) throw new Error(out.error || 'Request failed (' + r.status + ')');
    return out;
  }
  return {
    list: (page) => call({ headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list', page }) }),
    remove: (id) => call({ headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) }),
    upload: async (file) => {
      const small = await shrink(file);
      const form = new FormData();
      form.set('action', 'upload'); form.set('file', small, small.name); form.set('name', file.name);
      return (await call({ headers, body: form })).image;
    },
  };
}

// Phone photos run 5-10 MB; scale to 2400px on the long side and re-save as JPEG. GIFs and SVGs pass through.
export async function shrink(file) {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !/\.(jpe?g|png|webp|heic)$/i.test(file.name)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.86));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (e) { return file; }
}

const btn = (primary) => ({ background: primary ? GOLD : '#fff', color: primary ? '#fff' : GOLD, border: '1px solid ' + GOLD, borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' });

// Grid of photos with upload. With onPick it is a chooser; without it, a library with copy-link and delete.
function MediaGrid({ supabaseUrl, supabaseKey, onPick }) {
  const api = React.useMemo(() => mediaClient(supabaseUrl, supabaseKey), [supabaseUrl, supabaseKey]);
  const [images, setImages] = React.useState(null);
  const [page, setPage] = React.useState(1);
  const [more, setMore] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [busy, setBusy] = React.useState(0);
  const [err, setErr] = React.useState('');
  const [copied, setCopied] = React.useState('');
  const fileRef = React.useRef(null);

  function load(p) {
    api.list(p).then((o) => { setImages((prev) => (p === 1 ? o.images : (prev || []).concat(o.images))); setPage(p); setMore(o.more); }).catch((e) => { setImages((prev) => prev || []); setErr(e.message); });
  }
  React.useEffect(() => { load(1); }, []);

  async function upload(files) {
    setErr('');
    for (const f of Array.from(files || [])) {
      if (!/^image\//.test(f.type)) { setErr(f.name + ' is not a photo.'); continue; }
      setBusy((n) => n + 1);
      try {
        const img = await api.upload(f);
        setImages((prev) => [{ ...img, thumb: img.url.replace(/\/public$/, '/w=320,fit=scale-down,q=70') }].concat(prev || []));
      } catch (e) { setErr(e.message); }
      setBusy((n) => n - 1);
    }
  }
  async function remove(img) {
    if (!window.confirm('Delete this photo? Pages that use it will show a broken image.')) return;
    try { await api.remove(img.id); setImages((prev) => prev.filter((i) => i.id !== img.id)); } catch (e) { setErr(e.message); }
  }
  function copy(img) {
    const done = () => { setCopied(img.id); setTimeout(() => setCopied(''), 1500); };
    navigator.clipboard.writeText(img.url).then(done, () => {
      const ta = document.createElement('textarea'); ta.value = img.url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); done();
    });
  }

  const q = query.trim().toLowerCase();
  const shown = (images || []).filter((i) => !q || String(i.name).toLowerCase().includes(q));
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by file name" style={{ flex: 1, minWidth: 160, padding: '9px 11px', border: '0.5px solid #d8d0c4', borderRadius: 8, fontSize: 14 }} />
        <button onClick={() => fileRef.current.click()} style={btn(true)}>{busy ? 'Uploading ' + busy + '…' : '+ Upload photos'}</button>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => { upload(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
      </div>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 10 }}>Drop photos anywhere here. They are shrunk automatically, and the website serves each page the size it needs.</div>
      {err && <div style={{ background: '#fdecea', color: '#b3261e', borderRadius: 8, padding: '9px 13px', fontSize: 13, marginBottom: 10 }}>{err}</div>}
      {images === null && <div style={{ color: '#999', fontSize: 13 }}>Loading photos…</div>}
      {images && !shown.length && !err && <div style={{ color: '#999', fontSize: 13 }}>No photos yet.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
        {shown.map((img) => (
          <div key={img.id} style={{ background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 10, overflow: 'hidden' }}>
            <div onClick={onPick ? () => onPick(img) : undefined} style={{ height: 110, background: '#f5f0e8', cursor: onPick ? 'pointer' : 'default' }}>
              <img src={img.thumb} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            <div style={{ padding: '6px 8px' }}>
              <div title={img.name} style={{ fontSize: 11, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{img.name}</div>
              {onPick ? (
                <button onClick={() => onPick(img)} style={{ ...btn(false), padding: '3px 10px', fontSize: 11, marginTop: 5, width: '100%' }}>Use this</button>
              ) : (
                <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                  <button onClick={() => copy(img)} style={{ ...btn(false), padding: '3px 8px', fontSize: 11, flex: 1 }}>{copied === img.id ? 'Copied' : 'Copy link'}</button>
                  <button onClick={() => remove(img)} style={{ ...btn(false), padding: '3px 8px', fontSize: 11, color: '#b3261e', borderColor: '#e6b8b4' }}>Delete</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {more && <div style={{ textAlign: 'center', marginTop: 14 }}><button onClick={() => load(page + 1)} style={btn(false)}>Load more</button></div>}
    </div>
  );
}

export function MediaLibraryView({ navigate, supabaseUrl, supabaseKey }) {
  return (
    <div>
      <button onClick={() => navigate('admin')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GOLD, fontSize: 13, fontWeight: 500, padding: 0, marginBottom: 14 }}>← Admin</button>
      <MediaGrid supabaseUrl={supabaseUrl} supabaseKey={supabaseKey} />
    </div>
  );
}

export function MediaPicker({ supabaseUrl, supabaseKey, onPick, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fdfcfb', borderRadius: 12, width: '100%', maxWidth: 860, maxHeight: '88vh', overflow: 'auto', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontFamily: "'Cardo', serif", fontSize: 18, color: GOLD, fontWeight: 700 }}>Choose a photo</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>×</button>
        </div>
        <MediaGrid supabaseUrl={supabaseUrl} supabaseKey={supabaseKey} onPick={onPick} />
      </div>
    </div>
  );
}
