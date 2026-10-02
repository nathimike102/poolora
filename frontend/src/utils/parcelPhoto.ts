/**
 * utils/parcelPhoto.ts
 *
 * Takes a parcel photo with the camera and uploads it (UC-P03, UC-P05). The
 * photo is compressed so it uploads quickly on a mobile connection, and the
 * phone's last known position is attached when location is allowed.
 */
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { parcelService, type ParcelPhoto } from '../services/parcelService';
import { errorHandler } from './errorHandler';
import i18n from '../i18n';

export async function takeParcelPhoto(parcelId: string, stage: ParcelPhoto['stage'], from: 'camera' | 'library' = 'camera'): Promise<ParcelPhoto | null> {
  const permission = from === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(i18n.t('parcelPhoto.cameraTitle'), i18n.t('parcelPhoto.cameraBody'));
    return null;
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, base64: true, exif: false };
  const result = from === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset?.base64) return null;

  let at: { lat: number; lng: number } | undefined;
  try {
    const { granted } = await Location.getForegroundPermissionsAsync();
    const pos = granted ? await Location.getLastKnownPositionAsync() : null;
    if (pos) at = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    // Location is a bonus; the photo still counts without it
  }

  try {
    return await parcelService.addPhoto(parcelId, stage, asset.base64, at);
  } catch (e) {
    Alert.alert(i18n.t('parcelPhoto.uploadFailed'), errorHandler.process(e).message);
    return null;
  }
}
