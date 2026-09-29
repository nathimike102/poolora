import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RideDatePicker } from '../RideDatePicker';

describe('RideDatePicker', () => {
  const onClose = jest.fn();
  const onSelect = jest.fn();
  
  // A date within the next 14 days. The calendar opens on its month, which
  // is next month when today is near a month's end.
  const today = new Date();
  const mockDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly when visible', () => {
    const { getByText } = render(
      <RideDatePicker visible={true} onClose={onClose} onSelect={onSelect} selectedDate={mockDate} />
    );
    const monthName = mockDate.toLocaleDateString('en-US', { month: 'long' });
    const year = mockDate.getFullYear();
    const regex = new RegExp(`${monthName} ${year}`, 'i');
    expect(getByText(regex)).toBeTruthy();
  });

  it('navigates months', () => {
    const { getByTestId, getByText } = render(
      <RideDatePicker visible={true} onClose={onClose} onSelect={onSelect} selectedDate={mockDate} />
    );
    
    // We can go to next month
    fireEvent.press(getByTestId('next-month'));
    const nextMonth = new Date(mockDate.getFullYear(), mockDate.getMonth() + 1, 1);
    const nextMonthName = nextMonth.toLocaleDateString('en-US', { month: 'long' });
    const nextYear = nextMonth.getFullYear();
    const nextRegex = new RegExp(`${nextMonthName} ${nextYear}`, 'i');
    expect(getByText(nextRegex)).toBeTruthy();

    // And back
    fireEvent.press(getByTestId('prev-month'));
  });

  it('selects a date via calendar grid', () => {
    const { getByTestId } = render(
      <RideDatePicker visible={true} onClose={onClose} onSelect={onSelect} selectedDate={mockDate} />
    );
    
    // Select a day that is definitely allowed (e.g., today + 1)
    const allowedDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getDate();
    fireEvent.press(getByTestId(`day-${allowedDay}`));
    expect(onSelect).toHaveBeenCalled();
  });

  it('selects a date via quick-pick', () => {
    const { getByTestId } = render(
      <RideDatePicker visible={true} onClose={onClose} onSelect={onSelect} selectedDate={mockDate} />
    );
    
    fireEvent.press(getByTestId('quick-chip-Today'));
    expect(onSelect).toHaveBeenCalled();
  });
});
