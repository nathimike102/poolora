import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

jest.mock('../../hooks/useCurrentPlace', () => ({
  useCurrentPlace: () => ({ place: { lat: -17.83, lng: 31.05, address: 'Samora Machel Ave, Harare' }, status: 'ready', refresh: jest.fn() }),
}));
jest.mock('../../services/placeHistoryService', () => ({ getPlaceHistory: jest.fn().mockResolvedValue([]) }));
jest.mock('../../api/axios', () => ({ apiClient: { get: jest.fn() } }));

import { PlaceField } from '../PlaceField';
import { resolveMapPick } from '../../utils/mapPick';
import { geocodePlace } from '../../services/placesService';
import { apiClient } from '../../api/axios';

describe('PlaceField', () => {
  test('a point picked on the map fills the field and keeps its exact position', async () => {
    const onChange = jest.fn();
    const nav = useNavigation();
    const { getByLabelText } = render(<PlaceField label="Deliver to" value="" onChange={onChange} field="to" />);

    fireEvent.press(getByLabelText('Select on map: Deliver to'));
    const calls = (nav.navigate as jest.Mock).mock.calls;
    const [screen, params] = calls[calls.length - 1];
    expect(screen).toBe('MapPicker');
    expect(params).toMatchObject({ field: 'to' });

    resolveMapPick(params.requestId, { address: 'Avondale Shops, Harare', lat: -17.8, lng: 31.03 });
    expect(onChange).toHaveBeenCalledWith('Avondale Shops, Harare');

    // Submitting uses the pin, with no lookup of the address
    await expect(geocodePlace('Avondale Shops, Harare')).resolves.toMatchObject({ lat: -17.8, lng: 31.03 });
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  test('a pickup offers where the phone is, at its exact position', async () => {
    const onChange = jest.fn();
    const { getByLabelText, getByText } = render(<PlaceField label="Pick up from" value="" onChange={onChange} field="from" allowCurrent />);
    fireEvent(getByLabelText('Pick up from'), 'focus');
    fireEvent.press(getByText('Current location'));
    expect(onChange).toHaveBeenCalledWith('Samora Machel Ave, Harare');
    await expect(geocodePlace('Samora Machel Ave, Harare')).resolves.toMatchObject({ lat: -17.83, lng: 31.05 });
  });

  test('a map answer that nobody is waiting for changes nothing', () => {
    expect(() => resolveMapPick('pick-unknown', { address: 'x', lat: 0, lng: 0 })).not.toThrow();
  });
});
