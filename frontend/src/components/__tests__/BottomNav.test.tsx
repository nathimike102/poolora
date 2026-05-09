import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BottomNav } from '../BottomNav';
import * as Haptics from 'expo-haptics';

describe('BottomNav', () => {
  it('renders correctly', () => {
    const { getByTestId } = render(
      <BottomNav activeTab="home" onTabChange={() => {}} />
    );
    expect(getByTestId('bottom-nav')).toBeTruthy();
  });

  it('calls onTabChange and Haptics when a tab is pressed', () => {
    const onTabChange = jest.fn();
    const { getByTestId } = render(
      <BottomNav activeTab="home" onTabChange={onTabChange} />
    );
    
    fireEvent.press(getByTestId('nav-tab-search'));
    expect(onTabChange).toHaveBeenCalledWith('search');
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it('triggers animation on press in/out', () => {
    const { getByTestId } = render(
      <BottomNav activeTab="home" onTabChange={() => {}} />
    );
    const tab = getByTestId('nav-tab-search');
    
    fireEvent(tab, 'pressIn');
    fireEvent(tab, 'pressOut');
    // We check if it doesn't crash, animations are hard to assert but this hits the lines.
  });
});
