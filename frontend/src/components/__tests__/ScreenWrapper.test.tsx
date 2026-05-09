import React from 'react';
import { render } from '@testing-library/react-native';
import { ScreenWrapper } from '../ScreenWrapper';
import { Text } from 'react-native';

describe('ScreenWrapper', () => {
  it('renders children correctly', () => {
    const { getByText } = render(
      <ScreenWrapper>
        <Text>Content inside wrapper</Text>
      </ScreenWrapper>
    );
    expect(getByText('Content inside wrapper')).toBeTruthy();
  });
});
