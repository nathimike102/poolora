import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

jest.mock('expo-font', () => ({ loadAsync: jest.fn().mockResolvedValue(undefined) }));

import { Text, TextInput } from '../Text';
import { loadAppFonts } from '../../theme/fonts';

const styleOf = (el: { props: { [key: string]: unknown } }) => StyleSheet.flatten(el.props.style as never);

describe('Text in the app font', () => {
  test('keeps the phone font until the font has loaded', () => {
    const { getByText } = render(<Text style={{ fontWeight: '700' }}>Before</Text>);
    expect(styleOf(getByText('Before'))).toEqual({ fontWeight: '700' });
  });

  describe('once loaded', () => {
    beforeAll(() => loadAppFonts());

    test('each weight draws with its own file, not a thickened one', () => {
      const { getByText } = render(
        <>
          <Text>Plain</Text>
          <Text style={{ fontWeight: '600' }}>Semi</Text>
          <Text style={{ fontWeight: 'bold' }}>Bold</Text>
          <Text style={{ fontWeight: '900' }}>Black</Text>
        </>,
      );
      expect(styleOf(getByText('Plain'))).toMatchObject({ fontFamily: 'PlusJakartaSans_400Regular' });
      expect(styleOf(getByText('Semi'))).toMatchObject({ fontFamily: 'PlusJakartaSans_600SemiBold', fontWeight: 'normal' });
      expect(styleOf(getByText('Bold'))).toMatchObject({ fontFamily: 'PlusJakartaSans_700Bold' });
      expect(styleOf(getByText('Black'))).toMatchObject({ fontFamily: 'PlusJakartaSans_800ExtraBold' });
    });

    test('nested text keeps the weight around it unless it sets its own', () => {
      const { getByText } = render(
        <Text style={{ fontWeight: '700' }}>
          Total <Text style={{ color: 'red' }}>$5</Text> <Text style={{ fontWeight: '400' }}>each</Text>
        </Text>,
      );
      expect(styleOf(getByText('$5'))).toMatchObject({ fontFamily: 'PlusJakartaSans_700Bold', color: 'red' });
      expect(styleOf(getByText('each'))).toMatchObject({ fontFamily: 'PlusJakartaSans_400Regular' });
    });

    test('text with its own font, and text inside it, is left alone', () => {
      const { getByText } = render(
        <Text style={{ fontFamily: 'monospace' }}>
          AB12 <Text style={{ fontWeight: '700' }}>CD</Text>
        </Text>,
      );
      expect(styleOf(getByText('CD'))).toEqual({ fontWeight: '700' });
    });

    test('regular italic uses the italic file', () => {
      const { getByText } = render(<Text style={{ fontStyle: 'italic' }}>“Note”</Text>);
      expect(styleOf(getByText('“Note”'))).toMatchObject({ fontFamily: 'PlusJakartaSans_400Regular_Italic', fontStyle: 'normal' });
    });

    test('typed text uses the font too', () => {
      const { getByPlaceholderText } = render(<TextInput placeholder="Name" style={{ fontWeight: '500' }} />);
      expect(styleOf(getByPlaceholderText('Name'))).toMatchObject({ fontFamily: 'PlusJakartaSans_500Medium' });
    });
  });
});
