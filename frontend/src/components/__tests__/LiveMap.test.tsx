import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { LiveMap } from '../LiveMap';
import * as Location from 'expo-location';

let mockMapsEnabled = true;
jest.mock('../../config/maps', () => ({
  get MAPS_ENABLED() {
    return mockMapsEnabled;
  },
  MAP_STYLE: { light: 'https://example.com/light', dark: 'https://example.com/dark' },
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  installWebGeolocationPolyfill: jest.fn(),
  Accuracy: { Balanced: 3, High: 4 },
}));

describe('LiveMap', () => {
  const mockCoords = {
    coords: {
      latitude: 12.9716,
      longitude: 77.5946,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMapsEnabled = true;
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue(mockCoords);
  });

  it('shows a placeholder and never mounts the native map when maps are turned off', () => {
    mockMapsEnabled = false;
    const { getByTestId, queryByTestId } = render(<LiveMap showRoute />);
    expect(getByTestId('map-placeholder')).toBeTruthy();
    expect(queryByTestId('live-map-view')).toBeNull();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('renders loader initially', async () => {
    const { getByTestId } = render(<LiveMap />);
    expect(getByTestId('map-loader')).toBeTruthy();
  });

  it('renders MapView after loading', async () => {
    const { getByTestId, queryByTestId } = render(<LiveMap />);
    
    await waitFor(() => {
      expect(queryByTestId('map-loader')).toBeNull();
    }, { timeout: 2000 });
    
    expect(getByTestId('live-map-view')).toBeTruthy();
  });

  it('handles location error gracefully', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    
    const { getByTestId } = render(<LiveMap />);
    
    await waitFor(() => {
      expect(getByTestId('live-map-view')).toBeTruthy();
    }, { timeout: 2000 });
  });

  it('handles getCurrentPositionAsync error', async () => {
    (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(new Error('Location failed'));
    
    const { getByTestId } = render(<LiveMap />);
    
    await waitFor(() => {
      expect(getByTestId('live-map-view')).toBeTruthy();
    }, { timeout: 2000 });
  });

  it('draws the road route and the driver when they are given', async () => {
    const origin = { latitude: 12.93, longitude: 77.62 };
    const destination = { latitude: 12.97, longitude: 77.64 };
    const route = [origin, { latitude: 12.95, longitude: 77.63 }, destination];
    const { getByTestId, getByLabelText } = render(
      <LiveMap showRoute showDriver origin={origin} destination={destination} route={route} driverLocation={origin} />,
    );

    await waitFor(() => {
      expect(getByTestId('live-map-view')).toBeTruthy();
    }, { timeout: 2000 });
    expect(getByLabelText('Driver')).toBeTruthy();
  });
});
