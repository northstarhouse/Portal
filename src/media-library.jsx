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
    list: () => call({ headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list' }) }),
    update: (id, changes) => call({ headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id, ...changes }) }),
    remove: (id) => call({ headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) }),
    upload: async (file, folder) => {
      const small = await shrink(file);
      const form = new FormData();
      form.set('action', 'upload'); form.set('file', small, small.name); form.set('name', file.name); form.set('folder', folder || '');
      try { const b = await createImageBitmap(small); form.set('width', b.width); form.set('height', b.height); } catch (e) { /* not a raster photo */ }
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

// Photos with folders (a path kept in each photo's metadata, same as the old console), alt text and upload.
// With onPick it is a chooser; without it, a library with copy-link, alt text, move and delete.
function MediaGrid({ supabaseUrl, supabaseKey, onPick }) {
  const api = React.useMemo(() => mediaClient(supabaseUrl, supabaseKey), [supabaseUrl, supabaseKey]);
  const [images, setImages] = React.useState(null);
  const [folder, setFolder] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [busy, setBusy] = React.useState(0);
  const [err, setErr] = React.useState('');
  const [copied, setCopied] = React.useState('');
  const [open, setOpen] = React.useState(null);
  const [newFolders, setNewFolders] = React.useState([]);
  const [limit, setLimit] = React.useState(120);
  const fileRef = React.useRef(null);

  React.useEffect(() => { api.list().then((o) => setImages(o.images)).catch((e) => { setImages([]); setErr(e.message); }); }, []);

  const all = images || [];
  const q = query.trim().toLowerCase();
  const prefix = folder ? folder + '/' : '';
  const subs = new Set();
  all.concat(newFolders.map((f) => ({ folder: f }))).forEach((i) => {
    const f = i.folder || '';
    if (f.startsWith(prefix) && f !== folder) subs.add(f.slice(prefix.length).split('/')[0]);
  });
  const shown = q
    ? all.filter((i) => (String(i.name) + ' ' + String(i.alt)).toLowerCase().includes(q))
    : all.filter((i) => (i.folder || '') === folder);
  const crumbs = folder ? folder.split('/') : [];

  async function upload(files) {
    setErr('');
    for (const f of Array.from(files || [])) {
      if (!/^image\//.test(f.type)) { setErr(f.name + ' is not a photo.'); continue; }
      setBusy((n) => n + 1);
      try { const img = await api.upload(f, folder); setImages((prev) => [img].concat(prev || [])); }
      catch (e) { setErr(e.message); }
      setBusy((n) => n - 1);
    }
  }
  async function remove(img) {
    if (!window.confirm('Delete this photo? Pages that use it will show a broken image.')) return;
    try { await api.remove(img.id); setImages((prev) => prev.filter((i) => i.id !== img.id)); setOpen(null); } catch (e) { setErr(e.message); }
  }
  async function save(img, changes) {
    setErr('');
    try { const o = await api.update(img.id, changes); setImages((prev) => prev.map((i) => (i.id === img.id ? o.image : i))); setOpen(o.image); }
    catch (e) { setErr(e.message); }
  }
  function copy(img) {
    const done = () => { setCopied(img.id); setTimeout(() => setCopied(''), 1500); };
    navigator.clipboard.writeText(img.url).then(done, () => {
      const ta = document.createElement('textarea'); ta.value = img.url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); done();
    });
  }
  function newFolder() {
    const name = window.prompt('New folder name' + (folder ? ' (inside ' + folder + ')' : ''));
    if (!name || !name.trim()) return;
    const path = prefix + name.trim().replace(/\//g, '-');
    setNewFolders((p) => p.concat(path)); setFolder(path); setQuery('');
  }

  const small = { ...btn(false), padding: '3px 8px', fontSize: 11 };
  return (
    <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(120); }} placeholder="Search all photos by name or alt text" style={{ flex: 1, minWidth: 160, padding: '9px 11px', border: '0.5px solid #d8d0c4', borderRadius: 8, fontSize: 14 }} />
        <button onClick={newFolder} style={btn(false)}>+ Folder</button>
        <button onClick={() => fileRef.current.click()} style={btn(true)}>{busy ? 'Uploading ' + busy + '…' : '+ Upload photos'}</button>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => { upload(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
      </div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>
        <span onClick={() => { setFolder(''); setQuery(''); }} style={{ cursor: 'pointer', color: folder ? GOLD : '#555', fontWeight: 600 }}>All photos</span>
        {crumbs.map((c, i) => (<span key={i}> › <span onClick={() => setFolder(crumbs.slice(0, i + 1).join('/'))} style={{ cursor: 'pointer', color: i === crumbs.length - 1 ? '#555' : GOLD, fontWeight: 600 }}>{c}</span></span>))}
        <span style={{ marginLeft: 10, fontSize: 11 }}>Drop photos here to add them to this folder. They are shrunk automatically.</span>
      </div>
      {err && <div style={{ background: '#fdecea', color: '#b3261e', borderRadius: 8, padding: '9px 13px', fontSize: 13, marginBottom: 10 }}>{err}</div>}
      {images === null && <div style={{ color: '#999', fontSize: 13 }}>Loading photos…</div>}
      {!q && subs.size > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {[...subs].sort().map((n) => (
            <div key={n} onClick={() => setFolder(prefix + n)} style={{ background: '#f5f0e8', border: '0.5px solid #e0d8cc', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#5a4a30', cursor: 'pointer' }}>📁 {n}</div>
          ))}
        </div>
      )}
      {images && !shown.length && !subs.size && !err && <div style={{ color: '#999', fontSize: 13 }}>No photos here yet.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
        {shown.slice(0, limit).map((img) => (
          <div key={img.id} style={{ background: '#fff', border: '0.5px solid ' + (open && open.id === img.id ? GOLD : '#e0d8cc'), borderRadius: 10, overflow: 'hidden' }}>
            <div onClick={onPick ? () => onPick(img) : () => setOpen(open && open.id === img.id ? null : img)} style={{ height: 110, background: '#f5f0e8', cursor: 'pointer' }}>
              <img src={img.thumb} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            <div style={{ padding: '6px 8px' }}>
              <div title={img.name} style={{ fontSize: 11, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{img.name}</div>
              {!img.alt && <div style={{ fontSize: 10, color: '#b45309' }}>No alt text</div>}
              {onPick && <button onClick={() => onPick(img)} style={{ ...small, marginTop: 5, width: '100%' }}>Use this</button>}
            </div>
          </div>
        ))}
      </div>
      {shown.length > limit && <div style={{ textAlign: 'center', marginTop: 14 }}><button onClick={() => setLimit(limit + 120)} style={btn(false)}>Show more ({shown.length - limit} left)</button></div>}
      {open && !onPick && (
        <PhotoDetails key={open.id} img={open} onSave={(c) => save(open, c)} onCopy={() => copy(open)} copied={copied === open.id} onDelete={() => remove(open)} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

function PhotoDetails({ img, onSave, onCopy, copied, onDelete, onClose }) {
  const [name, setName] = React.useState(img.name || '');
  const [alt, setAlt] = React.useState(img.alt || '');
  const [folder, setFolder] = React.useState(img.folder || '');
  const field = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '0.5px solid #d8d0c4', borderRadius: 8, fontSize: 13 };
  const lab = { display: 'block', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, margin: '10px 0 4px' };
  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 340, maxWidth: '100%', background: '#fdfcfb', boxShadow: '-4px 0 18px rgba(0,0,0,0.15)', padding: 16, overflow: 'auto', zIndex: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: "'Cardo', serif", fontWeight: 700, color: GOLD, fontSize: 16 }}>Photo details</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>×</button>
      </div>
      <img src={img.url.replace(/\/public$/, '/w=700,fit=scale-down,q=75')} alt="" style={{ width: '100%', borderRadius: 8, marginTop: 8, background: '#f5f0e8' }} />
      <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{img.width && img.height ? img.width + ' × ' + img.height + ' · ' : ''}{img.uploaded ? new Date(img.uploaded).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}</div>
      <label style={lab}>Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} style={field} />
      <label style={lab}>Alt text (describe the photo)</label>
      <textarea value={alt} onChange={(e) => setAlt(e.target.value)} rows={3} style={{ ...field, resize: 'vertical' }} />
      <label style={lab}>Folder</label>
      <input value={folder} onChange={(e) => setFolder(e.target.value)} style={field} placeholder="e.g. Blog/2026" />
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <button onClick={() => onSave({ name, alt, folder })} style={btn(true)}>Save</button>
        <button onClick={onCopy} style={btn(false)}>{copied ? 'Copied' : 'Copy link'}</button>
        <button onClick={onDelete} style={{ ...btn(false), color: '#b3261e', borderColor: '#e6b8b4' }}>Delete</button>
      </div>
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
