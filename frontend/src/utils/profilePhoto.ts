/**
 * utils/profilePhoto.ts
 *
 * Choosing a profile picture: from the camera or the gallery, cropped square
 * and compressed so it uploads quickly on a mobile connection. The caller
 * decides when to upload it (userService.setPhoto).
 */
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import i18n from '../i18n';

export interface PickedPhoto {
  uri: string;
  base64: string;
}

/** Square crops at this quality come out well under the 3 MB limit */
const QUALITY = 0.5;

export async function pickProfilePhoto(source: 'camera' | 'library'): Promise<PickedPhoto | null> {
  const permission = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(i18n.t('setup.permissionTitle'), i18n.t(source === 'camera' ? 'setup.cameraNeeded' : 'setup.galleryNeeded'));
    return null;
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: QUALITY, base64: true, exif: false };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  return asset?.base64 ? { uri: asset.uri, base64: asset.base64 } : null;
}

/** Asks where the picture comes from, offering to remove a current one. */
export function askPhotoSource(onPick: (source: 'camera' | 'library') => void, onRemove?: () => void): void {
  Alert.alert(i18n.t('setup.photoTitle'), i18n.t('setup.chooseOption'), [
    { text: i18n.t('setup.takePhoto'), onPress: () => onPick('camera') },
    { text: i18n.t('setup.fromGallery'), onPress: () => onPick('library') },
    ...(onRemove ? [{ text: i18n.t('setup.removePhoto'), style: 'destructive' as const, onPress: onRemove }] : []),
    { text: i18n.t('setup.cancel'), style: 'cancel' as const },
  ]);
}
