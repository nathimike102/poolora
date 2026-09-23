import axios from 'axios';
import { autocomplete, geocodeAddress } from '../../services/MapsService';

jest.mock('axios');
jest.mock('../../config/redis', () => ({ getRedisClient: () => null }));
jest.mock('../../config', () => ({ config: { maps: { googleMapsKey: 'test-key' } } }));

const mockedGet = axios.get as jest.Mock;

describe('Maps errors shown to riders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not pass on what Google says about billing', async () => {
    mockedGet.mockResolvedValue({
      data: {
        status: 'REQUEST_DENIED',
        error_message: 'You must enable Billing on the Google Cloud Project at https://console.cloud.google.com/project/_/billing/enable',
      },
    });

    await expect(geocodeAddress('Kakinada')).rejects.toThrow(
      'Maps are unavailable right now. Please try again in a moment.',
    );
  });

  it('says plainly when a search simply has no matches', async () => {
    mockedGet.mockResolvedValue({ data: { status: 'ZERO_RESULTS', results: [] } });

    await expect(geocodeAddress('nowhere at all')).rejects.toThrow('We could not find that address.');
  });

  it('returns no predictions rather than failing when autocomplete has no matches', async () => {
    mockedGet.mockResolvedValue({ data: { status: 'ZERO_RESULTS', predictions: [] } });

    await expect(autocomplete('nowhere at all')).resolves.toEqual([]);
  });
});
