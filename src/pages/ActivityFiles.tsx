import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAsync } from '../lib/useAsync';
import { Err } from '../lib/ui';

type F = { id: string; path: string; file_name: string; mime: string | null; size_bytes: number | null };
const MAX = 25 * 1024 * 1024;
const size = (n: number | null) => (n == null ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} kB`);
const safe = (n: string) => n.normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(-80) || 'fil';

export default function ActivityFiles({ aid }: { aid: string }) {
  const { data, error, reload } = useAsync(async () => {
    const r = await supabase.from('activity_file').select('id,path,file_name,mime,size_bytes').eq('activity_id', aid).order('created_at');
    if (r.error) throw r.error;
    const fs = r.data as F[];
    const urls: Record<string, string> = {};
    if (fs.length) {
      const s = await supabase.storage.from('activity-files').createSignedUrls(fs.map((f) => f.path), 3600);
      (s.data ?? []).forEach((x) => { if (x.path && x.signedUrl) urls[x.path] = x.signedUrl; });
    }
    return { fs, urls };
  }, [aid], 'actfiles-' + aid);
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => setMsg(null), [aid]);

  async function upload(files: File[]) {
    if (!files.length) return;
    setBusy(true); setMsg(null);
    for (const file of files) {
      if (file.size > MAX) { setMsg(`${file.name} er over 25 MB`); continue; }
      const path = `${aid}/${crypto.randomUUID()}-${safe(file.name)}`;
      const up = await supabase.storage.from('activity-files').upload(path, file, { contentType: file.type || undefined });
      if (up.error) { setMsg(up.error.message); continue; }
      const ins = await supabase.from('activity_file').insert({ activity_id: aid, path, file_name: file.name, mime: file.type || null, size_bytes: file.size });
      if (ins.error) { await supabase.storage.from('activity-files').remove([path]); setMsg(ins.error.message); }
    }
    setBusy(false); reload();
  }
  async function del(f: F) {
    if (!confirm(`Slet ${f.file_name}?`)) return;
    const a = await supabase.from('activity_file').delete().eq('id', f.id);
    if (a.error) { setMsg(a.error.message); return; }
    await supabase.storage.from('activity-files').remove([f.path]);
    reload();
  }
  return (
    <>
      <h2>Filer</h2>
      <Err msg={error ?? msg} />
      {data && data.fs.length === 0 && <p className="mute">Ingen filer.</p>}
      {data && data.fs.length > 0 && (
        <ul className="list">{data.fs.map((f) => {
          const u = data.urls[f.path]; const img = f.mime?.startsWith('image/');
          return (
            <li key={f.id}>
              {img && u && <a href={u} target="_blank" rel="noreferrer"><img src={u} alt={f.file_name} style={{ width: 64, height: 64, objectFit: 'cover', display: 'block' }} /></a>}
              <span className="grow">{u ? <a href={u} target="_blank" rel="noreferrer">{f.file_name}</a> : f.file_name}<div className="mute">{size(f.size_bytes)}</div></span>
              <button className="btn ghost sm" onClick={() => del(f)}>Slet</button>
            </li>);
        })}</ul>
      )}
      <div className="bar">
        <label className="btn ghost sm" style={{ cursor: 'pointer' }}>{busy ? 'Uploader' : 'Vedhæft fil eller foto'}
          <input type="file" multiple accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" hidden disabled={busy} onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ''; upload(files); }} />
        </label>
        <span className="mute">Op til 25 MB pr. fil</span>
      </div>
    </>
  );
}
