// Journal (blog) editor for the Portal. Posts live in public.site_posts, which the website reads live.
// Writes go through the site-posts-admin edge function (it checks the Portal sign-in).
const GOLD = '#886c44';
const SITE = 'https://www.northstarhouse.org';
const STATUS_STYLE = {
  published: { bg: '#e8f5e9', color: '#2e7d32', label: 'Published' },
  scheduled: { bg: '#e3f2fd', color: '#1565c0', label: 'Scheduled' },
  draft: { bg: '#f3f4f6', color: '#6b7280', label: 'Draft' },
};
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: '0.5px solid #d8d0c4', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: '#fff' };
const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, margin: '14px 0 5px' };
const btn = (primary) => ({ background: primary ? GOLD : '#fff', color: primary ? '#fff' : GOLD, border: '1px solid ' + GOLD, borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' });

function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
}
// Pasted content keeps its structure but loses the fonts, colors and classes it came with.
function cleanPasted(html) {
  return String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '').replace(/<(meta|style|script|link)[^>]*>([\s\S]*?<\/\1>)?/gi, '')
    .replace(/\s(style|class|id|dir|lang)="[^"]*"/gi, '').replace(/<\/?(font|span)[^>]*>/gi, '');
}

function Toolbar({ run, onLink, onImage, uploading }) {
  const b = (label, title, fn, extra) => (
    <button type="button" key={title} title={title} onMouseDown={(e) => { e.preventDefault(); fn(); }}
      style={{ background: '#fff', border: '0.5px solid #d8d0c4', borderRadius: 6, padding: '5px 10px', fontSize: 13, cursor: 'pointer', color: '#444', minWidth: 32, ...(extra || {}) }}>{label}</button>
  );
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', padding: 8, background: '#faf7f2', border: '0.5px solid #d8d0c4', borderBottom: 'none', borderRadius: '8px 8px 0 0' }}>
      {b('B', 'Bold', () => run('bold'), { fontWeight: 700 })}
      {b('I', 'Italic', () => run('italic'), { fontStyle: 'italic' })}
      {b('U', 'Underline', () => run('underline'), { textDecoration: 'underline' })}
      {b('H2', 'Heading', () => run('formatBlock', 'h2'))}
      {b('H3', 'Subheading', () => run('formatBlock', 'h3'))}
      {b('¶', 'Normal paragraph', () => run('formatBlock', 'p'))}
      {b('• List', 'Bulleted list', () => run('insertUnorderedList'))}
      {b('1. List', 'Numbered list', () => run('insertOrderedList'))}
      {b('“ Quote', 'Quote', () => run('formatBlock', 'blockquote'))}
      {b('Link', 'Add or edit a link', onLink)}
      {b('Unlink', 'Remove link', () => run('unlink'))}
      {b(uploading ? 'Uploading…' : 'Image', 'Insert an image', onImage)}
      {b('Clear', 'Clear formatting', () => run('removeFormat'))}
    </div>
  );
}

