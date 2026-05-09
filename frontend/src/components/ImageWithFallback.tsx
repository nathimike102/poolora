/**
 * components/ImageWithFallback.tsx
 *
 * Image component with automatic fallback on load error.
 */

import React, { useState } from 'react';
import {
  Image,
  View,
  StyleSheet,
  ActivityIndicator,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useApp } from '../context/AppContext';

interface ImageWithFallbackProps {
  src: string;
  fallbackSrc?: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  style?: ImageStyle;
  containerStyle?: ViewStyle;
  borderRadius?: number;
  showLoader?: boolean;
}

export function ImageWithFallback({
  src,
  fallbackSrc,
  alt,
  width,
  height,
  resizeMode = 'cover',
  style,
  containerStyle,
  borderRadius = 0,
  showLoader = true,
}: ImageWithFallbackProps) {
  const { c } = useApp();
  const [source, setSource] = useState(src);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleError = () => {
    if (fallbackSrc && source !== fallbackSrc) {
      setSource(fallbackSrc);
    } else {
      setError(true);
    }
    setLoading(false);
  };

  return (
    <View
      style={[
        styles.container,
        { borderRadius },
        width !== undefined && { width: width as number },
        height !== undefined && { height: height as number },
        containerStyle,
      ]}
    >
      {error ? (
        // Error placeholder
        <View
          testID="error-placeholder"
          style={[
            styles.placeholder,
            { backgroundColor: c.surfaceVariant, borderRadius },
          ]}
        >
          <MaterialCommunityIcons
            name="image-broken-variant"
            size={28}
            color={c.textDisabled}
          />
        </View>
      ) : (
        <>
          <Image
            testID="image-with-fallback"
            source={{ uri: source }}
            accessibilityLabel={alt}
            resizeMode={resizeMode}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={handleError}
            style={[
              styles.image,
              { borderRadius },
              width !== undefined && { width: width as number },
              height !== undefined && { height: height as number },
              style,
            ]}
          />

          {/* Loading overlay — shown until image resolves */}
          {loading && showLoader && (
            <View
              testID="image-loader"
              style={[
                styles.loadingOverlay,
                { backgroundColor: c.surfaceVariant, borderRadius },
              ]}
            >
              <ActivityIndicator color={c.primary} size="small" />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
