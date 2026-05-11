import { env } from '../config/env';

export interface PlaceSuggestion {
  placeId: string;
  name: string;
  subtitle: string;
}

const AUTOCOMPLETE_URL =
  'https://maps.googleapis.com/maps/api/place/autocomplete/json';

/**
 * Fetch up to 5 place suggestions from Google Places Autocomplete API.
 */
export async function fetchPlaceSuggestions(
  input: string,
): Promise<PlaceSuggestion[]> {
  if (!input.trim()) return [];

  const params = new URLSearchParams({
    input,
    key: env.GOOGLE_MAPS_API_KEY,
    components: 'country:in',
  });

  const res = await fetch(`${AUTOCOMPLETE_URL}?${params}`);
  const data = await res.json();

  if (data.status !== 'OK') return [];

  return data.predictions.slice(0, 5).map((p: unknown) => ({
    placeId: p.place_id,
    name: p.structured_formatting?.main_text ?? p.description,
    subtitle: p.structured_formatting?.secondary_text ?? '',
  }));
}
