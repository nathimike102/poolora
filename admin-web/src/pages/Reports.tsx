import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, qs } from '../lib/api';
import { useApi } from '../lib/useApi';
import { money, num, pct, short } from '../lib/format';
import { ErrorBox, Field, Loading, PageHead, StatTile } from '../components/ui';
import { LineChart } from '../components/LineChart';
import { FORMAT_NAMES, ReportSchedules } from '../components/ReportSchedules';

type Format = 'count' | 'money' | 'percent' | 'decimal' | 'minutes';
interface Report {
  type: string;
  from: string;
  to: string;
  groupBy: 'day' | 'week' | 'month';
  summary: Array<{ label: string; value: number; format: Format }>;
  series: Array<Record<string, number | string>>;
  seriesColumns: Array<{ key: string; label: string; format: Format }>;
  tables: Array<{ title: string; columns: string[]; rows: Array<Array<string | number>> }>;
}

const TYPES: Array<[string, string]> = [
  ['users', 'Users'],
  ['rides', 'Rides'],
  ['financial', 'Money'],
  ['performance', 'Performance'],
  ['safety', 'Safety'],
];

const RANGES: Array<[string, string, number]> = [
  ['7d', 'Last 7 days', 7],
  ['30d', 'Last 30 days', 30],
  ['90d', 'Last 90 days', 90],
  ['365d', 'Last 12 months', 365],
];

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function show(value: number, format: Format): string {
  switch (format) {
    case 'money': return money(value);
    case 'percent': return pct(value, 1);
    case 'decimal': return value ? value.toFixed(2) : '—';
    case 'minutes': return value ? `${num(value)} min` : '—';
    default: return num(value);
  }
}

function periodLabel(iso: string, groupBy: Report['groupBy']): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = groupBy === 'month'
    ? { month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata' }
    : { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' };
  return d.toLocaleDateString('en-IN', opts);
}

export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const type = params.get('type') ?? 'rides';
  const range = params.get('range') ?? '30d';
  const groupBy = (params.get('groupBy') ?? (range === '365d' ? 'month' : range === '90d' ? 'week' : 'day')) as Report['groupBy'];
  const customFrom = params.get('from');
  const customTo = params.get('to');
  const days = RANGES.find((r) => r[0] === range)?.[2] ?? 30;
  // Computed once per choice: a fresh `new Date()` each render would change the
  // request URL every time and reload the report forever
  const { from, to } = useMemo(() => {
    const end = customTo ? new Date(`${customTo}T23:59:59+05:30`) : new Date();
    const start = customFrom ? new Date(`${customFrom}T00:00:00+05:30`) : new Date(end.getTime() - days * 86_400_000);
    return { from: start, to: end };
  }, [customFrom, customTo, days]);
  const query = qs({ from: from.toISOString(), to: to.toISOString(), groupBy });
  const { data, error, loading, reload } = useApi<Report>(`/admin/reports/${type}${query}`);
  const [downloadError, setDownloadError] = useState('');

  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next);
  };

  const [format, setFormat] = useState<keyof typeof FORMAT_NAMES>('xlsx');

  const download = async () => {
    setDownloadError('');
    try {
      await api.download(`/admin/reports/${type}${query}&format=${format}`, `poolora-${type}-${isoDay(from)}-to-${isoDay(to)}.${format}`);
    } catch (e) {
      setDownloadError((e as Error).message);
    }
  };

  const seriesFormat = data?.seriesColumns[0]?.format ?? 'count';

  return (
    <div className="stack">
      <PageHead title="Reports" sub="All times in India time. Data up to two years back." actions={
        <div className="row" style={{ gap: 6 }}>
          <select className="input" aria-label="File type" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
            {Object.entries(FORMAT_NAMES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button className="btn" onClick={download} disabled={!data}>Download</button>
        </div>
      } />
      {downloadError ? <div className="error-text">{downloadError}</div> : null}

      <div className="card row" style={{ gap: 16, alignItems: 'flex-end' }}>
        <div className="seg" role="group" aria-label="Report">
          {TYPES.map(([k, l]) => <button key={k} aria-pressed={type === k} onClick={() => set({ type: k })}>{l}</button>)}
        </div>
        <Field label="Range">
          <select className="input" value={customFrom ? 'custom' : range} onChange={(e) => (e.target.value === 'custom' ? set({ from: isoDay(from), to: isoDay(to) }) : set({ range: e.target.value, from: null, to: null, groupBy: null }))}>
            {RANGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            <option value="custom">Custom dates</option>
          </select>
        </Field>
        {customFrom ? (
          <>
            <Field label="From"><input className="input" type="date" value={customFrom} max={customTo ?? undefined} onChange={(e) => set({ from: e.target.value })} /></Field>
            <Field label="To"><input className="input" type="date" value={customTo ?? ''} min={customFrom} onChange={(e) => set({ to: e.target.value })} /></Field>
          </>
        ) : null}
        <Field label="Group by">
          <select className="input" value={groupBy} onChange={(e) => set({ groupBy: e.target.value })}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </Field>
      </div>

      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading label="Building the report" /> : null}
      {data ? (
        <>
          <div className="grid cols-4">
            {data.summary.map((s) => <StatTile key={s.label} label={s.label} value={show(s.value, s.format)} />)}
          </div>
          <div className="card">
            <h2>{data.seriesColumns.map((c) => c.label).join(', ')} by {data.groupBy}</h2>
            <LineChart
              title={`${TYPES.find((t) => t[0] === type)?.[1]} report`}
              rows={data.series}
              series={data.seriesColumns}
              formatX={(v) => periodLabel(v, data.groupBy)}
              formatY={(v) => (seriesFormat === 'money' ? `₹${short(v)}` : short(v))}
            />
            <details style={{ marginTop: 12 }}>
              <summary className="muted" style={{ cursor: 'pointer' }}>Show the figures as a table</summary>
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Period</th>
                      {Object.keys(data.series[0] ?? {}).filter((k) => k !== 'period').map((k) => <th key={k} className="num">{data.seriesColumns.find((c) => c.key === k)?.label ?? k}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {data.series.map((row) => (
                      <tr key={String(row.period)}>
                        <td>{periodLabel(String(row.period), data.groupBy)}</td>
                        {Object.entries(row).filter(([k]) => k !== 'period').map(([k, v]) => (
                          <td key={k} className="num">{show(Number(v), data.seriesColumns.find((c) => c.key === k)?.format ?? 'count')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
          <div className="grid cols-2">
            {data.tables.map((t) => (
              <div key={t.title} className="card">
                <h2>{t.title}</h2>
                {t.rows.length === 0 ? <p className="faint">Nothing in this range.</p> : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr>{t.columns.map((c, i) => <th key={c} className={typeof t.rows[0]?.[i] === 'number' ? 'num' : undefined}>{c}</th>)}</tr></thead>
                      <tbody>{t.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={typeof c === 'number' ? 'num' : undefined}>{typeof c === 'number' ? num(c) : c}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : null}

      <ReportSchedules />
    </div>
  );
}
