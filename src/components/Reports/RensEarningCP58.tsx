import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useState, useCallback, useMemo } from 'react';
import { DollarSign, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RentalApplication } from '../../types';

const LIST_URL =
  API_ENDPOINTS.PAYOUT_COMMISSION_REPORT_GET;

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

const RensEarningCP58: React.FC = () => {
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [properties, setProperties] = useState<RentalApplication[]>([]);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [renFilter, setRenFilter] = useState<string>('');

  const filteredProperties = properties;

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
      const resp = await fetch(url, { ...options, signal: controller.signal });
      return resp;
    } finally {
      clearTimeout(id);
    }
  };

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

  const fetchCommPayouts = useCallback(
    async (
      term = searchTerm,
      status = statusFilter,
      sd: string = startDate,
      ed: string = endDate
    ) => {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        const formData = new URLSearchParams();
        formData.append('UserName', '0');
        formData.append('StartDate', sd || '');
        formData.append('EndDate', ed || '');
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
    [user, searchTerm, statusFilter, startDate, endDate]
  );

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

  const dateRangeText = useMemo(() => {
    const sd = startDate ? startDate : 'ALL';
    const ed = endDate ? endDate : 'ALL';
    return `Date Range : ${sd} to ${ed}`;
  }, [startDate, endDate]);

  const totals = useMemo(() => {
    return filteredTableRows.reduce(
      (acc, r) => {
        acc.commission += toNumber(r.commission);
        acc.trainingFees += toNumber(r.trainingFees);
        acc.adminCharges += toNumber(r.adminCharges);
        acc.withholdingTaxAmt += toNumber(r.withholdingTaxAmt);
        acc.stampDuty += toNumber(r.stampDuty);
        return acc;
      },
      {
        commission: 0,
        trainingFees: 0,
        adminCharges: 0,
        withholdingTaxAmt: 0,
        stampDuty: 0,
      }
    );
  }, [filteredTableRows]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <DollarSign className="text-blue-600" size={32} />
            RENs Earning CP58
          </h1>

          <div className="mt-1 text-sm text-gray-600">{dateRangeText}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex items-center space-x-2">Payout Date :</div>

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
              fetchCommPayouts(searchTerm, statusFilter, startDate, endDate);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && filteredTableRows.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs md:text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  <th className="px-3 py-2 text-left border-b">Trans Id</th>
                  <th className="px-3 py-2 text-left border-b">Ren</th>
                  <th className="px-3 py-2 text-left border-b">Address</th>
                  <th className="px-3 py-2 text-right border-b">Commission</th>
                  <th className="px-3 py-2 text-right border-b">Training Fees</th>
                  <th className="px-3 py-2 text-right border-b">Total</th>
                  <th className="px-3 py-2 text-right border-b">Admin Fees</th>
                  <th className="px-3 py-2 text-right border-b">Less WHT</th>
                  <th className="px-3 py-2 text-right border-b">Stamp Duty</th>
                  <th className="px-3 py-2 text-right border-b">Total Payout</th>
                  <th className="px-3 py-2 text-left border-b">Payout Date</th>
                </tr>
              </thead>

              <tbody>
                {filteredTableRows.map((row, idx) => {
                  const baseClass =
                    'px-3 py-2 border-b whitespace-nowrap align-middle';
                  const rowClass = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';

                  return (
                    <tr key={`${row.kind}-${idx}`} className={rowClass}>
                      <td className={baseClass}>
                        {row.transId}
                        {row.txId ? ` (${row.txId})` : ''}
                      </td>

                      <td className={baseClass}>{row.ren}</td>

                      <td
                        className={`${baseClass} max-w-[420px] whitespace-normal break-words`}
                      >
                        {row.address}
                      </td>

                      <td className={`${baseClass} text-right`}>
                        {formatCurrency(row.commission)}
                      </td>

                      <td className={`${baseClass} text-right`}>
                        {formatCurrency(row.trainingFees)}
                      </td>

                      <td className={`${baseClass} text-right`}>
                        {formatCurrency(
                          toNumber(row.commission) + toNumber(row.trainingFees)
                        )}
                      </td>

                      <td className={`${baseClass} text-right`}>
                        {formatCurrency(row.adminCharges)}
                      </td>

                      <td className={`${baseClass} text-right`}>
                        {formatCurrency(row.withholdingTaxAmt)}
                      </td>

                      <td className={`${baseClass} text-right`}>
                        {formatCurrency(row.stampDuty)}
                      </td>

                      <td className={`${baseClass} text-right`}>
                        {formatCurrency(
                          toNumber(row.commission) +
                            toNumber(row.trainingFees) +
                            toNumber(row.adminCharges) +
                            toNumber(row.stampDuty) -
                            toNumber(row.withholdingTaxAmt)
                        )}
                      </td>

                      <td className={baseClass}>{row.payoutDate}</td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="bg-gray-100 font-semibold text-gray-800">
                  <td className="px-3 py-2 border-t">TOTAL</td>
                  <td className="px-3 py-2 border-t"></td>
                  <td className="px-3 py-2 border-t"></td>
                  <td className="px-3 py-2 border-t text-right">
                    {formatCurrency(totals.commission)}
                  </td>
                  <td className="px-3 py-2 border-t text-right">
                    {formatCurrency(totals.trainingFees)}
                  </td>
                  <td className="px-3 py-2 border-t text-right">
                    {formatCurrency(totals.commission + totals.trainingFees)}
                  </td>
                  <td className="px-3 py-2 border-t text-right">
                    {formatCurrency(totals.adminCharges)}
                  </td>
                  <td className="px-3 py-2 border-t text-right">
                    {formatCurrency(totals.withholdingTaxAmt)}
                  </td>
                  <td className="px-3 py-2 border-t text-right">
                    {formatCurrency(totals.stampDuty)}
                  </td>
                  <td className="px-3 py-2 border-t text-right">
                    {formatCurrency(
                      totals.commission +
                        totals.trainingFees +
                        totals.adminCharges +
                        totals.stampDuty -
                        totals.withholdingTaxAmt
                    )}
                  </td>
                  <td className="px-3 py-2 border-t"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && filteredTableRows.length === 0 && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No Commission Payouts Found
          </h3>
          <p className="text-gray-500 mb-4">
            {(searchTerm ||
              (statusFilter !== 'all' && statusFilter !== 'allstatus') ||
              startDate ||
              endDate ||
              renFilter)
              ? 'No payouts match your current filters.'
              : 'No commission payouts have been created yet.'}
          </p>

          {(searchTerm ||
            (statusFilter !== 'all' && statusFilter !== 'allstatus') ||
            startDate ||
            endDate ||
            renFilter) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setStartDate('');
                setEndDate('');
                setRenFilter('');
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

export default RensEarningCP58;