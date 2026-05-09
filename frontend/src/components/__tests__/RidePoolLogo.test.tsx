import React from 'react';
import { render } from '@testing-library/react-native';
import { RidePoolLogo } from '../RidePoolLogo';

describe('RidePoolLogo', () => {
  it('renders correctly with default props', () => {
    const { getByTestId } = render(<RidePoolLogo />);
    expect(getByTestId('ridepool-logo')).toBeTruthy();
  });
});
