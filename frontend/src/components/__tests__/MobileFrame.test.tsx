import React from 'react';
import { render } from '@testing-library/react-native';
import { DeviceStatusBar, DevicePreviewWrapper } from '../MobileFrame';
import { Text } from 'react-native';

describe('MobileFrame', () => {
  describe('DeviceStatusBar', () => {
    it('renders correctly', () => {
      const { getByTestId, getByText } = render(<DeviceStatusBar />);
      expect(getByTestId('device-status-bar')).toBeTruthy();
      expect(getByText('9:41')).toBeTruthy();
    });
  });

  describe('DevicePreviewWrapper', () => {
    it('renders children and status bar', () => {
      const { getByTestId, getByText } = render(
        <DevicePreviewWrapper>
          <Text>Screen Content</Text>
        </DevicePreviewWrapper>
      );
      expect(getByTestId('device-status-bar')).toBeTruthy();
      expect(getByText('Screen Content')).toBeTruthy();
    });
  });
});
