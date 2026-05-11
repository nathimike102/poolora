import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CustomTabBar } from '../CustomTabBar';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

describe('CustomTabBar', () => {
  const mockProps: BottomTabBarProps = {
    state: {
      index: 0,
      routes: [
        { key: 'home', name: 'RiderHome' },
        { key: 'search', name: 'Search' },
      ],
    },
    descriptors: {
      home: { options: { title: 'Home' } },
      search: { options: { title: 'Search' } },
    },
    navigation: {
      emit: jest.fn().mockReturnValue({ defaultPrevented: false }),
      navigate: jest.fn(),
    },
  } as unknown as BottomTabBarProps;

  it('renders correctly', () => {
    const { getByTestId } = render(<CustomTabBar {...mockProps} />);
    expect(getByTestId('custom-tab-bar')).toBeTruthy();
  });

  it('calls navigate when a tab is pressed', () => {
    const { getByTestId } = render(<CustomTabBar {...mockProps} />);
    fireEvent.press(getByTestId('custom-tab-Search'));
    expect(mockProps.navigation.navigate).toHaveBeenCalledWith('Search');
  });

  it('triggers animation on press in/out', () => {
    const { getByTestId } = render(<CustomTabBar {...mockProps} />);
    const tab = getByTestId('custom-tab-Search');
    
    fireEvent(tab, 'pressIn');
    fireEvent(tab, 'pressOut');
  });

  it('does not navigate if defaultPrevented is true', () => {
    const mockNavigate = jest.fn();
    const preventProps = {
      ...mockProps,
      navigation: {
        ...mockProps.navigation,
        emit: jest.fn().mockReturnValue({ defaultPrevented: true }),
        navigate: mockNavigate,
      }
    };
    const { getByTestId } = render(<CustomTabBar {...preventProps} />);
    fireEvent.press(getByTestId('custom-tab-Search'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
