import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { LiveMap } from '../LiveMap';
import * as Location from 'expo-location';

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
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue(mockCoords);
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
});
