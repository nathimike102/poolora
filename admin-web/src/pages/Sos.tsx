import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api, qs } from '../lib/api';
import { useApi } from '../lib/useApi';
import { subscribeSos } from '../lib/socket';
import { ago, titleCase, when } from '../lib/format';
import { Badge, Empty, ErrorBox, Field, Loading, PageHead, Pager, type Tone } from '../components/ui';
import { ActionDialog } from '../components/Dialog';
import type { MapPoint, OtherTrail } from '../components/MapView';
import type { SosVideoState } from '../components/SosVideo';

// The map library is large; load it only when an incident is opened
const MapView = lazy(() => import('../components/MapView').then((m) => ({ default: m.MapView })));
// So is the video library; it loads when an incident is opened
const SosVideo = lazy(() => import('../components/SosVideo').then((m) => ({ default: m.SosVideo })));

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
  userSafeAt?: string;
  lostContactAt?: string;
  cancelledAt?: string;
  contactsState?: 'pending' | 'sending' | 'sent' | 'unavailable' | 'none' | 'cancelled';
}

interface Person {
  _id: string;
  name: string;
  phone: string;
  gender?: string;
  warnings?: number;
  isSuspended?: boolean;
  profilePhotoUrl?: string;
  identity?: { status?: string };
  kyc?: { licenseNumber?: string; status?: string };
  createdAt?: string;
  emergencyContacts?: Array<{ name: string; phone: string; relation: string }>;
}

type Threat = 'driver' | 'passenger' | 'outside' | 'medical' | 'accident' | 'other';
const THREAT_TEXT: Record<Threat, string> = {
  driver: 'the driver',
  passenger: 'a passenger',
  outside: 'someone outside the car',
  medical: 'a medical emergency',
  accident: 'an accident',
  other: 'something else',
};
/** Distinct from the SOS red; the car first, then other riders */
const TRAIL_COLORS = ['#1d4ed8', '#7c3aed', '#b45309', '#0f766e', '#be185d'];

interface Trail {
  /** userId, or userId:vehicle for the car's own tracker */
  id: string;
  userId: string;
  role: 'driver' | 'rider' | 'vehicle';
  points: Array<{ lng: number; lat: number; at: string; battery?: number }>;
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
    threat?: Threat;
    lastBattery?: number;
    triggeredBy: string;
    locationSource?: 'device' | 'ride' | 'pickup';
    contactsDueAt?: string;
    video?: SosVideoState;
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
  history: { days: number; earlier: number; falseAlarms: number };
  emergencyNumbers: { general: string; police: string; ambulance: string; fire: string };
  /** Recordings and screenshots, with 15-minute links */
  evidence: Array<{ type: 'audio' | 'screenshot' | 'video'; url: string | null }>;
  /** Live video during the SOS (UC-X04): set up at all, and recorded or not */
  video: { available: boolean; recordingOn: boolean };
  vehicle: { make?: string; model?: string; color?: string; year?: number; plateNumber: string; vehicleType?: string; photos: string[]; tracker?: { deviceId: string; lastReportAt: string | null } | null } | null;
  coPassengers: Array<{ _id: string; status: string; rider: { _id: string; name: string; phone: string; profilePhotoUrl?: string; identity?: { status?: string } }; pickup: { address: string }; dropoff: { address: string }; actualPickupTime?: string; actualDropoffTime?: string }>;
  /** Mobile money numbers each person has paid or been paid with: registered to a real name */
  moneyNumbers: Record<string, Array<{ phone: string; channel: string }>>;
  messages: Array<{ sender: string; content: string; contentType: string; createdAt: string }>;
  calls: Array<{ caller: string; callee: string; status: string; createdAt: string; recordingDurationSec?: number }>;
  /** Every phone on the ride, from the trip trail */
  trails: Trail[];
}

/** What is happening now, in words: the badges an admin scans the list for */
/**
 * An unacknowledged SOS re-pages the team every few minutes, and each page is
 * logged. Back-to-back pages show as one line with a count, so the rest of the
 * timeline stays readable; the record itself keeps every entry.
 */
type TimelineEntry = { event: string; timestamp: string; details?: string };
function foldRepages(timeline: TimelineEntry[]): Array<TimelineEntry & { count: number; firstAt: string }> {
  const out: Array<TimelineEntry & { count: number; firstAt: string }> = [];
  for (const entry of timeline) {
    const last = out[out.length - 1];
    if (entry.event === 'Safety team paged again' && last?.event === entry.event) {
      last.count += 1;
      last.timestamp = entry.timestamp;
    } else {
      out.push({ ...entry, count: 1, firstAt: entry.timestamp });
    }
  }
  return out;
}

