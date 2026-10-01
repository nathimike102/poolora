/**
 * services/sosAudio.ts
 *
 * Audio recording during an SOS (PRD: recording options; UC-R07 step 7).
 * Off unless the user switches it on in Safety settings. While an SOS is
 * open it records in parts of about a minute and uploads each part as soon
 * as it ends, so a snatched or broken phone loses at most the last minute.
 * Only the Poolora safety team can play the recordings.
 */

import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import type { ApiResponse } from '../types/api';
import { logger } from '../utils/logger';

const PREF_KEY = '@poolora_sos_audio';
const CHUNK_SECONDS = 60;

/** AAC in .m4a on both platforms, mono and speech quality: about 360 KB a minute */
const SOS_RECORDING: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  sampleRate: 22050,
  bitRate: 48000,
};

export async function sosAudioEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(PREF_KEY).catch(() => null)) === 'on';
}

export async function setSosAudioEnabled(on: boolean): Promise<boolean> {
  if (on) {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) return false;
  }
  await AsyncStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  return on;
}

async function uploadPart(emergencyId: string, uri: string): Promise<void> {
  const { data } = await apiClient.post<ApiResponse<{ url: string; fields: Record<string, string>; fileUrl: string }>>(
    API_ENDPOINTS.safety.sosAudioUpload(emergencyId),
    { contentType: 'audio/mp4' },
  );
  const { url, fields, fileUrl } = data.data;
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  // React Native's FormData takes { uri, name, type }; the file must be the last field
  form.append('file', { uri, name: 'sos.m4a', type: 'audio/mp4' } as unknown as Blob);
  const res = await fetch(url, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  await apiClient.post(API_ENDPOINTS.safety.addEvidence(emergencyId), { type: 'audio', url: fileUrl });
}

/**
 * Records while `emergencyId` is set and `active` is true, when the user has
 * switched SOS audio on. Each finished part is uploaded; a failed upload is
 * retried once with the next part.
 */
export function useSosRecording(emergencyId: string | null, active: boolean): void {
  const recorder = useAudioRecorder(SOS_RECORDING);
  const pending = useRef<string[]>([]);

  useEffect(() => {
    if (!emergencyId || !active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = async () => {
      const parts = pending.current.splice(0);
      for (const uri of parts) {
        try {
          await uploadPart(emergencyId, uri);
        } catch (error) {
          logger.warn('SOS audio part not uploaded yet', { error });
          pending.current.push(uri);
        }
      }
    };

    const finishPart = async () => {
      try {
        await recorder.stop();
        if (recorder.uri) pending.current.push(recorder.uri);
      } catch (error) {
        logger.debug('SOS recording stop failed', { error });
      }
      void flush();
    };

    const startPart = async () => {
      if (stopped) return;
      try {
        await recorder.prepareToRecordAsync();
        recorder.record();
        timer = setTimeout(async () => {
          await finishPart();
          startPart();
        }, CHUNK_SECONDS * 1000);
      } catch (error) {
        logger.warn('SOS recording could not start', { error });
      }
    };

    (async () => {
      if (!(await sosAudioEnabled())) return;
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted || stopped) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => undefined);
      startPart();
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (recorder.isRecording) void finishPart();
    };
  }, [emergencyId, active]); // eslint-disable-line react-hooks/exhaustive-deps
}
