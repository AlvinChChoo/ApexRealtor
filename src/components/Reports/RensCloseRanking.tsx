import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useState, useCallback, useMemo } from 'react';
import { DollarSign, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RentalApplication } from '../../types';

const LIST_URL =
  API_ENDPOINTS.PAYOUT_COMMISSION_REPORT_GET;

const SUBMISSION_SET_URL =
  API_ENDPOINTS.CLAIM_SUBMISSION_DATE_SET;

type RowKind = 'detail';

interface CommRow {
  kind: RowKind;
  department: string;
  ren: string;
  slotLabel: string;
  applicationId?: number;
  txId?: string;
  transId?: string;
  address?: string;
  claimType?: string;
  submissionDate?: string;
  payoutDate?: string;
  grossFees: number;
  introducerFee: number;
  netFees: number;
  commission: number;
  trainingFees: number;
  adminCharges: number;
  stampDuty: number;
  netComm: number;
  invPctg: number;
  sharingPctg: number;
  withholdingTaxPctg: number;
  withholdingTaxAmt: number;
}

const monthOptions = [
  { value: '1', label: 'Jan' },
  { value: '2', label: 'Feb' },
  { value: '3', label: 'Mar' },
  { value: '4', label: 'Apr' },
  { value: '5', label: 'May' },
  { value: '6', label: 'Jun' },
  { value: '7', label: 'Jul' },
  { value: '8', label: 'Aug' },
  { value: '9', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dec' },
];

const RensCloseRanking: React.FC = () => {
  const { user } = useAuth();

  const now = new Date();
  const currentMonth = String(now.getMonth() + 1);
  const currentYear = String(now.getFullYear());

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [properties, setProperties] = useState<RentalApplication[]>([]);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);

  const [renFilter, setRenFilter] = useState<string>('');

  const filteredProperties = properties;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subModalRow, setSubModalRow] = useState<CommRow | null>(null);
  const [subNewDate, setSubNewDate] = useState<string>('');
  const [subUpdating, setSubUpdating] = useState(false);
  const [subUpdateError, setSubUpdateError] = useState<string | null>(null);

  const FETCH_TIMEOUT_MS = 600000;

  const fetchWithTimeout = async (
    url: string,
    options: RequestInit,
    timeoutMs = FETCH_TIMEOUT_MS
  ) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(url, { ...options, signal: controller.signal });
      return resp;
    } finally {
      clearTimeout(id);
    }
  };

  const toInputDate = (d?: string) => {
    if (!d) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;

    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';

    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');

    return `${y}-${m}-${day}`;
  };

  const getMonthDateRange = (month: string, year: string) => {
    const monthNum = Number(month);
    const yearNum = Number(year);

    if (!monthNum || !yearNum) {
      return {
        startDate: '',
        endDate: '',
      };
    }

    const firstDay = new Date(yearNum, monthNum - 1, 1);
    const lastDay = new Date(yearNum, monthNum, 0);

    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    return {
      startDate: formatDate(firstDay),
      endDate: formatDate(lastDay),
    };
  };

  const openSubmissionModal = (row: CommRow) => {
    setSubUpdateError(null);
    setSubModalRow(row);
    setSubNewDate(toInputDate(row.submissionDate || ''));
    setSubModalOpen(true);
  };

  const closeSubmissionModal = () => {
    setSubModalOpen(false);
    setSubModalRow(null);
    setSubNewDate('');
    setSubUpdateError(null);
  };

  const fetchCommPayouts = useCallback(
    async (
      term = searchTerm,
      status = statusFilter,
      month: string = selectedMonth,
      year: string = selectedYear
    ) => {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        const { startDate, endDate } = getMonthDateRange(month, year);

        const formData = new URLSearchParams();
        formData.append('UserName', '0');
        formData.append('StartDate', startDate);
        formData.append('EndDate', endDate);
        formData.append('ReportMode', 'PAYOUT');

        const response = await fetchWithTimeout(
          LIST_URL,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString(),
          },
          600000
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result?.status === 'success') {
          const arr = Array.isArray(result?.data) ? result.data : [];
          setProperties(arr);
          console.log('API raw result:', result);
          console.log('API data[0]:', arr[0]);
          console.log('StartDate sent:', startDate);
          console.log('EndDate sent:', endDate);
        } else if (result?.status === 'no_data_found') {
          setProperties([]);
        } else {
          throw new Error(result?.error || 'Unknown error');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch commission payout data');
        setProperties([]);
      } finally {
        setLoading(false);
      }
    },
    [user, searchTerm, statusFilter, selectedMonth, selectedYear]
  );

  const formatCurrency = (amount: string | number) => {
    const num =
      typeof amount === 'string' ? parseFloat(amount || '0') : amount || 0;

    return isNaN(num)
      ? 'N/A'
      : num.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr === '1900-01-01') return '';
    return dateStr;
  };

  const toNumber = (v: any): number => {
    if (v === null || v === undefined || v === '') return 0;
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  };

  const tableRows: CommRow[] = useMemo(() => {
    if (!filteredProperties.length) return [];

    const rows: CommRow[] = [];

    filteredProperties.forEach((p) => {
      const anyP = p as any;

      const department =
        anyP.Dept ||
        anyP.Department ||
        anyP.RenDepartment ||
        anyP.TeamName ||
        'Unknown Department';

      const txId =
        anyP.TxId || anyP.TXID || anyP.RefNo || String(anyP.ApplicationId);

      const transId = String(anyP.TransId || anyP.transId || anyP.TRANSID || '');

      const address = anyP.PropertyAddress || anyP.Address;
      const claimType = anyP.ClaimType || anyP.TransType || 'R';

      const submissionDate = formatDate(anyP.SubmissionDate || anyP.AddDate);
      const payoutDate = formatDate(anyP.PayoutDate || anyP.PayoutDate1);

      const introducerFee = toNumber(anyP.IntroCommAmt ?? anyP.IntroCommAmt);

      const listerExploded =
        anyP.ListerCommExplosionDate &&
        anyP.ListerCommExplosionDate !== '1900-01-01';

      const closerExploded =
        anyP.CloserCommExplosionDate &&
        anyP.CloserCommExplosionDate !== '1900-01-01';

      const slots: {
        userName: any;
        displayName: any;
        dept: any;
        commission: any;
        training: any;
        admin: any;
        stamp: any;
        invPctg: any;
        sharingPctg: any;
        withholdingTaxPctg: any;
        withholdingTaxAmt: any;
        slotLabel: string;
        roleType: 'lister' | 'closer';
      }[] = [
        {
          userName: anyP.ListerUserName,
          displayName: anyP.ListerDisplayName,
          dept: anyP.ListerDept,
          commission: anyP.ListerComm,
          training: anyP.ListerTrainingFees,
          admin: anyP.Lister1AdminCharges,
          stamp: anyP.ListerStampDuty,
          invPctg: anyP.ListerInvPctg,
          sharingPctg: anyP.ListerSharingPctg,
          withholdingTaxPctg: anyP.ListerWitholdingTaxPctg,
          withholdingTaxAmt: anyP.ListerWitholdingTaxAmt,
          slotLabel: 'Lister 1',
          roleType: 'lister',
        },
        {
          userName: anyP.ListerUserName1,
          displayName: anyP.Lister1DisplayName,
          dept: anyP.Lister1Dept,
          commission: anyP.Lister2Comm,
          training: anyP.Lister2TrainingFees,
          admin: anyP.Lister2AdminCharges,
          stamp: anyP.Lister2StampDuty,
          invPctg: anyP.ListerInvPctg1,
          sharingPctg: anyP.ListerSharingPctg1,
          withholdingTaxPctg: anyP.Lister1WitholdingTaxPctg,
          withholdingTaxAmt: anyP.Lister1WitholdingTaxAmt,
          slotLabel: 'Lister 2',
          roleType: 'lister',
        },
        {
          userName: anyP.ListerUserName2,
          displayName: anyP.Lister2DisplayName,
          dept: anyP.Lister2Dept,
          commission: anyP.Lister3Comm,
          training: anyP.Lister3TrainingFees,
          admin: anyP.Lister3AdminCharges,
          stamp: anyP.Lister3StampDuty,
          invPctg: anyP.ListerInvPctg2,
          sharingPctg: anyP.ListerSharingPctg2,
          withholdingTaxPctg: anyP.Lister2WitholdingTaxPctg,
          withholdingTaxAmt: anyP.Lister2WitholdingTaxAmt,
          slotLabel: 'Lister 3',
          roleType: 'lister',
        },
        {
          userName: anyP.CloserUserName,
          displayName: anyP.CloserDisplayName,
          dept: anyP.CloserDept,
          commission: anyP.Closer1Comm,
          training: anyP.Closer1TrainingFees,
          admin: anyP.Closer1AdminCharges,
          stamp: anyP.Closer1StampDuty,
          invPctg: anyP.CloserInvPctg,
          sharingPctg: anyP.CloserSharingPctg,
          withholdingTaxPctg: anyP.CloserWitholdingTaxPctg,
          withholdingTaxAmt: anyP.CloserWitholdingTaxAmt,
          slotLabel: 'Closer 1',
          roleType: 'closer',
        },
        {
          userName: anyP.CloserUserName1,
          displayName: anyP.Closer1DisplayName,
          dept: anyP.Closer1Dept,
          commission: anyP.Closer2Comm,
          training: anyP.Closer2TrainingFees,
          admin: anyP.Closer2AdminCharges,
          stamp: anyP.Closer2StampDuty,
          invPctg: anyP.CloserInvPctg1,
          sharingPctg: anyP.CloserSharingPctg1,
          withholdingTaxPctg: anyP.Closer1WitholdingTaxPctg,
          withholdingTaxAmt: anyP.Closer1WitholdingTaxAmt,
          slotLabel: 'Closer 2',
          roleType: 'closer',
        },
        {
          userName: anyP.CloserUserName2,
          displayName: anyP.Closer3DisplayName,
          dept: anyP.Closer3Dept,
          commission: anyP.Closer3Comm,
          training: anyP.Closer3TrainingFees,
          admin: anyP.Closer3AdminCharges,
          stamp: anyP.Closer3StampDuty,
          invPctg: anyP.CloserInvPctg2,
          sharingPctg: anyP.CloserSharingPctg2,
          withholdingTaxPctg: anyP.Closer2WitholdingTaxPctg,
          withholdingTaxAmt: anyP.Closer2WitholdingTaxAmt,
          slotLabel: 'Closer 3',
          roleType: 'closer',
        },
      ];

      let slotsPushedForThisApp = 0;

      slots.forEach((slot) => {
        const renName = String(slot.displayName || slot.userName || '').trim();
        const slotDepartment = slot.dept || department;
        const commission = toNumber(slot.commission);

        if (slot.roleType === 'lister' && !listerExploded) return;
        if (slot.roleType === 'closer' && !closerExploded) return;
        if (!renName || commission === 0) return;

        const baseGross =
          slot.roleType === 'lister'
            ? toNumber(anyP.TalProfessionalFeesTotalAmt)
            : toNumber(anyP.TalServiceFeesAmt);

        const grossFees = baseGross;
        const netFees = toNumber(anyP.NetFees ?? grossFees - introducerFee);

        const trainingFees = toNumber(slot.training);
        const adminCharges = toNumber(slot.admin);
        const stampDuty = toNumber(slot.stamp);
        const invPctg = toNumber(slot.invPctg);
        const sharingPctg = toNumber(slot.sharingPctg);
        const withholdingTaxPctg = toNumber(slot.withholdingTaxPctg);
        const withholdingTaxAmt = toNumber(slot.withholdingTaxAmt);
        const netComm = commission + trainingFees + adminCharges + stampDuty;

        rows.push({
          kind: 'detail',
          department: slotDepartment,
          ren: renName,
          slotLabel: slot.slotLabel,
          applicationId: Number(anyP.ApplicationId || 0),
          txId,
          transId,
          address,
          claimType,
          submissionDate,
          payoutDate,
          grossFees,
          introducerFee,
          netFees,
          commission,
          trainingFees,
          adminCharges,
          stampDuty,
          netComm,
          invPctg,
          sharingPctg,
          withholdingTaxPctg,
          withholdingTaxAmt,
        });

        slotsPushedForThisApp++;
      });

      const fallbackRen =
        anyP.RenName ||
        anyP.ListerRenName ||
        anyP.ClosingRenName ||
        anyP.ListerDisplayName ||
        'Unknown REN';

      const fallbackCommission = toNumber(
        anyP.ListerComm ?? anyP.TotalCommission ?? anyP.Lister1Comm
      );

      const fallbackTraining = toNumber(
        anyP.ListerTrainingFees ?? anyP.TraningFees ?? anyP.Lister1TrainingFees
      );

      const fallbackAdmin = toNumber(
        anyP.AdminCharger ?? anyP.AdminCharges ?? anyP.Lister1AdminCharges
      );

      const fallbackStamp = toNumber(
        anyP.StampDuty ??
          anyP.StampDut ??
          anyP.ListerStampDuty ??
          anyP.Lister1StampDuty
      );

      const grossFees = toNumber(anyP.AtlProFees);
      const netFees = toNumber(anyP.NetFees ?? grossFees - introducerFee);

      if (slotsPushedForThisApp === 0) {
        console.log('FALLBACK TransId =', anyP.TransId);

        rows.push({
          kind: 'detail',
          department,
          ren: String(fallbackRen),
          slotLabel: '',
          applicationId: Number(anyP.ApplicationId || 0),
          txId,
          transId: String(anyP.TransId || ''),
          address,
          claimType,
          submissionDate,
          payoutDate,
          grossFees,
          introducerFee,
          netFees,
          commission: fallbackCommission,
          trainingFees: fallbackTraining,
          adminCharges: fallbackAdmin,
          stampDuty: fallbackStamp,
          netComm:
            fallbackCommission + fallbackTraining + fallbackAdmin + fallbackStamp,
          invPctg: 0,
          sharingPctg: 0,
          withholdingTaxPctg: 0,
          withholdingTaxAmt: 0,
        });
      }
    });

    return rows;
  }, [filteredProperties]);

  const renOptions = useMemo(() => {
    const set = new Set<string>();

    tableRows.forEach((r) => {
      const name = String(r.ren || '').trim();
      if (name) set.add(name);
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tableRows]);

  const filteredTableRows = useMemo(() => {
    if (!renFilter) return tableRows;
    return tableRows.filter((r) => String(r.ren || '').trim() === renFilter);
  }, [tableRows, renFilter]);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years: string[] = [];
    for (let y = current; y >= 2000; y--) {
      years.push(String(y));
    }
    return years;
  }, []);

  const dateRangeText = useMemo(() => {
    const monthLabel =
      monthOptions.find((m) => m.value === selectedMonth)?.label || '';
    const { startDate, endDate } = getMonthDateRange(selectedMonth, selectedYear);

    if (!selectedMonth || !selectedYear) {
      return 'Date Range : ALL';
    }

    return `${monthLabel} ${selectedYear} (${startDate} to ${endDate})`;
  }, [selectedMonth, selectedYear]);

  const updateSubmissionDate = async (row: CommRow, newDate: string) => {
    const appId = Number(row.applicationId || 0);

    if (!appId) {
      return { ok: false, message: 'Missing ApplicationId' };
    }

    const formData = new URLSearchParams();
    formData.append('ApplicationId', String(appId));
    formData.append('SubmissionDate', String(newDate));

    const resp = await fetch(SUBMISSION_SET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    if (!resp.ok) {
      return { ok: false, message: `HTTP ${resp.status}` };
    }

    const result = await resp.json();

    if (result?.status === 'success') {
      return { ok: true };
    }

    return { ok: false, message: result?.data || 'Fail to register' };
  };

  const handleUpdateSubmissionDate = async () => {
    if (!subModalRow) return;

    setSubUpdating(true);
    setSubUpdateError(null);

    try {
      const resp = await updateSubmissionDate(subModalRow, subNewDate);

      if (!resp?.ok) {
        throw new Error(resp?.message || 'Failed to update submission date');
      }

      setProperties((prev: any[]) =>
        prev.map((p) => {
          const anyP = p as any;

          const pTransId = String(anyP.TransId || anyP.transId || anyP.TRANSID || '');
          const rowTransId = String(subModalRow.transId || '');

          const pTxId = String(
            anyP.TxId || anyP.TXID || anyP.RefNo || anyP.ApplicationId || ''
          );
          const rowTxId = String(subModalRow.txId || '');

          const isMatch =
            (rowTransId && pTransId && rowTransId === pTransId) ||
            (rowTxId && pTxId && rowTxId === pTxId);

          if (!isMatch) return p;

          return {
            ...anyP,
            SubmissionDate: subNewDate,
            AddDate: anyP.AddDate ?? subNewDate,
          };
        })
      );

      closeSubmissionModal();
    } catch (e: any) {
      setSubUpdateError(e?.message || 'Update failed');
    } finally {
      setSubUpdating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <DollarSign className="text-blue-600" size={32} />
            RENs Close Ranking
          </h1>

          <div className="mt-1 text-sm text-gray-600">{dateRangeText}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <div className="flex items-center space-x-2">
            <span>Month :</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span>Year :</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span>REN :</span>
            <select
              value={renFilter}
              onChange={(e) => setRenFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">SHOW ALL</option>
              {renOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => fetchCommPayouts()}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading data...</p>
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
            onClick={() => {
              fetchCommPayouts(searchTerm, statusFilter, selectedMonth, selectedYear);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-xs md:text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-700">
                <th className="w-3/5 px-3 py-2 text-left border-b">Ren</th>
                <th className="w-1/5 px-3 py-2 text-right border-b">Net Fees</th>
                <th className="w-1/5 px-3 py-2 text-left border-b">Submission Date</th>
              </tr>
            </thead>

            <tbody>
              {filteredTableRows.map((row, idx) => {
                const baseClass =
                  'px-3 py-2 border-b whitespace-nowrap align-middle';
                const rowClass = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';

                return (
                  <tr key={`${row.kind}-${idx}`} className={rowClass}>
                    <td className={`${baseClass} w-3/5`}>{row.ren}</td>

                    <td className={`${baseClass} w-1/5 text-right`}>
                      {formatCurrency(row.netFees)}
                    </td>

                    <td className={`${baseClass} w-1/5`}>
                      <div className="flex items-center gap-2">
                        <span>{row.submissionDate}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && !error && filteredTableRows.length === 0 && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No Commission Payouts Found
          </h3>
          <p className="text-gray-500 mb-4">
            {(searchTerm ||
              (statusFilter !== 'all' && statusFilter !== 'allstatus') ||
              selectedMonth ||
              selectedYear ||
              renFilter)
              ? 'No payouts match your current filters.'
              : 'No commission payouts have been created yet.'}
          </p>

          {(searchTerm ||
            (statusFilter !== 'all' && statusFilter !== 'allstatus') ||
            selectedMonth ||
            selectedYear ||
            renFilter) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setSelectedMonth(currentMonth);
                setSelectedYear(currentYear);
                setRenFilter('');
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {subModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeSubmissionModal}
          />

          <div className="relative bg-white w-full max-w-md rounded-xl shadow-xl p-6 mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Submission date
            </h3>

            <div className="space-y-2">
              <div className="text-sm text-gray-600">Value</div>

              <input
                type="date"
                value={subNewDate}
                onChange={(e) => setSubNewDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {subUpdateError && (
                <div className="text-sm text-red-600 mt-2">{subUpdateError}</div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeSubmissionModal}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                disabled={subUpdating}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleUpdateSubmissionDate}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={subUpdating || !subNewDate}
              >
                {subUpdating ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RensCloseRanking;