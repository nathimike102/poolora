import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ImageWithFallback } from '../ImageWithFallback';

describe('ImageWithFallback', () => {
  const mockUri = 'https://example.com/image.png';

  it('renders image correctly', () => {
    const { getByTestId } = render(<ImageWithFallback src={mockUri} />);
    expect(getByTestId('image-with-fallback')).toBeTruthy();
  });

  it('renders fallback when error occurs', () => {
    const { getByTestId } = render(<ImageWithFallback src="invalid" />);
    const image = getByTestId('image-with-fallback');
    
    // Simulate error
    fireEvent(image, 'error', { nativeEvent: { error: 'Failed to load' } });
    
    expect(getByTestId('error-placeholder')).toBeTruthy();
  });

  it('handles loading state', () => {
    const { getByTestId, queryByTestId } = render(<ImageWithFallback src={mockUri} />);
    const image = getByTestId('image-with-fallback');
    
    // Initially loading is true in state
    expect(getByTestId('image-loader')).toBeTruthy();
    
    // Simulate loadEnd
    fireEvent(image, 'loadEnd');
    expect(queryByTestId('image-loader')).toBeNull();
  });

  it('handles loadStart', () => {
    const { getByTestId } = render(<ImageWithFallback src={mockUri} />);
    const image = getByTestId('image-with-fallback');
    fireEvent(image, 'loadStart');
    expect(getByTestId('image-loader')).toBeTruthy();
  });
});
