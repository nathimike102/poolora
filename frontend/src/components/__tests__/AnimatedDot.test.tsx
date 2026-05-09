import React from 'react';
import { render } from '@testing-library/react-native';
import { AnimatedDot } from '../AnimatedDot';

describe('AnimatedDot', () => {
  it('renders correctly', () => {
    const { getByTestId } = render(<AnimatedDot />);
    expect(getByTestId('animated-dot')).toBeTruthy();
  });
});
