// Journal (blog) editor for the Portal. Posts live in public.site_posts, which the website reads live.
// Writes go through the site-posts-admin edge function (it checks the Portal sign-in).
import { MediaPicker } from './media-library.jsx';
import { buildBlogPrompt, parseBlogPackage, markdownToHtml } from './blog-prompt.js';
const GOLD = '#886c44';
const SITE = 'https://www.northstarhouse.org';
const STATUS_STYLE = {
  published: { bg: '#e8f5e9', color: '#2e7d32', label: 'Published' },
  scheduled: { bg: '#e3f2fd', color: '#1565c0', label: 'Scheduled' },
  draft: { bg: '#f3f4f6', color: '#6b7280', label: 'Draft' },
};
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: '0.5px solid #d8d0c4', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: '#fff' };
const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, margin: '14px 0 5px' };
const iconBtn = { background: '#fff', border: '0.5px solid #e4e0ea', borderRadius: 8, width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a9a6b8', cursor: 'pointer', padding: 0, flexShrink: 0 };
const cardBox = { background: '#fdfbf7', border: '0.5px solid #e0d8cc', borderRadius: 10, padding: '4px 16px 16px' };
const cardHead = { fontSize: 12, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 1, padding: '12px 0 2px' };
const chipRow = { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 };
const chip = { background: '#f1ebe0', color: '#5a4a30', borderRadius: 12, padding: '2px 10px', fontSize: 12 };
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

const splitList = (t) => String(t || '').split(',').map((x) => x.trim()).filter(Boolean);
const wordsOf = (t) => (String(t || '').match(/\S+/g) || []).length;
function Counter({ n, max }) { return <span style={{ float: 'right', fontSize: 11, color: n > max ? '#b3261e' : '#999', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{n} / {max}</span>; }

// The same checks the old console showed, computed from the post as it is right now.
function seoChecks(post, html) {
  const doc = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html');
  const text = doc.body.textContent || '';
  const kw = String(post.focus_keyword || '').trim().toLowerCase();
  const title = post.seo_title || post.title || '';
  const desc = post.seo_description || '';
  const firstP = ((doc.querySelector('p') || {}).textContent || '').toLowerCase();
  const heads = [...doc.querySelectorAll('h1,h2,h3,h4')].map((h) => h.textContent.toLowerCase());
  const alts = [...doc.querySelectorAll('img')].map((i) => (i.getAttribute('alt') || '').toLowerCase()).concat([String(post.hero_image_alt || '').toLowerCase()]);
  const links = doc.querySelectorAll('a[href]').length;
  const words = wordsOf(text);
  const checks = [
    { ok: title.length >= 30 && title.length <= 70, text: 'Title is ' + title.length + ' chars' + (title.length > 70 ? ' (too long, keep under 70)' : title.length < 30 ? ' (a bit short)' : '') },
    { ok: desc.length >= 70 && desc.length <= 160, text: desc ? 'Meta description is ' + desc.length + ' chars' + (desc.length > 160 ? ' (too long, keep under 160)' : desc.length < 70 ? ' (a bit short)' : '') : 'Add a meta description' },
    { ok: !!post.slug && post.slug.length <= 120, text: post.slug ? 'URL slug set and clean' : 'Add a URL slug' },
    { ok: !!post.hero_image_url, text: post.hero_image_url ? 'Hero image set' : 'Add a hero image' },
    { ok: words >= 300, text: 'Body is ' + words + ' words' + (words < 300 ? ' (aim for 300+)' : '') },
    { ok: links > 0, text: links + ' link(s) in body' },
  ];
  if (kw) {
    checks.push({ ok: title.toLowerCase().includes(kw), text: 'Focus keyword in the title' });
    checks.push({ ok: firstP.includes(kw), text: 'Mention the keyword in the first paragraph' });
    checks.push({ ok: heads.some((h) => h.includes(kw)), text: 'Focus keyword in a heading' });
    checks.push({ ok: alts.some((a) => a.includes(kw)), text: 'Focus keyword in an image alt' });
  }
  return { checks, score: Math.round(100 * checks.filter((c) => c.ok).length / checks.length) };
}

// Accepts a pasted embed code, a watch link, a youtu.be link or a Shorts link; returns the video id or ''.
function youtubeId(text) {
  const t = String(text || '');
  const m = t.match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?(?:[^"'\s]*&)?v=|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : /^[A-Za-z0-9_-]{11}$/.test(t.trim()) ? t.trim() : '';
}
const videoHtml = (id) => '<div class="nsh-video" contenteditable="false" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:18px 0;border-radius:6px"><iframe src="https://www.youtube.com/embed/' + id + '" title="YouTube video" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div><p><br></p>';

function Toolbar({ run, onLink, onImage, onVideo, uploading }) {
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
      {b('▶ Video', 'Insert a YouTube video (paste the embed code or link)', onVideo)}
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
  const uploading = false;
  const [picker, setPicker] = React.useState(false);
  const [msg, setMsg] = React.useState(null);        // { ok, text }
  const [slugTouched, setSlugTouched] = React.useState(false);
  const bodyRef = React.useRef(null);
  const picking = React.useRef('body');
  const savedRange = React.useRef(null);
  const tickT = React.useRef(null);
  const [pasteBox, setPasteBox] = React.useState(null);
  const [, setTick] = React.useState(0);

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
  async function copyPrompt() {
    if (!String(post.title || '').trim()) { setMsg({ ok: false, text: 'Type the blog title first, then copy the prompt.' }); return; }
    const text = buildBlogPrompt(post.title, post.focus_keyword);
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
  }
  function applyDraft(text) {
    const d = parseBlogPackage(text);
    if (!d.body_md && !d.title) { setMsg({ ok: false, text: 'That does not look like the blog package (no TITLE or BODY found).' }); return false; }
    const html = markdownToHtml(d.body_md);
    setPost((p) => ({
      ...p,
      title: d.title || p.title,
      slug: d.slug ? slugify(d.slug) : p.slug,
      seo_title: d.seo_title || p.seo_title,
      seo_description: d.seo_description || p.seo_description,
      excerpt: p.excerpt || d.seo_description || '',
      focus_keyword: d.focus_keyword || p.focus_keyword,
      _cats: d.category || p._cats,
      _tags: d.tags || p._tags,
      body_html: html || p.body_html,
    }));
    setSlugTouched(true); setHtmlMode(false); setEditorKey((k) => k + 1); setPasteBox(null);
    setMsg({ ok: true, text: 'Filled in from the draft. Read it over, add a main image, then publish.' });
    return true;
  }
  async function pasteDraft() {
    if (String(currentHtmlSafe()).replace(/<[^>]+>|&nbsp;/g, '').trim() && !window.confirm('This replaces the text already in this post. Continue?')) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) { applyDraft(text); return; }
    } catch (e) { /* the browser blocked reading the clipboard; fall back to a box */ }
    setPasteBox('');
  }

  function currentHtmlSafe() { return htmlMode ? post.body_html || '' : bodyRef.current ? bodyRef.current.innerHTML : post.body_html || ''; }
  function currentHtml() {
    if (htmlMode) return post.body_html || '';
    return bodyRef.current ? bodyRef.current.innerHTML : post.body_html || '';
  }

  function withLists(p) {
    const cats = Array.isArray(p.categories) && p.categories.length ? p.categories : p.category ? [p.category] : [];
    return { ...p, _cats: cats.join(', '), _tags: (Array.isArray(p.tags) ? p.tags : []).join(', ') };
  }
  function openPost(row) {
    setMsg(null); setHtmlMode(false); setSlugTouched(true);
    if (!row) {
      setPost({ title: '', slug: '', status: 'draft', excerpt: '', body_html: '', hero_image_url: '', hero_image_alt: '', category: '', author_name: 'North Star House', seo_title: '', seo_description: '', scheduled_for: null, _cats: '', _tags: '', featured: false, focus_keyword: '', canonical_url: '', og_image_url: '' });
      setSlugTouched(false); setEditorKey((k) => k + 1);
      return;
    }
    api('get', { id: row.id }).then((o) => { setPost(withLists(o.post)); setEditorKey((k) => k + 1); }).catch((e) => setMsg({ ok: false, text: e.message }));
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

  function addVideo() {
    rememberSelection();
    const raw = window.prompt('Paste the YouTube embed code or the video link');
    if (!raw) return;
    const id = youtubeId(raw);
    if (!id) { setMsg({ ok: false, text: 'That does not look like a YouTube link or embed code.' }); return; }
    if (htmlMode) { set('body_html', (post.body_html || '') + '\n' + videoHtml(id)); return; }
    restoreSelection();
    document.execCommand('insertHTML', false, videoHtml(id));
  }

  function pickImage(forWhat) {
    picking.current = forWhat;
    if (forWhat === 'body') rememberSelection();
    setPicker(true);
  }
  function onPicked(img) {
    setPicker(false);
    const url = img.url;
    const alt = String(img.alt || '').replace(/"/g, '&quot;');
    if (picking.current === 'hero') { set('hero_image_url', url); if (img.alt && !post.hero_image_alt) set('hero_image_alt', img.alt); }
    else if (picking.current === 'og') { set('og_image_url', url); }
    else if (htmlMode) { set('body_html', (post.body_html || '') + '\n<p><img src="' + url + '" alt="' + alt + '"></p>'); }
    else {
      restoreSelection();
      document.execCommand('insertHTML', false, '<p><img src="' + url + '" alt="' + alt + '" style="max-width:100%"></p>');
    }
  }

  function switchMode() {
    if (htmlMode) { setHtmlMode(false); setEditorKey((k) => k + 1); }
    else { set('body_html', bodyRef.current ? bodyRef.current.innerHTML : post.body_html); setHtmlMode(true); }
  }

  async function save(status) {
    const next = { ...post, body_html: currentHtml() };
    next.categories = splitList(next._cats); next.category = next.categories[0] || ''; next.tags = splitList(next._tags);
    delete next._cats; delete next._tags;
    if (status) next.status = status;
    if (next.status === 'scheduled' && !next.scheduled_for) { setMsg({ ok: false, text: 'Pick a date and time to schedule this post.' }); return; }
    if (!String(next.title || '').trim()) { setMsg({ ok: false, text: 'Add a title first.' }); return; }
    setBusy(true); setMsg(null);
    try {
      const out = await api('save', { post: next });
      setPost(withLists(out.post));
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
        <style>{'.blog-body{min-height:340px;padding:16px 18px;border:0.5px solid #d8d0c4;border-radius:0 0 8px 8px;background:#fff;font-size:16px;line-height:1.7;outline:none}.blog-body img{max-width:100%;height:auto}.blog-body h2{font-family:Cardo,serif;font-size:24px}.blog-body h3{font-family:Cardo,serif;font-size:19px}.blog-body blockquote{border-left:3px solid #b5a185;margin:12px 0;padding:2px 14px;color:#555}.blog-body a{color:#886c44}.blog-body .nsh-video iframe{pointer-events:none}'}</style>
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          <input value={post.title} onChange={(e) => { set('title', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)); }} style={{ ...inputStyle, fontSize: 20, fontFamily: "'Cardo', serif", flex: 1 }} placeholder="Post title" />
          <button type="button" onClick={copyPrompt} title="Copy the ChatGPT writing prompt with this title" style={iconBtn}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg></button>
          <button type="button" onClick={pasteDraft} title="Paste ChatGPT's finished blog to fill in this post" style={iconBtn}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg></button>
        </div>
        {pasteBox !== null && (
          <div style={{ marginTop: 8 }}>
            <textarea value={pasteBox} onChange={(e) => setPasteBox(e.target.value)} rows={8} autoFocus placeholder="Paste ChatGPT's answer here (starting at TITLE:)" style={{ ...inputStyle, fontFamily: 'Consolas, monospace', fontSize: 12 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button type="button" onClick={() => applyDraft(pasteBox)} style={btn(true)}>Fill in the post</button>
              <button type="button" onClick={() => setPasteBox(null)} style={btn(false)}>Cancel</button>
            </div>
          </div>
        )}

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
            <button type="button" onClick={() => pickImage('hero')} style={btn(false)}>{uploading ? 'Uploading…' : post.hero_image_url ? 'Replace image' : 'Choose or upload image'}</button>
            {post.hero_image_url && <button type="button" onClick={() => set('hero_image_url', '')} style={{ ...btn(false), marginLeft: 8, color: '#888', borderColor: '#d8d0c4' }}>Remove</button>}
            <input value={post.hero_image_alt || ''} onChange={(e) => set('hero_image_alt', e.target.value)} placeholder="Describe the image (for screen readers and search)" style={{ ...inputStyle, marginTop: 8 }} />
          </div>
        </div>

        <label style={labelStyle}>Post</label>
        <Toolbar run={run} onLink={addLink} onImage={() => pickImage('body')} onVideo={addVideo} uploading={uploading} />
        {htmlMode ? (
          <textarea value={post.body_html || ''} onChange={(e) => set('body_html', e.target.value)} style={{ ...inputStyle, minHeight: 340, borderRadius: '0 0 8px 8px', fontFamily: 'Consolas, monospace', fontSize: 13 }} />
        ) : (
          <div key={editorKey} ref={bodyRef} className="blog-body" contentEditable suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: post.body_html || '<p><br></p>' }}
            onKeyUp={() => { rememberSelection(); clearTimeout(tickT.current); tickT.current = setTimeout(() => setTick((n) => n + 1), 800); }} onMouseUp={rememberSelection}
            onPaste={(e) => {
              const html = e.clipboardData.getData('text/html');
              const plain = e.clipboardData.getData('text/plain');
              e.preventDefault();
              if (/^\s*(<iframe[\s\S]*youtube|https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/)/i.test(plain) && youtubeId(plain)) { document.execCommand('insertHTML', false, videoHtml(youtubeId(plain))); return; }
              if (html) document.execCommand('insertHTML', false, cleanPasted(html));
              else document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
            }} />
        )}
        <div style={{ textAlign: 'right', marginTop: 6 }}>
          <button type="button" onClick={switchMode} style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>{htmlMode ? 'Back to the editor' : 'Edit as HTML'}</button>
        </div>
        {picker && <MediaPicker supabaseUrl={supabaseUrl} supabaseKey={supabaseKey} onPick={onPicked} onClose={() => setPicker(false)} />}

        <div style={{ ...cardBox, marginTop: 18 }}>
          <div style={cardHead}>Organize</div>
          <label style={labelStyle}>Categories <Counter n={splitList(post._cats).length} max={6} /></label>
          <input value={post._cats || ''} onChange={(e) => set('_cats', e.target.value)} style={inputStyle} placeholder="Add categories, comma-separated" />
          <div style={chipRow}>{splitList(post._cats).map((c, i) => <span key={i} style={chip}>{c}</span>)}</div>
          <label style={labelStyle}>Tags <Counter n={splitList(post._tags).length} max={30} /></label>
          <input value={post._tags || ''} onChange={(e) => set('_tags', e.target.value)} style={inputStyle} placeholder="Add tags, comma-separated" />
          <div style={chipRow}>{splitList(post._tags).map((c, i) => <span key={i} style={chip}>{c}</span>)}</div>
          <label style={labelStyle}>Author</label>
          <input value={post.author_name || ''} onChange={(e) => set('author_name', e.target.value)} style={inputStyle} />
          <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>Byline shown on the post.</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 14, cursor: 'pointer' }}><input type="checkbox" checked={!!post.featured} onChange={(e) => set('featured', e.target.checked)} /> Featured post</label>
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

        {(() => {
          const r = seoChecks(post, currentHtmlSafe());
          const title = post.seo_title || post.title || '';
          const desc = post.seo_description || post.excerpt || '';
          const url = 'www.northstarhouse.org/journal/' + (post.slug || '');
          const og = post.og_image_url || post.hero_image_url;
          return (
            <div style={{ ...cardBox, marginTop: 16 }}>
              <div style={{ ...cardHead, display: 'flex', justifyContent: 'space-between' }}><span>SEO &amp; social</span><span style={{ color: r.score >= 80 ? '#2e7d32' : r.score >= 50 ? '#b45309' : '#b3261e' }}>SEO score {r.score}%</span></div>
              <label style={labelStyle}>Focus keyword</label>
              <input value={post.focus_keyword || ''} onChange={(e) => set('focus_keyword', e.target.value)} style={inputStyle} placeholder="historic preservation" />
              <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>The phrase this post should rank for. Optional, powers the checks below.</div>
              <label style={labelStyle}>SEO title <Counter n={(post.seo_title || '').length} max={70} /></label>
              <input value={post.seo_title || ''} onChange={(e) => set('seo_title', e.target.value)} style={inputStyle} placeholder="Leave blank to use the post title" />
              <label style={labelStyle}>Meta description <Counter n={(post.seo_description || '').length} max={160} /></label>
              <textarea value={post.seo_description || ''} onChange={(e) => set('seo_description', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Leave blank to use the summary" />
              <label style={labelStyle}>URL slug <Counter n={(post.slug || '').length} max={120} /></label>
              <div style={{ fontSize: 12, color: '#888', wordBreak: 'break-all' }}>{url}</div>
              <label style={labelStyle}>Canonical URL</label>
              <input value={post.canonical_url || ''} onChange={(e) => set('canonical_url', e.target.value)} style={inputStyle} placeholder="https://…" />
              <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>Only set this if the same content lives at another URL.</div>
              <label style={labelStyle}>Social image (Open Graph)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {post.og_image_url && <img src={post.og_image_url} alt="" style={{ width: 90, height: 50, objectFit: 'cover', borderRadius: 6 }} />}
                <button type="button" onClick={() => pickImage('og')} style={btn(false)}>Choose image</button>
                <button type="button" onClick={() => set('og_image_url', post.hero_image_url || '')} style={btn(false)}>Use hero image</button>
                {post.og_image_url && <button type="button" onClick={() => set('og_image_url', '')} style={{ ...btn(false), color: '#888', borderColor: '#d8d0c4' }}>Remove</button>}
              </div>
              <label style={labelStyle}>Google result</label>
              <div style={{ background: '#fff', border: '0.5px solid #e0d8cc', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 12, color: '#4d5156' }}>{url.replace(/\//g, ' › ')}</div>
                <div style={{ fontSize: 19, color: '#1a0dab', lineHeight: 1.3 }}>{title.slice(0, 70)}</div>
                <div style={{ fontSize: 13, color: '#4d5156' }}>{desc.slice(0, 160)}</div>
              </div>
              <label style={labelStyle}>Social card</label>
              <div style={{ border: '0.5px solid #e0d8cc', borderRadius: 8, overflow: 'hidden', maxWidth: 420, background: '#fff' }}>
                {og ? <img src={og} alt="" style={{ width: '100%', height: 190, objectFit: 'cover', display: 'block' }} /> : <div style={{ height: 120, background: '#f5f0e8' }} />}
                <div style={{ padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, color: '#888' }}>www.northstarhouse.org</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{title.slice(0, 70)}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{desc.length > 110 ? desc.slice(0, 110) + '…' : desc}</div>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                {r.checks.map((k, i) => <div key={i} style={{ fontSize: 13, padding: '2px 0', color: k.ok ? '#2e7d32' : '#b45309' }}>{k.ok ? '✓' : '○'} {k.text}</div>)}
                <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>Checks update as you save or change fields.</div>
              </div>
            </div>
          );
        })()}
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
                <div style={{ fontSize: 11, color: '#999' }}>{when(p)}{p.category ? ' \u00b7 ' + p.category : ''}</div>
              </div>
              <span style={{ background: st.bg, color: st.color, borderRadius: 10, padding: '2px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{st.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
