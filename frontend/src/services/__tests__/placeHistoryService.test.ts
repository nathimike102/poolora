import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPlaceHistory, rememberPlace, toggleFavouritePlace } from '../placeHistoryService';

const place = (n: number) => ({ name: `Place ${n}`, subtitle: 'Kakinada' });

describe('placeHistoryService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('puts the most recent place first and does not duplicate a place', async () => {
    await rememberPlace(place(1));
    await rememberPlace(place(2));
    await rememberPlace(place(1));

    const names = (await getPlaceHistory()).map(p => p.name);
    expect(names).toEqual(['Place 1', 'Place 2']);
  });

  it('keeps at most six recent places', async () => {
    for (let i = 1; i <= 8; i++) await rememberPlace(place(i));

    const names = (await getPlaceHistory()).map(p => p.name);
    expect(names).toHaveLength(6);
    expect(names[0]).toBe('Place 8');
    expect(names).not.toContain('Place 1');
  });

  it('keeps favourites at the top and never drops them', async () => {
    await rememberPlace(place(1));
    await toggleFavouritePlace(place(1));
    for (let i = 2; i <= 9; i++) await rememberPlace(place(i));

    const history = await getPlaceHistory();
    expect(history[0]).toMatchObject({ name: 'Place 1', favourite: true });
    expect(history.filter(p => !p.favourite)).toHaveLength(6);
  });

  it('keeps the favourite mark when a place is searched again', async () => {
    await rememberPlace(place(1));
    await toggleFavouritePlace(place(1));
    await rememberPlace({ ...place(1), lat: 16.9, lng: 82.2 });

    expect((await getPlaceHistory())[0]).toMatchObject({ favourite: true, lat: 16.9 });
  });

  it('returns an empty list when storage holds something unreadable', async () => {
    await AsyncStorage.setItem('@poolora_place_history', '{not json');
    expect(await getPlaceHistory()).toEqual([]);
  });
});
