import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertCircle,
  DollarSign,
  PenSquare,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RentalApplication } from '../../types';

const LIST_URL =
  API_ENDPOINTS.PAYOUT_COMMISSION_REPORT_GET;

const SUBMISSION_SET_URL =
  API_ENDPOINTS.CLAIM_SUBMISSION_DATE_SET;

const PAYOUT_SET_URL =
  API_ENDPOINTS.CLAIM_PAYOUT_DATE_SET;

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

const PendingOverridingComPayout: React.FC = () => {
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [properties, setProperties] = useState<RentalApplication[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const filteredProperties = properties;

  const normalizeSearch = (v: any) => String(v || '').toLowerCase().trim();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subModalRow, setSubModalRow] = useState<CommRow | null>(null);
  const [subNewDate, setSubNewDate] = useState<string>('');
  const [subUpdating, setSubUpdating] = useState(false);
  const [subUpdateError, setSubUpdateError] = useState<string | null>(null);

  const [renFilter, setRenFilter] = useState<string>('all');

  const rowKey = (r: CommRow) =>
    `${r.applicationId || 0}__${r.slotLabel || ''}__${(r.ren || '').trim()}__${r.transId || ''}__${r.txId || ''}`;

  const digitsOnly = (s: string) => (s || '').replace(/\D/g, '');

  const normalizeToDigits8 = (s: string) => {
    const d = digitsOnly(s);
    return d.length > 8 ? d.slice(0, 8) : d;
  };

  const isValidDateParts = (dd: number, mm: number, yyyy: number) => {
    if (yyyy < 1900 || yyyy > 2999) return false;
    if (mm < 1 || mm > 12) return false;
    if (dd < 1 || dd > 31) return false;

    const dt = new Date(yyyy, mm - 1, dd);
    return (
      dt.getFullYear() === yyyy &&
      dt.getMonth() === mm - 1 &&
      dt.getDate() === dd
    );
  };

  const digits8ToDisplay = (d8: string) => {
    const d = normalizeToDigits8(d8);
    if (d.length !== 8) return '';
    const dd = parseInt(d.slice(0, 2), 10);
    const mm = parseInt(d.slice(2, 4), 10);
    const yyyy = parseInt(d.slice(4, 8), 10);
    if (!isValidDateParts(dd, mm, yyyy)) return '';
    return `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${String(yyyy).padStart(4, '0')}`;
  };

  const displayToIso = (s: string) => {
    if (!s) return '';
    const d = normalizeToDigits8(s);
    if (d.length !== 8) return '';
    const dd = parseInt(d.slice(0, 2), 10);
    const mm = parseInt(d.slice(2, 4), 10);
    const yyyy = parseInt(d.slice(4, 8), 10);
    if (!isValidDateParts(dd, mm, yyyy)) return '';
    return `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  };

  const apiDateToDisplay = (s?: string) => {
    if (!s || s === '1900-01-01') return '';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const yyyy = parseInt(s.slice(0, 4), 10);
      const mm = parseInt(s.slice(5, 7), 10);
      const dd = parseInt(s.slice(8, 10), 10);
      if (!isValidDateParts(dd, mm, yyyy)) return '';
      return `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${String(yyyy).padStart(4, '0')}`;
    }

    const dt = new Date(s);
    if (isNaN(dt.getTime())) return '';
    const dd = dt.getDate();
    const mm = dt.getMonth() + 1;
    const yyyy = dt.getFullYear();
    if (!isValidDateParts(dd, mm, yyyy)) return '';
    return `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${String(yyyy).padStart(4, '0')}`;
  };

  const [payoutInputMap, setPayoutInputMap] = useState<Record<string, string>>(
    {}
  );

  const [payoutUpdating, setPayoutUpdating] = useState(false);
  const [payoutUpdateMsg, setPayoutUpdateMsg] = useState<string | null>(null);
  const [payoutUpdateError, setPayoutUpdateError] = useState<string | null>(
    null
  );

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
        formData.append('ReportMode', 'EXPLOSION');

        const response = await fetchWithTimeout(
          LIST_URL,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString(),
          },
          600000
        );

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();

        if (result?.status === 'success') {
          const arr = Array.isArray(result?.data) ? result.data : [];
          setRawData(arr);
          setProperties(arr);
          console.log('API raw result:', result);
          console.log('API data[0]:', arr[0]);
        } else if (result?.status === 'no_data_found') {
          setRawData([]);
          setProperties([]);
        } else {
          throw new Error(result?.error || 'Unknown error');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch overriding commission payout data');
        setProperties([]);
        setRawData([]);
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
        anyP.TxId || anyP.TXID || anyP.RefNo || String(anyP.ApplicationId || '');

      const transId = String(
        anyP.TransId || anyP.transId || anyP.TRANSID || ''
      );

      const address = anyP.PropertyAddress || anyP.Address || '';
      const claimType = anyP.ClaimType || anyP.TransType || 'R';

      const submissionDate = formatDate(anyP.SubmissionDate || anyP.AddDate);
      const payoutDate = formatDate(anyP.PayoutDate || anyP.PayoutDate1);

      const introducerFee = toNumber(anyP.IntroCommAmt);

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
          admin: anyP.ListerAdminCharges,
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
          sharingPctg: anyP.CloserInvPctg1,
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
            ? toNumber(
                anyP.TalProfessionalFeesTotalAmt ??
                  anyP.AtlProFees ??
                  anyP.TalProfessionalFeesAmt
              )
            : toNumber(anyP.TalServiceFeesAmt ?? anyP.AtlProFees);

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
        anyP.ListerAdminCharges ??
          anyP.AdminCharger ??
          anyP.AdminCharges ??
          anyP.Lister1AdminCharges
      );

      const fallbackStamp = toNumber(
        anyP.StampDuty ??
          anyP.StampDut ??
          anyP.ListerStampDuty ??
          anyP.Lister1StampDuty
      );

      const fallbackWHTAmt = toNumber(
        anyP.ListerWitholdingTaxAmt ??
          anyP.WitholdingTaxAmt ??
          anyP.WithholdingTaxAmt
      );

      const grossFees = toNumber(
        anyP.AtlProFees ??
          anyP.TalProfessionalFeesTotalAmt ??
          anyP.TalProfessionalFeesAmt
      );
      const netFees = toNumber(anyP.NetFees ?? grossFees - introducerFee);

      if (slotsPushedForThisApp === 0) {
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
            fallbackCommission +
            fallbackTraining +
            fallbackAdmin +
            fallbackStamp,
          invPctg: 0,
          sharingPctg: 0,
          withholdingTaxPctg: 0,
          withholdingTaxAmt: fallbackWHTAmt,
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

  const viewRows = useMemo(() => {
    const keyword = normalizeSearch(searchTerm);

    return tableRows.filter((r) => {
      const matchRen =
        renFilter === 'all' || String(r.ren || '').trim() === renFilter;

      if (!matchRen) return false;

      if (!keyword) return true;

      const renName = normalizeSearch(r.ren);
      const transId = normalizeSearch(r.transId);
      const refNo = normalizeSearch(r.txId);
      const address = normalizeSearch(r.address);

      return (
        renName.includes(keyword) ||
        transId.includes(keyword) ||
        refNo.includes(keyword) ||
        address.includes(keyword)
      );
    });
  }, [tableRows, renFilter, searchTerm]);

  useEffect(() => {
    const next: Record<string, string> = {};
    tableRows.forEach((r) => {
      next[rowKey(r)] = apiDateToDisplay(r.payoutDate);
    });
    setPayoutInputMap(next);
  }, [tableRows]);

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

          const pTransId = String(
            anyP.TransId || anyP.transId || anyP.TRANSID || ''
          );
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

  const handleBulkUpdatePayoutDate = async () => {
    setPayoutUpdateMsg(null);
    setPayoutUpdateError(null);

    const payloadRows: {
      ApplicationId: number;
      TransId: string;
      PayoutDate: string;
    }[] = [];

    viewRows.forEach((r) => {
      const appId = Number(r.applicationId || 0);
      const transId = String(r.transId || '').trim();
      if (!appId || !transId) return;

      const k = rowKey(r);
      const display = (payoutInputMap[k] ?? '').trim();
      const iso = displayToIso(display);
      if (!iso) return;

      payloadRows.push({
        ApplicationId: appId,
        TransId: transId,
        PayoutDate: iso,
      });
    });

    if (payloadRows.length === 0) {
      setPayoutUpdateError('No valid payout dates to update.');
      return;
    }

    setPayoutUpdating(true);

    try {
      const formData = new URLSearchParams();
      formData.append('Rows', JSON.stringify(payloadRows));

      const resp = await fetch(PAYOUT_SET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const result = await resp.json();

      if (result?.status === 'success' || result?.status === 'partial') {
        const updated = Number(result?.updated || 0);
        const failed = Number(result?.failed || 0);

        setPayoutUpdateMsg(
          result?.status === 'success'
            ? `Updated ${updated} payout date(s).`
            : `Updated ${updated} payout date(s), failed ${failed}.`
        );

        setProperties((prev: any[]) =>
          prev.map((p) => {
            const anyP = p as any;
            const pAppId = Number(anyP.ApplicationId || 0);
            const pTransId = String(
              anyP.TransId || anyP.transId || anyP.TRANSID || ''
            ).trim();
            const pTransId1 = String(
              anyP.TransId1 || anyP.transId1 || anyP.TRANSID1 || ''
            ).trim();

            const hit = payloadRows.find(
              (x) =>
                x.ApplicationId === pAppId &&
                (x.TransId === pTransId || x.TransId === pTransId1)
            );

            if (!hit) return p;

            if (hit.TransId === pTransId) {
              return { ...anyP, PayoutDate: hit.PayoutDate };
            }
            if (hit.TransId === pTransId1) {
              return { ...anyP, PayoutDate1: hit.PayoutDate };
            }
            return p;
          })
        );
      } else {
        throw new Error(result?.error || 'Update failed');
      }
    } catch (e: any) {
      setPayoutUpdateError(e?.message || 'Update failed');
    } finally {
      setPayoutUpdating(false);
    }
  };

  const totals = useMemo(() => {
    return viewRows.reduce(
      (acc, r) => {
        acc.grossFees += toNumber(r.grossFees);
        acc.introducerFee += toNumber(r.introducerFee);
        acc.netFees += toNumber(r.netFees);
        acc.commission += toNumber(r.commission);
        acc.trainingFees += toNumber(r.trainingFees);
        acc.adminCharges += toNumber(r.adminCharges);
        acc.withholdingTaxAmt += toNumber(r.withholdingTaxAmt);
        acc.stampDuty += toNumber(r.stampDuty);
        return acc;
      },
      {
        grossFees: 0,
        introducerFee: 0,
        netFees: 0,
        commission: 0,
        trainingFees: 0,
        adminCharges: 0,
        withholdingTaxAmt: 0,
        stampDuty: 0,
      }
    );
  }, [viewRows]);

  useEffect(() => {
    if (user) {
      fetchCommPayouts();
    }
  }, [user, fetchCommPayouts]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <DollarSign className="text-blue-600" size={32} />
            Pending Overriding Commission Payout Report
          </h1>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <button
            onClick={() => fetchCommPayouts()}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Refresh
          </button>

          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search REN / Trans Id / Ref No / Address"
            className="w-full md:w-[360px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          />

          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-600">REN</div>
            <select
              value={renFilter}
              onChange={(e) => setRenFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="all">-- Show All --</option>
              {renOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading overriding commission payout data...</p>
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

      {!loading && !error && viewRows.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs md:text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  <th className="px-3 py-2 text-left border-b">Payout Date</th>
                  <th className="px-3 py-2 text-left border-b">Trans Id</th>
                  <th className="px-3 py-2 text-left border-b">Ren</th>
                  <th className="px-3 py-2 text-left border-b">Address</th>
                  <th className="px-3 py-2 text-right border-b">Gross Fees</th>
                  <th className="px-3 py-2 text-right border-b">
                    Less Introducer Fees
                  </th>
                  <th className="px-3 py-2 text-right border-b">Net Fees</th>
                  <th className="px-3 py-2 text-right border-b">Commission</th>
                  <th className="px-3 py-2 text-right border-b">
                    Training Fees
                  </th>
                  <th className="px-3 py-2 text-right border-b">Total</th>
                  <th className="px-3 py-2 text-right border-b">Admin Fees</th>
                  <th className="px-3 py-2 text-right border-b">Less WHT</th>
                  <th className="px-3 py-2 text-right border-b">Stamp Duty</th>
                  <th className="px-3 py-2 text-right border-b">
                    Total Payout
                  </th>
                  <th className="px-3 py-2 text-left border-b">
                    Submission Date
                  </th>
                </tr>
              </thead>

              <tbody>
                {viewRows.map((row, idx) => {
                  const baseClass =
                    'px-3 py-2 border-b whitespace-nowrap align-middle';
                  const rowClass = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';

                  const k = rowKey(row);
                  const payoutVal = payoutInputMap[k] ?? '';

                  return (
                    <tr key={`${row.kind}-${idx}`} className={rowClass}>
                      <td className={baseClass}>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="dd/MM/yyyy"
                          className="w-[110px] border border-gray-300 rounded-md px-2 py-1 text-xs md:text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={payoutVal}
                          onChange={(e) => {
                            const d = normalizeToDigits8(e.target.value);
                            setPayoutInputMap((prev) => ({ ...prev, [k]: d }));
                          }}
                          onFocus={(e) => {
                            const d = normalizeToDigits8(e.currentTarget.value);
                            setPayoutInputMap((prev) => ({ ...prev, [k]: d }));
                            setTimeout(() => {
                              try {
                                e.currentTarget.select();
                              } catch {}
                            }, 0);
                          }}
                          onBlur={(e) => {
                            const d = normalizeToDigits8(e.currentTarget.value);
                            const formatted = digits8ToDisplay(d);
                            setPayoutInputMap((prev) => ({
                              ...prev,
                              [k]: formatted,
                            }));
                          }}
                        />
                      </td>

                      <td className={baseClass}>
                        {row.transId}
                        {row.txId ? ` (${row.txId})` : ''}
                      </td>

                      <td className={baseClass}>{row.ren}</td>
                      <td className="px-3 py-2 border-b align-middle whitespace-normal break-words min-w-[260px] max-w-[420px]">
                        {row.address}
                      </td>

                      <td className={`${baseClass} text-right`}>
                        {formatCurrency(row.grossFees)}
                      </td>
                      <td className={`${baseClass} text-right`}>
                        {formatCurrency(row.introducerFee)}
                      </td>
                      <td className={`${baseClass} text-right`}>
                        {formatCurrency(row.netFees)}
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
                        {formatCurrency(row.netComm)}
                      </td>

                      <td className={baseClass}>
                        <div className="flex items-center gap-2">
                          <span>{row.submissionDate}</span>

                          <button
                            type="button"
                            onClick={() => openSubmissionModal(row)}
                            className="p-1 rounded hover:bg-gray-200"
                            title="Edit Submission Date"
                          >
                            <PenSquare className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="bg-gray-100 font-semibold text-gray-800">
                  <td className="px-3 py-2 border-t"></td>
                  <td className="px-3 py-2 border-t">TOTAL</td>
                  <td className="px-3 py-2 border-t"></td>
                  <td className="px-3 py-2 border-t"></td>

                  <td className="px-3 py-2 border-t text-right">
                    {formatCurrency(totals.grossFees)}
                  </td>
                  <td className="px-3 py-2 border-t text-right">
                    {formatCurrency(totals.introducerFee)}
                  </td>
                  <td className="px-3 py-2 border-t text-right">
                    {formatCurrency(totals.netFees)}
                  </td>
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
                        totals.stampDuty
                    )}
                  </td>
                  <td className="px-3 py-2 border-t"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && viewRows.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBulkUpdatePayoutDate}
            disabled={payoutUpdating}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {payoutUpdating ? 'Updating...' : 'Update Payout Date'}
          </button>

          {payoutUpdateMsg && (
            <div className="text-sm text-green-700">{payoutUpdateMsg}</div>
          )}
          {payoutUpdateError && (
            <div className="text-sm text-red-600">{payoutUpdateError}</div>
          )}
        </div>
      )}

      {!loading && !error && viewRows.length === 0 && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No Overriding Commission Payouts Found
          </h3>
          <p className="text-gray-500 mb-4">
            {(searchTerm ||
              (statusFilter !== 'all' && statusFilter !== 'allstatus') ||
              startDate ||
              endDate)
              ? 'No payouts match your current filters.'
              : 'No overriding commission payouts have been created yet.'}
          </p>
          {(searchTerm ||
            (statusFilter !== 'all' && statusFilter !== 'allstatus') ||
            startDate ||
            endDate) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setStartDate('');
                setEndDate('');
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
                <div className="text-sm text-red-600 mt-2">
                  {subUpdateError}
                </div>
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

export default PendingOverridingComPayout;