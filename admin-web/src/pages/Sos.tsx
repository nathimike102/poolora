import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api, qs } from '../lib/api';
import { useApi } from '../lib/useApi';
import { subscribeSos } from '../lib/socket';
import { ago, titleCase, when } from '../lib/format';
import { Badge, Empty, ErrorBox, Field, Loading, PageHead, Pager, type Tone } from '../components/ui';
import { ActionDialog } from '../components/Dialog';
import type { MapPoint } from '../components/MapView';

// The map library is large; load it only when an incident is opened
const MapView = lazy(() => import('../components/MapView').then((m) => ({ default: m.MapView })));

type Geo = { coordinates: [number, number] };

interface Incident {
  _id: string;
  status: string;
  riskLevel: string;
  monitoringState?: string;
  missedCheckIns?: number;
  createdAt: string;
  resolvedAt?: string;
  policeNotifiedAt?: string;
  triggeredBy?: { name: string; phone: string };
}

interface Person {
  _id: string;
  name: string;
  phone: string;
  gender?: string;
  warnings?: number;
  isSuspended?: boolean;
  emergencyContacts?: Array<{ name: string; phone: string; relation: string }>;
}

interface SosDetail {
  record: Incident & {
    triggerLocation: Geo;
    locationHistory: Array<{ location: Geo; timestamp: string }>;
    timeline: Array<{ event: string; timestamp: string; details?: string }>;
    emergencyContactsNotified: Array<{ name: string; phone: string; notifiedAt: string; method: string }>;
    liveTrackingUrl?: string;
    resolutionNotes?: string;
    audioRecordingUrls?: string[];
    screenshotUrls?: string[];
    escalationReason?: string;
  };
  booking: {
    _id: string;
    pickup: { address: string };
    dropoff: { address: string };
    ride?: { departureTime: string; startedAt?: string; status: string; vehicle?: { plateNumber: string; vehicleType: string } };
  } | null;
  rider: Person | null;
  driver: Person | null;
  triggeredByRole: 'rider' | 'driver';
}

const STATUS_TONE: Record<string, Tone> = { triggered: 'danger', acknowledged: 'warn', resolved: 'good', false_alarm: 'neutral' };
const RISK_TONE: Record<string, Tone> = { high: 'danger', medium: 'warn', low: 'info' };

