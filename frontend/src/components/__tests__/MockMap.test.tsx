import React from 'react';
import { render } from '@testing-library/react-native';
import { MockMap } from '../MockMap';

describe('MockMap', () => {
  it('renders correctly', () => {
    const { getByTestId } = render(<MockMap />);
    expect(getByTestId('mock-map')).toBeTruthy();
  });

  it('renders with route and markers', () => {
    const { getByTestId } = render(
      <MockMap 
        showRoute={true} 
        showDriver={true}
      />
    );
    expect(getByTestId('mock-map')).toBeTruthy();
  });

  it('renders with style', () => {
    const { getByTestId } = render(<MockMap style={{ flex: 1 }} />);
    expect(getByTestId('mock-map')).toBeTruthy();
  });
});
