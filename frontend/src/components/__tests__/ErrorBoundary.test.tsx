import React from 'react';
import { render } from '@testing-library/react-native';
import { ErrorBoundary } from '../ErrorBoundary';
import { Text } from 'react-native';

const ProblematicComponent = () => {
  throw new Error('Test Error');
};

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <Text>Normal Child</Text>
      </ErrorBoundary>
    );
    expect(getByText('Normal Child')).toBeTruthy();
  });

  it('renders fallback UI when there is an error', () => {
    // Silence console.error for this test
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    const { getByTestId, getByText } = render(
      <ErrorBoundary>
        <ProblematicComponent />
      </ErrorBoundary>
    );
    
    expect(getByTestId('error-boundary-fallback')).toBeTruthy();
    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('Test Error')).toBeTruthy();
    
    spy.mockRestore();
  });
});
