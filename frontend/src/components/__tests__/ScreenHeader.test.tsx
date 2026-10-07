import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { ScreenHeader } from '../ScreenHeader';
import { EmptyState } from '../EmptyState';

describe('ScreenHeader', () => {
  test('shows the title as a header and goes back from the arrow', () => {
    const nav = useNavigation();
    const { getByRole, getByTestId } = render(<ScreenHeader title="Wallet" />);
    expect(getByRole('header')).toHaveTextContent('Wallet');
    fireEvent.press(getByTestId('back-button'));
    expect(nav.goBack).toHaveBeenCalled();
  });

  test('a custom back action replaces going back', () => {
    const onBack = jest.fn();
    const { getByTestId } = render(<ScreenHeader title="Trip" onBack={onBack} />);
    fireEvent.press(getByTestId('back-button'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('a restricted account gets no arrow, and the right-hand control shows', () => {
    const { queryByTestId, getByText } = render(
      <ScreenHeader title="Account suspended" noBack right={<Text>Mark all read</Text>} />,
    );
    expect(queryByTestId('back-button')).toBeNull();
    expect(getByText('Mark all read')).toBeTruthy();
  });
});

describe('EmptyState', () => {
  test('says what will appear and offers a way to start', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <EmptyState icon="receipt" title="No receipts yet" body="Paid trips appear here." action={{ label: 'Find a ride', onPress }} />,
    );
    expect(getByText('Paid trips appear here.')).toBeTruthy();
    fireEvent.press(getByText('Find a ride'));
    expect(onPress).toHaveBeenCalled();
  });
});
