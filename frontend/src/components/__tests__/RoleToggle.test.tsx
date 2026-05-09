import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RoleToggle } from '../RoleToggle';
import { useApp } from '../../context/AppContext';

jest.mock('../../context/AppContext', () => ({
  useApp: jest.fn(),
}));

describe('RoleToggle', () => {
  const mockSwitchRole = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    (useApp as jest.Mock).mockReturnValue({
      role: 'rider',
      switchRole: mockSwitchRole,
      c: { surface: '#fff', textSec: '#000', text: '#fff', primary: '#000', primaryLight: '#eee' }
    });
  });

  it('renders correctly', () => {
    const { getByText } = render(<RoleToggle />);
    expect(getByText('Rider')).toBeTruthy();
  });

  it('calls switchRole when toggled from rider to driver', () => {
    const { getByTestId } = render(<RoleToggle />);
    fireEvent.press(getByTestId('role-toggle-driver'));
    expect(mockSwitchRole).toHaveBeenCalled();
  });

  it('calls switchRole when toggled from driver to rider', () => {
    (useApp as jest.Mock).mockReturnValue({
      role: 'driver',
      switchRole: mockSwitchRole,
      c: { surface: '#fff', textSec: '#000', text: '#fff', primary: '#000', primaryLight: '#eee' }
    });
    const { getByTestId } = render(<RoleToggle />);
    fireEvent.press(getByTestId('role-toggle-rider'));
    expect(mockSwitchRole).toHaveBeenCalled();
  });

  it('handles onLayout', () => {
    const { getByTestId } = render(<RoleToggle />);
    fireEvent(getByTestId('role-toggle-container'), 'layout', {
      nativeEvent: { layout: { width: 300 } }
    });
  });

  it('does not call switchRole if already in that role (driver)', () => {
    (useApp as jest.Mock).mockReturnValue({
      role: 'driver',
      switchRole: mockSwitchRole,
      c: { surface: '#fff', textSec: '#000', text: '#fff', primary: '#000', primaryLight: '#eee' }
    });
    const { getByTestId } = render(<RoleToggle />);
    fireEvent.press(getByTestId('role-toggle-driver'));
    expect(mockSwitchRole).not.toHaveBeenCalled();
  });

  it('does not call switchRole if already in that role (rider)', () => {
    (useApp as jest.Mock).mockReturnValue({
      role: 'rider',
      switchRole: mockSwitchRole,
      c: { surface: '#fff', textSec: '#000', text: '#fff', primary: '#000', primaryLight: '#eee' }
    });
    const { getByTestId } = render(<RoleToggle />);
    fireEvent.press(getByTestId('role-toggle-rider'));
    expect(mockSwitchRole).not.toHaveBeenCalled();
  });
});
