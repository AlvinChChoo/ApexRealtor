import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { RotateCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PerformanceGauge from './PerformanceGauge';
import { RENPerformance } from '../../types';

type PendingTaskLog = {
  TaskLogId: number;
  TaskType: string;
  TaskDesc: string;
  RequestDate?: string;
  RequestUserName?: string;
  RequestStatus?: string;
  RefId?: string;
  RowId?: string | number;
  RefNo?: string;
  TransType?: string;
};

type ApiResponse<T> = {
  status: 'success' | 'fail' | 'no_data_found';
  data?: T | T[];
  error?: string;
};

type RentalApplication = {
  ApplicationId: string | number;
  PropertyAddress?: string;
  RefNo?: string | number;
  ApplicationStatus?: string;
  DocMUid?: string;
  TenancyPeriodFrom?: string;
  TenancyPeriodTo?: string;
};

type SummaryRow = {
  ApplicationStatus: string;
  Cnt: number;
};

type CommissionPayoutRow = Record<string, any>;

const PENDING_TASK_LOG_URL =
  API_ENDPOINTS.PENDING_TASK_LOG_GET;

const APP_GET_URL =
  API_ENDPOINTS.RENTAL_APPLICATION_SUMMARY_GET;

const SUMMARY_URL =
  API_ENDPOINTS.APPLICATION_STATUS_SUMMARY_GET;

const COMM_PAYOUT_URL =
  API_ENDPOINTS.PAYOUT_COMMISSION_REPORT_GET;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const [activities, setActivities] = useState<PendingTaskLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const [summaryMap, setSummaryMap] = useState<Record<string, number>>({});
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [upcomingDue, setUpcomingDue] = useState<RentalApplication[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [upcomingError, setUpcomingError] = useState<string | null>(null);

  const [commissionPayoutRows, setCommissionPayoutRows] = useState<CommissionPayoutRow[]>([]);
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [commissionError, setCommissionError] = useState<string | null>(null);

  const normalize = (s: string | undefined | null) => (s || '').toLowerCase().trim();

  const toNumber = useCallback((v: any): number => {
    if (v === null || v === undefined || v === '') return 0;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return Number.isNaN(n) ? 0 : n;
  }, []);

  const loggedInUserName = useMemo(() => {
    return String(localStorage.getItem('userName') || '').trim().toLowerCase();
  }, []);

  const totalAtlProFeesForLoggedInLister = useMemo(() => {
    return commissionPayoutRows.reduce((sum, row) => {
      const listerUserName = String(row?.ListerUserName || '').trim().toLowerCase();

      if (!loggedInUserName) return sum;
      if (listerUserName !== loggedInUserName) return sum;

      return sum + toNumber(row?.AtlProFees);
    }, 0);
  }, [commissionPayoutRows, loggedInUserName, toNumber]);

  const renData: RENPerformance = useMemo(
    () => ({
      totalRevenue: totalAtlProFeesForLoggedInLister,
      monthlyTarget: 480000,
      completedDeals: 156,
      activeListings: 89,
    }),
    [totalAtlProFeesForLoggedInLister]
  );

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);

    try {
      const formData = new URLSearchParams();
      formData.append('UserName', localStorage.getItem('userName') || '');
      formData.append('ReturnRowCnt', '50');

      const resp = await fetch(SUMMARY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const json = await resp.json();

      if (json?.status === 'success' && Array.isArray(json.data)) {
        const map: Record<string, number> = {};
        (json.data as SummaryRow[]).forEach((r) => {
          const key = normalize(r.ApplicationStatus || 'Unknown');
          map[key] = (map[key] || 0) + (Number(r.Cnt) || 0);
        });
        setSummaryMap(map);
      } else if (json?.status === 'no_data_found') {
        setSummaryMap({});
      } else {
        throw new Error(json?.error || 'Unknown summary error');
      }
    } catch (e: any) {
      setSummaryMap({});
      setSummaryError(e?.message || 'Failed to load status summary');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const getCount = useCallback(
    (aliases: string[]) =>
      aliases.reduce((acc, a) => acc + (summaryMap[normalize(a)] || 0), 0),
    [summaryMap]
  );

  const tiles = useMemo(
    () => ({
      review: getCount(['pending review', 'review']),
      pendingCommission: getCount(['pending commission']),
      partialCommission: getCount(['partial commission', 'partial commission paid']),
      commissionPaid: getCount(['commission paid', 'paid commission']),
      rejected: getCount(['rejected']),
      aborted: getCount(['deal aborted', 'aborted']),
    }),
    [getCount]
  );

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const body = new URLSearchParams();

      const isAccountUser =
        String(localStorage.getItem('account') || '').trim().toUpperCase() === 'Y';

      if (!isAccountUser) {
        body.append('UserName', localStorage.getItem('userName') || '');
      }

      const resp = await fetch(PENDING_TASK_LOG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const json = await resp.json();

      if (json?.status !== 'success' || !Array.isArray(json?.data)) {
        throw new Error('Invalid response');
      }

      const sorted = [...json.data].sort(
        (a, b) => (b.TaskLogId ?? 0) - (a.TaskLogId ?? 0)
      );

      setActivities(sorted);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      setError(err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUpcomingDue = useCallback(async () => {
    setUpcomingLoading(true);
    setUpcomingError(null);

    try {
      const body = new URLSearchParams();
      body.append('UserName', localStorage.getItem('userName') || '');
      body.append('ApplicationId', '');
      body.append('ReportType', 'UpcomingDue');
      body.append('TransType', 'Rental');
      body.append('SearchKeyword', '');
      body.append('ShowOnlyExpiringTrans', '');
      body.append('ReturnRowCnt', '50');
      body.append('ApplicationStatus', '');

      const resp = await fetch(APP_GET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const json: ApiResponse<RentalApplication> = await resp.json();

      if (json.status === 'success' && json.data) {
        const list = Array.isArray(json.data) ? json.data : [json.data];
        setUpcomingDue(list);
      } else if (json.status === 'no_data_found') {
        setUpcomingDue([]);
      } else {
        throw new Error(json.error || 'Failed to load upcoming due applications');
      }
    } catch (e: any) {
      setUpcomingDue([]);
      setUpcomingError(e?.message || 'Failed to load upcoming due applications');
    } finally {
      setUpcomingLoading(false);
    }
  }, []);

  const fetchCommissionPayouts = useCallback(async () => {
    setCommissionLoading(true);
    setCommissionError(null);

    try {
      const body = new URLSearchParams();
      body.append('UserName', localStorage.getItem('userName') || '');
      body.append('StartDate', '1-Jan-2026');
      body.append('EndDate', '30-Dec-2026');
      body.append('ReportMode', 'PAYOUT');

      const resp = await fetch(COMM_PAYOUT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const json = await resp.json();

      if (json?.status === 'success') {
        const arr = Array.isArray(json?.data) ? json.data : [];
        setCommissionPayoutRows(arr);
      } else if (json?.status === 'no_data_found') {
        setCommissionPayoutRows([]);
      } else {
        throw new Error(json?.error || 'Failed to load commission payout records');
      }
    } catch (e: any) {
      setCommissionPayoutRows([]);
      setCommissionError(e?.message || 'Failed to load commission payout records');
    } finally {
      setCommissionLoading(false);
    }
  }, []);

  const handleExportUpcomingDue = useCallback(() => {
    if (!upcomingDue.length) {
      alert('No upcoming due tenancies to export.');
      return;
    }

    const headers = [
      'ApplicationId',
      'RefNo',
      'PropertyAddress',
      'TenancyPeriodFrom',
      'TenancyPeriodTo',
      'ApplicationStatus',
    ];

    const escapeCell = (val: unknown): string => {
      const v = val == null ? '' : String(val);
      return `"${v.replace(/"/g, '""')}"`;
    };

    const rows = upcomingDue.map((app) => [
      app.ApplicationId,
      app.RefNo ?? '',
      app.PropertyAddress ?? '',
      app.TenancyPeriodFrom ?? '',
      app.TenancyPeriodTo ?? '',
      app.ApplicationStatus ?? '',
    ]);

    const csvLines: string[] = [];
    csvLines.push(headers.map(escapeCell).join(','));
    rows.forEach((row) => {
      csvLines.push(row.map(escapeCell).join(','));
    });

    const csvContent = csvLines.join('\r\n');
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.setAttribute('download', `upcoming_due_tenancies_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [upcomingDue]);

  useEffect(() => {
    fetchSummary();
    fetchActivities();
    fetchUpcomingDue();
    fetchCommissionPayouts();
  }, [fetchSummary, fetchActivities, fetchUpcomingDue, fetchCommissionPayouts]);

  const handleView = useCallback(
    (a: PendingTaskLog) => {
      const appId = String(a.RefId ?? '').trim();
      const rowId = String(a.RowId ?? a.TaskLogId ?? '').trim();

      if (!appId) {
        alert('Missing ApplicationId (RefId) in this task.');
        return;
      }

      navigate(`/rental/${encodeURIComponent(appId)}`, {
        state: {
          application: { ApplicationId: appId },
          RowId: rowId || '',
          from: 'dashboard',
        },
      });
    },
    [navigate]
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleDateString()}
        </div>
      </div>

      

      {/* GRID: Performance left, upcoming + task right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Performance */}
        <div className="lg:col-span-1 space-y-4">
          <PerformanceGauge
            current={renData.totalRevenue}
            target={renData.monthlyTarget}
            title="REN Performance"
          />

          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="text-sm text-gray-500">Monthly Revenue</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              RM{' '}
              {renData.totalRevenue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>

            {commissionLoading && (
              <p className="mt-2 text-xs text-gray-500">Loading commission payout...</p>
            )}

            {commissionError && (
              <p className="mt-2 text-xs text-red-600">{commissionError}</p>
            )}
          </div>

          {summaryLoading && (
            <div className="bg-white rounded-xl shadow-lg p-4 text-sm text-gray-500">
              Loading summary...
            </div>
          )}

          {summaryError && (
            <div className="bg-white rounded-xl shadow-lg p-4 text-sm text-red-600">
              {summaryError}
            </div>
          )}
        </div>

        {/* RIGHT: TWO SEPARATE CONTAINERS */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Due */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">
                Upcoming Due Tenancies
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportUpcomingDue}
                  disabled={!upcomingDue.length}
                  className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-100 disabled:opacity-60"
                >
                  Export to Excel
                </button>
                <button
                  type="button"
                  onClick={fetchUpcomingDue}
                  disabled={upcomingLoading}
                  className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-100 disabled:opacity-60"
                >
                  <RotateCw size={14} className={upcomingLoading ? 'animate-spin' : ''} />
                  {upcomingLoading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            </div>

            {upcomingLoading && <p className="text-sm text-gray-500">Loading upcoming due…</p>}
            {upcomingError && <p className="text-sm text-red-600">Error: {upcomingError}</p>}

            {!upcomingLoading && !upcomingError && upcomingDue.length === 0 && (
              <p className="text-sm text-gray-500">No upcoming due tenancies found.</p>
            )}

            {!upcomingLoading && !upcomingError && upcomingDue.length > 0 && (
              <div className="space-y-2">
                {upcomingDue.map((app) => (
                  <div
                    key={app.ApplicationId}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {app.RefNo ? `Ref: ${app.RefNo} • ` : ''}
                        {app.PropertyAddress || '(No address)'}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Status: {app.ApplicationStatus || 'Unknown'}
                        {app.TenancyPeriodTo ? ` • Tenancy End: ${app.TenancyPeriodTo}` : ''}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/rental/${app.ApplicationId}`, {
                          state: { application: app, from: 'dashboard-upcoming' },
                        })
                      }
                      className="text-xs px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-100"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Task List */}
          <div className="bg-gray-100 rounded-xl shadow-inner p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Task List ({activities.length} {activities.length === 1 ? 'task' : 'tasks'})
              </h3>

              <div className="flex items-center gap-3">
                {lastRefreshedAt && (
                  <span className="text-xs text-gray-500">
                    Refreshed {lastRefreshedAt.toLocaleTimeString()}
                  </span>
                )}
                <button
                  type="button"
                  onClick={fetchActivities}
                  disabled={loading}
                  className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-md border border-gray-400 hover:bg-gray-200 disabled:opacity-60"
                >
                  <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
                  {loading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            </div>

            {loading && <p className="text-sm text-gray-500">Loading…</p>}
            {error && <p className="text-sm text-red-600">Error: {error}</p>}
            {!loading && !error && activities.length === 0 && (
              <p className="text-sm text-gray-600">No tasks available.</p>
            )}

            <div className="space-y-4">
              {activities.map((t) => (
                <div
                  key={t.TaskLogId}
                  className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm"
                >
                  <div className="min-w-0">
                    <p
                      className="font-medium text-gray-900 break-words leading-5"
                      dangerouslySetInnerHTML={{ __html: t.TaskDesc || '' }}
                    />
                    <p className="text-sm text-gray-600">
                      {t.RequestUserName ? `By ${t.RequestUserName}` : ''}
                      {t.RequestDate ? ` • ${t.RequestDate}` : ''}
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      Ref No : {t.RefNo ?? '—'} ({t.RefId ?? '—'})
                      {t.TransType ? ` • ${t.TransType}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-gray-700">{t.RequestStatus ?? '—'}</span>
                    <button
                      type="button"
                      onClick={() => handleView(t)}
                      className="text-xs px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-200"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;