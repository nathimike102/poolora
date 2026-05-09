import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import App from './App';
import { setupAllInterceptors } from './src/api/interceptors';

// Mock all complex sub-components
jest.mock('./src/api/interceptors', () => ({
  setupAllInterceptors: jest.fn(),
}));

jest.mock('./src/navigation/AppNavigator', () => ({
  AppNavigator: () => null,
}));

describe('App', () => {
  it('renders correctly', async () => {
    const { getByTestId } = render(<App />);
    await waitFor(() => {
      expect(setupAllInterceptors).toHaveBeenCalled();
    });
  });
});
