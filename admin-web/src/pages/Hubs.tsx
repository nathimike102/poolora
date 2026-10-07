import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { Badge, Empty, ErrorBox, Field, Loading, PageHead } from '../components/ui';
import { ActionDialog } from '../components/Dialog';
import { MapView } from '../components/MapView';

interface Hub { _id: string; name: string; kind: 'kombi_rank' | 'bus_terminus'; city: string; address?: string; aliases: string[]; lat: number; lng: number; active: boolean }
interface Suggestion { name: string; kind: Hub['kind']; city: string }
type Form = { name: string; kind: Hub['kind']; city: string; address: string; aliases: string; lat: string; lng: string };

const KIND: Record<Hub['kind'], string> = { kombi_rank: 'Kombi rank', bus_terminus: 'Bus terminus' };
const EMPTY: Form = { name: '', kind: 'kombi_rank', city: '', address: '', aliases: '', lat: '', lng: '' };

/**
 * Kombi ranks and bus termini (UC-R12). Riders see them first in place
 * search, and can say when their bus leaves from a terminus. A new one
 * starts switched off: check the pin on the map, then switch it on.
 */
export function HubsPage() {
  const { data, error, loading, reload } = useApi<{ hubs: Hub[]; suggestions: Suggestion[] }>('/admin/hubs');
  const [editing, setEditing] = useState<Hub | 'new' | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [removing, setRemoving] = useState<Hub | null>(null);

  useEffect(() => {
    if (editing && editing !== 'new') {
      setForm({ name: editing.name, kind: editing.kind, city: editing.city, address: editing.address ?? '', aliases: editing.aliases.join(', '), lat: String(editing.lat), lng: String(editing.lng) });
    }
  }, [editing]);

  const startNew = (s?: Suggestion) => {
    setForm(s ? { ...EMPTY, name: s.name, kind: s.kind, city: s.city } : EMPTY);
    setEditing('new');
  };
  const field = (key: keyof Form) => ({ value: form[key], onChange: (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value }) });
  const body = () => ({
    name: form.name.trim(), kind: form.kind, city: form.city.trim(), address: form.address.trim(),
    aliases: form.aliases.split(',').map((a) => a.trim()).filter(Boolean),
    // A position typed in wins; without one the address is looked up on the map
    ...(form.lat.trim() && form.lng.trim() ? { lat: Number(form.lat), lng: Number(form.lng) } : {}),
  });
  const save = () => (editing === 'new' ? api.post('/admin/hubs', body()) : api.patch(`/admin/hubs/${(editing as Hub)._id}`, body())).then(reload);
  const toggle = (h: Hub) => api.patch(`/admin/hubs/${h._id}`, { active: !h.active }).then(reload);
  const lat = Number(form.lat);
  const lng = Number(form.lng);

  return (
    <div className="stack">
      <PageHead
        title="Ranks and termini"
        sub="Riders see switched-on ranks and termini first when they search for a place, and can say when their bus leaves. Check each pin before switching it on."
        actions={<button className="btn primary" onClick={() => startNew()}>Add one</button>}
      />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {data?.suggestions.length ? (
        <div className="card stack" style={{ gap: 6 }}>
          <strong>Suggested for this market</strong>
          <div className="row" style={{ gap: 6 }}>
            {data.suggestions.map((s) => <button key={`${s.city}-${s.name}`} className="btn" onClick={() => startNew(s)}>{s.name}, {s.city}</button>)}
          </div>
        </div>
      ) : null}
      {data && !data.hubs.length ? <Empty>None yet.</Empty> : null}
      {data?.hubs.length ? (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Kind</th><th>City</th><th>Position</th><th>Shown to riders</th><th /></tr></thead>
            <tbody>
              {data.hubs.map((h) => (
                <tr key={h._id}>
                  <td>{h.name}{h.aliases.length ? <div className="faint">Also: {h.aliases.join(', ')}</div> : null}</td>
                  <td>{KIND[h.kind]}</td>
                  <td>{h.city}</td>
                  <td>{h.lat.toFixed(5)}, {h.lng.toFixed(5)}</td>
                  <td><Badge tone={h.active ? 'good' : 'warn'}>{h.active ? 'Yes' : 'Not yet'}</Badge></td>
                  <td className="row" style={{ gap: 6 }}>
                    <button className="btn" onClick={() => setEditing(h)}>Edit</button>
                    <button className="btn" onClick={() => toggle(h)}>{h.active ? 'Switch off' : 'Switch on'}</button>
                    <button className="btn" onClick={() => setRemoving(h)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ActionDialog
        open={editing !== null}
        title={editing === 'new' ? 'Add a rank or terminus' : `Edit ${(editing as Hub | null)?.name ?? ''}`}
        confirmLabel="Save"
        tone="primary"
        canConfirm={form.name.trim().length >= 2 && form.city.trim().length >= 2}
        onConfirm={save}
        onClose={() => setEditing(null)}
      >
        <Field label="Name"><input className="input" {...field('name')} placeholder="Mbare Musika" /></Field>
        <Field label="Kind">
          <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Hub['kind'] })}>
            <option value="kombi_rank">Kombi rank</option>
            <option value="bus_terminus">Bus terminus</option>
          </select>
        </Field>
        <Field label="City"><input className="input" {...field('city')} placeholder="Harare" /></Field>
        <Field label="Address (to find it on the map)"><input className="input" {...field('address')} /></Field>
        <Field label="Other names people search for (comma separated)"><input className="input" {...field('aliases')} placeholder="Musika" /></Field>
        <div className="row" style={{ gap: 6 }}>
          <Field label="Latitude"><input className="input" {...field('lat')} placeholder="Found from the address" /></Field>
          <Field label="Longitude"><input className="input" {...field('lng')} /></Field>
        </div>
        {Number.isFinite(lat) && Number.isFinite(lng) && form.lat && form.lng ? (
          <div style={{ height: 240 }}><MapView key={`${lat},${lng}`} trail={[]} trigger={{ lat, lng }} label={`Pin for ${form.name}`} /></div>
        ) : <p className="faint" style={{ margin: 0 }}>Leave the position empty to find it from the address; then edit it to check the pin on the map.</p>}
      </ActionDialog>

      <ActionDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? ''}`}
        confirmLabel="Remove"
        tone="danger"
        canConfirm
        onConfirm={() => api.del(`/admin/hubs/${removing!._id}`).then(reload)}
        onClose={() => setRemoving(null)}
      >
        <p style={{ margin: 0 }}>Riders will no longer see it. Bookings that mention it keep its name.</p>
      </ActionDialog>
    </div>
  );
}
