import React from 'react';
import { FeatureUnavailable } from '../../components/FeatureUnavailable';

export function TripDetailScreen() {
  return (
    <FeatureUnavailable
      icon="map-marker-path"
      title="Trip pooling is coming later"
      description="Planning group trips is not available yet. For now you can find and book shared rides."
    />
  );
}
