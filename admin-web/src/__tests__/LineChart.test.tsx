import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { LineChart } from '../components/LineChart';

const rows = [
  { period: '2026-09-01T00:00:00.000Z', completed: 4, cancelled: 1 },
  { period: '2026-09-02T00:00:00.000Z', completed: 7, cancelled: 2 },
];

describe('LineChart', () => {
  it('draws one line per series with a legend and end labels', () => {
    const { container, getByText } = render(
      <LineChart title="Rides" rows={rows} series={[{ key: 'completed', label: 'Completed' }, { key: 'cancelled', label: 'Cancelled' }]} formatX={(v) => v.slice(5, 10)} formatY={String} />,
    );
    expect(container.querySelectorAll('path')).toHaveLength(2);
    expect(getByText('Completed')).toBeTruthy();
    expect(getByText('7')).toBeTruthy(); // last value labelled at the line's end
  });

  it('never draws more than three series', () => {
    const many = [1, 2, 3, 4].map((i) => ({ key: `s${i}`, label: `S${i}` }));
    const { container } = render(<LineChart title="x" rows={[{ period: 'a', s1: 1, s2: 2, s3: 3, s4: 4 }]} series={many} formatX={String} formatY={String} />);
    expect(container.querySelectorAll('path')).toHaveLength(3);
  });

  it('says so when there is no data', () => {
    const { getByText } = render(<LineChart title="x" rows={[]} series={[{ key: 'a', label: 'A' }]} formatX={String} formatY={String} />);
    expect(getByText('No data for this range.')).toBeTruthy();
  });
});
