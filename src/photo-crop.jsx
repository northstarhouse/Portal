// Crop / reposition an event photo. The website shows an image exactly as it was uploaded, so this makes a new, cropped copy
// (saved to the photo library) and the event uses that. Pick a shape, drag the photo to move it, slide to zoom.
import React from 'react';
import { mediaClient } from './media-library.jsx';
const GOLD = '#886c44';
const SHAPES = [
  { key: 'orig', label: 'Whole photo', ratio: 0 },
  { key: 'p34', label: 'Flyer 3:4', ratio: 3 / 4 },
  { key: 'p45', label: 'Portrait 4:5', ratio: 4 / 5 },
  { key: 'sq', label: 'Square', ratio: 1 },
  { key: 'l32', label: 'Wide 3:2', ratio: 3 / 2 },
  { key: 'l169', label: 'Banner 16:9', ratio: 16 / 9 },
];
const MAX_SIDE = 2400;

export function PhotoCropper({ url, alt, supabaseUrl, supabaseKey, onDone, onClose }) {
  const [bmp, setBmp] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [shape, setShape] = React.useState('p34');
  const [zoom, setZoom] = React.useState(1);
  const [c, setC] = React.useState({ x: 0.5, y: 0.5 }); // crop centre as a share of the photo's width / height
  const [busy, setBusy] = React.useState(false);
  const canvas = React.useRef(null);
  const drag = React.useRef(null);

  React.useEffect(() => {
    let live = true;
    fetch(url, { mode: 'cors' }).then((r) => { if (!r.ok) throw new Error('load'); return r.blob(); })
      .then((b) => createImageBitmap(b)).then((b) => { if (live) setBmp(b); })
      .catch(() => { if (live) setErr('Could not open this photo for editing here. Upload a cropped copy with Change photo instead.'); });
    return () => { live = false; };
  }, [url]);

  const geom = React.useMemo(() => {
    if (!bmp) return null;
    const W = bmp.width, H = bmp.height;
    const ratio = (SHAPES.find((s) => s.key === shape) || SHAPES[0]).ratio || W / H;
    const baseW = W / H > ratio ? H * ratio : W, baseH = W / H > ratio ? H : W / ratio;
    const cw = baseW / zoom, ch = baseH / zoom;
    const cx = Math.min(Math.max(c.x * W, cw / 2), W - cw / 2), cy = Math.min(Math.max(c.y * H, ch / 2), H - ch / 2);
    return { W, H, ratio, cw, ch, cx, cy };
  }, [bmp, shape, zoom, c]);

  const PREV_H = 380, PREV_MAX_W = 460;
  const prev = geom ? (() => { let w = PREV_H * geom.ratio, h = PREV_H; if (w > PREV_MAX_W) { w = PREV_MAX_W; h = w / geom.ratio; } return { w: Math.round(w), h: Math.round(h) }; })() : { w: 300, h: 380 };

  React.useEffect(() => {
    if (!geom || !canvas.current) return;
    const ctx = canvas.current.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, prev.w, prev.h);
    ctx.drawImage(bmp, geom.cx - geom.cw / 2, geom.cy - geom.ch / 2, geom.cw, geom.ch, 0, 0, prev.w, prev.h);
  }, [geom, prev.w, prev.h, bmp]);

  const down = (e) => { drag.current = { x: e.clientX, y: e.clientY, cx: geom.cx, cy: geom.cy }; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => {
    const d = drag.current; if (!d || !geom) return;
    const nx = d.cx - ((e.clientX - d.x) / prev.w) * geom.cw, ny = d.cy - ((e.clientY - d.y) / prev.h) * geom.ch;
    setC({ x: nx / geom.W, y: ny / geom.H });
  };
  const up = () => { drag.current = null; };

  async function save() {
    if (!geom) return;
    setBusy(true); setErr('');
    try {
      const scale = Math.min(1, MAX_SIDE / Math.max(geom.cw, geom.ch));
      const out = document.createElement('canvas');
      out.width = Math.round(geom.cw * scale); out.height = Math.round(geom.ch * scale);
      const ctx = out.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(bmp, geom.cx - geom.cw / 2, geom.cy - geom.ch / 2, geom.cw, geom.ch, 0, 0, out.width, out.height);
      const blob = await new Promise((res) => out.toBlob(res, 'image/jpeg', 0.9));
      if (!blob) throw new Error('Could not make the cropped photo.');
      const file = new File([blob], 'event-photo-cropped.jpg', { type: 'image/jpeg' });
      const img = await mediaClient(supabaseUrl, supabaseKey).upload(file, 'Events');
      onDone({ url: img.url, alt: alt || img.alt || '' });
    } catch (e) { setErr(e.message || 'Could not save the cropped photo.'); setBusy(false); }
  }

  const btn = (on) => ({ fontSize: 12, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', border: '1px solid ' + GOLD, background: on ? GOLD : '#fff', color: on ? '#fff' : GOLD, fontFamily: 'inherit' });
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(35,38,43,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 2000, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 18, width: '100%', maxWidth: 760, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 auto', minWidth: 240 }}>
          {geom ? (
            <canvas ref={canvas} width={prev.w} height={prev.h} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
              style={{ width: prev.w, height: prev.h, maxWidth: '100%', border: '0.5px solid #d8d0c4', borderRadius: 8, cursor: 'grab', touchAction: 'none', display: 'block' }} />
          ) : (
            <div style={{ width: 300, height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 13, background: '#faf6ef', borderRadius: 8, textAlign: 'center', padding: 16 }}>{err || 'Loading photo…'}</div>
          )}
        </div>
        <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Cardo','Georgia',serif" }}>Crop photo</div>
          <div style={{ fontSize: 12, color: '#888' }}>The website shows the photo exactly as it appears here. Drag the photo to move it.</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SHAPES.map((s) => <button key={s.key} type="button" style={btn(shape === s.key)} onClick={() => { setShape(s.key); setZoom(1); setC({ x: 0.5, y: 0.5 }); }}>{s.label}</button>)}
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#888' }}>Zoom
            <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} disabled={!geom} />
          </label>
          {err && geom && <div style={{ fontSize: 12, color: '#b3402a' }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
            <button type="button" disabled={!geom || busy} onClick={save} style={{ ...btn(true), fontSize: 13, padding: '8px 16px' }}>{busy ? 'Saving…' : 'Use this crop'}</button>
            <button type="button" disabled={busy} onClick={onClose} style={{ ...btn(false), fontSize: 13, padding: '8px 16px' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
