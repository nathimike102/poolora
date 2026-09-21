/**
 * types/images.d.ts
 *
 * Metro resolves imported images to an asset reference that <Image> accepts.
 */

declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';
  const source: ImageSourcePropType;
  export default source;
}
