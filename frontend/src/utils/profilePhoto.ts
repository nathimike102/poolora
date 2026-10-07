/**
 * utils/profilePhoto.ts
 *
 * Choosing a profile picture: from the camera or the gallery, cropped square
 * and compressed so it uploads quickly on a mobile connection. The caller
 * decides when to upload it (userService.setPhoto).
 *
 * The square is cut here, around the middle of the picture, not in the image
 * picker's own crop screen: on Android 15 and later that screen draws under
 * the status bar, its done and back buttons cannot be reached, and people
 * were left stuck on a half-black screen.
 */
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Alert } from 'react-native';
import i18n from '../i18n';

export interface PickedPhoto {
  uri: string;
  base64: string;
}

/** Shown at most this big anywhere in the app; well under the 3 MB upload limit */
const SIZE = 720;
const QUALITY = 0.7;

/** The largest square in the middle of the picture, scaled down and compressed */
async function squareJpeg(uri: string): Promise<PickedPhoto | null> {
  // Sizes from the decoded picture: a camera photo's reported size may be before rotation
  const decoded = await ImageManipulator.manipulate(uri).renderAsync();
  const { width, height } = decoded;
  const side = Math.min(width, height);
  const context = ImageManipulator.manipulate(decoded).crop({
    originX: Math.floor((width - side) / 2),
    originY: Math.floor((height - side) / 2),
    width: side,
    height: side,
  });
  if (side > SIZE) context.resize({ width: SIZE, height: SIZE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG, base64: true });
  return saved.base64 ? { uri: saved.uri, base64: saved.base64 } : null;
}

export async function pickProfilePhoto(source: 'camera' | 'library'): Promise<PickedPhoto | null> {
  const permission = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(i18n.t('setup.permissionTitle'), i18n.t(source === 'camera' ? 'setup.cameraNeeded' : 'setup.galleryNeeded'));
    return null;
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: 1, exif: false };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  return asset ? squareJpeg(asset.uri) : null;
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
