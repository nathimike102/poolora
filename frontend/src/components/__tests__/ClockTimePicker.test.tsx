import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ClockTimePicker } from '../ClockTimePicker';

describe('ClockTimePicker', () => {
  const onConfirm = jest.fn();
  const onDismiss = jest.fn();

  it('renders correctly', () => {
    const { getByText } = render(
      <ClockTimePicker
        visible={true}
        onDismiss={onDismiss}
        onConfirm={onConfirm}
        initialTime="09:30"
      />
    );
    expect(getByText('SELECT TIME')).toBeTruthy();
  });

  it('switches between hours and minutes mode', () => {
    const { getByTestId, getByText } = render(
      <ClockTimePicker
        visible={true}
        onDismiss={onDismiss}
        onConfirm={onConfirm}
        initialTime="09:30"
      />
    );
    
    fireEvent.press(getByTestId('minute-btn'));
    expect(getByText('Select minute')).toBeTruthy();
    
    fireEvent.press(getByTestId('hour-btn'));
    expect(getByText('Select hour')).toBeTruthy();
  });

  it('toggles AM/PM', () => {
    const { getByTestId } = render(
      <ClockTimePicker
        visible={true}
        onDismiss={onDismiss}
        onConfirm={onConfirm}
        initialTime="09:30"
      />
    );
    
    fireEvent.press(getByTestId('pm-chip'));
    fireEvent.press(getByTestId('am-chip'));
  });

  it('handles clock touch and release', () => {
    const { getByTestId } = render(
      <ClockTimePicker
        visible={true}
        onDismiss={onDismiss}
        onConfirm={onConfirm}
        initialTime="09:30"
      />
    );
    
    const overlay = getByTestId('clock-touch-overlay');
    // Simulate touch at 3 o'clock (12 is idx 0, 3 is idx 3)
    // CENTER is 130. 3 o'clock is x=130+HAND_RADIUS, y=130
    fireEvent(overlay, 'responderGrant', {
      nativeEvent: { locationX: 200, locationY: 130 }
    });
    fireEvent(overlay, 'responderRelease');
    
    // Switch to minutes and touch
    fireEvent.press(getByTestId('minute-btn'));
    fireEvent(overlay, 'responderMove', {
      nativeEvent: { locationX: 130, locationY: 200 } // 6 o'clock
    });
  });

  it('calls onConfirm with correct 24h format', () => {
    const { getByTestId } = render(
      <ClockTimePicker
        visible={true}
        onDismiss={onDismiss}
        onConfirm={onConfirm}
        initialTime="09:30"
      />
    );
    
    fireEvent.press(getByTestId('pm-chip'));
    fireEvent.press(getByTestId('confirm-btn'));
    expect(onConfirm).toHaveBeenCalledWith('21:30');
  });

  it('handles 12 AM and 12 PM correctly', () => {
    const conf = jest.fn();
    const { getByTestId, rerender } = render(
      <ClockTimePicker
        visible={true}
        onDismiss={onDismiss}
        onConfirm={conf}
        initialTime="00:00"
      />
    );
    fireEvent.press(getByTestId('confirm-btn'));
    expect(conf).toHaveBeenCalledWith('00:00');

    rerender(
      <ClockTimePicker
        visible={true}
        onDismiss={onDismiss}
        onConfirm={conf}
        initialTime="12:00"
      />
    );
    fireEvent.press(getByTestId('confirm-btn'));
    expect(conf).toHaveBeenCalledWith('12:00');
  });
});
