import React from 'react';
import { render } from '@testing-library/react-native';

import { AvatarRing } from '../AvatarRing';

/** The arc's length as a share of the whole circle */
function filledShare(tree: ReturnType<typeof render>): number | null {
  const arc = tree.UNSAFE_root.findAll(n => typeof n.props.strokeDasharray === 'string')[0];
  if (!arc) return null;
  const [dash, whole] = String(arc.props.strokeDasharray).split(' ').map(Number);
  return dash / whole;
}

describe('AvatarRing', () => {
  test('fills as much of the ring as the profile is complete', () => {
    expect(filledShare(render(<AvatarRing name="Tendai" progress={1 / 3} />))).toBeCloseTo(1 / 3, 5);
    expect(filledShare(render(<AvatarRing name="Tendai" progress={0.5} />))).toBeCloseTo(0.5, 5);
  });

  test('an empty profile draws no arc, only the track', () => {
    expect(filledShare(render(<AvatarRing name="Tendai" progress={0} />))).toBeNull();
  });

  test('shows the initial without a picture', () => {
    expect(render(<AvatarRing name="tendai" progress={0.5} />).getByText('T')).toBeTruthy();
  });
});
