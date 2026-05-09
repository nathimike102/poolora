/**
 * components/ErrorBoundary.tsx
 *
 * Top-level crash safety net. Catches any unhandled render errors
 * from child components and shows a user-friendly fallback screen
 * instead of a white screen / app crash.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <AppNavigator />
 *   </ErrorBoundary>
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to your crash-reporting service here (e.g. Sentry, Crashlytics)
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  private handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View testID="error-boundary-fallback" style={styles.container}>
          <Text style={styles.emoji}>😵</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </Text>
          <Pressable style={styles.button} onPress={this.handleRestart}>
            <Text style={styles.buttonText}>Restart</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 32,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    maxWidth: 280,
  },
  button: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
