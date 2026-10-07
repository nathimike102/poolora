import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import { api } from '../lib/api';
import { when } from '../lib/format';
import { Badge } from './ui';

interface Pass { url: string; token: string; live: boolean; recording: boolean }

export interface SosVideoState {
  room: string;
  requestedAt?: string;
  startedAt?: string;
  endedAt?: string;
  recording: boolean;
}

/**
 * Live video from the person's phone during an SOS (UC-X04). The team only
 * watches: nothing is sent to the phone, so it never makes a sound or shows
 * anyone. Every viewing is in the audit log.
 */
export function SosVideo({ id, video, open, available, recordingOn, onChange }: {
  id: string;
  video?: SosVideoState;
  open: boolean;
  available: boolean;
  recordingOn: boolean;
  onChange: () => void;
}) {
  const roomRef = useRef<Room | null>(null);
  const videoEl = useRef<HTMLVideoElement>(null);
  const audioEl = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<'idle' | 'connecting' | 'waiting' | 'showing'>('idle');
  const [error, setError] = useState('');
  const [asking, setAsking] = useState(false);
  const cameraOn = Boolean(video?.startedAt && !video.endedAt);

  const leave = () => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    setState('idle');
  };
  useEffect(() => leave, [id]);
  useEffect(() => {
    if (!open) leave();
  }, [open]);

  const attach = (track: RemoteTrack) => {
    if (track.kind === Track.Kind.Video && videoEl.current) {
      track.attach(videoEl.current);
      setState('showing');
    } else if (track.kind === Track.Kind.Audio && audioEl.current) {
      track.attach(audioEl.current);
    }
  };

  const watch = async () => {
    setError('');
    setState('connecting');
    try {
      const pass = await api.post<Pass>(`/admin/sos/${id}/video/watch`);
      const room = new Room();
      roomRef.current = room;
      room
        .on(RoomEvent.TrackSubscribed, (track) => attach(track))
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach();
          if (track.kind === Track.Kind.Video) setState('waiting');
        })
        .on(RoomEvent.Disconnected, () => {
          roomRef.current = null;
          setState('idle');
          onChange();
        });
      await room.connect(pass.url, pass.token, { autoSubscribe: true });
      // The click that started watching lets the browser play the sound
      await room.startAudio().catch(() => undefined);
      setState('waiting');
      room.remoteParticipants.forEach((p) => p.trackPublications.forEach((t) => (t.track ? attach(t.track) : undefined)));
    } catch (e) {
      leave();
      setError((e as Error).message);
    }
  };

  const ask = async () => {
    setError('');
    setAsking(true);
    try {
      await api.post(`/admin/sos/${id}/video/ask`);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAsking(false);
    }
  };

  if (!available) {
    return (
      <div className="card">
        <h2>Video</h2>
        <p className="faint" style={{ margin: 0 }}>Not set up: the LiveKit keys are missing. Call the person instead.</p>
      </div>
    );
  }

  return (
    <div className="card stack" style={{ gap: 8 }}>
      <div className="spread">
        <h2 style={{ margin: 0 }}>Video</h2>
        <span className="row" style={{ gap: 6 }}>
          {cameraOn ? <Badge tone="danger">Camera on</Badge> : video?.requestedAt && open ? <Badge tone="warn">Asked {when(video.requestedAt)}</Badge> : null}
          {cameraOn ? <Badge tone="neutral">{video?.recording ? 'Recorded with the incident' : 'Live only, not recorded'}</Badge> : null}
        </span>
      </div>
      {error ? <div className="banner danger" role="alert">{error}</div> : null}
      <div style={{ position: 'relative', background: '#111', borderRadius: 'var(--radius)', aspectRatio: '4 / 3', display: state === 'idle' ? 'none' : 'block' }}>
        <video ref={videoEl} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} aria-label="Live video from the person's phone" />
        <audio ref={audioEl} autoPlay />
        {state !== 'showing' ? (
          <div className="faint" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#ddd', padding: 16, textAlign: 'center' }}>
            {state === 'connecting' ? 'Connecting…' : 'Waiting for their camera. It shows here as soon as they turn it on.'}
          </div>
        ) : null}
      </div>
      {open ? (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {state === 'idle'
            ? <button className={`btn${cameraOn ? ' primary' : ''}`} onClick={watch}>{cameraOn ? 'Watch now' : 'Open the video window'}</button>
            : <button className="btn" onClick={leave}>Stop watching</button>}
          {!cameraOn ? <button className="btn" disabled={asking} onClick={ask}>{video?.requestedAt ? 'Ask again' : 'Ask them to turn on their camera'}</button> : null}
        </div>
      ) : null}
      <p className="faint" style={{ margin: 0 }}>
        Their phone makes no sound and shows nobody; you see and hear them only. Do not ask them to speak if the danger may be in the car.
        {' '}{recordingOn ? 'Video is recorded with the incident, and their phone tells them so.' : 'Nothing is recorded.'} Every viewing is logged.
      </p>
    </div>
  );
}
