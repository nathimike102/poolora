import React from 'react';
import { FeatureUnavailable } from '../../components/FeatureUnavailable';

export function ParcelTrackingScreen() {
  return (
    <FeatureUnavailable
      icon="package-variant-closed"
      title="Parcel pooling is coming later"
      description="Sending parcels with commuters is not available yet. We'll add it to the app once delivery tracking and verification are ready."
    />
  );
}
