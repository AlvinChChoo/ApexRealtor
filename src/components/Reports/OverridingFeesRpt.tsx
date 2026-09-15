import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Filter,
  Eye,
  DollarSign,
  Calendar,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RentalApplication } from '../../types';

const LIST_URL =
  API_ENDPOINTS.RENTAL_APPLICATION_GET;
const SUMMARY_URL =
  API_ENDPOINTS.APPLICATION_STATUS_SUMMARY_GET;

type SummaryRow = { ApplicationStatus: string; Cnt: number };

type RowKind = 'detail' | 'renTotal' | 'deptTotal' | 'grandTotal';

interface CommRow {
  kind: RowKind;
  department: string;
  ren: string;
  slotLabel: string; // "Lister 1", "Closer 2", etc (blank for totals)
  txId?: string;
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
  netComm: number; // per-agent net commission
  invPctg: number; // from ListerInvPctg / CloserInvPctg variants
  sharingPctg: number; // from ListerSharingPctg / CloserSharingPctg variants

  // NEW: withholding tax per slot
  withholdingTaxPctg: number;
  withholdingTaxAmt: number;

  // NEW: overriding fees per slot
  overridingPctg: number;
  overridingAmt: number;

  // NEW: leader overriding fees per slot
  leaderUserName?: string;
  leaderDisplayName?: string;
  leaderOverridingPctg: number;
  leaderOverridingAmt: number;
}

