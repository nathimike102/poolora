import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BackButton } from '../BackButton';
import { useNavigation } from '@react-navigation/native';

describe('BackButton', () => {
  it('renders correctly', () => {
    const { getByTestId } = render(<BackButton />);
    expect(getByTestId('back-button')).toBeTruthy();
  });

  it('calls navigation.goBack when pressed and no custom onPress provided', () => {
    const nav = useNavigation();
    
    const { getByTestId } = render(<BackButton />);
    fireEvent.press(getByTestId('back-button'));
    
    expect(nav.goBack).toHaveBeenCalled();
  });

  it('calls custom onPress when provided', () => {
    const mockOnPress = jest.fn();
    const { getByTestId } = render(<BackButton onPress={mockOnPress} />);
    
    fireEvent.press(getByTestId('back-button'));
    
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });
});
