import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useAsync, useAsyncFn } from '../useAsync';

function ConsumerAsync({ fn }: { fn: () => Promise<string> }) {
  const { data, loading, error } = useAsync(fn);
  return <Text testID="state">{String(data)}|{String(loading)}|{error ? error.message : ''}</Text>;
}

function ConsumerAsyncFn({ fn }: { fn: () => Promise<string> }) {
  const { data, loading, error, execute } = useAsyncFn(fn);
  React.useEffect(() => {
    execute().catch(() => {});
  }, [execute]);
  return <Text testID="state2">{String(data)}|{String(loading)}|{error ? error.message : ''}</Text>;
}

test('useAsync resolves and sets data', async () => {
  const { findByTestId } = render(<ConsumerAsync fn={() => Promise.resolve('ok')} />);
  const el = await findByTestId('state');
  expect(String(el.props.children)).toEqual(expect.stringContaining('ok'));
  expect(String(el.props.children)).toEqual(expect.stringContaining('false'));
});

test('useAsyncFn execute sets data', async () => {
  const { findByTestId } = render(<ConsumerAsyncFn fn={() => Promise.resolve('ok2')} />);
  const el = await findByTestId('state2');
  expect(String(el.props.children)).toEqual(expect.stringContaining('ok2'));
});
