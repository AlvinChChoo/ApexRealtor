import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useEffect, useMemo, useState } from 'react';
import { Percent, Search, RefreshCcw, CheckCircle2, AlertTriangle, Upload } from 'lucide-react';

type Emp = {
  UserName: string;
  Branch: string | null;
  Nric: string | null;
  NricName: string;
  DisplayName: string;
  EmpGroups: string | null;
  LtdSales?: number | string | null;
  OpeningIndPctg?: number | string | null;
  IndividualPctg?: number | string | null;
};

type ListApiResponse =
  | { status: 'success'; data: Emp[] }
  | { status: 'no_data_found'; error?: string }
  | { status: 'error'; error?: string; detail?: any };

type BatchResult = {
  UserName: string;
  status: 'success' | 'error' | 'warning';
  error?: string;
  warning?: string;
  LTDSales?: number | null;
  OpeningIndPctg?: number | null;
  detail?: any;
};

type BatchApiResponse = {
  status: 'success' | 'partial_success' | 'error';
  updated: number;
  failed: number;
  results: BatchResult[];
};

const LIST_ENDPOINT = API_ENDPOINTS.INT_EMP_GET;
const BATCH_ENDPOINT = API_ENDPOINTS.INT_EMP_SET_INDIVIDUAL_PCTG_BATCH;

type Row = Emp & {
  _serverLTDSales: number | null;
  _serverOpeningIndPctg: number | null;
  _inputLTDSales: string;
  _inputOpeningIndPctg: string;
};

const toNum = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