export function SosStatus({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{titleCase(status)}</Badge>;
}

export function SosListPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'open';
  const page = Number(params.get('page') ?? 1);
  const { data, error, loading, reload } = useApi<{ incidents: Incident[]; total: number; limit: number }>(
    `/admin/sos${qs({ status: status === 'all' ? '' : status, page, limit: 25 })}`,
    15_000,
  );
  const navigate = useNavigate();

  useEffect(() => subscribeSos(() => reload()), [reload]);

  return (
    <div className="stack">
      <PageHead
        title="SOS incidents"
        sub="Respond to an open SOS within 5 minutes. This list refreshes live."
        actions={
          <div className="seg" role="group" aria-label="Show">
            {[['open', 'Open'], ['resolved', 'Resolved'], ['false_alarm', 'False alarms'], ['all', 'All']].map(([v, l]) => (
              <button key={v} aria-pressed={status === v} onClick={() => setParams({ status: v })}>{l}</button>
            ))}
          </div>
        }
      />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {data ? (
        <div className="card">
          {data.incidents.length === 0 ? (
            <Empty>{status === 'open' ? 'No open SOS. All clear.' : 'No incidents here.'}</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Raised</th><th>By</th><th>Status</th><th>Risk</th><th>Missed check-ins</th><th>Police</th></tr>
                </thead>
                <tbody>
                  {data.incidents.map((i) => (
                    <tr key={i._id} className="link" onClick={() => navigate(`/sos/${i._id}`)}>
                      <td><Link to={`/sos/${i._id}`}>{when(i.createdAt)}</Link><div className="faint">{ago(i.createdAt)}</div></td>
                      <td>{i.triggeredBy?.name ?? '—'}<div className="faint">{i.triggeredBy?.phone}</div></td>
                      <td><SosStatus status={i.status} /></td>
                      <td><Badge tone={RISK_TONE[i.riskLevel] ?? 'neutral'}>{titleCase(i.riskLevel)}</Badge></td>
                      <td className="num">{i.missedCheckIns ?? 0}</td>
                      <td>{i.policeNotifiedAt ? when(i.policeNotifiedAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} limit={data.limit} total={data.total} onPage={(p) => setParams({ status, page: String(p) })} />
        </div>
      ) : null}
    </div>
  );
}

function PersonCard({ title, person, raised }: { title: string; person: Person | null; raised: boolean }) {
  if (!person) return null;
  return (
    <div className="card">
      <div className="spread">
        <h2 style={{ margin: 0 }}>{title}</h2>
        {raised ? <Badge tone="danger">Raised the SOS</Badge> : null}
      </div>
      <p style={{ marginTop: 8 }}>
        <Link to={`/users/${person._id}`}><strong>{person.name}</strong></Link>
        {person.gender ? <span className="faint"> · {person.gender}</span> : null}
      </p>
      <p><a className="btn small" href={`tel:${person.phone}`}>Call {person.phone}</a></p>
      {person.emergencyContacts?.length ? (
        <>
          <h3 style={{ marginTop: 12 }}>Emergency contacts</h3>
          {person.emergencyContacts.map((c) => (
            <div key={c.phone} className="spread" style={{ padding: '4px 0' }}>
              <span>{c.name} <span className="faint">({c.relation})</span></span>
              <a href={`tel:${c.phone}`}>{c.phone}</a>
            </div>
          ))}
        </>
      ) : <p className="faint">No emergency contacts saved.</p>}
    </div>
  );
}

export function SosDetailPage() {
  const { id = '' } = useParams();
  const { data, error, loading, reload } = useApi<SosDetail>(`/admin/sos/${id}`, 20_000);
  const [live, setLive] = useState<MapPoint[]>([]);
  const [dialog, setDialog] = useState<'resolve' | 'police' | 'log' | null>(null);
  const [text, setText] = useState('');
  const [falseAlarm, setFalseAlarm] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => setLive([]), [id]);
  useEffect(
    () =>
      subscribeSos((e) => {
        if (e.emergencyId !== id) return;
        if (e.location) setLive((l) => [...l, e.location!]);
        else reload();
      }),
    [id, reload],
  );

  const trail = useMemo<MapPoint[]>(() => {
    const history = (data?.record.locationHistory ?? []).map((h) => ({ lng: h.location.coordinates[0], lat: h.location.coordinates[1] }));
    return [...history, ...live];
  }, [data, live]);

  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox error={error} onRetry={reload} />;
  const { record, booking, rider, driver } = data;
  const open = record.status === 'triggered' || record.status === 'acknowledged';
  const trigger = { lng: record.triggerLocation.coordinates[0], lat: record.triggerLocation.coordinates[1] };
  const lastSeen = record.locationHistory[record.locationHistory.length - 1]?.timestamp;

  const act = async (fn: () => Promise<unknown>) => {
    setActionError('');
    try {
      await fn();
      await reload();
    } catch (e) {
      setActionError((e as Error).message);
    }
  };
  const openDialog = (d: typeof dialog) => {
    setText('');
    setFalseAlarm(false);
    setDialog(d);
  };

  return (
    <div className="stack">
      <PageHead
        back={{ to: '/sos', label: 'SOS incidents' }}
        title={`SOS raised by the ${data.triggeredByRole}`}
        sub={<span className="row"><SosStatus status={record.status} /><Badge tone={RISK_TONE[record.riskLevel] ?? 'neutral'}>{titleCase(record.riskLevel)} risk</Badge> Raised {when(record.createdAt)} ({ago(record.createdAt)})</span>}
        actions={
          open ? (
            <>
              {record.status === 'triggered' ? <button className="btn primary" onClick={() => act(() => api.post(`/admin/sos/${id}/acknowledge`))}>Take this incident</button> : null}
              <button className="btn" onClick={() => openDialog('log')}>Log a call or action</button>
              {!record.policeNotifiedAt ? <button className="btn danger" onClick={() => openDialog('police')}>Police called</button> : null}
              <button className="btn" onClick={() => openDialog('resolve')}>Resolve</button>
            </>
          ) : (
            <button className="btn" onClick={() => openDialog('log')}>Add a follow-up note</button>
          )
        }
      />
      {actionError ? <div className="banner danger" role="alert">{actionError}</div> : null}
      {record.escalationReason ? <div className="banner danger"><div><strong>Escalated</strong>{record.escalationReason}</div></div> : null}

      <div className="grid cols-2" style={{ gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)' }}>
        <div className="card stack" style={{ gap: 8 }}>
          <div className="spread">
            <h2 style={{ margin: 0 }}>Location</h2>
            <span className="faint">{lastSeen ? `Last update ${ago(lastSeen)}` : 'No updates since the alert'}{live.length ? ' · live' : ''}</span>
          </div>
          <Suspense fallback={<div className="map"><Loading label="Loading the map" /></div>}>
            <MapView trail={trail} trigger={trigger} label="Map of the person's position during the SOS" />
          </Suspense>
          {record.liveTrackingUrl ? <p className="faint">Public tracking link sent to emergency contacts: <a href={record.liveTrackingUrl} target="_blank" rel="noreferrer">open</a></p> : null}
        </div>
        <div className="stack">
          <PersonCard title="Rider" person={rider} raised={data.triggeredByRole === 'rider'} />
          <PersonCard title="Driver" person={driver} raised={data.triggeredByRole === 'driver'} />
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Ride</h2>
          {booking ? (
            <table>
              <tbody>
                <tr><td className="muted">From</td><td>{booking.pickup.address}</td></tr>
                <tr><td className="muted">To</td><td>{booking.dropoff.address}</td></tr>
                <tr><td className="muted">Departure</td><td>{when(booking.ride?.departureTime)}</td></tr>
                <tr><td className="muted">Ride status</td><td>{booking.ride ? titleCase(booking.ride.status) : '—'}</td></tr>
                <tr><td className="muted">Vehicle</td><td>{booking.ride?.vehicle ? `${booking.ride.vehicle.plateNumber} · ${booking.ride.vehicle.vehicleType}` : '—'}</td></tr>
              </tbody>
            </table>
          ) : <p className="muted">The booking could not be found.</p>}
          <h3 style={{ marginTop: 16 }}>Contacts alerted by SMS</h3>
          {record.emergencyContactsNotified.length ? record.emergencyContactsNotified.map((c) => (
            <div key={c.phone + c.notifiedAt} className="spread"><span>{c.name} · {c.phone}</span><span className="faint">{when(c.notifiedAt)}</span></div>
          )) : <p className="faint">None. SMS may be off (TWILIO_ENABLED), or no contacts are saved.</p>}
          {(record.audioRecordingUrls?.length || record.screenshotUrls?.length) ? (
            <>
              <h3 style={{ marginTop: 16 }}>Evidence</h3>
              {[...(record.audioRecordingUrls ?? []), ...(record.screenshotUrls ?? [])].map((u, i) => (
                <div key={u}><a href={u} target="_blank" rel="noreferrer">Evidence {i + 1}</a></div>
              ))}
            </>
          ) : null}
        </div>
        <div className="card">
          <h2>Timeline</h2>
          <ol className="timeline">
            {[...record.timeline].reverse().map((t, i) => (
              <li key={i}>
                <time dateTime={t.timestamp}>{when(t.timestamp)}</time>
                <div><strong>{t.event}</strong>{t.details ? <div className="muted">{t.details}</div> : null}</div>
              </li>
            ))}
          </ol>
          {record.resolutionNotes ? <p style={{ marginTop: 12 }}><strong>Resolution: </strong>{record.resolutionNotes}</p> : null}
        </div>
      </div>

      <ActionDialog
        open={dialog === 'log'}
        title="Log a call or action"
        confirmLabel="Add to timeline"
        canConfirm={text.trim().length > 0}
        onConfirm={() => api.post(`/admin/sos/${id}/log`, { text }).then(reload)}
        onClose={() => setDialog(null)}
      >
        <Field label="What happened">
          <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Called the rider at 21:04; she is safe and the driver has stopped at a petrol pump." />
        </Field>
      </ActionDialog>

      <ActionDialog
        open={dialog === 'police'}
        title="Record that police were called"
        confirmLabel="Record"
        tone="danger"
        onConfirm={() => api.post(`/admin/sos/${id}/police`, { notes: text }).then(reload)}
        onClose={() => setDialog(null)}
      >
        <p className="muted">Call the local police first (dial 112), then record it here. Share the live tracking link with them if they ask for the location.</p>
        <Field label="Station, officer or reference (optional)">
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      </ActionDialog>

      <ActionDialog
        open={dialog === 'resolve'}
        title="Resolve this incident"
        confirmLabel="Resolve"
        canConfirm={text.trim().length >= 5}
        onConfirm={() => api.post(`/admin/sos/${id}/resolve`, { notes: text, isFalseAlarm: falseAlarm }).then(reload)}
        onClose={() => setDialog(null)}
      >
        <Field label="How it was resolved">
          <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Rider confirmed she reached home safely." />
        </Field>
        <label className="check">
          <input type="checkbox" checked={falseAlarm} onChange={(e) => setFalseAlarm(e.target.checked)} />
          It was a false alarm
        </label>
        <p className="faint">If the driver was at fault, suspend them from their user page after resolving.</p>
      </ActionDialog>
    </div>
  );
}
