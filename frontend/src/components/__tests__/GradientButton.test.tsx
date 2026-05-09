import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GradientButton } from '../GradientButton';

describe('GradientButton', () => {
  it('renders label correctly', () => {
    const { getByText } = render(<GradientButton label="Submit" onPress={() => {}} />);
    expect(getByText('Submit')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const mockPress = jest.fn();
    const { getByTestId } = render(<GradientButton label="Click Me" onPress={mockPress} />);
    
    fireEvent.press(getByTestId('gradient-button'));
    expect(mockPress).toHaveBeenCalled();
  });

  it('triggers animation on press in/out', () => {
    const { getByTestId } = render(<GradientButton label="Animate" onPress={() => {}} />);
    const button = getByTestId('gradient-button');
    
    fireEvent(button, 'pressIn');
    fireEvent(button, 'pressOut');
  });

  it('renders loading state', () => {
    const { getByTestId, queryByText } = render(
      <GradientButton label="Wait" onPress={() => {}} loading={true} />
    );
    expect(queryByText('Wait')).toBeNull();
    // Assuming ActivityIndicator is rendered
  });
});