const formatDisplay = (v: any): string => {
  const n = toNum(v);
  if (n === null) return '-';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

const RenIndividualPctgSession: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    window.setTimeout(() => setToast(null), 2500);
  };

  const fetchList = async (signal?: AbortSignal) => {
    try {
      setErr(null);
      setLoading(true);

      const body = new URLSearchParams();
      body.set('Def', '');
      body.set('ApplicationId', '');
      body.set('ShowActive', '1');
      
      

      const res = await fetch(LIST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json: ListApiResponse = await res.json();

      if (json.status === 'success') {
        const mapped: Row[] = (json.data || []).map((r) => {
          const ltdSales = toNum(r.LtdSales);
          const openingIndPctg = toNum(r.OpeningIndPctg);

          return {
            ...r,
            _serverLTDSales: ltdSales,
            _serverOpeningIndPctg: openingIndPctg,
            _inputLTDSales: ltdSales === null ? '' : String(ltdSales),
            _inputOpeningIndPctg: openingIndPctg === null ? '' : String(openingIndPctg),
          };
        });

        setRows(mapped);
      } else if (json.status === 'no_data_found') {
        setRows([]);
        setErr(json.error || 'No data found.');
      } else {
        setRows([]);
        setErr(json.error || 'Server returned an error.');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setErr(e?.message || 'Network error.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    fetchList(ctrl.signal);
    return () => ctrl.abort();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const name = (r.DisplayName || r.NricName || r.UserName || '').toLowerCase();
      const branch = (r.Branch || '').toLowerCase();
      const groups = (r.EmpGroups || '').toLowerCase();

      return name.includes(q) || branch.includes(q) || groups.includes(q);
    });
  }, [rows, query]);

  const changed = useMemo(() => {
    return rows
      .map((r) => {
        const ltdSales = toNum(r._inputLTDSales);
        const openingIndPctg = toNum(r._inputOpeningIndPctg);

        const nextLTDSales = ltdSales === null ? null : ltdSales;
        const nextOpeningIndPctg = openingIndPctg === null ? null : clampPct(openingIndPctg);

        const ltdChanged =
          (r._serverLTDSales === null && nextLTDSales !== null) ||
          (r._serverLTDSales !== null && nextLTDSales === null) ||
          (r._serverLTDSales !== null &&
            nextLTDSales !== null &&
            Math.abs(r._serverLTDSales - nextLTDSales) > 1e-9);

        const openingChanged =
          (r._serverOpeningIndPctg === null && nextOpeningIndPctg !== null) ||
          (r._serverOpeningIndPctg !== null && nextOpeningIndPctg === null) ||
          (r._serverOpeningIndPctg !== null &&
            nextOpeningIndPctg !== null &&
            Math.abs(r._serverOpeningIndPctg - nextOpeningIndPctg) > 1e-9);

        if (!ltdChanged && !openingChanged) return null;

        return {
          UserName: r.UserName,
          LTDSales: nextLTDSales,
          OpeningIndPctg: nextOpeningIndPctg,
        };
      })
      .filter(Boolean) as {
      UserName: string;
      LTDSales: number | null;
      OpeningIndPctg: number | null;
    }[];
  }, [rows]);

  const onLTDSalesChange = (userName: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.UserName === userName ? { ...r, _inputLTDSales: value } : r))
    );
  };

  const onOpeningIndPctgChange = (userName: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.UserName === userName ? { ...r, _inputOpeningIndPctg: value } : r))
    );
  };

  const updateAll = async () => {
    if (changed.length === 0) return;

    setSavingAll(true);
    setErr(null);

    try {
      const payloadItems = changed.map((c) => ({
        UserName: c.UserName,
        LTDSales: c.LTDSales,
        OpeningIndPctg: c.OpeningIndPctg,
      }));

      const form = new URLSearchParams();
      form.set('items', JSON.stringify({ items: payloadItems }));

      const res = await fetch(BATCH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json: BatchApiResponse = await res.json();

      if (json.results && Array.isArray(json.results)) {
        const successMap = new Map<
          string,
          {
            LTDSales: number | null;
            OpeningIndPctg: number | null;
          }
        >();

        json.results.forEach((r) => {
          if (r.status === 'success' || r.status === 'warning') {
            successMap.set(r.UserName, {
              LTDSales:
                r.LTDSales === null || typeof r.LTDSales === 'number'
                  ? (r.LTDSales ?? null)
                  : null,
              OpeningIndPctg:
                r.OpeningIndPctg === null || typeof r.OpeningIndPctg === 'number'
                  ? (r.OpeningIndPctg ?? null)
                  : null,
            });
          }
        });

        if (successMap.size > 0) {
          setRows((prev) =>
            prev.map((row) => {
              const next = successMap.get(row.UserName);
              if (!next) return row;

              return {
                ...row,
                LtdSales: next.LTDSales,
                OpeningIndPctg: next.OpeningIndPctg,
                _serverLTDSales: next.LTDSales,
                _serverOpeningIndPctg: next.OpeningIndPctg,
                _inputLTDSales: next.LTDSales === null ? '' : String(next.LTDSales),
                _inputOpeningIndPctg:
                  next.OpeningIndPctg === null ? '' : String(next.OpeningIndPctg),
              };
            })
          );
        }
      } else {
        setRows((prev) =>
          prev.map((row) => {
            const changedRow = changed.find((c) => c.UserName === row.UserName);
            if (!changedRow) return row;

            return {
              ...row,
              LtdSales: changedRow.LTDSales,
              OpeningIndPctg: changedRow.OpeningIndPctg,
              _serverLTDSales: changedRow.LTDSales,
              _serverOpeningIndPctg: changedRow.OpeningIndPctg,
              _inputLTDSales: changedRow.LTDSales === null ? '' : String(changedRow.LTDSales),
              _inputOpeningIndPctg:
                changedRow.OpeningIndPctg === null ? '' : String(changedRow.OpeningIndPctg),
            };
          })
        );
      }

      if (json.status === 'success') {
          await fetchList();
          alert('Selected REN details updated successfully.');
        } else if (json.status === 'partial_success') {
          await fetchList();
          showToast('err', `Updated ${json.updated}, failed ${json.failed}.`);
        } else {
          showToast('err', 'Batch update failed.');
        }
    } catch (e: any) {
      showToast('err', e?.message || 'Network error during batch update.');
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-blue-600/10 text-blue-500">
            <Percent size={22} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-black">REN Individual %</h2>
            <p className="text-sm text-slate-400">Load, edit, and batch update REN percentages</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchList()}
            disabled={loading || savingAll}
            className="inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-100 px-3 py-2 rounded-lg border border-slate-700 disabled:opacity-60"
          >
            <RefreshCcw size={18} />
            <span>{loading ? 'Refreshing…' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={updateAll}
            disabled={savingAll || changed.length === 0}
            className={[
              'inline-flex items-center space-x-2 px-4 py-2 rounded-lg border text-white transition-colors',
              savingAll || changed.length === 0
                ? 'bg-slate-400 border-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 border-blue-600',
            ].join(' ')}
            title={changed.length === 0 ? 'No changes to update' : `Update ${changed.length} change(s)`}
          >
            <Upload size={18} />
            <span>{savingAll ? 'Updating…' : `Update All (${changed.length})`}</span>
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, branch or group…"
            className="pl-10 pr-3 py-2 rounded-lg bg-slate-800 text-slate-100 placeholder-slate-400 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>

        <div className="text-sm text-slate-400">
          Showing <span className="text-slate-200 font-medium">{filtered.length}</span> of{' '}
          <span className="text-slate-200 font-medium">{rows.length}</span>
        </div>
      </div>

      {err && (
        <div className="rounded-lg border border-red-700 bg-red-900/20 p-4 text-red-200 mb-4">
          {err}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-300 bg-white">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Staff
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Branch
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Groups
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                LTD Sales
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                OpeningIndPctg
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                REN Individual %
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 bg-white">
            {filtered.map((r) => {
              const name = r.DisplayName || r.NricName || r.UserName || '(No Name)';

              const ltdSalesNum = toNum(r._inputLTDSales);
              const openingNum = toNum(r._inputOpeningIndPctg);

              const ltdChanged =
                (r._serverLTDSales === null && ltdSalesNum !== null) ||
                (r._serverLTDSales !== null && ltdSalesNum === null) ||
                (r._serverLTDSales !== null &&
                  ltdSalesNum !== null &&
                  Math.abs(r._serverLTDSales - ltdSalesNum) > 1e-9);

              const openingChanged =
                (r._serverOpeningIndPctg === null && openingNum !== null) ||
                (r._serverOpeningIndPctg !== null && openingNum === null) ||
                (r._serverOpeningIndPctg !== null &&
                  openingNum !== null &&
                  Math.abs(r._serverOpeningIndPctg - clampPct(openingNum)) > 1e-9);

              const isChanged = ltdChanged || openingChanged;

              return (
                <tr key={r.UserName} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-800">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                        {name.charAt(0).toUpperCase()}
                      </div>

                      <div className="flex flex-col">
                        <span className="font-medium">{name}</span>
                        <span className="text-xs text-slate-500">{r.UserName}</span>
                      </div>

                      {isChanged && (
                        <span
                          className="ml-2 inline-block w-2 h-2 rounded-full bg-amber-500"
                          title="Changed"
                        />
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-slate-700">{r.Branch || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{r.EmpGroups || '-'}</td>

                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        step="0.01"
                        value={r._inputLTDSales}
                        onChange={(e) => onLTDSalesChange(r.UserName, e.target.value)}
                        disabled={savingAll}
                        className="w-32 px-3 py-2 rounded-md bg-white text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100"
                      />
                    </div>

                    {r._inputLTDSales.trim() !== '' && toNum(r._inputLTDSales) === null && (
                      <div className="text-xs text-red-600 mt-1">Invalid number</div>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        max={100}
                        value={r._inputOpeningIndPctg}
                        onChange={(e) => onOpeningIndPctgChange(r.UserName, e.target.value)}
                        disabled={savingAll}
                        className="w-28 px-3 py-2 rounded-md bg-white text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100"
                      />
                      <span className="text-slate-500">%</span>
                    </div>

                    {r._inputOpeningIndPctg.trim() !== '' &&
                      toNum(r._inputOpeningIndPctg) === null && (
                        <div className="text-xs text-red-600 mt-1">Invalid number</div>
                      )}
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    <div className="flex items-center space-x-2">
                      <div className="w-28 px-3 py-2 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        {formatDisplay(r.IndividualPctg)}
                      </div>
                      <span className="text-slate-500">%</span>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No staff found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={updateAll}
          disabled={savingAll || changed.length === 0}
          className={[
            'inline-flex items-center space-x-2 px-4 py-2 rounded-lg border text-white transition-colors',
            savingAll || changed.length === 0
              ? 'bg-slate-400 border-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 border-blue-600',
          ].join(' ')}
          title={changed.length === 0 ? 'No changes to update' : `Update ${changed.length} change(s)`}
        >
          <Upload size={18} />
          <span>{savingAll ? 'Updating…' : 'Update'}</span>
        </button>
      </div>

      {toast && (
        <div
          className={[
            'fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg',
            toast.type === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white',
          ].join(' ')}
        >
          {toast.type === 'ok' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span className="text-sm">{toast.msg}</span>
        </div>
      )}
    </div>
  );
};

export default RenIndividualPctgSession;