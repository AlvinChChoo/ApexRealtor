import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const ENDPOINT_LISTER_CLOSER_REN =
  API_ENDPOINTS.LISTER_CLOSER_BY_APPLICATION_ID_GET;

type RenOption = { value: string; label: string };

/* =========================
   Helpers
========================= */
const fmt2 = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const currency = (n: string | number) => {
  const raw = typeof n === 'string' ? stripCommaFormat(n) : n;
  const num = typeof raw === 'string' ? parseFloat(raw || '0') : raw || 0;
  return Number.isFinite(num) ? fmt2(num) : '0.00';
};

const toNumString = (x: string | number) => {
  const s = String(x ?? '');
  const cleaned = s.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned || '0';
};

const toNumber = (x: any) => {
  const n = parseFloat(String(x ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const stripCommaFormat = (x: string | number) => {
  return String(x ?? '').replace(/,/g, '').trim();
};

const formatInputOnBlur = (x: string | number) => {
  const raw = stripCommaFormat(x);

  if (raw === '' || raw === '.') return '0.00';

  const num = Number(raw);
  if (!Number.isFinite(num)) return '0.00';

  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const handleAmountFocus = (
  e: React.FocusEvent<HTMLInputElement>,
  setter: (v: string) => void
) => {
  const raw = stripCommaFormat(e.target.value);
  setter(raw);
  requestAnimationFrame(() => {
    e.target.select();
  });
};

const handleAmountBlur = (
  e: React.FocusEvent<HTMLInputElement>,
  setter: (v: string) => void
) => {
  setter(formatInputOnBlur(e.target.value));
};

const rowTotal = (base: number, sstOn: boolean) => {
  const sst = sstOn ? base * 0.08 : 0;
  return { sst, total: base + sst };
};

/* =========================
   Public asset -> PNG dataURL
========================= */
async function assetToDataUrl(pathFromPublicRoot: string): Promise<string> {
  const url = new URL(pathFromPublicRoot, window.location.origin).toString();
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => res(el);
    el.onerror = () => rej(new Error('Image failed to load: ' + pathFromPublicRoot));
    el.src = url + '?v=' + Date.now();
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/* =========================
   Label Only
========================= */
const LabelOnly: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-center space-x-2">
    <label className="text-sm font-medium text-gray-700 whitespace-nowrap">{text}</label>
  </div>
);

/* =========================
   RowThree (Memoized)
========================= */
interface RowThreeProps {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  sstChecked: boolean;
  onSstChange: (b: boolean) => void;
  sstAmt: number;
  total: number;
  disabled?: boolean;
}

const RowThree: React.FC<RowThreeProps> = React.memo(
  ({ label, value, onValueChange, sstChecked, onSstChange, sstAmt, total, disabled }) => {
    const [localVal, setLocalVal] = useState(value);

    useEffect(() => {
      setLocalVal(value);
    }, [value]);

    return (
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
        <LabelOnly text={label} />
        <div>
          <input
            type="text"
            value={localVal}
            onChange={(e) => {
              const v = toNumString(e.target.value);
              setLocalVal(v);
              onValueChange(v);
            }}
            disabled={disabled}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right disabled:bg-gray-100 disabled:text-gray-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={sstChecked}
            onChange={(e) => onSstChange(e.target.checked)}
            disabled={disabled}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-60"
          />
          <span className="text-sm font-medium text-gray-700">SST (8%)?</span>
          <span className="text-sm text-gray-600">RM {currency(sstAmt)}</span>
        </div>
        <div className="text-sm font-medium text-gray-700">TOTAL</div>
        <div className="text-sm font-semibold text-gray-900">RM {currency(total)}</div>
      </div>
    );
  }
);

/* =========================
   Props
========================= */
export interface BillingDetailsInitial {
  llProfessionalFees?: string;
  llProfessionalSst?: boolean;
  stampingDoneByIRSB?: boolean;

  llAdminFees?: string;
  llAdminSst?: boolean;
  llStamping?: string;
  tnServiceFees?: string;
  tnServiceSst?: boolean;
  tnAdminFees?: string;
  tnAdminSst?: boolean;
  tnStamping?: string;
  rentalOrSalePrice?: string;
  earnestDeposit?: string;
  introducerName?: string;
  introducerNric?: string;
  introducerCommAmt?: string;

  introducerAddress?: string;
  introducerTel?: string;
  introducerTinNo?: string;
  introducerBankAccNo?: string;
  introducerBankHolder?: string;

  IntroBanker?: string;

  AtrAdvRentalAmt?: string;
  AtrSecurityDepositAmt?: string;
  AtrUtilityDepositAmt?: string;
  AtrAccessCard?: string;
  AtrIndahWater?: string;
  AtrOtherDepositAmt?: string;

  introducerEmail?: string;
  introducerPostalCode?: string;
  introducerParty?: string;

  // NEW
  refundRen?: string;
}

interface BillingDetailsProps {
  applicationId: string | number;
  application?: any;
  initialValues?: BillingDetailsInitial;
  title?: string;
  endpoint?: string;
  onRefresh?: () => Promise<void> | void;
  headerLogoPath?: string;
  footerBannerPath?: string;
}

/* =========================
   Component
========================= */
const BillingDetails: React.FC<BillingDetailsProps> = ({
  applicationId,
  application,
  initialValues,
  title = 'TRANSACTION DETAILS..',
  endpoint = API_ENDPOINTS.BILLING_DET_SET,
  onRefresh,
  headerLogoPath = '/inte-logo.png',
  footerBannerPath = '/Int_Footer.jpeg',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [renOptionsFromApi, setRenOptionsFromApi] = useState<RenOption[]>([]);

  const isAccountUser =
    String(localStorage.getItem('account') || '').trim().toUpperCase() === 'Y';

  const canEdit = useMemo(() => {
    if (isAccountUser) return true;
    const status = String(application?.ApplicationStatus ?? '').trim().toUpperCase();
    return ['ACTIVE', 'PENDING REVIEW', 'REJECTED'].includes(status);
  }, [application?.ApplicationStatus, isAccountUser]);

  /* ---------- Landlord/Tenant states ---------- */
  const [llProfessionalFees, setLlProfessionalFees] = useState(initialValues?.llProfessionalFees ?? '0');
  const [llProfessionalSst, setLlProfessionalSst] = useState(initialValues?.llProfessionalSst ?? false);
  const [llAdminFees, setLlAdminFees] = useState(initialValues?.llAdminFees ?? '0');
  const [llAdminSst, setLlAdminSst] = useState(initialValues?.llAdminSst ?? false);
  const [llStamping, setLlStamping] = useState(initialValues?.llStamping ?? '0');
  const [advanceRental, setAdvanceRental] = useState(initialValues?.AtrAdvRentalAmt ?? '0');

  const [tnServiceFees, setTnServiceFees] = useState(initialValues?.tnServiceFees ?? '0');
  const [tnServiceSst, setTnServiceSst] = useState(initialValues?.tnServiceSst ?? false);
  const [tnAdminFees, setTnAdminFees] = useState(initialValues?.tnAdminFees ?? '0');
  const [tnAdminSst, setTnAdminSst] = useState(initialValues?.tnAdminSst ?? false);
  const [tnStamping, setTnStamping] = useState(initialValues?.tnStamping ?? '0');

  const [llReimburseTo, setLlReimburseTo] = useState<string>('');
  const [tnReimburseTo, setTnReimburseTo] = useState<string>('');

  const [stampingDoneByIRSB, setStampingDoneByIRSB] = useState<'Y' | 'N'>('N');

  /* ---------- Others ---------- */
  const [rentalOrSalePrice, setRentalOrSalePrice] = useState(initialValues?.rentalOrSalePrice ?? '0');
  const [earnestDeposit, setEarnestDeposit] = useState(initialValues?.earnestDeposit ?? '0');
  const [securityDeposit, setSecurityDeposit] = useState(initialValues?.AtrSecurityDepositAmt ?? '0');
  const [utilityDeposit, setUtilityDeposit] = useState(initialValues?.AtrUtilityDepositAmt ?? '0');
  const [accessCardDeposit, setAccessCardDeposit] = useState(initialValues?.AtrAccessCard ?? '0');
  const [indahWater, setIndahWater] = useState(initialValues?.AtrIndahWater ?? '0');
  const [otherDeposit, setOtherDeposit] = useState(initialValues?.AtrOtherDepositAmt ?? '0');

  // NEW: Others reimburse REN
  const [refundRen, setRefundRen] = useState<string>(initialValues?.refundRen ?? '');

  /* ---------- Introducer ---------- */
  const [introducerName, setIntroducerName] = useState(initialValues?.introducerName ?? '');
  const [introducerNric, setIntroducerNric] = useState(initialValues?.introducerNric ?? '');
  const [introducerCommAmt, setIntroducerCommAmt] = useState(initialValues?.introducerCommAmt ?? '0');
  const [introducerAddress, setIntroducerAddress] = useState(initialValues?.introducerAddress ?? '');
  const [introducerTel, setIntroducerTel] = useState(initialValues?.introducerTel ?? '');
  const [introducerTinNo, setIntroducerTinNo] = useState(initialValues?.introducerTinNo ?? '');
  const [introducerBankAccNo, setIntroducerBankAccNo] = useState(initialValues?.introducerBankAccNo ?? '');
  const [introducerBankHolder, setIntroducerBankHolder] = useState(initialValues?.introducerBankHolder ?? '');
  const [IntroBanker, setIntroBanker] = useState<string>(String(initialValues?.IntroBanker ?? ''));
  const [introducerEmail, setIntroducerEmail] = useState(initialValues?.introducerEmail ?? '');
  const [introducerPostalCode, setIntroducerPostalCode] = useState(initialValues?.introducerPostalCode ?? '');
  const [introducerParty, setIntroducerParty] = useState(
    String(initialValues?.introducerParty ?? application?.IntroParty ?? '')
  );

  const [statementRemarks, setStatementRemarks] = useState<string>('');

  /* ---------- Hydrate from application ---------- */
  useEffect(() => {
    if (!application) return;

    setLlProfessionalFees(String(application.AtlProFees ?? '0'));

    const profFees = toNumber(application.AtlProFees ?? 0);
    const sstAmt = toNumber(application.AtlProFeesSstAmt ?? 0);

    if (profFees === 0) {
      setLlProfessionalSst(true);
    } else if (profFees > 0 && sstAmt > 0) {
      setLlProfessionalSst(true);
    } else {
      setLlProfessionalSst(false);
    }

    setLlAdminFees(String(application.LandlordAdminFeesAmt ?? '0'));
    const adminFees = toNumber(application.LandlordAdminFeesAmt ?? 0);
    const adminSst = toNumber(application.LandlordAdminFeesSst ?? 0);

    if (adminFees === 0) {
      setLlAdminSst(true);
    } else if (adminFees > 0 && adminSst > 0) {
      setLlAdminSst(true);
    } else {
      setLlAdminSst(false);
    }

    setLlStamping(String(application.LandlordStampingFees ?? '0'));

    setTnServiceFees(String(application.TalServiceFeesAmt ?? '0'));
    const svcFees = toNumber(application.TalServiceFeesAmt ?? 0);
    const svcSst = toNumber(application.TalProfessionalFeesSstAmt ?? 0);

    if (svcFees === 0) {
      setTnServiceSst(true);
    } else if (svcFees > 0 && svcSst > 0) {
      setTnServiceSst(true);
    } else {
      setTnServiceSst(false);
    }

    setTnAdminFees(String(application.TenantAdminFeesAmt ?? '0'));
    const admFees = toNumber(application.TenantAdminFeesAmt ?? 0);
    const admSst = toNumber(application.TenantAdminFeesSst ?? 0);

    if (admFees === 0) {
      setTnAdminSst(true);
    } else if (admFees > 0 && admSst > 0) {
      setTnAdminSst(true);
    } else {
      setTnAdminSst(false);
    }

    setTnStamping(String(application.TenantStampingFees ?? '0'));

    setLlReimburseTo(
      String(application.LandlordStampDutyReimbuseToRen ?? '').trim()
    );

    setTnReimburseTo(
      String(application.TenantStampDutyReimbuseToRen ?? '').trim()
    );

    setStampingDoneByIRSB(
      String(
        application?.StampingDoneByIrsb ??
          application?.StampingDoneByIRSB ??
          application?.StampingByIRSB ??
          '0'
      )
        .trim()
        .toUpperCase() === 'Y' ||
        String(
          application?.StampingDoneByIrsb ??
            application?.StampingDoneByIRSB ??
            application?.StampingByIRSB ??
            '0'
        ).trim() === '1' ||
        application?.StampingDoneByIrsb === true ||
        application?.StampingDoneByIRSB === true ||
        application?.StampingByIRSB === true
        ? 'Y'
        : 'N'
    );

    setRentalOrSalePrice(formatInputOnBlur(String(application.AtlRentalAmt ?? '0')));
    setEarnestDeposit(formatInputOnBlur(String(application.AtlEdFullAmt ?? '0')));
    setAdvanceRental(formatInputOnBlur(String(application.AtrAdvRentalAmt ?? '0')));
    setSecurityDeposit(formatInputOnBlur(String(application.AtrSecurityDepositAmt ?? '0')));
    setUtilityDeposit(formatInputOnBlur(String(application.AtrUtilityDepositAmt ?? '0')));
    setAccessCardDeposit(formatInputOnBlur(String(application.AtrAccessCard ?? '0')));
    setIndahWater(formatInputOnBlur(String(application.AtrIndahWater ?? '0')));
    setOtherDeposit(formatInputOnBlur(String(application.AtrOtherDepositAmt ?? '0')));

    // NEW: hydrate refund REN for Others
    setRefundRen(
      String(
        application.RefundToRenUserName ??   // ✅ ADD THIS
          application.RefundToRen ??
          application.OtherRefundToRen ??
          application.AtrOtherDepositReimburseToRen ??
          ''
      ).trim()
    );

    setIntroducerName(String(application.IntroName ?? ''));
    setIntroducerNric(String(application.IntroIdNo ?? ''));
    setIntroducerCommAmt(String(application.IntroCommAmt ?? '0'));
    setIntroducerAddress(String(application.IntroAddress ?? ''));
    setIntroducerTel(String(application.IntroTelNo ?? ''));
    setIntroducerTinNo(String(application.IntroTinNo ?? ''));

    setIntroducerBankAccNo(
      String(
        application.IntroBankAccNo ??
          application.IntroBankACNo ??
          application.IntroBankAccountNo ??
          ''
      )
    );

    setIntroducerBankHolder(
      String(
        application.IntroBankHolder ??
          application.IntroBankAccountHolder ??
          ''
      )
    );

    setIntroBanker(
      String(
        application.IntroBanker ??
          application.IntroducerBanker ??
          application.IntroBankerName ??
          ''
      )
    );

    setIntroducerEmail(String(application.IntroEmail ?? ''));
    setIntroducerPostalCode(String(application.IntroPostalCode ?? ''));
    setIntroducerParty(String(application.IntroParty ?? ''));
    setStatementRemarks(String(application.StatementRemarks ?? ''));
  }, [application]);

  /* ---------- Derived totals ---------- */
  const d = useMemo(() => {
    const llProf = rowTotal(toNumber(llProfessionalFees), llProfessionalSst);
    const llAdm = rowTotal(toNumber(llAdminFees), llAdminSst);
    const tnServ = rowTotal(toNumber(tnServiceFees), tnServiceSst);
    const tnAdm = rowTotal(toNumber(tnAdminFees), tnAdminSst);
    return {
      llProf,
      llAdm,
      tnServ,
      tnAdm,
      landlordGrand: llProf.total + llAdm.total + toNumber(llStamping),
      tenantGrand: tnServ.total + tnAdm.total + toNumber(tnStamping),
    };
  }, [
    llProfessionalFees,
    llProfessionalSst,
    llAdminFees,
    llAdminSst,
    tnServiceFees,
    tnServiceSst,
    tnAdminFees,
    tnAdminSst,
    llStamping,
    tnStamping,
  ]);

  useEffect(() => {
    const appId = String(application?.ApplicationId ?? applicationId ?? '').trim();
    if (!appId) {
      setRenOptionsFromApi([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const fd = new FormData();
        fd.append('ApplicationId', appId);

        const resp = await fetch(ENDPOINT_LISTER_CLOSER_REN, {
          method: 'POST',
          body: fd,
        });

        const json = await resp.json();

        const rows: any[] = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json)
          ? json
          : Array.isArray(json?.result)
          ? json.result
          : [];

        const mapped: RenOption[] = rows
          .map((r: any) => {
            const userName = String(
              r?.UserName ?? r?.User_Name ?? r?.User ?? r?.value ?? ''
            ).trim();
            const display = String(
              r?.DisplayName ?? r?.Display_Name ?? r?.Name ?? r?.label ?? ''
            ).trim();

            const label = display || userName;
            const value = userName || label;

            if (!label || !value) return null;
            return { value, label };
          })
          .filter(Boolean) as RenOption[];

        if (!cancelled) setRenOptionsFromApi(mapped);
      } catch {
        if (!cancelled) setRenOptionsFromApi([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [application?.ApplicationId, applicationId]);

  const renOptions = useMemo<RenOption[]>(() => {
    const a: any = application || {};
    const list =
      a.RenList ||
      a.RENList ||
      a.RenOptions ||
      a.renOptions ||
      a.RenDropdown ||
      a.renList;

    const base: RenOption[] = Array.isArray(list)
      ? (list
          .map((x: any) => {
            const label = String(
              x?.label ?? x?.Name ?? x?.RenName ?? x?.UserName ?? x?.EmpName ?? ''
            ).trim();
            const value = String(
              x?.value ?? x?.Id ?? x?.RenId ?? x?.UserId ?? x?.EmpId ?? label
            ).trim();
            if (!label) return null;
            return { label, value };
          })
          .filter(Boolean) as RenOption[])
      : [];

    const merged = [...base, ...renOptionsFromApi];
    const seen = new Set<string>();
    return merged.filter((o) => {
      const k = String(o.value ?? '').trim();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [application, renOptionsFromApi]);

  /* ---------- Save ---------- */
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<null | { type: 'ok' | 'err'; text: string }>(null);
  const [requesting, setRequesting] = useState<'Tenant' | 'Landlord' | null>(null);

  const handleUpdateBilling = async () => {
    if (!canEdit) {
      setMsg({ type: 'err', text: 'This application status disallows editing.' });
      return;
    }
    if (saving || refreshing) return;

    setSaving(true);
    setMsg(null);

    try {
      const formData = new FormData();
      formData.append('ApplicationId', String(application?.ApplicationId ?? applicationId));

      formData.append('AtlProFees', stripCommaFormat(llProfessionalFees));
      formData.append('AtlProFeesSstAmt', String(d.llProf.sst));
      formData.append('AtlProFeesTotalAmt', String(d.llProf.total));

      formData.append('LandlordAdminFeesAmt', stripCommaFormat(llAdminFees));
      formData.append('LandlordAdminFeesSst', String(d.llAdm.total - toNumber(llAdminFees)));
      formData.append('LandlordAdminFeesTotal', String(d.llAdm.total));
      formData.append('LandlordStampingFees', stripCommaFormat(llStamping));

      formData.append('TalServiceFeesAmt', stripCommaFormat(tnServiceFees));
      formData.append('TalProfessionalFeesSstAmt', String(d.tnServ.sst));

      formData.append('TenantAdminFeesAmt', stripCommaFormat(tnAdminFees));
      formData.append('TenantAdminFeesSst', String(d.tnAdm.sst));
      formData.append('TenantAdminFeesTotal', String(d.tnAdm.total));

      formData.append('TenantStampingFees', stripCommaFormat(tnStamping));

      formData.append('LandlordStampDutyReimbuseToRen', llReimburseTo);
      formData.append('TenantStampDutyReimbuseToRen', tnReimburseTo);
      formData.append('StampingDoneByIRSB', stampingDoneByIRSB);

      formData.append('AtlRentalAmt', stripCommaFormat(rentalOrSalePrice));
      formData.append('AtlEdFullAmt', stripCommaFormat(earnestDeposit));
      formData.append('AtrAdvRentalAmt', stripCommaFormat(advanceRental));
      formData.append('AtrSecurityDepositAmt', stripCommaFormat(securityDeposit));
      formData.append('AtrUtilityDepositAmt', stripCommaFormat(utilityDeposit));
      formData.append('AtrAccessCard', stripCommaFormat(accessCardDeposit));
      formData.append('AtrIndahWater', stripCommaFormat(indahWater));
      formData.append('AtrOtherDepositAmt', stripCommaFormat(otherDeposit));

      // NEW: save refund REN
      formData.append('RefundToRenUserName', refundRen);

      formData.append('IntroName', introducerName);
      formData.append('IntroIdNo', introducerNric);
      formData.append('IntroCommAmt', stripCommaFormat(introducerCommAmt));
      formData.append('IntroAddress', introducerAddress);
      formData.append('IntroTelNo', introducerTel);
      formData.append('IntroTinNo', introducerTinNo);
      formData.append('IntroBankAccNo', introducerBankAccNo);
      formData.append('IntroBankHolder', introducerBankHolder);
      formData.append('IntroBanker', String(IntroBanker ?? ''));
      formData.append('IntroEmail', introducerEmail);
      formData.append('IntroPostalCode', introducerPostalCode);
      formData.append('IntroParty', introducerParty);
      formData.append('StatementRemarks', (statementRemarks || '').trim());

      const response = await fetch(endpoint, { method: 'POST', body: formData });
      const data = await response.json();

      if (data.status === 'success') {
        const successText = data.data || 'Updated successfully.';

        setLlProfessionalFees(toNumString(llProfessionalFees));
        setLlProfessionalSst(!!llProfessionalSst);
        setLlAdminFees(toNumString(llAdminFees));
        setLlAdminSst(!!llAdminSst);
        setLlStamping(toNumString(llStamping));

        setTnServiceFees(toNumString(tnServiceFees));
        setTnServiceSst(!!tnServiceSst);
        setTnAdminFees(toNumString(tnAdminFees));
        setTnAdminSst(!!tnAdminSst);
        setTnStamping(toNumString(tnStamping));

        setRentalOrSalePrice(toNumString(rentalOrSalePrice));
        setEarnestDeposit(toNumString(earnestDeposit));
        setAdvanceRental(toNumString(advanceRental));
        setSecurityDeposit(toNumString(securityDeposit));
        setUtilityDeposit(toNumString(utilityDeposit));
        setAccessCardDeposit(toNumString(accessCardDeposit));
        setIndahWater(toNumString(indahWater));
        setOtherDeposit(toNumString(otherDeposit));

        setIntroducerName(String(introducerName));
        setIntroducerNric(String(introducerNric));
        setIntroducerCommAmt(toNumString(introducerCommAmt));
        setIntroBanker(String(IntroBanker ?? ''));
        setIntroducerEmail(String(introducerEmail));
        setIntroducerPostalCode(String(introducerPostalCode));

        setMsg({ type: 'ok', text: successText });
        alert(successText);

        if (onRefresh) {
          setRefreshing(true);
          try {
            await onRefresh();
          } finally {
            setRefreshing(false);
          }
        }
      } else {
        setMsg({ type: 'err', text: data.data || 'Update failed.' });
      }
    } catch {
      setMsg({ type: 'err', text: 'An error occurred while updating.' });
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Request Proforma ---------- */
  const handleRequestProforma = async (invoiceType: 'Tenant' | 'Landlord') => {
    if (requesting || saving || refreshing) return;

    setRequesting(invoiceType);
    setMsg(null);

    try {
      const formData = new FormData();
      formData.append('ApplicationId', String(application?.ApplicationId ?? applicationId));
      formData.append('InvoiceType', invoiceType);
      formData.append('ApplicationStatus', 'REQUESTED');

      const response = await fetch(
        API_ENDPOINTS.APPLICATION_REQUEST_PROFORMA_INVOICE_SET,
        { method: 'POST', body: formData }
      );

      const data = await response.json();

      if (data.status === 'success') {
        const msgText =
          data.data || `${invoiceType} Proforma Invoice request submitted successfully.`;
        setMsg({ type: 'ok', text: msgText });
        alert(msgText);

        if (onRefresh) {
          setRefreshing(true);
          try {
            await onRefresh();
          } finally {
            setRefreshing(false);
          }
        }
      } else {
        setMsg({
          type: 'err',
          text: data.data || `${invoiceType} Proforma Invoice request failed.`,
        });
      }
    } catch {
      setMsg({
        type: 'err',
        text: `${invoiceType} Proforma Invoice request error.`,
      });
    } finally {
      setRequesting(null);
    }
  };

  /* ---------- Generate Statement ---------- */
  const handleGenerateStatement = async () => {
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      const tenantName = String(application?.Tenant1Name ?? '').trim();

      let propertyText = String(
        application?.PropertyAddress ??
          application?.Property ??
          application?.Address ??
          application?.FullAddress ??
          ''
      ).trim();

      const postal = String(application?.PropertyPostalCode ?? '').trim();
      const state = String(application?.PropertyState ?? '').trim();

      propertyText = [propertyText, postal, state].filter(Boolean).join(', ');

      let logoDataUrl: string | undefined;
      let footerDataUrl: string | undefined;
      try {
        if (headerLogoPath) logoDataUrl = await assetToDataUrl(headerLogoPath);
      } catch {}
      try {
        if (footerBannerPath) footerDataUrl = await assetToDataUrl(footerBannerPath);
      } catch {}

      const headerTop = 8;
      const logoW = 42;
      const logoH = 14;

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', 20, headerTop, logoW, logoH);
      }

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(70, 150, 230);
      doc.setFontSize(24);
      doc.text('STATEMENT', pageW - 20, headerTop + 10, { align: 'right' });

      const headerBottomY = headerTop + logoH + 8;
      doc.setDrawColor(0);
      doc.line(20, headerBottomY, pageW - 20, headerBottomY);

      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);

      const today = new Date();
      const dd = today.toLocaleDateString('en-GB');

      const toLabelX = 20;
      const toValueX = 40;
      const dateY = headerBottomY + 11;
      const lineHeightFactor = 1.2;
      const sf = (doc as any)?.internal?.scaleFactor || 72 / 25.4;
      const lineH = (doc.getFontSize() * lineHeightFactor) / sf;

      doc.text('Date', toLabelX, dateY);
      doc.text(dd, toValueX, dateY);

      let cursorY = dateY + 8;
      doc.text('To', toLabelX, cursorY);

      const toText = tenantName ? tenantName : '-';
      const wrappedTo = doc.splitTextToSize(toText, pageW - 20 - toValueX);
      doc.text(wrappedTo, toValueX, cursorY, { lineHeightFactor });

      cursorY = cursorY + (wrappedTo.length - 1) * lineH + 8;

      doc.text('Property  ', toLabelX, cursorY);

      const propText = propertyText ? propertyText : '-';
      const wrappedProp = doc.splitTextToSize(propText, pageW - 20 - toValueX);
      doc.text(wrappedProp, toValueX, cursorY, { lineHeightFactor });

      const underlineY = cursorY + (wrappedProp.length - 1) * lineH + 5;
      doc.setDrawColor(0);
      doc.line(20, underlineY, pageW - 20, underlineY);

      doc.setFontSize(12);
      doc.text('Kindly remit the following payments :-', 20, underlineY + 12);

      const xl = 25;
      const xr = 120;
      let yl = underlineY + 26;
      let yr = underlineY + 26;

      const linePadTop = 5;
      const linePadBottom = 2;

      const putRow = (
        xLabel: number,
        xCurrency: number,
        xAmt: number,
        y: number,
        label: string,
        amt: number | string
      ) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.text(label, xLabel, y);
        doc.text('RM', xCurrency, y, { align: 'right' });
        doc.text(currency(amt), xAmt, y, { align: 'right' });
      };

      putRow(xl, xl + 55, xl + 80, yl, 'Advance Rental', advanceRental);
      yl += 9;
      putRow(xl, xl + 55, xl + 80, yl, 'Security Deposit', securityDeposit);
      yl += 9;
      putRow(xl, xl + 55, xl + 80, yl, 'Utility Deposit', utilityDeposit);
      yl += 9;
      putRow(xl, xl + 55, xl + 80, yl, 'Access Card Deposit', accessCardDeposit);
      yl += 9;
      putRow(xl, xl + 55, xl + 80, yl, 'Indah Water', indahWater);
      yl += 9;
      putRow(xl, xl + 55, xl + 80, yl, 'Others', otherDeposit);
      yl += 12;

      const totalCollection =
        toNumber(advanceRental) +
        toNumber(securityDeposit) +
        toNumber(utilityDeposit) +
        toNumber(accessCardDeposit) +
        toNumber(indahWater) +
        toNumber(otherDeposit);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);

      const rmWidthL = doc.getTextWidth('RM');
      const xRML = xl + 55;
      const xAmtL = xl + 80;
      const padL = 1;
      const padR = 0;

      const leftStart = xRML - rmWidthL - padL;
      const leftEnd = xAmtL + padR;

      doc.line(leftStart, yl - linePadTop, leftEnd, yl - linePadTop);
      doc.text('RM', xRML, yl, { align: 'right' });
      doc.text(currency(totalCollection), xAmtL, yl, { align: 'right' });
      doc.line(leftStart, yl + linePadBottom, leftEnd, yl + linePadBottom);
      yl += 12;

      putRow(xr, xr + 55, xr + 80, yr, 'Serv. Fee + SST', d.tnServ.total);
      yr += 9;
      putRow(xr, xr + 55, xr + 80, yr, 'Admin', d.tnAdm.total);
      yr += 9;
      putRow(xr, xr + 55, xr + 80, yr, 'Stamping', tnStamping);
      yr += 9;
      putRow(xr, xr + 55, xr + 80, yr, 'Refund to REN', 0);
      yr += 12;

      const totalRight = d.tnServ.total + d.tnAdm.total + toNumber(tnStamping);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);

      const rmWidthR = doc.getTextWidth('RM');
      const xRMR = xr + 55;
      const xAmtR = xr + 80;
      const rightStart = xRMR - rmWidthR - padL;
      const rightEnd = xAmtR + padR;

      doc.line(rightStart, yr - linePadTop, rightEnd, yr - linePadTop);
      doc.text('RM', xRMR, yr, { align: 'right' });
      doc.text(currency(totalRight), xAmtR, yr, { align: 'right' });
      doc.line(rightStart, yr + linePadBottom, rightEnd, yr + linePadBottom);

      const grandTotal = totalCollection + totalRight;
      const totalRowY = Math.max(yl, yr) + 10;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(`Total : RM ${currency(grandTotal)}`, 20, totalRowY);

      const remarksTop = totalRowY + 15;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('Statement Remarks', 20, remarksTop);

      const remarksText = (statementRemarks || '').trim();
      const maxWidth = 170 - 4 * 2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);

      const wrapped = doc.splitTextToSize(remarksText.length ? remarksText : ' ', maxWidth);
      const boxHeight = Math.max(22, wrapped.length * 6 + 8);

      doc.rect(20, remarksTop + 4, 170, boxHeight);
      const textStartY = remarksTop + 4 + 8;
      doc.text(wrapped, 22, textStartY, { maxWidth });

      if (footerDataUrl) {
        const footerH = 20;
        doc.addImage(footerDataUrl, 'PNG', 0, pageH - footerH, pageW, footerH);
      }

      doc.save('statement.pdf');
    } catch (err: any) {
      console.error('Generate Statement Error:', err);
      alert(`Generate Statement failed: ${err?.message ?? String(err)}`);
    }
  };

  const buttonDisabled = !canEdit || saving || refreshing;

  const buttonLabel = saving
    ? refreshing
      ? 'Refreshing…'
      : 'Saving…'
    : 'Update Details';

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-4 flex items-center justify-between cursor-pointer select-none rounded-xl transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5" />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <ChevronDown
          className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </div>

      {isExpanded && (
        <div className="p-6 bg-gray-50">
          {msg && (
            <div
              className={`mb-4 p-3 rounded-lg ${
                msg.type === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}
            >
              {msg.text}
            </div>
          )}

          <fieldset disabled={!canEdit} className="contents">
            {/* LANDLORD */}
            <div className="mb-6">
              <div className="bg-gray-200 px-4 py-2 rounded font-semibold uppercase">
                LANDLORD
              </div>
              <div className="mt-4 space-y-2">
                <RowThree
                  label="Professional Fees"
                  value={llProfessionalFees}
                  onValueChange={(v) => setLlProfessionalFees(toNumString(v))}
                  sstChecked={llProfessionalSst}
                  onSstChange={setLlProfessionalSst}
                  sstAmt={d.llProf.sst}
                  total={d.llProf.total}
                  disabled={!canEdit}
                />

                <RowThree
                  label="Admin Fees"
                  value={llAdminFees}
                  onValueChange={(v) => setLlAdminFees(toNumString(v))}
                  sstChecked={llAdminSst}
                  onSstChange={setLlAdminSst}
                  sstAmt={d.llAdm.sst}
                  total={d.llAdm.total}
                  disabled={!canEdit}
                />

                <div className="flex items-center gap-2">
                  <label className="w-4/5 text-sm font-medium text-gray-700">
                    Stamping (RM)
                  </label>
                  <input
                    type="text"
                    value={llStamping}
                    onChange={(e) => setLlStamping(toNumString(e.target.value))}
                    disabled={!canEdit}
                    className="w-1/5 border border-gray-300 rounded px-2 py-1 text-right disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="w-4/5 text-sm font-medium text-gray-700">
                    Reimburse to
                  </label>
                  <select
                    value={llReimburseTo}
                    onChange={(e) => setLlReimburseTo(e.target.value)}
                    disabled={!canEdit || renOptions.length === 0}
                    className="w-2/5 border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    <option value="">
                      {renOptions.length ? '-- Select --' : '-- No REN --'}
                    </option>
                    {renOptions.map((o) => (
                      <option key={`${o.value}-${o.label}`} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-right font-semibold mt-2">
                  Grand Total: RM {currency(d.landlordGrand)}
                </div>
              </div>
            </div>

            {/* TENANT */}
            <div className="mb-6">
              <div className="bg-gray-200 px-4 py-2 rounded font-semibold uppercase">
                TENANT
              </div>
              <div className="mt-4 space-y-2">
                <RowThree
                  label="Service Fees"
                  value={tnServiceFees}
                  onValueChange={(v) => setTnServiceFees(toNumString(v))}
                  sstChecked={tnServiceSst}
                  onSstChange={setTnServiceSst}
                  sstAmt={d.tnServ.sst}
                  total={d.tnServ.total}
                  disabled={!canEdit}
                />

                <RowThree
                  label="Admin Fees"
                  value={tnAdminFees}
                  onValueChange={(v) => setTnAdminFees(toNumString(v))}
                  sstChecked={tnAdminSst}
                  onSstChange={setTnAdminSst}
                  sstAmt={d.tnAdm.sst}
                  total={d.tnAdm.total}
                  disabled={!canEdit}
                />

                <div className="flex items-center gap-2">
                  <label className="w-4/5 text-sm font-medium text-gray-700">
                    Stamping (RM)
                  </label>
                  <input
                    type="text"
                    value={tnStamping}
                    onChange={(e) => setTnStamping(toNumString(e.target.value))}
                    disabled={!canEdit}
                    className="w-1/5 border border-gray-300 rounded px-2 py-1 text-right disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>

                <div className="text-right font-semibold mt-2">
                  Grand Total: RM {currency(d.tenantGrand)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="w-4/5 text-sm font-medium text-gray-700">Reimburse to</label>
              <select
                value={tnReimburseTo}
                onChange={(e) => setTnReimburseTo(e.target.value)}
                disabled={!canEdit || renOptions.length === 0}
                className="w-2/5 border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">
                  {renOptions.length ? '-- Select --' : '-- No REN --'}
                </option>
                {renOptions.map((o) => (
                  <option key={`${o.value}-${o.label}`} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="my-6 border-t border-gray-300 pt-4">
              <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={stampingDoneByIRSB === 'Y'}
                  onChange={(e) => setStampingDoneByIRSB(e.target.checked ? 'Y' : 'N')}
                  disabled={!canEdit}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-60"
                />
                Stamping done by IRSB
              </label>
            </div>

            {/* OTHERS */}
            <div className="mb-6">
              <div className="bg-gray-200 px-4 py-2 rounded font-semibold uppercase">
                OTHERS
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    Monthly Rental Amount
                  </div>
                  <input
                    type="text"
                    value={rentalOrSalePrice}
                    onChange={(e) => setRentalOrSalePrice(toNumString(e.target.value))}
                    onFocus={(e) => handleAmountFocus(e, setRentalOrSalePrice)}
                    onBlur={(e) => handleAmountBlur(e, setRentalOrSalePrice)}
                    disabled={!canEdit}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-right disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Earnest Deposit</div>
                  <input
                    type="text"
                    value={earnestDeposit}
                    onChange={(e) => setEarnestDeposit(toNumString(e.target.value))}
                    onFocus={(e) => handleAmountFocus(e, setEarnestDeposit)}
                    onBlur={(e) => handleAmountBlur(e, setEarnestDeposit)}
                    disabled={!canEdit}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-right disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Advance Rental</div>
                  <input
                    type="text"
                    value={advanceRental}
                    onChange={(e) => setAdvanceRental(toNumString(e.target.value))}
                    onFocus={(e) => handleAmountFocus(e, setAdvanceRental)}
                    onBlur={(e) => handleAmountBlur(e, setAdvanceRental)}
                    disabled={!canEdit}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-right disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Security Deposit</div>
                  <input
                    type="text"
                    value={securityDeposit}
                    onChange={(e) => setSecurityDeposit(toNumString(e.target.value))}
                    onFocus={(e) => handleAmountFocus(e, setSecurityDeposit)}
                    onBlur={(e) => handleAmountBlur(e, setSecurityDeposit)}
                    disabled={!canEdit}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-right disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Utility Deposit</div>
                  <input
                    type="text"
                    value={utilityDeposit}
                    onChange={(e) => setUtilityDeposit(toNumString(e.target.value))}
                    onFocus={(e) => handleAmountFocus(e, setUtilityDeposit)}
                    onBlur={(e) => handleAmountBlur(e, setUtilityDeposit)}
                    disabled={!canEdit}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-right disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Access Card Deposit</div>
                  <input
                    type="text"
                    value={accessCardDeposit}
                    onChange={(e) => setAccessCardDeposit(toNumString(e.target.value))}
                    onFocus={(e) => handleAmountFocus(e, setAccessCardDeposit)}
                    onBlur={(e) => handleAmountBlur(e, setAccessCardDeposit)}
                    disabled={!canEdit}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-right disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Indah Water</div>
                  <input
                    type="text"
                    value={indahWater}
                    onChange={(e) => setIndahWater(toNumString(e.target.value))}
                    onFocus={(e) => handleAmountFocus(e, setIndahWater)}
                    onBlur={(e) => handleAmountBlur(e, setIndahWater)}
                    disabled={!canEdit}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-right disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    Reimburse to REN
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <select
                      value={refundRen}
                      onChange={(e) => setRefundRen(e.target.value)}
                      disabled={!canEdit || renOptions.length === 0}
                      className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500"
                    >
                      <option value="">
                        {renOptions.length ? '-- Select REN --' : '-- No REN --'}
                      </option>
                      {renOptions.map((o) => (
                        <option key={`refund-${o.value}-${o.label}`} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={otherDeposit}
                      onChange={(e) => setOtherDeposit(toNumString(e.target.value))}
                      onFocus={(e) => handleAmountFocus(e, setOtherDeposit)}
                      onBlur={(e) => handleAmountBlur(e, setOtherDeposit)}
                      disabled={!canEdit}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-right disabled:bg-gray-100 disabled:text-gray-500"
                      placeholder="Amount"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* INTRODUCER */}
            <div className="mb-6">
              <div className="bg-gray-200 px-4 py-2 rounded font-semibold uppercase">
                INTRODUCER DETAIL
              </div>

              <div className="mt-4 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                  <label className="text-sm font-medium text-gray-700">Introducer From</label>
                  <select
                    value={introducerParty}
                    onChange={(e) => setIntroducerParty(e.target.value)}
                    disabled={!canEdit}
                    className="md:col-span-3 w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
                  >
                    <option value="">-- Select --</option>
                    <option value="Landlord">Landlord</option>
                    <option value="Tenant">Tenant</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                  <label className="text-sm font-medium text-gray-700">Name as per IC</label>
                  <input
                    type="text"
                    value={introducerName}
                    onChange={(e) => setIntroducerName(e.target.value)}
                    disabled={!canEdit}
                    className="md:col-span-3 w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                  <label className="text-sm font-medium text-gray-700">NRIC No</label>
                  <input
                    type="text"
                    value={introducerNric}
                    onChange={(e) => setIntroducerNric(e.target.value)}
                    disabled={!canEdit}
                    className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
                  />

                  <label className="text-sm font-medium text-gray-700">Intro Fees (RM)</label>
                  <input
                    type="text"
                    value={introducerCommAmt}
                    onChange={(e) => setIntroducerCommAmt(toNumString(e.target.value))}
                    disabled={!canEdit}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-right disabled:bg-gray-100"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                  <label className="text-sm font-medium text-gray-700">Address</label>
                  <textarea
                    rows={2}
                    value={introducerAddress}
                    onChange={(e) => setIntroducerAddress(e.target.value)}
                    disabled={!canEdit}
                    className="md:col-span-3 w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                  <label className="text-sm font-medium text-gray-700">Postal Code</label>
                  <input
                    type="text"
                    value={introducerPostalCode}
                    onChange={(e) => setIntroducerPostalCode(e.target.value)}
                    disabled={!canEdit}
                    className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
                  />

                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={introducerEmail}
                    onChange={(e) => setIntroducerEmail(e.target.value)}
                    disabled={!canEdit}
                    className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                  <label className="text-sm font-medium text-gray-700">Tel No</label>
                  <input
                    type="text"
                    value={introducerTel}
                    onChange={(e) => setIntroducerTel(e.target.value)}
                    disabled={!canEdit}
                    className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
                  />

                  <label className="text-sm font-medium text-gray-700">TIN No</label>
                  <input
                    type="text"
                    value={introducerTinNo}
                    onChange={(e) => setIntroducerTinNo(e.target.value)}
                    disabled={!canEdit}
                    className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                  <label className="text-sm font-medium text-gray-700">Bank A/C No</label>
                  <input
                    type="text"
                    value={introducerBankAccNo}
                    onChange={(e) => setIntroducerBankAccNo(e.target.value)}
                    disabled={!canEdit}
                    className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
                  />

                  <label className="text-sm font-medium text-gray-700">
                    Bank A/C Holder Name
                  </label>
                  <input
                    type="text"
                    value={introducerBankHolder}
                    onChange={(e) => setIntroducerBankHolder(e.target.value)}
                    disabled={!canEdit}
                    className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                  <label className="text-sm font-medium text-gray-700">Bank</label>
                  <input
                    type="text"
                    value={IntroBanker}
                    onChange={(e) => setIntroBanker(e.target.value)}
                    disabled={!canEdit}
                    className="md:col-span-3 w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
                  />
                </div>
              </div>
            </div>

            {/* STATEMENT REMARKS */}
            <div className="mb-6">
              <div className="bg-gray-200 px-4 py-2 rounded font-semibold uppercase">
                STATEMENT REMARKS
              </div>
              <div className="mt-4">
                <textarea
                  value={statementRemarks}
                  onChange={(e) => setStatementRemarks(e.target.value)}
                  rows={4}
                  disabled={!canEdit}
                  className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="Enter remarks to appear on the statement PDF…"
                />
              </div>
            </div>

            <div className="flex flex-row justify-center items-stretch pt-2 space-x-3 text-sm">
              <button
                onClick={handleUpdateBilling}
                disabled={buttonDisabled}
                title={!canEdit ? 'Application not editable for this status' : undefined}
                className={`flex-1 bg-green-600 text-white px-4 py-2 rounded-lg font-medium ${
                  buttonDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-green-700'
                }`}
                type="button"
              >
                {buttonLabel}
              </button>

              <button
                onClick={() => {
                  if (canEdit) handleGenerateStatement();
                }}
                disabled={!canEdit}
                title={!canEdit ? 'Application not editable for this status' : undefined}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
                type="button"
              >
                Generate Statement
              </button>
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
};

export default BillingDetails;