import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { DriverLoginModal } from '../DriverLoginModal';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';

jest.mock('../../context/AppContext', () => ({
  useApp: jest.fn(),
}));

describe('DriverLoginModal', () => {
  const onClose = jest.fn();
  const mockNavigate = jest.fn();
  const mockSetRole = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate });
    (useApp as jest.Mock).mockReturnValue({
      c: { surface: '#fff', primaryDark: '#000', text: '#000', textSec: '#666', border: '#eee', bg: '#f9f9f9', primaryLight: '#eee', primary: '#000', success: '#0f0' },
      setRole: mockSetRole,
    });
  });

  it('renders correctly when visible', () => {
    const { getByText } = render(
      <DriverLoginModal visible={true} onClose={onClose} />
    );
    expect(getByText('Become a Driver')).toBeTruthy();
  });

  it('handles switch to driver role and navigation', async () => {
    const { getByTestId } = render(
      <DriverLoginModal visible={true} onClose={onClose} />
    );
    
    fireEvent.press(getByTestId('onboarding-btn'));
    
    expect(mockSetRole).toHaveBeenCalledWith('driver');
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('PersonalDetails');
    }, { timeout: 1000 });
  });

  it('closes on backdrop press', () => {
    const { getByTestId } = render(
      <DriverLoginModal visible={true} onClose={onClose} />
    );
    fireEvent.press(getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on close button press', () => {
    const { getByTestId } = render(
      <DriverLoginModal visible={true} onClose={onClose} />
    );
    fireEvent.press(getByTestId('modal-close-btn'));
    expect(onClose).toHaveBeenCalled();
  });
});
