/**
 * services/sosVideo.ts
 *
 * Live video to the safety team during an SOS (UC-X04), through LiveKit.
 * The phone only sends: it receives nothing, so it never makes a sound, and
 * no data is spent on incoming video. Low resolution (320×240, about 1 MB a
 * minute) and the back camera first, to show what is happening.
 *
 * The LiveKit libraries are native and large, so they load only when the
 * camera is turned on; a build without them says video needs an update.
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';
import type { ApiResponse } from '../types/api';

export interface SosVideoSession {
  /** Whether the safety team's copy is recorded with the incident */
  recording: boolean;
  /** Camera off keeps the sound going, for less data */
  setCamera(on: boolean): Promise<void>;
  switchCamera(): Promise<void>;
  stop(): Promise<void>;
}

export class SosVideoUnsupported extends Error {}

let globalsRegistered = false;

/**
 * Turns the camera on for the safety team. `withSound` is false while the
 * phone records SOS audio itself, so the two never fight over the microphone
 * and that recording carries on. `onEnded` runs if the video drops for good.
 */
export async function startSosVideo(emergencyId: string, withSound: boolean, toldRecorded: boolean, onEnded: () => void): Promise<SosVideoSession> {
  let native: typeof import('@livekit/react-native');
  let client: typeof import('livekit-client');
  try {
    // Inline requires: Metro loads these only now, not at app start
    native = require('@livekit/react-native') as typeof import('@livekit/react-native');
    client = require('livekit-client') as typeof import('livekit-client');
    if (!globalsRegistered) {
      native.registerGlobals();
      globalsRegistered = true;
    }
  } catch (error) {
    logger.warn('SOS video is not in this build', { error });
    throw new SosVideoUnsupported('Video needs the latest version of the app.');
  }

  // What the screen told the person about recording: the server never records beyond it
  const { data } = await apiClient.post<ApiResponse<{ url: string; token: string; recording: boolean }>>(API_ENDPOINTS.safety.sosVideo(emergencyId), { toldRecorded });
  const pass = data.data;
  const preset = client.VideoPresets43.h240;
  let facing: 'environment' | 'user' = 'environment';
  const room = new client.Room({
    adaptiveStream: false,
    dynacast: false,
    videoCaptureDefaults: { resolution: preset.resolution, facingMode: facing },
    publishDefaults: { videoEncoding: preset.encoding, simulcast: false },
  });
  // LiveKit's audio session only with sound: on iOS, ending it would stop
  // the SOS audio recording that has the microphone instead
  const audioOff = () => (withSound ? native.AudioSession.stopAudioSession().catch(() => undefined) : Promise.resolve());
  const tellStopped = () => apiClient.post(API_ENDPOINTS.safety.sosVideoStop(emergencyId)).catch(() => undefined);
  let stopping = false;
  room.on(client.RoomEvent.Disconnected, () => {
    if (stopping) return;
    // Dropped for good: tell the server if it can be reached (LiveKit tells it otherwise)
    audioOff();
    tellStopped();
    onEnded();
  });

  try {
    if (withSound) await native.AudioSession.startAudioSession();
    await room.connect(pass.url, pass.token);
    await room.localParticipant.setCameraEnabled(true);
    if (withSound) await room.localParticipant.setMicrophoneEnabled(true);
  } catch (error) {
    stopping = true;
    await room.disconnect().catch(() => undefined);
    await audioOff();
    // The server already shows the camera as on to the safety team
    await tellStopped();
    throw error;
  }

  // The camera is reaching the safety team: the server starts the recording, if there is one
  let recording = pass.recording;
  try {
    const sent = await apiClient.post<ApiResponse<{ recording: boolean }>>(API_ENDPOINTS.safety.sosVideoSending(emergencyId));
    recording = sent.data.data.recording;
  } catch (error) {
    logger.warn('Could not confirm SOS video', { error });
  }

  const cameraTrack = () => room.localParticipant.getTrackPublication(client.Track.Source.Camera)?.track as
    | { restartTrack(options: { facingMode: 'environment' | 'user'; resolution: typeof preset.resolution }): Promise<void> }
    | undefined;

  return {
    recording,
    async setCamera(on) {
      await room.localParticipant.setCameraEnabled(on);
    },
    async switchCamera() {
      facing = facing === 'environment' ? 'user' : 'environment';
      await cameraTrack()?.restartTrack({ facingMode: facing, resolution: preset.resolution });
    },
    async stop() {
      stopping = true;
      await room.disconnect().catch(() => undefined);
      await audioOff();
      await tellStopped();
    },
  };
}