export function BlogEditorView({ navigate, supabaseUrl, supabaseKey }) {
  const [posts, setPosts] = React.useState(null);
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [post, setPost] = React.useState(null);      // the post being edited
  const [editorKey, setEditorKey] = React.useState(0);
  const [htmlMode, setHtmlMode] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [msg, setMsg] = React.useState(null);        // { ok, text }
  const [slugTouched, setSlugTouched] = React.useState(false);
  const bodyRef = React.useRef(null);
  const fileRef = React.useRef(null);
  const heroRef = React.useRef(null);
  const picking = React.useRef('body');
  const savedRange = React.useRef(null);

  async function api(action, data) {
    const r = await fetch(supabaseUrl + '/functions/v1/site-posts-admin', {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...(data || {}) }),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || out.error) throw new Error(out.error || 'Request failed (' + r.status + ')');
    return out;
  }
  function loadList() {
    api('list').then((o) => setPosts(o.posts || [])).catch((e) => { setPosts([]); setMsg({ ok: false, text: e.message }); });
  }
  React.useEffect(loadList, []);

  function set(k, v) { setPost((p) => ({ ...p, [k]: v })); }
  function currentHtml() {
    if (htmlMode) return post.body_html || '';
    return bodyRef.current ? bodyRef.current.innerHTML : post.body_html || '';
  }

  function openPost(row) {
    setMsg(null); setHtmlMode(false); setSlugTouched(true);
    if (!row) {
      setPost({ title: '', slug: '', status: 'draft', excerpt: '', body_html: '', hero_image_url: '', hero_image_alt: '', category: '', author_name: 'North Star House', seo_title: '', seo_description: '', scheduled_for: null });
      setSlugTouched(false); setEditorKey((k) => k + 1);
      return;
    }
    api('get', { id: row.id }).then((o) => { setPost(o.post); setEditorKey((k) => k + 1); }).catch((e) => setMsg({ ok: false, text: e.message }));
  }

  function run(cmd, val) {
    if (htmlMode) return;
    if (bodyRef.current) bodyRef.current.focus();
    document.execCommand(cmd, false, val || null);
  }
  function rememberSelection() {
    const s = window.getSelection();
    if (s && s.rangeCount && bodyRef.current && bodyRef.current.contains(s.anchorNode)) savedRange.current = s.getRangeAt(0).cloneRange();
  }
  function restoreSelection() {
    if (bodyRef.current) bodyRef.current.focus();
    if (savedRange.current) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(savedRange.current); }
  }
  function addLink() {
    if (htmlMode) return;
    rememberSelection();
    const url = window.prompt('Link address (https://…)');
    if (!url) return;
    restoreSelection();
    document.execCommand('createLink', false, /^(https?:|mailto:|\/)/i.test(url) ? url : 'https://' + url);
  }

  async function uploadFile(file) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = 'journal/' + new Date().getFullYear() + '/' + Date.now().toString(36) + '-' + slugify(file.name.replace(/\.[^.]+$/, '')) + '.' + ext;
    const r = await fetch(supabaseUrl + '/storage/v1/object/site-images/' + path, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey, 'Content-Type': file.type || 'image/jpeg', 'x-upsert': 'true' },
      body: file,
    });
    if (!r.ok) throw new Error('Image upload failed (' + r.status + ').');
    return supabaseUrl + '/storage/v1/object/public/site-images/' + path;
  }
  function pickImage(forWhat) {
    picking.current = forWhat;
    if (forWhat === 'body') rememberSelection();
    (forWhat === 'hero' ? heroRef : fileRef).current.click();
  }
  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true); setMsg(null);
    try {
      const url = await uploadFile(file);
      if (picking.current === 'hero') { set('hero_image_url', url); }
      else if (htmlMode) { set('body_html', (post.body_html || '') + '\n<p><img src="' + url + '" alt=""></p>'); }
      else {
        restoreSelection();
        document.execCommand('insertHTML', false, '<p><img src="' + url + '" alt="" style="max-width:100%"></p>');
      }
    } catch (err) { setMsg({ ok: false, text: err.message }); }
    setUploading(false);
  }

  function switchMode() {
    if (htmlMode) { setHtmlMode(false); setEditorKey((k) => k + 1); }
    else { set('body_html', bodyRef.current ? bodyRef.current.innerHTML : post.body_html); setHtmlMode(true); }
  }

  async function save(status) {
    const next = { ...post, body_html: currentHtml() };
    if (status) next.status = status;
    if (next.status === 'scheduled' && !next.scheduled_for) { setMsg({ ok: false, text: 'Pick a date and time to schedule this post.' }); return; }
    if (!String(next.title || '').trim()) { setMsg({ ok: false, text: 'Add a title first.' }); return; }
    setBusy(true); setMsg(null);
    try {
      const out = await api('save', { post: next });
      setPost(out.post);
      const live = out.post.status === 'published';
      setMsg({ ok: true, text: live ? 'Saved and published.' + (out.refreshed ? ' The website is updating now.' : ' It will show on the website shortly.') : out.post.status === 'scheduled' ? 'Saved. It will publish at the scheduled time.' : 'Draft saved.' });
      loadList();
    } catch (err) { setMsg({ ok: false, text: err.message }); }
    setBusy(false);
  }
  async function remove() {
    if (!post.id || !window.confirm('Delete "' + post.title + '" permanently? This also removes it from the website.')) return;
    setBusy(true);
    try { await api('delete', { id: post.id }); setPost(null); loadList(); }
    catch (err) { setMsg({ ok: false, text: err.message }); }
    setBusy(false);
  }

  const back = (label, fn) => (
    <button onClick={fn} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GOLD, fontSize: 13, fontWeight: 500, padding: 0, marginBottom: 14 }}>← {label}</button>
  );

  // ---------- editor ----------
  if (post) {
    const st = STATUS_STYLE[post.status] || STATUS_STYLE.draft;
    return (
      <div>
        {back('All posts', () => { setPost(null); setMsg(null); })}
        <style>{'.blog-body{min-height:340px;padding:16px 18px;border:0.5px solid #d8d0c4;border-radius:0 0 8px 8px;background:#fff;font-size:16px;line-height:1.7;outline:none}.blog-body img{max-width:100%;height:auto}.blog-body h2{font-family:Cardo,serif;font-size:24px}.blog-body h3{font-family:Cardo,serif;font-size:19px}.blog-body blockquote{border-left:3px solid #b5a185;margin:12px 0;padding:2px 14px;color:#555}.blog-body a{color:#886c44}'}</style>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ background: st.bg, color: st.color, borderRadius: 10, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{st.label}</span>
          {post.id && post.status === 'published' && <a href={SITE + '/journal/' + post.slug} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: GOLD }}>View on website ↗</a>}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {post.id && <button disabled={busy} onClick={remove} style={{ ...btn(false), color: '#b3261e', borderColor: '#e6b8b4' }}>Delete</button>}
            <button disabled={busy} onClick={() => save('draft')} style={btn(false)}>Save as draft</button>
            {post.status === 'scheduled'
              ? <button disabled={busy} onClick={() => save('scheduled')} style={btn(true)}>Save schedule</button>
              : <button disabled={busy} onClick={() => save('published')} style={btn(true)}>{post.status === 'published' ? 'Update post' : 'Publish now'}</button>}
          </span>
        </div>
        {msg && <div style={{ background: msg.ok ? '#e8f5e9' : '#fdecea', color: msg.ok ? '#2e7d32' : '#b3261e', borderRadius: 8, padding: '9px 13px', fontSize: 13, margin: '8px 0' }}>{msg.text}</div>}

        <label style={labelStyle}>Title</label>
        <input value={post.title} onChange={(e) => { set('title', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)); }} style={{ ...inputStyle, fontSize: 20, fontFamily: "'Cardo', serif" }} placeholder="Post title" />

        <label style={labelStyle}>Web address</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#888' }}>
          <span>northstarhouse.org/journal/</span>
          <input value={post.slug} onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} style={{ ...inputStyle, flex: 1 }} />
        </div>
        {post.id && post.status === 'published' && <div style={{ fontSize: 11, color: '#b3261e', marginTop: 4 }}>Changing the address of a live post breaks links people already have.</div>}

        <label style={labelStyle}>Short summary (shows on the Journal page and in search results)</label>
        <textarea value={post.excerpt || ''} onChange={(e) => set('excerpt', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />

        <label style={labelStyle}>Main image</label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {post.hero_image_url && <img src={post.hero_image_url} alt="" style={{ width: 150, height: 100, objectFit: 'cover', borderRadius: 8, border: '0.5px solid #d8d0c4' }} />}
          <div style={{ flex: 1, minWidth: 220 }}>
            <button type="button" onClick={() => pickImage('hero')} style={btn(false)}>{uploading ? 'Uploading…' : post.hero_image_url ? 'Replace image' : 'Upload image'}</button>
            {post.hero_image_url && <button type="button" onClick={() => set('hero_image_url', '')} style={{ ...btn(false), marginLeft: 8, color: '#888', borderColor: '#d8d0c4' }}>Remove</button>}
            <input value={post.hero_image_alt || ''} onChange={(e) => set('hero_image_alt', e.target.value)} placeholder="Describe the image (for screen readers and search)" style={{ ...inputStyle, marginTop: 8 }} />
          </div>
        </div>

        <label style={labelStyle}>Post</label>
        <Toolbar run={run} onLink={addLink} onImage={() => pickImage('body')} uploading={uploading} />
        {htmlMode ? (
          <textarea value={post.body_html || ''} onChange={(e) => set('body_html', e.target.value)} style={{ ...inputStyle, minHeight: 340, borderRadius: '0 0 8px 8px', fontFamily: 'Consolas, monospace', fontSize: 13 }} />
        ) : (
          <div key={editorKey} ref={bodyRef} className="blog-body" contentEditable suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: post.body_html || '<p><br></p>' }}
            onKeyUp={rememberSelection} onMouseUp={rememberSelection}
            onPaste={(e) => {
              const html = e.clipboardData.getData('text/html');
              e.preventDefault();
              if (html) document.execCommand('insertHTML', false, cleanPasted(html));
              else document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
            }} />
        )}
        <div style={{ textAlign: 'right', marginTop: 6 }}>
          <button type="button" onClick={switchMode} style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>{htmlMode ? 'Back to the editor' : 'Edit as HTML'}</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
        <input ref={heroRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div><label style={labelStyle}>Category</label><input value={post.category || ''} onChange={(e) => set('category', e.target.value)} style={inputStyle} placeholder="e.g. History" /></div>
          <div><label style={labelStyle}>Author</label><input value={post.author_name || ''} onChange={(e) => set('author_name', e.target.value)} style={inputStyle} /></div>
        </div>

        <label style={labelStyle}>Publishing</label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={post.status} onChange={(e) => set('status', e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
            <option value="draft">Draft (not on the website)</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
          </select>
          {post.status === 'scheduled' && (
            <input type="datetime-local" value={toLocalInput(post.scheduled_for)} onChange={(e) => set('scheduled_for', e.target.value ? new Date(e.target.value).toISOString() : null)} style={{ ...inputStyle, width: 'auto' }} />
          )}
        </div>

        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: GOLD, fontWeight: 600 }}>Search engine details (optional)</summary>
          <label style={labelStyle}>Search title</label>
          <input value={post.seo_title || ''} onChange={(e) => set('seo_title', e.target.value)} style={inputStyle} placeholder="Leave blank to use the post title" />
          <label style={labelStyle}>Search description</label>
          <textarea value={post.seo_description || ''} onChange={(e) => set('seo_description', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Leave blank to use the summary" />
        </details>
      </div>
    );
  }

  // ---------- list ----------
  const q = query.trim().toLowerCase();
  const shown = (posts || []).filter((p) => (filter === 'all' || p.status === filter) && (!q || (p.title || '').toLowerCase().includes(q)));
  const when = (p) => { const d = p.status === 'scheduled' ? p.scheduled_for : p.published_at || p.updated_at; return d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''; };
  return (
    <div>
      {back('Admin', () => navigate('admin'))}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search posts" style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
          <option value="all">All posts</option><option value="published">Published</option><option value="scheduled">Scheduled</option><option value="draft">Drafts</option>
        </select>
        <button onClick={() => openPost(null)} style={btn(true)}>+ New post</button>
      </div>
      {msg && <div style={{ background: '#fdecea', color: '#b3261e', borderRadius: 8, padding: '9px 13px', fontSize: 13, marginBottom: 10 }}>{msg.text}</div>}
      {posts === null && <div style={{ color: '#999', fontSize: 13 }}>Loading posts…</div>}
      {posts && !shown.length && <div style={{ color: '#999', fontSize: 13 }}>No posts match.</div>}
      <div style={{ display: 'grid', gap: 8 }}>
        {shown.map((p) => {
          const st = STATUS_STYLE[p.status] || STATUS_STYLE.draft;
          return (
            <div key={p.id} onClick={() => openPost(p)} style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}>
              {p.hero_image_url ? <img src={p.hero_image_url} alt="" style={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} /> : <div style={{ width: 56, height: 42, borderRadius: 6, background: '#f5f0e8', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#2a2a2a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || '(untitled)'}</div>
                <div style={{ fontSize: 11, color: '#999' }}>{when(p)}{p.category ? ' · ' + p.category : ''}</div>
              </div>
              <span style={{ background: st.bg, color: st.color, borderRadius: 10, padding: '2px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{st.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
