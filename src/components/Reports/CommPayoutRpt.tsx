import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useState, useCallback, useMemo } from 'react';
import { DollarSign, AlertCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

import { useAuth } from '../../context/AuthContext';
import { RentalApplication } from '../../types';

const LIST_URL =
  API_ENDPOINTS.PAYOUT_COMMISSION_REPORT_GET;

type RowKind = 'detail';
type ViewTab = 'ren' | 'department';

interface CommRow {
  kind: RowKind;
  department: string;
  ren: string;
  deptDisplayName: string;
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

type TotalsShape = {
  grossFees: number;
  introducerFee: number;
  netFees: number;
  commission: number;
  trainingFees: number;
  total: number;
  adminCharges: number;
  withholdingTaxAmt: number;
  stampDuty: number;
  totalPayout: number;
};

type GroupedRows = {
  key: string;
  ren: string;
  deptDisplayName: string;
  rows: CommRow[];
  totals: TotalsShape;
};

type DepartmentGroupedRows = {
  key: string;
  department: string;
  renGroups: GroupedRows[];
  totals: TotalsShape;
};

const CommPayoutRpt: React.FC = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<ViewTab>('ren');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [properties, setProperties] = useState<RentalApplication[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [renFilter, setRenFilter] = useState<string>('');

  const filteredProperties = properties;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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

  const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr === '1900-01-01') return '';
    return dateStr;
  };

  const formatDateForExcel = (dateStr?: string) => {
    if (!dateStr || dateStr === '1900-01-01') return '';
    const s = String(dateStr).trim();
    if (!s) return '';

    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
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

  const toNumber = (v: any): number => {
    if (v === null || v === undefined || v === '') return 0;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const getRowTotal = (row: CommRow) =>
    toNumber(row.commission) + toNumber(row.trainingFees);

  const getRowTotalPayout = (row: CommRow) =>
    toNumber(row.commission) +
    toNumber(row.trainingFees) +
    toNumber(row.adminCharges) +
    toNumber(row.stampDuty) -
    toNumber(row.withholdingTaxAmt);

  const createEmptyTotals = (): TotalsShape => ({
    grossFees: 0,
    introducerFee: 0,
    netFees: 0,
    commission: 0,
    trainingFees: 0,
    total: 0,
    adminCharges: 0,
    withholdingTaxAmt: 0,
    stampDuty: 0,
    totalPayout: 0,
  });

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
        //formData.append('UserName', '0');
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
        setError(err?.message || 'Failed to fetch commission payout data');
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

      const masterDeptDisplayName = String(
        anyP.ListerLeaderDisplayName ||
          anyP.listerLeaderDisplayName ||
          anyP.DeptDisplayName ||
          anyP.DepartmentDisplayName ||
          department ||
          ''
      ).trim();

      const txId =
        anyP.TxId || anyP.TXID || anyP.RefNo || String(anyP.ApplicationId || '');

      const transId = String(anyP.TransId || anyP.transId || anyP.TRANSID || '');
      const address = anyP.PropertyAddress || anyP.Address || '';
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
          department: String(slotDepartment || 'Unknown Department').trim(),
          ren: renName,
          deptDisplayName: masterDeptDisplayName,
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
        anyP.CloserDisplayName ||
        'Unknown REN';

      const fallbackCommission = toNumber(
        anyP.ListerComm ??
          anyP.Closer1Comm ??
          anyP.TotalCommission ??
          anyP.Lister1Comm
      );

      const fallbackTraining = toNumber(
        anyP.ListerTrainingFees ??
          anyP.Closer1TrainingFees ??
          anyP.TraningFees ??
          anyP.Lister1TrainingFees
      );

      const fallbackAdmin = toNumber(
        anyP.ListerAdminCharges ??
          anyP.Closer1AdminCharges ??
          anyP.AdminCharger ??
          anyP.AdminCharges ??
          anyP.Lister1AdminCharges
      );

      const fallbackStamp = toNumber(
        anyP.StampDuty ??
          anyP.StampDut ??
          anyP.ListerStampDuty ??
          anyP.Closer1StampDuty ??
          anyP.Lister1StampDuty
      );

      const fallbackWithholdingTaxPctg = toNumber(
        anyP.ListerWitholdingTaxPctg ??
          anyP.CloserWitholdingTaxPctg ??
          anyP.Lister1WitholdingTaxPctg ??
          anyP.Closer1WitholdingTaxPctg ??
          anyP.Lister2WitholdingTaxPctg ??
          anyP.Closer2WitholdingTaxPctg
      );

      const fallbackWithholdingTaxAmt = toNumber(
        anyP.ListerWitholdingTaxAmt ??
          anyP.CloserWitholdingTaxAmt ??
          anyP.Lister1WitholdingTaxAmt ??
          anyP.Closer1WitholdingTaxAmt ??
          anyP.Lister2WitholdingTaxAmt ??
          anyP.Closer2WitholdingTaxAmt
      );

      const grossFees = toNumber(anyP.AtlProFees);
      const netFees = toNumber(anyP.NetFees ?? grossFees - introducerFee);

      if (slotsPushedForThisApp === 0) {
        rows.push({
          kind: 'detail',
          department: String(department || 'Unknown Department').trim(),
          ren: String(fallbackRen),
          deptDisplayName: masterDeptDisplayName,
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
          withholdingTaxPctg: fallbackWithholdingTaxPctg,
          withholdingTaxAmt: fallbackWithholdingTaxAmt,
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

  const groupedTableRows: GroupedRows[] = useMemo(() => {
    const map = new Map<string, GroupedRows>();

    filteredTableRows.forEach((row) => {
      const ren = row.ren || '';
      const deptDisplayName = row.deptDisplayName || '';
      const key = `${ren}|||${deptDisplayName}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          ren,
          deptDisplayName,
          rows: [],
          totals: createEmptyTotals(),
        });
      }

      const group = map.get(key)!;
      group.rows.push(row);
      group.totals.grossFees += toNumber(row.grossFees);
      group.totals.introducerFee += toNumber(row.introducerFee);
      group.totals.netFees += toNumber(row.netFees);
      group.totals.commission += toNumber(row.commission);
      group.totals.trainingFees += toNumber(row.trainingFees);
      group.totals.total += getRowTotal(row);
      group.totals.adminCharges += toNumber(row.adminCharges);
      group.totals.withholdingTaxAmt += toNumber(row.withholdingTaxAmt);
      group.totals.stampDuty += toNumber(row.stampDuty);
      group.totals.totalPayout += getRowTotalPayout(row);
    });


    map.forEach((group) => {
  group.rows.sort((a, b) => {
    const payoutA = String(a.payoutDate || '');
    const payoutB = String(b.payoutDate || '');

    if (payoutA !== payoutB) return payoutA.localeCompare(payoutB);

    const submissionA = String(a.submissionDate || '');
    const submissionB = String(b.submissionDate || '');

    if (submissionA !== submissionB) return submissionA.localeCompare(submissionB);

    return String(a.transId || '').localeCompare(String(b.transId || ''));
  });
});
          
    return Array.from(map.values()).sort((a, b) => {
      const deptCmp = (a.deptDisplayName || '').localeCompare(
        b.deptDisplayName || ''
      );
      if (deptCmp !== 0) return deptCmp;

      return (a.ren || '').localeCompare(b.ren || '');
    });
  }, [filteredTableRows]);

  const groupedByDepartmentRows: DepartmentGroupedRows[] = useMemo(() => {
    const deptMap = new Map<string, DepartmentGroupedRows>();

    groupedTableRows.forEach((renGroup) => {
      const department = String(
        renGroup.deptDisplayName || 'Unknown Department'
      ).trim();

      if (!deptMap.has(department)) {
        deptMap.set(department, {
          key: department,
          department,
          renGroups: [],
          totals: createEmptyTotals(),
        });
      }

      const deptGroup = deptMap.get(department)!;
      deptGroup.renGroups.push(renGroup);

      deptGroup.totals.grossFees += renGroup.totals.grossFees;
      deptGroup.totals.introducerFee += renGroup.totals.introducerFee;
      deptGroup.totals.netFees += renGroup.totals.netFees;
      deptGroup.totals.commission += renGroup.totals.commission;
      deptGroup.totals.trainingFees += renGroup.totals.trainingFees;
      deptGroup.totals.total += renGroup.totals.total;
      deptGroup.totals.adminCharges += renGroup.totals.adminCharges;
      deptGroup.totals.withholdingTaxAmt += renGroup.totals.withholdingTaxAmt;
      deptGroup.totals.stampDuty += renGroup.totals.stampDuty;
      deptGroup.totals.totalPayout += renGroup.totals.totalPayout;
    });

    return Array.from(deptMap.values())
      .map((deptGroup) => ({
        ...deptGroup,
        renGroups: [...deptGroup.renGroups].sort((a, b) =>
          (a.ren || '').localeCompare(b.ren || '')
        ),
      }))
      .sort((a, b) => (a.department || '').localeCompare(b.department || ''));
  }, [groupedTableRows]);

  const dateRangeText = useMemo(() => {
    const sd = startDate ? startDate : 'ALL';
    const ed = endDate ? endDate : 'ALL';
    return `Date Range : ${sd} to ${ed}`;
  }, [startDate, endDate]);

  const totals = useMemo(() => {
    return filteredTableRows.reduce(
      (acc, r) => {
        acc.grossFees += toNumber(r.grossFees);
        acc.introducerFee += toNumber(r.introducerFee);
        acc.netFees += toNumber(r.netFees);
        acc.commission += toNumber(r.commission);
        acc.trainingFees += toNumber(r.trainingFees);
        acc.total += getRowTotal(r);
        acc.adminCharges += toNumber(r.adminCharges);
        acc.withholdingTaxAmt += toNumber(r.withholdingTaxAmt);
        acc.stampDuty += toNumber(r.stampDuty);
        acc.totalPayout += getRowTotalPayout(r);
        return acc;
      },
      createEmptyTotals()
    );
  }, [filteredTableRows]);

  const headers = [
    'Trans Id',
    'Address',
    'Gross Fees',
    'Introducer Fees',
    'Net Fees',
    'Commission',
    'Training Fees',
    'Total',
    'Admin Fees',
    'Less WHT',
    'Stamp Duty',
    'Total Payout',
    'Submission Date',
    'Payout',
  ];

  const excelColumnWidths = [
    { wch: 9 },
    { wch: 25 },
    { wch: 7 },
    { wch: 7 },
    { wch: 8 },
    { wch: 7 },
    { wch: 7 },
    { wch: 8 },
    { wch: 6 },
    { wch: 6 },
    { wch: 6 },
    { wch: 7 },
    { wch: 7 },
    { wch: 7 },
  ];

  const makeBorder = (color = 'D9D9D9') => ({
    top: { style: 'thin', color: { rgb: color } },
    bottom: { style: 'thin', color: { rgb: color } },
    left: { style: 'thin', color: { rgb: color } },
    right: { style: 'thin', color: { rgb: color } },
  });

  const safeSheetName = (name: string, usedNames: Set<string>) => {
    let sheetName = String(name || 'REN')
      .replace(/[\\\/\?\*\[\]\:]/g, '')
      .trim();

    if (!sheetName) sheetName = 'REN';
    if (sheetName.length > 31) sheetName = sheetName.substring(0, 31);

    let finalName = sheetName;
    let counter = 2;

    while (usedNames.has(finalName)) {
      const suffix = `_${counter}`;
      const maxBaseLength = 31 - suffix.length;
      finalName = `${sheetName.substring(0, maxBaseLength)}${suffix}`;
      counter++;
    }

    usedNames.add(finalName);
    return finalName;
  };

  const applyCommonSheetStyle = (ws: XLSX.WorkSheet) => {
    ws['!cols'] = excelColumnWidths;

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:N1');

    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) continue;

        (ws[addr] as any).s = {
          font: {
            name: 'Arial',
            sz: 7,
          },
          alignment: {
            vertical: 'center',
            horizontal: C >= 2 && C <= 11 ? 'right' : 'left',
            wrapText: C === 1,
          },
          border: makeBorder(),
        };

        if (C >= 2 && C <= 11 && typeof ws[addr].v === 'number') {
          (ws[addr] as any).z = '#,##0.00';
        }
      }
    }

    (ws as any)['!pageSetup'] = {
      paperSize: 9,
      orientation: 'landscape',
      fitToWidth: 1,
      fitToHeight: 0,
      scale: 52,
    };

    (ws as any)['!margins'] = {
      left: 0.15,
      right: 0.15,
      top: 0.6,
      bottom: 0.25,
      header: 0.1,
      footer: 0.1,
    };
  };

  const handleExportExcel = useCallback(() => {
    try {
      if (!groupedTableRows.length) return;

      setExporting(true);
      setError(null);

      const title = 'Commission Payout Report';

      const aoa: any[][] = [];
      aoa.push([title]);
      aoa.push([dateRangeText]);
      aoa.push([]);

      groupedTableRows.forEach((group) => {
        aoa.push([
          `REN : ${group.ren || '-'}    Dept : ${group.deptDisplayName || '-'}`,
        ]);

        aoa.push(headers);

        group.rows.forEach((row) => {
          aoa.push([
            `${row.transId || ''}${row.txId ? ` (${row.txId})` : ''}`,
            row.address || '',
            toNumber(row.grossFees),
            toNumber(row.introducerFee),
            toNumber(row.netFees),
            toNumber(row.commission),
            toNumber(row.trainingFees),
            getRowTotal(row),
            toNumber(row.adminCharges),
            toNumber(row.withholdingTaxAmt),
            toNumber(row.stampDuty),
            getRowTotalPayout(row),
            formatDateForExcel(row.submissionDate),
            formatDateForExcel(row.payoutDate),
          ]);
        });

        aoa.push([
          'Total',
          '',
          group.totals.grossFees,
          group.totals.introducerFee,
          group.totals.netFees,
          group.totals.commission,
          group.totals.trainingFees,
          group.totals.total,
          group.totals.adminCharges,
          group.totals.withholdingTaxAmt,
          group.totals.stampDuty,
          group.totals.totalPayout,
          '',
          '',
        ]);

        aoa.push([]);
      });

      aoa.push([]);
      aoa.push([
        'GRAND TOTAL',
        '',
        totals.grossFees,
        totals.introducerFee,
        totals.netFees,
        totals.commission,
        totals.trainingFees,
        totals.total,
        totals.adminCharges,
        totals.withholdingTaxAmt,
        totals.stampDuty,
        totals.totalPayout,
        '',
        '',
      ]);

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      ws['!cols'] = excelColumnWidths;

      const merges: XLSX.Range[] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
      ];

      let rowPtr = 3;
      groupedTableRows.forEach((group) => {
        merges.push({
          s: { r: rowPtr, c: 0 },
          e: { r: rowPtr, c: headers.length - 1 },
        });

        rowPtr += 1;
        rowPtr += 1;
        rowPtr += group.rows.length;
        rowPtr += 1;
        rowPtr += 1;
      });

      ws['!merges'] = merges;

      applyCommonSheetStyle(ws);

      if (ws['A1']) {
        (ws['A1'] as any).s = {
          font: { name: 'Arial', sz: 10, bold: true },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }

      if (ws['A2']) {
        (ws['A2'] as any).s = {
          font: { name: 'Arial', sz: 7, italic: true },
          alignment: { horizontal: 'left', vertical: 'center' },
        };
      }

      rowPtr = 3;
      groupedTableRows.forEach((group) => {
        const groupTitleCell = XLSX.utils.encode_cell({ r: rowPtr, c: 0 });
        if (ws[groupTitleCell]) {
          (ws[groupTitleCell] as any).s = {
            font: { name: 'Arial', sz: 7, bold: true },
            fill: { fgColor: { rgb: 'D9D9D9' } },
            alignment: { horizontal: 'left', vertical: 'center' },
            border: makeBorder('A6A6A6'),
          };
        }

        const headerRow = rowPtr + 1;
        for (let C = 0; C < headers.length; C++) {
          const headerCell = XLSX.utils.encode_cell({ r: headerRow, c: C });
          if (!ws[headerCell]) continue;

          (ws[headerCell] as any).s = {
            font: { name: 'Arial', sz: 7, bold: true },
            fill: { fgColor: { rgb: 'EDEDED' } },
            alignment: {
              horizontal: C >= 2 && C <= 11 ? 'right' : 'center',
              vertical: 'center',
              wrapText: true,
            },
            border: makeBorder('A6A6A6'),
          };
        }

        const totalRow = rowPtr + 2 + group.rows.length;
        for (let C = 0; C < headers.length; C++) {
          const totalCell = XLSX.utils.encode_cell({ r: totalRow, c: C });
          if (!ws[totalCell]) continue;

          (ws[totalCell] as any).s = {
            font: { name: 'Arial', sz: 7, bold: true },
            fill: { fgColor: { rgb: 'F5F5F5' } },
            alignment: {
              horizontal: C >= 2 && C <= 11 ? 'right' : 'left',
              vertical: 'center',
              wrapText: C === 1,
            },
            border: makeBorder('A6A6A6'),
          };

          if (C >= 2 && C <= 11 && typeof ws[totalCell].v === 'number') {
            (ws[totalCell] as any).z = '#,##0.00';
          }
        }

        rowPtr = totalRow + 2;
      });

      const grandTotalRow = aoa.length - 1;
      for (let C = 0; C < headers.length; C++) {
        const cell = XLSX.utils.encode_cell({ r: grandTotalRow, c: C });
        if (!ws[cell]) continue;

        (ws[cell] as any).s = {
          font: { name: 'Arial', sz: 7, bold: true },
          fill: { fgColor: { rgb: 'E2F0D9' } },
          alignment: {
            horizontal: C >= 2 && C <= 11 ? 'right' : 'left',
            vertical: 'center',
            wrapText: C === 1,
          },
          border: makeBorder('A6A6A6'),
        };

        if (C >= 2 && C <= 11 && typeof ws[cell].v === 'number') {
          (ws[cell] as any).z = '#,##0.00';
        }
      }

      ws['!rows'] = Array.from({ length: aoa.length }, (_, i) => {
        if (i === 0) return { hpt: 20 };
        if (i === 1) return { hpt: 16 };
        if (i === 2) return { hpt: 6 };
        return { hpt: 18 };
      });

      if (groupedTableRows.length > 0) {
        ws['!autofilter'] = {
          ref: 'A5:N5',
        };
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'CommPayoutRpt');

      (wb as any).Workbook = {
        Views: [{ RTL: false }],
      };

      XLSX.writeFile(
        wb,
        `Commission_Payout_Report_${startDate || 'ALL'}_to_${endDate || 'ALL'}.xlsx`
      );
    } catch (e: any) {
      setError(e?.message || 'Failed to export Excel file');
    } finally {
      setExporting(false);
    }
  }, [groupedTableRows, dateRangeText, startDate, endDate, totals]);

  const handleExportIndividualTabsExcel = useCallback(() => {
    try {
      if (!groupedTableRows.length) return;

      setExporting(true);
      setError(null);

      const wb = XLSX.utils.book_new();
      const usedSheetNames = new Set<string>();

      groupedTableRows.forEach((group) => {
        const aoa: any[][] = [];

        aoa.push(['Commission Payout Report']);
        aoa.push([dateRangeText]);
        aoa.push([]);
        aoa.push([
          `REN : ${group.ren || '-'}    Dept : ${group.deptDisplayName || '-'}`,
        ]);
        aoa.push(headers);

        group.rows.forEach((row) => {
          aoa.push([
            `${row.transId || ''}${row.txId ? ` (${row.txId})` : ''}`,
            row.address || '',
            toNumber(row.grossFees),
            toNumber(row.introducerFee),
            toNumber(row.netFees),
            toNumber(row.commission),
            toNumber(row.trainingFees),
            getRowTotal(row),
            toNumber(row.adminCharges),
            toNumber(row.withholdingTaxAmt),
            toNumber(row.stampDuty),
            getRowTotalPayout(row),
            formatDateForExcel(row.submissionDate),
            formatDateForExcel(row.payoutDate),
          ]);
        });

        aoa.push([
          'Total',
          '',
          group.totals.grossFees,
          group.totals.introducerFee,
          group.totals.netFees,
          group.totals.commission,
          group.totals.trainingFees,
          group.totals.total,
          group.totals.adminCharges,
          group.totals.withholdingTaxAmt,
          group.totals.stampDuty,
          group.totals.totalPayout,
          '',
          '',
        ]);

        const ws = XLSX.utils.aoa_to_sheet(aoa);

        ws['!cols'] = excelColumnWidths;
        ws['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
          { s: { r: 3, c: 0 }, e: { r: 3, c: headers.length - 1 } },
        ];

        applyCommonSheetStyle(ws);

        if (ws['A1']) {
          (ws['A1'] as any).s = {
            font: { name: 'Arial', sz: 10, bold: true },
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        }

        if (ws['A2']) {
          (ws['A2'] as any).s = {
            font: { name: 'Arial', sz: 7, italic: true },
            alignment: { horizontal: 'left', vertical: 'center' },
          };
        }

        if (ws['A4']) {
          (ws['A4'] as any).s = {
            font: { name: 'Arial', sz: 7, bold: true },
            fill: { fgColor: { rgb: 'D9D9D9' } },
            alignment: { horizontal: 'left', vertical: 'center' },
            border: makeBorder('A6A6A6'),
          };
        }

        for (let C = 0; C < headers.length; C++) {
          const headerCell = XLSX.utils.encode_cell({ r: 4, c: C });
          if (!ws[headerCell]) continue;

          (ws[headerCell] as any).s = {
            font: { name: 'Arial', sz: 7, bold: true },
            fill: { fgColor: { rgb: 'EDEDED' } },
            alignment: {
              horizontal: C >= 2 && C <= 11 ? 'right' : 'center',
              vertical: 'center',
              wrapText: true,
            },
            border: makeBorder('A6A6A6'),
          };
        }

        const totalRow = aoa.length - 1;
        for (let C = 0; C < headers.length; C++) {
          const totalCell = XLSX.utils.encode_cell({ r: totalRow, c: C });
          if (!ws[totalCell]) continue;

          (ws[totalCell] as any).s = {
            font: { name: 'Arial', sz: 7, bold: true },
            fill: { fgColor: { rgb: 'F5F5F5' } },
            alignment: {
              horizontal: C >= 2 && C <= 11 ? 'right' : 'left',
              vertical: 'center',
              wrapText: C === 1,
            },
            border: makeBorder('A6A6A6'),
          };

          if (C >= 2 && C <= 11 && typeof ws[totalCell].v === 'number') {
            (ws[totalCell] as any).z = '#,##0.00';
          }
        }

        ws['!rows'] = Array.from({ length: aoa.length }, (_, i) => {
          if (i === 0) return { hpt: 20 };
          if (i === 1) return { hpt: 16 };
          if (i === 2) return { hpt: 6 };
          return { hpt: 18 };
        });

        if (group.rows.length > 0) {
          ws['!autofilter'] = {
            ref: 'A5:N5',
          };
        }

        const sheetName = safeSheetName(group.ren || 'REN', usedSheetNames);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      const totalAoa: any[][] = [
        ['Commission Payout Report'],
        [dateRangeText],
        [],
        ['GRAND TOTAL'],
        headers,
        [
          'GRAND TOTAL',
          '',
          totals.grossFees,
          totals.introducerFee,
          totals.netFees,
          totals.commission,
          totals.trainingFees,
          totals.total,
          totals.adminCharges,
          totals.withholdingTaxAmt,
          totals.stampDuty,
          totals.totalPayout,
          '',
          '',
        ],
      ];

      const totalWs = XLSX.utils.aoa_to_sheet(totalAoa);

      totalWs['!cols'] = excelColumnWidths;
      totalWs['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: headers.length - 1 } },
      ];

      applyCommonSheetStyle(totalWs);

      if (totalWs['A1']) {
        (totalWs['A1'] as any).s = {
          font: { name: 'Arial', sz: 10, bold: true },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }

      if (totalWs['A2']) {
        (totalWs['A2'] as any).s = {
          font: { name: 'Arial', sz: 7, italic: true },
          alignment: { horizontal: 'left', vertical: 'center' },
        };
      }

      if (totalWs['A4']) {
        (totalWs['A4'] as any).s = {
          font: { name: 'Arial', sz: 7, bold: true },
          fill: { fgColor: { rgb: 'D9D9D9' } },
          alignment: { horizontal: 'left', vertical: 'center' },
          border: makeBorder('A6A6A6'),
        };
      }

      for (let C = 0; C < headers.length; C++) {
        const headerCell = XLSX.utils.encode_cell({ r: 4, c: C });
        if (!totalWs[headerCell]) continue;

        (totalWs[headerCell] as any).s = {
          font: { name: 'Arial', sz: 7, bold: true },
          fill: { fgColor: { rgb: 'EDEDED' } },
          alignment: {
            horizontal: C >= 2 && C <= 11 ? 'right' : 'center',
            vertical: 'center',
            wrapText: true,
          },
          border: makeBorder('A6A6A6'),
        };
      }

      const grandTotalDataRow = 5;
      for (let C = 0; C < headers.length; C++) {
        const cell = XLSX.utils.encode_cell({ r: grandTotalDataRow, c: C });
        if (!totalWs[cell]) continue;

        (totalWs[cell] as any).s = {
          font: { name: 'Arial', sz: 7, bold: true },
          fill: { fgColor: { rgb: 'E2F0D9' } },
          alignment: {
            horizontal: C >= 2 && C <= 11 ? 'right' : 'left',
            vertical: 'center',
            wrapText: C === 1,
          },
          border: makeBorder('A6A6A6'),
        };

        if (C >= 2 && C <= 11 && typeof totalWs[cell].v === 'number') {
          (totalWs[cell] as any).z = '#,##0.00';
        }
      }

      totalWs['!rows'] = Array.from({ length: totalAoa.length }, (_, i) => {
        if (i === 0) return { hpt: 20 };
        if (i === 1) return { hpt: 16 };
        if (i === 2) return { hpt: 6 };
        return { hpt: 18 };
      });

      totalWs['!autofilter'] = {
        ref: 'A5:N5',
      };

      XLSX.utils.book_append_sheet(
        wb,
        totalWs,
        safeSheetName('GRAND TOTAL', usedSheetNames)
      );

      (wb as any).Workbook = {
        Views: [{ RTL: false }],
      };

      XLSX.writeFile(
        wb,
        `Commission_Payout_Report_Individual_Tabs_${startDate || 'ALL'}_to_${endDate || 'ALL'}.xlsx`
      );
    } catch (e: any) {
      setError(e?.message || 'Failed to export Excel file');
    } finally {
      setExporting(false);
    }
  }, [groupedTableRows, dateRangeText, startDate, endDate, totals]);

  const renderColumnHeader = () => (
    <tr className="bg-gray-100 text-gray-700 font-semibold">
      <td className="px-3 py-2 text-left border-b">Trans Id</td>
      <td className="px-3 py-2 text-left border-b">Address</td>
      <td className="px-3 py-2 text-right border-b">Gross Fees</td>
      <td className="px-3 py-2 text-right border-b">Introducer Fees</td>
      <td className="px-3 py-2 text-right border-b">Net Fees</td>
      <td className="px-3 py-2 text-right border-b">Commission</td>
      <td className="px-3 py-2 text-right border-b">Training Fees</td>
      <td className="px-3 py-2 text-right border-b">Total</td>
      <td className="px-3 py-2 text-right border-b">Admin Fees</td>
      <td className="px-3 py-2 text-right border-b">Less WHT</td>
      <td className="px-3 py-2 text-right border-b">Stamp Duty</td>
      <td className="px-3 py-2 text-right border-b">Total Payout</td>
      <td className="px-3 py-2 text-left border-b">Submission Date</td>
      <td className="px-3 py-2 text-left border-b">Payout</td>
    </tr>
  );

  const renderDetailRows = (rows: CommRow[], keyPrefix: string) =>
    rows.map((row, idx) => {
      const baseClass = 'px-3 py-2 border-b whitespace-nowrap align-top';
      const rowClass = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';

      return (
        <tr key={`${keyPrefix}-${row.transId || 'row'}-${idx}`} className={rowClass}>
          <td className={baseClass}>
            {row.transId}
            {row.txId ? ` (${row.txId})` : ''}
          </td>

          <td
            className="px-3 py-2 border-b align-top whitespace-normal break-words break-all min-w-[420px] max-w-[520px]"
            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
          >
            {row.address}
          </td>

          <td className={`${baseClass} text-right`}>{formatCurrency(row.grossFees)}</td>
          <td className={`${baseClass} text-right`}>
            {formatCurrency(row.introducerFee)}
          </td>
          <td className={`${baseClass} text-right`}>{formatCurrency(row.netFees)}</td>
          <td className={`${baseClass} text-right`}>
            {formatCurrency(row.commission)}
          </td>
          <td className={`${baseClass} text-right`}>
            {formatCurrency(row.trainingFees)}
          </td>
          <td className={`${baseClass} text-right`}>
            {formatCurrency(getRowTotal(row))}
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
            {formatCurrency(getRowTotalPayout(row))}
          </td>
          <td className={baseClass}>{row.submissionDate}</td>
          <td className={baseClass}>{row.payoutDate}</td>
        </tr>
      );
    });

  const renderTotalRow = (label: string, totalsObj: TotalsShape, bgClass = 'bg-gray-100') => (
    <tr className={`${bgClass} font-semibold text-gray-900`}>
      <td className="px-3 py-2 border-b">{label}</td>
      <td className="px-3 py-2 border-b"></td>

      <td className="px-3 py-2 border-b text-right">
        {formatCurrency(totalsObj.grossFees)}
      </td>

      <td className="px-3 py-2 border-b text-right">
        {formatCurrency(totalsObj.introducerFee)}
      </td>

      <td className="px-3 py-2 border-b text-right">
        {formatCurrency(totalsObj.netFees)}
      </td>

      <td className="px-3 py-2 border-b text-right">
        {formatCurrency(totalsObj.commission)}
      </td>

      <td className="px-3 py-2 border-b text-right">
        {formatCurrency(totalsObj.trainingFees)}
      </td>

      <td className="px-3 py-2 border-b text-right">
        {formatCurrency(totalsObj.total)}
      </td>

      <td className="px-3 py-2 border-b text-right">
        {formatCurrency(totalsObj.adminCharges)}
      </td>

      <td className="px-3 py-2 border-b text-right">
        {formatCurrency(totalsObj.withholdingTaxAmt)}
      </td>

      <td className="px-3 py-2 border-b text-right">
        {formatCurrency(totalsObj.stampDuty)}
      </td>

      <td className="px-3 py-2 border-b text-right">
        {formatCurrency(totalsObj.totalPayout)}
      </td>

      <td className="px-3 py-2 border-b"></td>
      <td className="px-3 py-2 border-b"></td>
    </tr>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <DollarSign className="text-blue-600" size={32} />
            Commission Payout Report
          </h1>
          <div className="mt-1 text-sm text-gray-600">{dateRangeText}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:flex-wrap gap-4 md:items-center">
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

          <button
            onClick={handleExportExcel}
            disabled={loading || exporting || groupedTableRows.length === 0}
            className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            {exporting ? 'Exporting...' : 'Export Excel'}
          </button>

          <button
            onClick={handleExportIndividualTabsExcel}
            disabled={loading || exporting || groupedTableRows.length === 0}
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            {exporting ? 'Exporting...' : 'Export Individual Tab to Excel'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('ren')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'ren'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Group By REN
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('department')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'department'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Group By Department
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading commission payout data...</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Error Loading Data</h3>
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

      {!loading && !error && activeTab === 'ren' && groupedTableRows.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs md:text-sm border-collapse">
              <tbody>
                {groupedTableRows.map((group) => (
                  <React.Fragment key={group.key}>
                    <tr className="bg-gray-200 font-semibold text-gray-900">
                      <td colSpan={14} className="px-4 py-3 border-b">
                        <div className="flex flex-wrap items-center gap-10 whitespace-nowrap">
                          <span>REN : {group.ren || '-'}</span>
                          <span>Dept : {group.deptDisplayName || '-'}</span>
                        </div>
                      </td>
                    </tr>

                    {renderColumnHeader()}
                    {renderDetailRows(group.rows, group.key)}
                    {renderTotalRow('REN Total', group.totals)}

                    <tr>
                      <td colSpan={14} className="h-4 bg-white border-0"></td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>

              <tfoot>
                <tr className="bg-gray-100 font-semibold text-gray-800">
                  <td className="px-3 py-2 border-t">TOTAL</td>
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
                    {formatCurrency(totals.total)}
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
                    {formatCurrency(totals.totalPayout)}
                  </td>

                  <td className="px-3 py-2 border-t"></td>
                  <td className="px-3 py-2 border-t"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {!loading &&
        !error &&
        activeTab === 'department' &&
        groupedByDepartmentRows.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg">
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs md:text-sm border-collapse">
                <tbody>
                  {groupedByDepartmentRows.map((deptGroup) => (
                    <React.Fragment key={deptGroup.key}>
                      <tr className="bg-slate-300 font-bold text-slate-900">
                        <td colSpan={14} className="px-4 py-3 border-b">
                          <div className="flex flex-wrap items-center gap-10 whitespace-nowrap">
                            <span>Department : {deptGroup.department || '-'}</span>
                          </div>
                        </td>
                      </tr>

                      {deptGroup.renGroups.map((renGroup) => (
                        <React.Fragment key={`${deptGroup.key}-${renGroup.key}`}>
                          <tr className="bg-gray-200 font-semibold text-gray-900">
                            <td colSpan={14} className="px-4 py-3 border-b">
                              <div className="flex flex-wrap items-center gap-10 whitespace-nowrap">
                                <span>REN : {renGroup.ren || '-'}</span>
                                <span>Dept : {renGroup.deptDisplayName || '-'}</span>
                              </div>
                            </td>
                          </tr>

                          {renderColumnHeader()}
                          {renderDetailRows(
                            renGroup.rows,
                            `${deptGroup.key}-${renGroup.key}`
                          )}
                          {renderTotalRow('REN Total', renGroup.totals)}

                          <tr>
                            <td colSpan={14} className="h-3 bg-white border-0"></td>
                          </tr>
                        </React.Fragment>
                      ))}

                      {renderTotalRow('Department Total', deptGroup.totals, 'bg-slate-100')}

                      <tr>
                        <td colSpan={14} className="h-5 bg-white border-0"></td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="bg-gray-100 font-semibold text-gray-800">
                    <td className="px-3 py-2 border-t">TOTAL</td>
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
                      {formatCurrency(totals.total)}
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
                      {formatCurrency(totals.totalPayout)}
                    </td>

                    <td className="px-3 py-2 border-t"></td>
                    <td className="px-3 py-2 border-t"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

      {!loading && !error && groupedTableRows.length === 0 && (
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

export default CommPayoutRpt;