import React, { useEffect } from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

// Mock useAsyncFn hook to control execute behaviour
jest.mock('../useAsync', () => ({
  useAsyncFn: (fn: any, _opts: any) => {
    const execute = jest.fn().mockResolvedValue('ok-result');
    return {
      data: null,
      loading: false,
      error: null,
      execute,
      refetch: execute,
    };
  },
}));

import { useApi } from '../useApi';

function Consumer({ api }: { api: () => Promise<string> }) {
  const { data, loading, execute } = useApi(api);
  useEffect(() => {
    // call execute to ensure returned function is callable
    execute().catch(() => {});
  }, [execute]);

  return (
    <Text testID="state">{String(data)}|{String(loading)}</Text>
  );
}

test('useApi returns execute and state fields', async () => {
  const { getByTestId } = render(<Consumer api={() => Promise.resolve('ok')} />);
  const txt = String(getByTestId('state').props.children);
  expect(txt).toEqual(expect.stringContaining('null'));
  expect(txt).toEqual(expect.stringContaining('false'));
});