const OverridingFeesRpt: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [properties, setProperties] = useState<RentalApplication[]>([]);

  // Only show rows with non-null ListerCommExplosionDate
  const filteredProperties = useMemo(
    () =>
      properties.filter((p) => {
        const d = (p as any).ListerCommExplosionDate;
        return d && d !== '1900-01-01'; // treat 1900-01-01 as "empty"
      }),
    [properties]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [summaryMap, setSummaryMap] = useState<Record<string, number>>({});
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const normalize = (s: string) => (s || '').toLowerCase().trim();

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const formData = new URLSearchParams();
      formData.append('UserName', '0');
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
    (aliases: string[]) => {
      return aliases.reduce(
        (acc, a) => acc + (summaryMap[normalize(a)] || 0),
        0
      );
    },
    [summaryMap]
  );

  const tiles = useMemo(
    () => ({
      pendingCommission: getCount(['pending commission']),
      partialCommission: getCount(['partial commission', 'partial commission paid']),
      commissionPaid: getCount(['commission paid', 'paid commission']),
    }),
    [getCount]
  );

  const fetchCommPayouts = useCallback(
    async (term = searchTerm, status = statusFilter) => {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        const formData = new URLSearchParams();
        formData.append('UserName', '');
        formData.append('ApplicationId', '');
        formData.append('TransType', 'Rental');
        formData.append('SearchKeyword', term);
        formData.append('ShowOnlyExpiringTrans', '');
        formData.append('ReturnRowCnt', '50');

        const isAll =
          status === 'all' || status === 'allstatus' || status === '';
        formData.append('ApplicationStatus', isAll ? '' : status);

        const response = await fetch(LIST_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();

        if (result?.status === 'success') {
          setProperties(Array.isArray(result.data) ? result.data : []);
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
    [user, searchTerm, statusFilter]
  );

  const handleTileClick = useCallback(
    (statusValue: string) => {
      setStatusFilter(statusValue);
      fetchCommPayouts(searchTerm, statusValue);
    },
    [fetchCommPayouts, searchTerm]
  );

  useEffect(() => {
    fetchSummary();
    fetchCommPayouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchCommPayouts();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, statusFilter, fetchCommPayouts]);

  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'active':
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
      case 'draft':
      case 'pending review':
        return 'bg-yellow-100 text-yellow-800';
      case 'expired':
      case 'cancelled':
      case 'rejected':
      case 'deal aborted':
      case 'aborted':
        return 'bg-red-100 text-red-800';
      case 'completed':
      case 'signed':
      case 'commission paid':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

  type Totals = {
    grossFees: number;
    introducerFee: number;
    netFees: number;
    commission: number;
    trainingFees: number;
    adminCharges: number;
    stampDuty: number;
    netComm: number;
    withholdingTaxAmt: number;
    overridingAmt: number;
    leaderOverridingAmt: number;
  };

  // Build table rows (detail + totals), expanding each record into up to 6 agent rows
  const tableRows: CommRow[] = useMemo(() => {
    if (!filteredProperties.length) return [];

    // department -> ren -> CommRow[]
    const deptMap = new Map<string, Map<string, CommRow[]>>();

    filteredProperties.forEach((p) => {
      const anyP = p as any;

      const department =
        anyP.Dept ||
        anyP.Department ||
        anyP.RenDepartment ||
        anyP.TeamName ||
        'Unknown Department';

      const txId =
        anyP.TxId || anyP.TXID || anyP.RefNo || String(p.ApplicationId);
      const address = anyP.PropertyAddress || anyP.Address;
      const claimType = anyP.ClaimType || anyP.TransType || 'R';
      const submissionDate = formatDate(
        anyP.CommSubmitDate || anyP.SubmissionDate || p.AddDate
      );
      const payoutDate = formatDate(
        anyP.CommPayoutDate || anyP.PayOutDate || anyP.CommissionPaidDate
      );

      // Introducer fee is at application level
      const introducerFee = toNumber(
        anyP.LessIntroducerFee ?? anyP.IntroducerFee
      );

      // Explosion flags
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
        overridingPctg: any;
        overridingAmt: any;
        leaderUserName: any;
        leaderDisplayName: any;
        leaderOverridingPctg: any;
        leaderOverridingAmt: any;
        slotLabel: string;
        roleType: 'lister' | 'closer';
      }[] = [
        {
          userName: anyP.ListerUserName,          
          displayName: anyP.ListerDisplayName,
          dept: anyP.ListerDept,
          commission: anyP.Lister1Comm,
          training: anyP.Lister1TrainingFees,
          admin: anyP.Lister1AdminCharges,
          stamp: anyP.Lister1StampDuty,
          invPctg: anyP.ListerInvPctg,
          sharingPctg: anyP.ListerSharingPctg,
          withholdingTaxPctg: anyP.ListerWitholdingTaxPctg,
          withholdingTaxAmt: anyP.ListerWitholdingTaxAmt,
          overridingPctg: anyP.OverridingPctg,
          overridingAmt: anyP.OverridingAmt,
          leaderUserName: anyP.ListerLeaderUserName,
          leaderDisplayName: anyP.ListerLeaderDisplayName,
          leaderOverridingPctg: anyP.ListerLeaderOveridingPctg,
          leaderOverridingAmt: anyP.ListerLeaderOveridingAmt,
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
          overridingPctg: anyP.OverridingPctg,
          overridingAmt: anyP.OverridingAmt,
          leaderUserName: anyP.Lister1LeaderUserName,
          leaderDisplayName: anyP.Lister1LeaderDisplayName,
          leaderOverridingPctg: anyP.Lister1LeaderOveridingPctg,
          leaderOverridingAmt: anyP.Lister1LeaderOveridingAmt,
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
          overridingPctg: anyP.OverridingPctg,
          overridingAmt: anyP.OverridingAmt,
          leaderUserName: anyP.Lister2LeaderUserName,
          leaderDisplayName: anyP.Lister2LeaderDisplayName,
          leaderOverridingPctg: anyP.Lister2LeaderOveridingPctg,
          leaderOverridingAmt: anyP.Lister2LeaderOveridingAmt,
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
          overridingPctg: anyP.OverridingPctg,
          overridingAmt: anyP.OverridingAmt,
          leaderUserName: anyP.CloserLeaderUserName,
          leaderDisplayName: anyP.CloserLeaderDisplayName,
          leaderOverridingPctg: anyP.CloserLeaderOveridingPctg,
          leaderOverridingAmt: anyP.CloserLeaderOveridingAmt,
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
          overridingPctg: anyP.OverridingPctg,
          overridingAmt: anyP.OverridingAmt,
          leaderUserName: anyP.Closer1LeaderUserName,
          leaderDisplayName: anyP.Closer1LeaderDisplayName,
          leaderOverridingPctg: anyP.Closer1LeaderOveridingPctg,
          leaderOverridingAmt: anyP.Closer1LeaderOveridingAmt,
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
          overridingPctg: anyP.OverridingPctg,
          overridingAmt: anyP.OverridingAmt,
          leaderUserName: anyP.Closer2LeaderUserName,
          leaderDisplayName: anyP.Closer2LeaderDisplayName,
          leaderOverridingPctg: anyP.Closer2LeaderOveridingPctg,
          leaderOverridingAmt: anyP.Closer2LeaderOveridingAmt,
          slotLabel: 'Closer 3',
          roleType: 'closer',
        },
      ];

      let slotsPushedForThisApp = 0;
/*
slots.forEach((slot) => {
  const renName = String(slot.displayName || slot.userName || '').trim();
  const slotDepartment = slot.dept || department;
  const commission = toNumber(slot.commission);

  // 🔸 Decide which leader username to show in REN column based on slotLabel
  let effectiveRen = renName; // fallback to normal REN

  if (slot.slotLabel === 'Lister 1') {
    effectiveRen = String(anyP.ListerLeaderUserName || '').trim();
  } else if (slot.slotLabel === 'Lister 2') {
    effectiveRen = String(anyP.Lister1LeaderUserName || '').trim();
  } else if (slot.slotLabel === 'Lister 3') {
    effectiveRen = String(anyP.Lister2LeaderUserName || '').trim();
  } else if (slot.slotLabel === 'Closer 1') {
    effectiveRen = String(anyP.CloserLeaderUserName || '').trim();
  } else if (slot.slotLabel === 'Closer 2') {
    effectiveRen = String(anyP.Closer1LeaderUserName || '').trim();
  } else if (slot.slotLabel === 'Closer 3') {
    effectiveRen = String(anyP.Closer2LeaderUserName || '').trim();
  }

  // If leader username is empty, fall back to original REN
  if (!effectiveRen) {
    effectiveRen = renName;
  }

  // Explosion checks
  if (slot.roleType === 'lister' && !listerExploded) {
    return;
  }
  if (slot.roleType === 'closer' && !closerExploded) {
    return;
  }

  // Must have REN name (or leader) and non-zero commission
  if (!effectiveRen || commission === 0) {
    return;
  }

  // per-row grossFees based on role
  const baseGross =
    slot.roleType === 'lister'
      ? toNumber(anyP.AtlProFees)
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
  const overridingPctg = toNumber(slot.overridingPctg);
  const overridingAmt = toNumber(slot.overridingAmt);
  const leaderUserName = slot.leaderUserName;
  const leaderDisplayName = slot.leaderDisplayName;
  const leaderOverridingPctg = toNumber(slot.leaderOverridingPctg);
  const leaderOverridingAmt = toNumber(slot.leaderOverridingAmt);
  const netComm = commission; // Net Comm per slot = that slot commission

  const detailRow: CommRow = {
    kind: 'detail',
    department: slotDepartment,
    ren: effectiveRen,          // 🔴 now shows leader username per your rules
    slotLabel: slot.slotLabel,
    txId,
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
    overridingPctg,
    overridingAmt,
    leaderUserName,
    leaderDisplayName,
    leaderOverridingPctg,
    leaderOverridingAmt,
  };

  if (!deptMap.has(slotDepartment)) {
    deptMap.set(slotDepartment, new Map());
  }
  const renMap = deptMap.get(slotDepartment)!;

  // 🔸 Group by effectiveRen (leader-based), not original renName
  if (!renMap.has(effectiveRen)) {
    renMap.set(effectiveRen, []);
  }
  renMap.get(effectiveRen)!.push(detailRow);
  slotsPushedForThisApp++;
});
*/

      slots.forEach((slot) => {
  const slotDepartment = slot.dept || department;
  const commission = toNumber(slot.commission);

  // Base REN name (normal REN) – prefer DisplayName, fallback to UserName
  const baseRenName = String(slot.displayName || slot.userName || '').trim();

  // 🔸 Decide which LEADER DISPLAY NAME to show in REN column
  let effectiveRenDisplay = baseRenName; // default = normal REN

  if (slot.slotLabel === 'Lister 1') {
    // If Lister1 → show ListerLeaderDisplayName (fallback to ListerLeaderUserName)
    effectiveRenDisplay = String(
      anyP.ListerLeaderDisplayName || anyP.ListerLeaderUserName || ''
    ).trim();
  } else if (slot.slotLabel === 'Lister 2') {
    // If Lister2 → show Lister1LeaderDisplayName
    effectiveRenDisplay = String(
      anyP.Lister1LeaderDisplayName || anyP.Lister1LeaderUserName || ''
    ).trim();
  } else if (slot.slotLabel === 'Lister 3') {
    // If Lister3 → show Lister2LeaderDisplayName
    effectiveRenDisplay = String(
      anyP.Lister2LeaderDisplayName || anyP.Lister2LeaderUserName || ''
    ).trim();
  } else if (slot.slotLabel === 'Closer 1') {
    // If Closer1 → show CloserLeaderDisplayName
    effectiveRenDisplay = String(
      anyP.CloserLeaderDisplayName || anyP.CloserLeaderUserName || ''
    ).trim();
  } else if (slot.slotLabel === 'Closer 2') {
    // If Closer2 → show Closer1LeaderDisplayName
    effectiveRenDisplay = String(
      anyP.Closer1LeaderDisplayName || anyP.Closer1LeaderUserName || ''
    ).trim();
  } else if (slot.slotLabel === 'Closer 3') {
    // If Closer3 → show Closer2LeaderDisplayName
    effectiveRenDisplay = String(
      anyP.Closer2LeaderDisplayName || anyP.Closer2LeaderUserName || ''
    ).trim();
  }

  // If leader DisplayName is empty, fall back to normal REN DisplayName
  if (!effectiveRenDisplay) {
    effectiveRenDisplay = baseRenName;
  }

  // Explosion checks
  if (slot.roleType === 'lister' && !listerExploded) {
    return;
  }
  if (slot.roleType === 'closer' && !closerExploded) {
    return;
  }

  // Must have a name and non-zero commission
  if (!effectiveRenDisplay || commission === 0) {
    return;
  }

  // per-row grossFees based on role
  const baseGross =
    slot.roleType === 'lister'
      ? toNumber(anyP.AtlProFees)
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
  const overridingPctg = toNumber(slot.overridingPctg);
  const overridingAmt = toNumber(slot.overridingAmt);
  const leaderUserName = slot.leaderUserName;
  const leaderDisplayName = slot.leaderDisplayName;
  const leaderOverridingPctg = toNumber(slot.leaderOverridingPctg);
  const leaderOverridingAmt = toNumber(slot.leaderOverridingAmt);
  const netComm = commission; // Net Comm per slot = that slot commission

  const detailRow: CommRow = {
    kind: 'detail',
    department: slotDepartment,
    ren: effectiveRenDisplay, // 👈 REN column now shows proper DisplayName
    slotLabel: slot.slotLabel,
    txId,
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
    overridingPctg,
    overridingAmt,
    leaderUserName,
    leaderDisplayName,
    leaderOverridingPctg,
    leaderOverridingAmt,
  };

  if (!deptMap.has(slotDepartment)) {
    deptMap.set(slotDepartment, new Map());
  }
  const renMap = deptMap.get(slotDepartment)!;

  // Group by leader DisplayName (effectiveRenDisplay)
  if (!renMap.has(effectiveRenDisplay)) {
    renMap.set(effectiveRenDisplay, []);
  }
  renMap.get(effectiveRenDisplay)!.push(detailRow);
  slotsPushedForThisApp++;
});

      
      
      if (slotsPushedForThisApp === 0) {
        const fallbackRen =
          anyP.RenName ||
          anyP.ListerRenName ||
          anyP.ClosingRenName ||
          'Unknown REN';

        const fallbackCommission = toNumber(
          anyP.Commission ?? anyP.TotalCommission ?? anyP.Lister1Comm
        );
        const fallbackTraining = toNumber(
          anyP.TrainingFees ?? anyP.TraningFees ?? anyP.Lister1TrainingFees
        );
        const fallbackAdmin = toNumber(
          anyP.AdminCharger ?? anyP.AdminCharges ?? anyP.Lister1AdminCharges
        );
        const fallbackStamp = toNumber(
          anyP.StampDuty ?? anyP.StampDut ?? anyP.Lister1StampDuty
        );

        const grossFees = toNumber(
          anyP.AtlProFees ?? anyP.GrossFees ?? anyP.AtlRentalAmt
        );
        const netFees = toNumber(anyP.NetFees ?? grossFees - introducerFee);
        const fallbackNetComm = fallbackCommission;

        const fallbackRow: CommRow = {
          kind: 'detail',
          department,
          ren: String(fallbackRen),
          slotLabel: '',
          txId,
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
          netComm: fallbackNetComm,
          invPctg: 0,
          sharingPctg: 0,
          withholdingTaxPctg: 0,
          withholdingTaxAmt: 0,
          overridingPctg: 0,
          overridingAmt: 0,
          leaderUserName: undefined,
          leaderDisplayName: undefined,
          leaderOverridingPctg: 0,
          leaderOverridingAmt: 0,
        };

        if (!deptMap.has(department)) {
          deptMap.set(department, new Map());
        }
        const renMap = deptMap.get(department)!;
        const renKey = String(fallbackRen);
        if (!renMap.has(renKey)) {
          renMap.set(renKey, []);
        }
        renMap.get(renKey)!.push(fallbackRow);
      }
    });

    const rows: CommRow[] = [];

    let grandTotals: Totals = {
      grossFees: 0,
      introducerFee: 0,
      netFees: 0,
      commission: 0,
      trainingFees: 0,
      adminCharges: 0,
      stampDuty: 0,
      netComm: 0,
      withholdingTaxAmt: 0,
      overridingAmt: 0,
      leaderOverridingAmt: 0,
    };

    for (const [department, renMap] of deptMap.entries()) {
      let deptTotals: Totals = {
        grossFees: 0,
        introducerFee: 0,
        netFees: 0,
        commission: 0,
        trainingFees: 0,
        adminCharges: 0,
        stampDuty: 0,
        netComm: 0,
        withholdingTaxAmt: 0,
        overridingAmt: 0,
        leaderOverridingAmt: 0,
      };

      for (const [ren, detailRows] of renMap.entries()) {
        let renTotals: Totals = {
          grossFees: 0,
          introducerFee: 0,
          netFees: 0,
          commission: 0,
          trainingFees: 0,
          adminCharges: 0,
          stampDuty: 0,
          netComm: 0,
          withholdingTaxAmt: 0,
          overridingAmt: 0,
          leaderOverridingAmt: 0,
        };

        // Push each detail row and accumulate REN totals
        detailRows.forEach((row) => {
          rows.push(row);

          renTotals.grossFees += row.grossFees;
          renTotals.introducerFee += row.introducerFee;
          renTotals.netFees += row.netFees;
          renTotals.commission += row.commission;
          renTotals.trainingFees += row.trainingFees;
          renTotals.adminCharges += row.adminCharges;
          renTotals.stampDuty += row.stampDuty;
          renTotals.netComm += row.netComm;
          renTotals.withholdingTaxAmt += row.withholdingTaxAmt;
          renTotals.overridingAmt += row.overridingAmt;
          renTotals.leaderOverridingAmt += row.leaderOverridingAmt;
        });

        // REN total row (no inv/sharing/withholding % for totals)
        rows.push({
          kind: 'renTotal',
          department,
          ren: 'Total',
          slotLabel: '',
          txId: '',
          address: '',
          claimType: '',
          submissionDate: '',
          payoutDate: '',
          grossFees: renTotals.grossFees,
          introducerFee: renTotals.introducerFee,
          netFees: renTotals.netFees,
          commission: renTotals.commission,
          trainingFees: renTotals.trainingFees,
          adminCharges: renTotals.adminCharges,
          stampDuty: renTotals.stampDuty,
          netComm: renTotals.netComm,
          invPctg: 0,
          sharingPctg: 0,
          withholdingTaxPctg: 0,
          withholdingTaxAmt: renTotals.withholdingTaxAmt,
          overridingPctg: 0,
          overridingAmt: renTotals.overridingAmt,
          leaderUserName: undefined,
          leaderDisplayName: undefined,
          leaderOverridingPctg: 0,
          leaderOverridingAmt: renTotals.leaderOverridingAmt,
        });

        // Add to department totals
        deptTotals.grossFees += renTotals.grossFees;
        deptTotals.introducerFee += renTotals.introducerFee;
        deptTotals.netFees += renTotals.netFees;
        deptTotals.commission += renTotals.commission;
        deptTotals.trainingFees += renTotals.trainingFees;
        deptTotals.adminCharges += renTotals.adminCharges;
        deptTotals.stampDuty += renTotals.stampDuty;
        deptTotals.netComm += renTotals.netComm;
        deptTotals.withholdingTaxAmt += renTotals.withholdingTaxAmt;
        deptTotals.overridingAmt += renTotals.overridingAmt;
        deptTotals.leaderOverridingAmt += renTotals.leaderOverridingAmt;
      }

      // Department total row
      rows.push({
        kind: 'deptTotal',
        department,
        ren: 'Total Of Department',
        slotLabel: '',
        txId: '',
        address: '',
        claimType: '',
        submissionDate: '',
        payoutDate: '',
        grossFees: deptTotals.grossFees,
        introducerFee: deptTotals.introducerFee,
        netFees: deptTotals.netFees,
        commission: deptTotals.commission,
        trainingFees: deptTotals.trainingFees,
        adminCharges: deptTotals.adminCharges,
        stampDuty: deptTotals.stampDuty,
        netComm: deptTotals.netComm,
        invPctg: 0,
        sharingPctg: 0,
        withholdingTaxPctg: 0,
        withholdingTaxAmt: deptTotals.withholdingTaxAmt,
        overridingPctg: 0,
        overridingAmt: deptTotals.overridingAmt,
        leaderUserName: undefined,
        leaderDisplayName: undefined,
        leaderOverridingPctg: 0,
        leaderOverridingAmt: deptTotals.leaderOverridingAmt,
      });

      // Add to grand totals
      grandTotals.grossFees += deptTotals.grossFees;
      grandTotals.introducerFee += deptTotals.introducerFee;
      grandTotals.netFees += deptTotals.netFees;
      grandTotals.commission += deptTotals.commission;
      grandTotals.trainingFees += deptTotals.trainingFees;
      grandTotals.adminCharges += deptTotals.adminCharges;
      grandTotals.stampDuty += deptTotals.stampDuty;
      grandTotals.netComm += deptTotals.netComm;
      grandTotals.withholdingTaxAmt += deptTotals.withholdingTaxAmt;
      grandTotals.overridingAmt += deptTotals.overridingAmt;
      grandTotals.leaderOverridingAmt += deptTotals.leaderOverridingAmt;
    }

    // Grand Total row
    if (rows.length > 0) {
      rows.push({
        kind: 'grandTotal',
        department: 'Grand Total',
        ren: 'Grand Total',
        slotLabel: '',
        txId: '',
        address: '',
        claimType: '',
        submissionDate: '',
        payoutDate: '',
        grossFees: grandTotals.grossFees,
        introducerFee: grandTotals.introducerFee,
        netFees: grandTotals.netFees,
        commission: grandTotals.commission,
        trainingFees: grandTotals.trainingFees,
        adminCharges: grandTotals.adminCharges,
        stampDuty: grandTotals.stampDuty,
        netComm: grandTotals.netComm,
        invPctg: 0,
        sharingPctg: 0,
        withholdingTaxPctg: 0,
        withholdingTaxAmt: grandTotals.withholdingTaxAmt,
        overridingPctg: 0,
        overridingAmt: grandTotals.overridingAmt,
        leaderUserName: undefined,
        leaderDisplayName: undefined,
        leaderOverridingPctg: 0,
        leaderOverridingAmt: grandTotals.leaderOverridingAmt,
      });
    }

    return rows;
  }, [filteredProperties]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <DollarSign className="text-blue-600" size={32} />
            Overiding Fees Report
          </h1>
        </div>
      </div>

      {summaryError && (
        <div className="text-sm text-red-600">{summaryError}</div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search keyword"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter size={20} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="allstatus">All Status</option>
              <option value="pending commission">Pending Commission</option>
              <option value="partial commission">Partial Commission</option>
              <option value="commission paid">Commission Paid</option>
            </select>
          </div>
          <button
            onClick={() => {
              fetchCommPayouts();
              fetchSummary();
            }}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Loading / error */}
      {loading && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading commission payout data...</p>
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
              fetchCommPayouts();
              fetchSummary();
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* TABLE VIEW */}
      {!loading && !error && filteredProperties.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs md:text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  
                  <th className="px-3 py-2 text-left border-b">Leader</th>
                  <th className="px-3 py-2 text-right border-b">Leader Overriding %</th>
                  
                  <th className="px-3 py-2 text-left border-b">REN</th>
                  <th className="px-3 py-2 text-left border-b">Ref No</th>
                  <th className="px-3 py-2 text-left border-b">Address</th>
                  <th className="px-3 py-2 text-left border-b">Claim Type</th>
                  <th className="px-3 py-2 text-left border-b">
                    Submission Date
                  </th>
                  <th className="px-3 py-2 text-left border-b">Pay Out Date</th>
                  <th className="px-3 py-2 text-right border-b">Gross Fees</th>
                  <th className="px-3 py-2 text-right border-b">
                    Less Introducer Fee
                  </th>
                  <th className="px-3 py-2 text-right border-b">Net Fees</th>
                  <th className="px-3 py-2 text-right border-b">Gross Comm</th>                                                    
                  <th className="px-3 py-2 text-right border-b">W/H Tax %</th>
                  <th className="px-3 py-2 text-right border-b">W/H Tax Amt</th>
                  <th className="px-3 py-2 text-right border-b">Net Comm</th>
                  
                  
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, idx) => {
                  const baseClass =
                    'px-3 py-2 border-b whitespace-nowrap align-middle';
                  let rowClass = '';
                  if (row.kind === 'detail') {
                    rowClass = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                  } else if (row.kind === 'renTotal') {
                    rowClass = 'bg-gray-100 font-semibold';
                  } else if (row.kind === 'deptTotal') {
                    rowClass = 'bg-gray-200 font-semibold';
                  } else if (row.kind === 'grandTotal') {
                    rowClass = 'bg-yellow-100 font-bold';
                  }

                  return (
                    <tr key={`${row.kind}-${idx}`} className={rowClass}>
                      <td className={baseClass}>
                        {row.leaderDisplayName || row.leaderUserName || ''}
                      </td>
                      <td className={`${baseClass} text-right`}>
                        {row.kind === 'detail'
                          ? row.leaderOverridingPctg.toFixed(2)
                          : ''}
                      </td>

                      <td className={baseClass}>{row.displayName}</td>
                      
                      <td className={baseClass}>{row.txId}</td>
                      <td className={baseClass}>{row.address}</td>
                      <td className={baseClass}>{row.claimType}</td>
                      <td className={baseClass}>{row.submissionDate}</td>
                      <td className={baseClass}>{row.payoutDate}</td>
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
                        {formatCurrency(row.leaderOverridingAmt)}
                      </td>
                      
                      
                      <td className={`${baseClass} text-right`}>
                        {row.kind === 'detail'
                          ? row.withholdingTaxPctg.toFixed(2)
                          : ''}
                      </td>
                      <td className={`${baseClass} text-right`}>
                        {row.kind === 'detail'
                          ? formatCurrency(row.withholdingTaxAmt)
                          : ''}
                      </td>

                       <td className={`${baseClass} text-right`}>
                        {formatCurrency(row.leaderOverridingAmt)}
                      </td>
                      
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* optional small legend */}
          <div className="px-4 py-3 text-xs text-gray-500">
            <div className="flex flex-wrap gap-4">
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 bg-gray-100 inline-block rounded-sm" />
                REN Total
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 bg-gray-200 inline-block rounded-sm" />
                Department Total
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 bg-yellow-100 inline-block rounded-sm" />
                Grand Total
              </span>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && filteredProperties.length === 0 && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No Commission Payouts Found
          </h3>
          <p className="text-gray-500 mb-4">
            {(searchTerm ||
              (statusFilter !== 'all' && statusFilter !== 'allstatus'))
              ? 'No payouts match your current filters.'
              : 'No commission payouts have been created yet.'}
          </p>
          {(searchTerm ||
            (statusFilter !== 'all' && statusFilter !== 'allstatus')) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
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

export default OverridingFeesRpt;