function SosNow({ i }: { i: Incident }) {
  if (i.cancelledAt) return <Badge tone="neutral">Cancelled by the user</Badge>;
  if (i.status !== 'triggered' && i.status !== 'acknowledged') return <span className="faint">—</span>;
  return (
    <span className="row">
      {i.lostContactAt && !i.userSafeAt ? <Badge tone="danger">Phone out of contact</Badge> : null}
      {i.userSafeAt ? <Badge tone="info">Says they are safe</Badge> : null}
      {i.status === 'triggered' ? <Badge tone="danger">Nobody has it · {ago(i.createdAt)}</Badge> : null}
    </span>
  );
}

const CONTACTS_TEXT: Record<string, string> = {
  pending: 'Waiting out the cancel window; they are texted in a few seconds.',
  sending: 'Texting them now.',
  none: 'No emergency contacts are set to get SOS texts.',
  unavailable: 'Could not text them: SMS is off (TWILIO_ENABLED) or not set up. Call them.',
  cancelled: 'Not texted: the user cancelled inside the window.',
};

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

  // New, changed or closed incidents; not every live position
  useEffect(() => subscribeSos((e) => { if (e.kind === 'alert') reload(); }), [reload]);

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
                  <tr><th>Raised</th><th>By</th><th>Status</th><th>Now</th><th>Risk</th><th>Police</th></tr>
                </thead>
                <tbody>
                  {data.incidents.map((i) => (
                    <tr key={i._id} className="link" onClick={() => navigate(`/sos/${i._id}`)}>
                      <td><Link to={`/sos/${i._id}`}>{when(i.createdAt)}</Link><div className="faint">{ago(i.createdAt)}</div></td>
                      <td>{i.triggeredBy?.name ?? '—'}<div className="faint">{i.triggeredBy?.phone}</div></td>
                      <td><SosStatus status={i.status} /></td>
                      <td><SosNow i={i} /></td>
                      <td><Badge tone={RISK_TONE[i.riskLevel] ?? 'neutral'}>{titleCase(i.riskLevel)}</Badge></td>
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

function PersonCard({ title, person, raised, named, money }: { title: string; person: Person | null; raised: boolean; named: boolean; money?: Array<{ phone: string; channel: string }> }) {
  if (!person) return null;
  return (
    <div className="card">
      <div className="spread">
        <h2 style={{ margin: 0 }}>{title}</h2>
        <span className="row">
          {raised ? <Badge tone="danger">Raised the SOS</Badge> : null}
          {named ? <Badge tone="danger">Named as the danger</Badge> : null}
        </span>
      </div>
      <div className="row" style={{ marginTop: 8, alignItems: 'center' }}>
        {person.profilePhotoUrl ? <img src={person.profilePhotoUrl} alt={`Photo of ${person.name}`} style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} /> : null}
        <div>
          <Link to={`/users/${person._id}`}><strong>{person.name}</strong></Link>
          {person.gender ? <span className="faint"> · {person.gender}</span> : null}
          <div className="faint">
            {person.identity?.status === 'verified' ? 'ID checked by Poolora' : 'ID not checked'}
            {person.kyc?.licenseNumber ? ` · Licence ${person.kyc.licenseNumber}` : ''}
            {person.createdAt ? ` · Member since ${when(person.createdAt)}` : ''}
          </div>
        </div>
      </div>
      <p><a className="btn small" href={`tel:${person.phone}`}>Call {person.phone}</a></p>
      {money?.length ? (
        <p className="faint">Mobile money used: {money.map((m) => `${m.phone} (${titleCase(m.channel)})`).join(', ')}. Registered to a name at the network: the police can ask the network.</p>
      ) : null}
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
  // Other phones on the ride, as positions arrive
  const [liveOthers, setLiveOthers] = useState<Record<string, MapPoint[]>>({});
  const [dialog, setDialog] = useState<'resolve' | 'police' | 'log' | 'suspend' | null>(null);
  const [text, setText] = useState('');
  const [falseAlarm, setFalseAlarm] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    setLive([]);
    setLiveOthers({});
  }, [id]);
  useEffect(
    () =>
      subscribeSos((e) => {
        if (e.emergencyId !== id) return;
        if (e.kind === 'trail' && e.location && (e.trailId ?? e.userId)) {
          const key = (e.trailId ?? e.userId)!;
          const { location } = e;
          setLiveOthers((o) => ({ ...o, [key]: [...(o[key] ?? []), location] }));
        } else if (e.kind === 'location' && e.location) setLive((l) => [...l, e.location!]);
        else reload();
      }),
    [id, reload],
  );

  const trail = useMemo<MapPoint[]>(() => {
    const history = (data?.record.locationHistory ?? []).map((h) => ({ lng: h.location.coordinates[0], lat: h.location.coordinates[1] }));
    return [...history, ...live];
  }, [data, live]);

  const others = useMemo<OtherTrail[]>(() => {
    if (!data) return [];
    const names = new Map<string, string>();
    if (data.rider) names.set(data.rider._id, data.rider.name);
    if (data.driver) names.set(data.driver._id, data.driver.name);
    for (const p of data.coPassengers ?? []) names.set(p.rider._id, p.rider.name);
    const ids = new Set([...(data.trails ?? []).map((t) => t.id), ...Object.keys(liveOthers)]);
    ids.delete(data.record.triggeredBy); // their own SOS trail is the red line
    // The car's tracker first, then the driver's phone, then riders
    const rank = (k: string) => (k.endsWith(':vehicle') ? 2 : k === data.driver?._id ? 1 : 0);
    const ordered = [...ids].sort((a, b) => rank(b) - rank(a));
    return ordered.map((key, i) => {
      const stored = data.trails?.find((t) => t.id === key)?.points ?? [];
      const uid = key.replace(/:vehicle$/, '');
      const label = key.endsWith(':vehicle')
        ? `The car's own GPS tracker${data.vehicle?.plateNumber ? ` (${data.vehicle.plateNumber})` : ''}`
        : uid === data.driver?._id ? `The car (${names.get(uid) ?? 'driver'}'s phone)` : `${names.get(uid) ?? 'Rider'}'s phone`;
      return {
        id: key,
        color: TRAIL_COLORS[i % TRAIL_COLORS.length],
        label,
        points: [...stored.map((p) => ({ lng: p.lng, lat: p.lat })), ...(liveOthers[uid] ?? [])],
      };
    });
  }, [data, liveOthers]);

  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox error={error} onRetry={reload} />;
  const { record, booking, rider, driver, history, emergencyNumbers: numbers, vehicle } = data;
  const threat = record.threat;
  const namedRole = threat === 'driver' ? 'driver' : threat === 'passenger' ? 'rider' : null;
  const lastOf = (key?: string) => data.trails?.find((t) => t.id === key)?.points.at(-1);
  const other = data.triggeredByRole === 'rider' ? driver : rider;
  const otherRole = data.triggeredByRole === 'rider' ? 'driver' : 'rider';
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
        sub={
          <span className="row">
            <SosStatus status={record.status} />
            <Badge tone={RISK_TONE[record.riskLevel] ?? 'neutral'}>{titleCase(record.riskLevel)} risk</Badge>
            Raised {when(record.createdAt)} ({ago(record.createdAt)})
            {history.earlier ? <span className="faint">· {history.earlier} earlier SOS in {history.days} days{history.falseAlarms ? `, ${history.falseAlarms} false alarm${history.falseAlarms === 1 ? '' : 's'}` : ''}</span> : null}
          </span>
        }
        actions={
          open ? (
            <>
              {record.status === 'triggered' ? <button className="btn primary" onClick={() => act(() => api.post(`/admin/sos/${id}/acknowledge`))}>Take this incident</button> : null}
              <button className="btn" onClick={() => openDialog('log')}>Log a call or action</button>
              {!record.policeNotifiedAt ? <button className="btn danger" onClick={() => openDialog('police')}>Police called</button> : null}
              {other && !other.isSuspended ? <button className="btn" onClick={() => openDialog('suspend')}>Suspend the {otherRole}</button> : null}
              <button className="btn" onClick={() => openDialog('resolve')}>Resolve</button>
            </>
          ) : (
            <button className="btn" onClick={() => openDialog('log')}>Add a follow-up note</button>
          )
        }
      />
      {actionError ? <div className="banner danger" role="alert">{actionError}</div> : null}
      {open && record.lostContactAt && !record.userSafeAt ? (
        <div className="banner danger" role="alert"><div><strong>Phone out of contact</strong>No position since {when(record.lostContactAt)}. Call them now; if there is no answer, call the police ({numbers.police}).</div></div>
      ) : null}
      {open && record.userSafeAt ? (
        <div className="banner"><div><strong>Says they are safe</strong>Since {when(record.userSafeAt)}. Call to confirm in their own words before you resolve: someone may have made them tap it.</div></div>
      ) : null}
      {record.escalationReason && !record.userSafeAt ? <div className="banner danger"><div><strong>Escalated</strong>{record.escalationReason}</div></div> : null}
      {threat ? (
        <div className={`banner${threat === 'driver' || threat === 'passenger' || threat === 'outside' ? ' danger' : ''}`}>
          <div>
            <strong>They say the danger is {THREAT_TEXT[threat]}</strong>
            {threat === 'medical' || threat === 'accident'
              ? 'The other person on the ride may be able to help: consider calling them to stop and assist, or to get the person to a hospital.'
              : threat === 'passenger'
                ? 'Another rider on this ride (below) may be the danger, or a witness.'
                : threat === 'driver'
                  ? 'Do not tell the driver about the SOS. Follow the car on the map.'
                  : 'Call the person to find out more.'}
          </div>
        </div>
      ) : null}
      {open || record.video ? (
        <Suspense fallback={<div className="card"><Loading label="Loading video" /></div>}>
          <SosVideo id={id} video={record.video} open={open} available={data.video.available} recordingOn={data.video.recordingOn} onChange={reload} />
        </Suspense>
      ) : null}

      <div className="grid cols-2" style={{ gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)' }}>
        <div className="card stack" style={{ gap: 8 }}>
          <div className="spread">
            <h2 style={{ margin: 0 }}>Location</h2>
            <span className="faint">{lastSeen ? `Last update ${ago(lastSeen)}` : 'No updates since the alert'}{live.length ? ' · live' : ''}</span>
          </div>
          <Suspense fallback={<div className="map"><Loading label="Loading the map" /></div>}>
            <MapView trail={trail} trigger={trigger} others={others} label="Map of the person's position during the SOS" />
          </Suspense>
          <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
            <span className="faint"><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: '#c0282d' }} /> The person who raised it{typeof record.lastBattery === 'number' ? ` · battery ${Math.round(record.lastBattery * 100)}%` : ''}</span>
            {others.map((o) => {
              const last = lastOf(o.id);
              return (
                <span key={o.id} className="faint">
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: o.color }} /> {o.label}
                  {last ? ` · seen ${ago(last.at)}${typeof last.battery === 'number' ? `, battery ${Math.round(last.battery * 100)}%` : ''}` : ''}
                </span>
              );
            })}
          </div>
          {record.locationSource && record.locationSource !== 'device' ? (
            <p className="faint">The phone had no GPS fix when the SOS was raised; the first point is {record.locationSource === 'ride' ? "the car's last reported position" : 'the pickup point'}.</p>
          ) : null}
          {record.liveTrackingUrl ? <p className="faint">Public tracking link sent to emergency contacts: <a href={record.liveTrackingUrl} target="_blank" rel="noreferrer">open</a></p> : null}
        </div>
        <div className="stack">
          <PersonCard title="Rider" person={rider} raised={data.triggeredByRole === 'rider'} named={namedRole === 'rider' && data.triggeredByRole === 'driver'} money={rider ? data.moneyNumbers?.[rider._id] : undefined} />
          <PersonCard title="Driver" person={driver} raised={data.triggeredByRole === 'driver'} named={namedRole === 'driver'} money={driver ? data.moneyNumbers?.[driver._id] : undefined} />
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
                <tr><td className="muted">Vehicle</td><td>{vehicle ? <strong>{[vehicle.color, vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ')}{vehicle.plateNumber ? `, plate ${vehicle.plateNumber}` : ''}</strong> : booking.ride?.vehicle ? `${booking.ride.vehicle.plateNumber} · ${booking.ride.vehicle.vehicleType}` : '—'}</td></tr>
              </tbody>
            </table>
          ) : <p className="muted">The booking could not be found.</p>}
          {vehicle?.photos?.length ? (
            <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
              {vehicle.photos.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`Photo ${i + 1} of the car`} style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 6 }} /></a>)}
            </div>
          ) : null}
          <p className="faint">
            {vehicle?.tracker
              ? `GPS tracker linked (device ${vehicle.tracker.deviceId})${vehicle.tracker.lastReportAt ? `, last reported ${ago(vehicle.tracker.lastReportAt)}` : ', not reported yet'}. It keeps reporting if every phone is off; for the full history outside the ride, ask the tracking company or the police.`
              : 'No GPS tracker linked to this car.'}
          </p>
          {driver ? <p className="faint">Driver's licence and car papers: <Link to={`/applications/${driver._id}`}>open the driver's documents</Link>.</p> : null}

          <h3 style={{ marginTop: 16 }}>Other riders on this ride</h3>
          {data.coPassengers?.length ? (
            <table>
              <tbody>
                {data.coPassengers.map((p) => {
                  const last = lastOf(p.rider._id);
                  return (
                    <tr key={p._id}>
                      <td>
                        <Link to={`/users/${p.rider._id}`}>{p.rider.name}</Link>{' '}
                        <a href={`tel:${p.rider.phone}`}>{p.rider.phone}</a>
                        <div className="faint">
                          {p.actualPickupTime ? (p.actualDropoffTime ? `Dropped ${when(p.actualDropoffTime)}` : 'In the car') : 'Not picked up'}
                          {p.rider.identity?.status === 'verified' ? ' · ID checked' : ''}
                          {last ? ` · phone seen ${ago(last.at)}` : ''}
                          {data.moneyNumbers?.[p.rider._id]?.length ? ` · mobile money ${data.moneyNumbers[p.rider._id].map((m) => m.phone).join(', ')}` : ''}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <p className="faint">None: only these two were on the ride.</p>}

          <details style={{ marginTop: 16 }}>
            <summary>Messages and calls between them ({data.messages?.length ?? 0} messages, {data.calls?.length ?? 0} calls)</summary>
            {data.messages?.map((m, i) => (
              <div key={i} style={{ padding: '4px 0' }}>
                <span className="faint">{when(m.createdAt)} · {m.sender === rider?._id ? rider?.name : m.sender === driver?._id ? driver?.name : 'Someone'}: </span>
                {m.contentType === 'text' ? m.content : `[${m.contentType}]`}
              </div>
            ))}
            {data.calls?.map((c, i) => (
              <div key={`c${i}`} className="faint" style={{ padding: '4px 0' }}>
                {when(c.createdAt)} · call from {c.caller === rider?._id ? rider?.name : driver?.name} · {c.status}{c.recordingDurationSec ? ` · recorded ${c.recordingDurationSec} s (user page)` : ''}
              </div>
            ))}
          </details>

          <h3 style={{ marginTop: 16 }}>Contacts alerted by SMS</h3>
          {record.emergencyContactsNotified.length ? record.emergencyContactsNotified.map((c) => (
            <div key={c.phone + c.notifiedAt} className="spread"><span>{c.name} · {c.phone}</span><span className="faint">{when(c.notifiedAt)}</span></div>
          )) : <p className="faint">{CONTACTS_TEXT[record.contactsState ?? ''] ?? 'None were reached. Call them if you can.'}</p>}
          {data.evidence.length ? (
            <>
              <h3 style={{ marginTop: 16 }}>Evidence</h3>
              <p className="faint">Recorded during the SOS: audio in parts of about a minute, video once the camera is turned off. Links last 15 minutes; reload for new ones.</p>
              {data.evidence.map((e, i) => (
                <div key={i} style={{ padding: '4px 0' }}>
                  {!e.url ? <span className="faint">Part {i + 1} could not be loaded</span>
                    : e.type === 'audio' ? <audio controls preload="none" src={e.url} aria-label={`Recording part ${i + 1}`} style={{ width: '100%' }} />
                      : e.type === 'video' ? <video controls preload="none" src={e.url} aria-label={`Video ${i + 1}`} style={{ width: '100%', maxHeight: 360, background: '#111' }} />
                      : <a href={e.url} target="_blank" rel="noreferrer">Screenshot {i + 1}</a>}
                </div>
              ))}
            </>
          ) : null}
        </div>
        <div className="card">
          <h2>Timeline</h2>
          <ol className="timeline">
            {foldRepages(record.timeline).reverse().map((t, i) => (
              <li key={i}>
                <time dateTime={t.timestamp}>{when(t.timestamp)}</time>
                <div>
                  <strong>{t.event}{t.count > 1 ? ` (${t.count} times)` : ''}</strong>
                  {t.count > 1 ? <div className="muted">First at {when(t.firstAt)}, latest at {when(t.timestamp)}</div> : null}
                  {t.details ? <div className="muted">{t.details}</div> : null}
                </div>
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
        <p className="muted">Call the police first (dial {numbers.police}, or {numbers.general} for any emergency), then record it here. Share the live tracking link with them if they ask for the location.</p>
        <Field label="Station, officer or reference (optional)">
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      </ActionDialog>

      <ActionDialog
        open={dialog === 'suspend'}
        title={`Suspend ${other?.name ?? `the ${otherRole}`} pending investigation`}
        confirmLabel="Suspend"
        tone="danger"
        canConfirm={text.trim().length >= 5}
        onConfirm={() => api.post(`/admin/accounts/${other!._id}/suspend`, { days: null, reason: text }).then(reload)}
        onClose={() => setDialog(null)}
      >
        <p className="muted">
          They can still see their rides but cannot post or book until an admin lifts it (UC-A03). They are told at once, so if the person who raised the SOS may still be with them, wait until that person is safe.
        </p>
        <Field label="Reason (shown to them)">
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Under investigation after a safety report on a ride" />
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
