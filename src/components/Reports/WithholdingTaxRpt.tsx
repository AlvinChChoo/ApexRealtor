import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useState, useCallback, useMemo } from 'react';
import { DollarSign, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const LIST_URL =
  API_ENDPOINTS.WITHOLDING_TAX_RPT_GET;

interface WithholdingTaxRow {
  ApplicationId?: number | null;
  AddDate?: string;
  RefNo?: string;
  TransId?: number | string | null;
  PayoutDate?: string;
  SubmissionDate?: string;
  ListerUserName?: string;
  ListerDisplayName?: string;
  ListerWitholdingTaxPctg?: number;
  ListerWitholdingTaxAmt?: number;
}

const WithholdingTaxRpt: React.FC = () => {
  const { user } = useAuth();

  const [rows, setRows] = useState<WithholdingTaxRow[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reportMode, setReportMode] = useState<string>('PAYOUT');
  const [returnRowCnt, setReturnRowCnt] = useState<string>('50');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const FETCH_TIMEOUT_MS = 600000;

  const fetchWithTimeout = async (
    url: string,
    options: RequestInit,
    timeoutMs = FETCH_TIMEOUT_MS
  ) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return resp;
    } finally {
      clearTimeout(id);
    }
  };

  const toNumber = (v: any): number => {
    if (v === null || v === undefined || v === '') return 0;
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  };

  const formatCurrency = (amount: string | number) => {
    const num =
      typeof amount === 'string' ? parseFloat(amount || '0') : amount || 0;

    return isNaN(num)
      ? '0.00'
      : num.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  };

  const formatPctg = (value: string | number) => {
    const num =
      typeof value === 'string' ? parseFloat(value || '0') : value || 0;

    return isNaN(num)
      ? '0.00'
      : num.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr === '1900-01-01') return '';
    return dateStr;
  };

  const fetchWithholdingTax = useCallback(
    async (sd: string = startDate, ed: string = endDate, mode: string = reportMode) => {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        const formData = new URLSearchParams();
        formData.append('ReturnRowCnt', returnRowCnt || '50');
        formData.append('StartDate', sd || '');
        formData.append('EndDate', ed || '');
        formData.append('ReportMode', mode || 'PAYOUT');

        const response = await fetchWithTimeout(
          LIST_URL,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString(),
          },
          FETCH_TIMEOUT_MS
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result?.status === 'success') {
          const arr = Array.isArray(result?.data) ? result.data : [];
          setRows(arr);
          console.log('Withholding Tax API raw result:', result);
          console.log('Withholding Tax API data[0]:', arr[0]);
        } else if (result?.status === 'no_data_found') {
          setRows([]);
        } else {
          throw new Error(
            typeof result?.error === 'string'
              ? result.error
              : 'Failed to fetch withholding tax report'
          );
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch withholding tax report');
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [user, startDate, endDate, reportMode, returnRowCnt]
  );

  const dateRangeText = useMemo(() => {
    const sd = startDate ? startDate : 'ALL';
    const ed = endDate ? endDate : 'ALL';
    return `Date Range : ${sd} to ${ed}`;
  }, [startDate, endDate]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.withholdingTaxAmt += toNumber(row.ListerWitholdingTaxAmt);
        return acc;
      },
      {
        withholdingTaxAmt: 0,
      }
    );
  }, [rows]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <DollarSign className="text-blue-600" size={32} />
            Withholding Tax Report
          </h1>
          <div className="mt-1 text-sm text-gray-600">{dateRangeText}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <span>Payout Date :</span>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span>Mode :</span>
            <select
              value={reportMode}
              onChange={(e) => setReportMode(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="PAYOUT">PAYOUT</option>
              <option value="EXPLOSION">EXPLOSION</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span>Rows :</span>
            <select
              value={returnRowCnt}
              onChange={(e) => setReturnRowCnt(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
              <option value="1000">1000</option>
            </select>
          </div>

          <button
            onClick={() => fetchWithholdingTax()}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading withholding tax data...</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            Error Loading Data
          </h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => fetchWithholdingTax(startDate, endDate, reportMode)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs md:text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  <th className="px-3 py-2 text-left border-b">Ref No</th>
                  <th className="px-3 py-2 text-left border-b">Application ID</th>
                  <th className="px-3 py-2 text-left border-b">Trans ID</th>
                  <th className="px-3 py-2 text-left border-b">Lister User Name</th>
                  <th className="px-3 py-2 text-left border-b">Lister Display Name</th>
                  <th className="px-3 py-2 text-left border-b">Add Date</th>
                  <th className="px-3 py-2 text-left border-b">Payout Date</th>
                  <th className="px-3 py-2 text-left border-b">Submission Date</th>
                  <th className="px-3 py-2 text-right border-b">WHT %</th>
                  <th className="px-3 py-2 text-right border-b">Less WHT</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, idx) => {
                  const baseClass =
                    'px-3 py-2 border-b whitespace-nowrap align-middle';
                  const rowClass = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';

                  return (
                    <tr
                      key={`${row.ApplicationId ?? 'app'}-${row.TransId ?? 'trans'}-${idx}`}
                      className={rowClass}
                    >
                      <td className={baseClass}>{row.RefNo || ''}</td>
                      <td className={baseClass}>{row.ApplicationId ?? ''}</td>
                      <td className={baseClass}>{row.TransId ?? ''}</td>
                      <td className={baseClass}>{row.ListerUserName || ''}</td>
                      <td className={baseClass}>{row.ListerDisplayName || ''}</td>
                      <td className={baseClass}>{formatDate(row.AddDate)}</td>
                      <td className={baseClass}>{formatDate(row.PayoutDate)}</td>
                      <td className={baseClass}>{formatDate(row.SubmissionDate)}</td>
                      <td className={`${baseClass} text-right`}>
                        {formatPctg(row.ListerWitholdingTaxPctg || 0)}
                      </td>
                      <td className={`${baseClass} text-right`}>
                        {formatCurrency(row.ListerWitholdingTaxAmt || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="bg-gray-100 font-semibold text-gray-800">
                  <td className="px-3 py-2 border-t" colSpan={9}>
                    TOTAL
                  </td>
                  <td className="px-3 py-2 border-t text-right">
                    {formatCurrency(totals.withholdingTaxAmt)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No Withholding Tax Data Found
          </h3>
          <p className="text-gray-500 mb-4">
            {(startDate || endDate || reportMode !== 'PAYOUT' || returnRowCnt !== '50')
              ? 'No records match your current filters.'
              : 'No withholding tax records found.'}
          </p>

          {(startDate || endDate || reportMode !== 'PAYOUT' || returnRowCnt !== '50') && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setReportMode('PAYOUT');
                setReturnRowCnt('50');
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default WithholdingTaxRpt;