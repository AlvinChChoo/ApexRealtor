import { API_ENDPOINTS } from '../../config/apiConfig';
// src/components/BillingDetailsForSales.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

/* =========================
   Helpers
========================= */
const fmt2 = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const currency = (n: string | number) => {
  const num = typeof n === 'string' ? parseFloat(n || '0') : n || 0;
  return Number.isFinite(num) ? fmt2(num) : '0.00';
};

const toNumString = (x: string | number) => {
  const s = String(x ?? '');
  const cleaned = s.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : (cleaned || '0');
};

const toNumber = (x: any) => {
  const n = parseFloat(String(x ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const rowTotal = (base: number, sstOn: boolean) => {
  const sst = sstOn ? base * 0.08 : 0;
  return { sst, total: base + sst };
};

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
}
const RowThree: React.FC<RowThreeProps> = React.memo(
  ({ label, value, onValueChange, sstChecked, onSstChange, sstAmt, total }) => {
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
            className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={sstChecked}
            onChange={(e) => onSstChange(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">SST (8%)</span>
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
  introducerEmail?: string;
  introducerPostalCode?: string;
  introducerAddress?: string;
  introducerTelNo?: string;
  introducerTinNo?: string;
  introducerBankAcNo?: string;
  introducerBankHolderName?: string;

  // NEW: Introducer Banker
  IntroBanker?: string;

  AtrAdvRentalAmt?: string;
  AtrSecurityDepositAmt?: string;
  AtrUtilityDepositAmt?: string;
  AtrAccessCard?: string;
  AtrIndahWater?: string;
  AtrOtherDepositAmt?: string;

  PaymentFor?: string;

  // ✅ NEW columns from RentalApplicationGet.php (exact names)
  EdToBanker?: string;
  EdToBankAcNo?: string;
  EdToBankHolder?: string;

  // optional (exists in your code usage)
  introducerParty?: string;
}

export interface BillingDetailsForSalesProps {
  applicationId: string | number;
  application?: any;
  initialValues?: BillingDetailsInitial;
  title?: string;
  endpoint?: string;
  onRefresh?: () => Promise<void> | void;
}

/* =========================
   Component
========================= */
const BillingDetailsForSales: React.FC<BillingDetailsForSalesProps> = ({
  applicationId,
  application,
  initialValues,
  title = 'TRANSACTION DETAILS',
  endpoint = API_ENDPOINTS.BILLING_DET_SET,
  onRefresh,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

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

  /* ---------- Others (existing) ---------- */
  const [rentalOrSalePrice, setRentalOrSalePrice] = useState(initialValues?.rentalOrSalePrice ?? '0');
  const [earnestDeposit, setEarnestDeposit] = useState(initialValues?.earnestDeposit ?? '0');

  /* ---------- Others (NEW deposit fields) ---------- */
  const [securityDeposit, setSecurityDeposit] = useState(initialValues?.AtrSecurityDepositAmt ?? '0');
  const [utilityDeposit, setUtilityDeposit] = useState(initialValues?.AtrUtilityDepositAmt ?? '0');
  const [accessCardDeposit, setAccessCardDeposit] = useState(initialValues?.AtrAccessCard ?? '0');
  const [indahWater, setIndahWater] = useState(initialValues?.AtrIndahWater ?? '0');
  const [otherDeposit, setOtherDeposit] = useState(initialValues?.AtrOtherDepositAmt ?? '0');

  // REN reimburses
  type RenOption = { value: string; label: string };
  const [renOptionsFromApi, setRenOptionsFromApi] = useState<RenOption[]>([]);
  const [llReimburseTo, setLlReimburseTo] = useState<string>(''); // Vendor
  const [tnReimburseTo, setTnReimburseTo] = useState<string>(''); // Buyer

  /* ---------- Payment For ---------- */
  const [paymentFor, setPaymentFor] = useState(initialValues?.PaymentFor ?? '');

  // ✅ NEW: mapped to NEW columns from RentalApplicationGet.php
  const [EdToBanker, setEdToBanker] = useState(initialValues?.EdToBanker ?? '');
  const [EdToBankAcNo, setEdToBankAcNo] = useState(initialValues?.EdToBankAcNo ?? '');
  const [EdToBankHolder, setEdToBankHolder] = useState(initialValues?.EdToBankHolder ?? '');

  // ✅ Only show these 3 inputs for these 2 selections
  const showEdBankDetails =
    paymentFor === 'To be release to vendor solicitor' ||
    paymentFor === 'To be release to vendor agent';

  // ✅ If not selected, auto-clear the 3 fields (set to blank)
  useEffect(() => {
    if (!showEdBankDetails) {
      //setEdToBanker('');
      //setEdToBankAcNo('');
      //setEdToBankHolder('');
    }
  }, [showEdBankDetails]);

  /* ---------- Introducer ---------- */
  const [introducerName, setIntroducerName] = useState(initialValues?.introducerName ?? '');
  const [introducerNric, setIntroducerNric] = useState(initialValues?.introducerNric ?? '');
  const [introducerCommAmt, setIntroducerCommAmt] = useState(initialValues?.introducerCommAmt ?? '0');
  const [introducerEmail, setIntroducerEmail] = useState(initialValues?.introducerEmail ?? '');
  const [introducerPostalCode, setIntroducerPostalCode] = useState(initialValues?.introducerPostalCode ?? '');

  const [introducerAddress, setIntroducerAddress] = useState(initialValues?.introducerAddress ?? '');
  const [introducerTelNo, setIntroducerTelNo] = useState(initialValues?.introducerTelNo ?? '');
  const [introducerTinNo, setIntroducerTinNo] = useState(initialValues?.introducerTinNo ?? '');
  const [introducerBankAcNo, setIntroducerBankAcNo] = useState(initialValues?.introducerBankAcNo ?? '');
  const [introducerBankHolderName, setIntroducerBankHolderName] = useState(
    initialValues?.introducerBankHolderName ?? ''
  );

  // NEW: Introducer Banker (state variable name must be IntroBanker)
  const [IntroBanker, setIntroBanker] = useState(initialValues?.IntroBanker ?? '');

  // NEW: Introducer Party (Landlord/Tenant)
  const [introducerParty, setIntroducerParty] = useState(initialValues?.introducerParty ?? '');

  /* ---------- Hydrate REN options ---------- */
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

        const resp = await fetch(
          API_ENDPOINTS.LISTER_CLOSER_BY_APPLICATION_ID_GET,
          { method: 'POST', body: fd }
        );

        const json = await resp.json();
        const rows: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];

        const opts: RenOption[] = rows
          .map((r) => {
            const userName = String(r?.UserName ?? '').trim();
            const display = String(r?.DisplayName ?? '').trim();
            if (!userName && !display) return null;
            return { label: display || userName, value: userName || display };
          })
          .filter(Boolean) as RenOption[];

        if (!cancelled) setRenOptionsFromApi(opts);
      } catch {
        if (!cancelled) setRenOptionsFromApi([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [application?.ApplicationId, applicationId]);

  const renOptions = useMemo(() => renOptionsFromApi, [renOptionsFromApi]);

  /* ---------- Hydrate from application ---------- */
  useEffect(() => {
    if (!application) return;

    // LANDLORD
    setLlProfessionalFees(String(application.AtlProFees ?? '0'));
    //setLlProfessionalSst(toNumber(application.AtlProFeesSstAmt) > 0);
    const vProfFees = toNumber(application.AtlProFees ?? 0);
    const vProfSst  = toNumber(application.AtlProFeesSstAmt ?? 0);
    
    if (vProfFees === 0) {
      setLlProfessionalSst(true);
    } else if (vProfFees > 0 && vProfSst > 0) {
      setLlProfessionalSst(true);
    } else {
      setLlProfessionalSst(false);
    }

    
    setLlAdminFees(String(application.LandlordAdminFeesAmt ?? '0'));
    setLlAdminSst(toNumber(application.LandlordAdminFeesSst) > 0);
    setLlStamping(String(application.LandlordStampingFees ?? '0'));

    // Reimburse to REN hydrate
    setLlReimburseTo(String(application.LandlordStampDutyReimbuseToRen ?? '').trim());
    setTnReimburseTo(String(application.TenantStampDutyReimbuseToRen ?? '').trim());

    // TENANT
    setTnServiceFees(String(application.TalServiceFeesAmt ?? '0'));
    //setTnServiceSst(toNumber(application.TalProfessionalFeesSstAmt) > 0);
    const bSvcFees = toNumber(application.TalServiceFeesAmt ?? 0);
    const bSvcSst  = toNumber(application.TalProfessionalFeesSstAmt ?? 0);
    
    if (bSvcFees === 0) {
      setTnServiceSst(true);
    } else if (bSvcFees > 0 && bSvcSst > 0) {
      setTnServiceSst(true);
    } else {
      setTnServiceSst(false);
    }

    
    setTnAdminFees(String(application.TenantAdminFeesAmt ?? '0'));
    setTnAdminSst(toNumber(application.TenantAdminFeesSst) > 0);
    setTnStamping(String(application.TenantStampingFees ?? '0'));

    // OTHERS
    setRentalOrSalePrice(String(application.AtlRentalAmt ?? '0'));
    setEarnestDeposit(String(application.AtlEdFullAmt ?? '0'));

    setAdvanceRental(String(application.AtrAdvRentalAmt ?? '0'));
    setSecurityDeposit(String(application.AtrSecurityDepositAmt ?? '0'));
    setUtilityDeposit(String(application.AtrUtilityDepositAmt ?? '0'));
    setAccessCardDeposit(String(application.AtrAccessCard ?? '0'));
    setIndahWater(String(application.AtrIndahWater ?? '0'));
    setOtherDeposit(String(application.AtrOtherDepositAmt ?? '0'));

    // PAYMENT FOR
    setPaymentFor(String(application.PaymentFor ?? ''));

    // ✅ Mapping: NEW columns from RentalApplicationGet.php
    setEdToBanker(String(application.EdToBanker ?? ''));
    setEdToBankAcNo(String(application.EdToBankAcNo ?? ''));
    setEdToBankHolder(String(application.EdToBankHolder ?? ''));

    // INTRODUCER
    setIntroducerName(String(application.IntroName ?? ''));
    setIntroducerNric(String(application.IntroIdNo ?? ''));
    setIntroducerCommAmt(String(application.IntroCommAmt ?? '0'));
    setIntroducerEmail(String(application.IntroEmail ?? ''));
    setIntroducerPostalCode(String(application.IntroPostalCode ?? ''));

    setIntroducerAddress(String(application.IntroAddress ?? ''));
    setIntroducerTelNo(String(application.IntroTelNo ?? ''));
    setIntroducerTinNo(String(application.IntroTinNo ?? ''));
    setIntroducerBankAcNo(String(application.IntroBankAccNo ?? ''));
    setIntroducerBankHolderName(String(application.IntroBankHolder ?? ''));
    setIntroducerParty(String(application.IntroParty ?? ''));

    // NEW: Introducer Banker hydrate
    setIntroBanker(String(application.IntroBanker ?? ''));
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

  /* ---------- Save ---------- */
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<null | { type: 'ok' | 'err'; text: string }>(null);

  const handleUpdateBilling = async () => {
    if (saving || refreshing) return;

    setSaving(true);
    setMsg(null);

    try {
      const formData = new FormData();
      formData.append('ApplicationId', String(application?.ApplicationId ?? applicationId));

      // LANDLORD
      formData.append('AtlProFees', llProfessionalFees);
      formData.append('AtlProFeesSstAmt', String(d.llProf.sst));
      formData.append('AtlProFeesTotalAmt', String(d.llProf.total));

      formData.append('LandlordAdminFeesAmt', llAdminFees);
      formData.append('LandlordAdminFeesSst', llAdminSst ? '1' : '0');
      formData.append('LandlordAdminFeesTotal', String(d.llAdm.total));
      formData.append('LandlordStampingFees', llStamping);

      // TENANT
      formData.append('TalServiceFeesAmt', tnServiceFees);
      formData.append('TalProfessionalFeesSstAmt', String(d.tnServ.sst));
      formData.append('TenantAdminFeesAmt', tnAdminFees);
      formData.append('TenantAdminFeesSst', tnAdminSst ? '1' : '0');
      formData.append('TenantAdminFeesTotal', String(d.tnAdm.total));
      formData.append('TenantStampingFees', tnStamping);

      // OTHERS (existing)
      formData.append('AtlRentalAmt', rentalOrSalePrice);
      formData.append('AtlEdFullAmt', earnestDeposit);

      // NEW DEPOSITS
      formData.append('AtrAdvRentalAmt', advanceRental);
      formData.append('AtrSecurityDepositAmt', securityDeposit);
      formData.append('AtrUtilityDepositAmt', utilityDeposit);
      formData.append('AtrAccessCard', accessCardDeposit);
      formData.append('AtrIndahWater', indahWater);
      formData.append('AtrOtherDepositAmt', otherDeposit);

      // Payment For
      formData.append('PaymentFor', paymentFor);

      // ✅ Save NEW columns using PHP param names you asked (EdToBanker / EdToBankAcNo / EdToBankHolder)
      formData.append('EdToBanker', EdToBanker);
      formData.append('EdToBankAcNo', EdToBankAcNo);
      formData.append('EdToBankHolder', EdToBankHolder);

      // INTRODUCER
      formData.append('IntroName', introducerName);
      formData.append('IntroIdNo', introducerNric);
      formData.append('IntroCommAmt', introducerCommAmt);
      formData.append('IntroEmail', introducerEmail);
      formData.append('IntroPostalCode', introducerPostalCode);

      formData.append('IntroAddress', introducerAddress);
      formData.append('IntroTelNo', introducerTelNo);
      formData.append('IntroTinNo', introducerTinNo);
      formData.append('IntroBankAccNo', introducerBankAcNo);
      formData.append('IntroBankHolder', introducerBankHolderName);
      formData.append('IntroParty', introducerParty);
      formData.append('LandlordStampDutyReimbuseToRen', llReimburseTo);
      formData.append('TenantStampDutyReimbuseToRen', tnReimburseTo);

      // NEW: Introducer Banker
      formData.append('IntroBanker', IntroBanker);

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.status === 'success') {
        const successText = data.data || 'Updated successfully.';
        alert(successText);
        setMsg({ type: 'ok', text: successText });

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

  /* ---------- Generate Statement (PDF) ---------- */
  /* ---------- Generate Statement (PDF) ---------- */
const handleGenerateStatement = async () => {
  try {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // ✅ SAFER tenant & property mapping (avoid "undefined" / wrong key)
    const buyerName = String(
      application?.BuyerName ??
        application?.buyerName ??
        application?.tenant1Name ?? // (your existing key)
        application?.TenantName ??
        application?.TnName ??
        ''
    ).trim();

    const propertyText = String(
      application?.PropertyAddress ??
        application?.propertyAddress ??
        application?.Address ??
        application?.FullAddress ??
        ''
    ).trim();

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(70, 150, 230);
    doc.setFontSize(24);
    doc.text('STATEMENT', pageW - 15, 20, { align: 'right' });

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    const dd = new Date().toLocaleDateString('en-GB');

    const toLabelX = 20;
    const toValueX = 40;
    const dateY = 35;
    const toY = 43;
    const propY = 51;

    // ✅ Safer dynamic height (so long buyer/property won’t overlap the underline)
    const lineHeightFactor = 1.2;
    const sf = (doc as any)?.internal?.scaleFactor || 72 / 25.4; // fallback
    const lineH = (doc.getFontSize() * lineHeightFactor) / sf;

    doc.text('Date', toLabelX, dateY);
    doc.text(dd, toValueX, dateY);

    // --- TO ---
    doc.text('To', toLabelX, toY);
    const toText = buyerName || '-';
    const wrappedTo = doc.splitTextToSize(toText, (pageW - 20) - toValueX);
    doc.text(wrappedTo, toValueX, toY, { lineHeightFactor });

    // --- PROPERTY ---
    // put property below TO block (dynamic)
    const propStartY = toY + (wrappedTo.length - 1) * lineH + 8;
    doc.text('Property :', toLabelX, propStartY);

    const pText = propertyText || '-';
    const wrappedProp = doc.splitTextToSize(pText, (pageW - 20) - toValueX);
    doc.text(wrappedProp, toValueX, propStartY, { lineHeightFactor });

    // underline AFTER property block
    const underlineY = propStartY + (wrappedProp.length - 1) * lineH + 5;
    doc.setDrawColor(0);
    doc.line(20, underlineY, pageW - 20, underlineY);

    doc.setFontSize(12);
    doc.text('Kindly remit the following payments :-', 20, underlineY + 12);

    // Start left/right columns after the header
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

    // Left side (collections)
    putRow(xl, xl + 55, xl + 80, yl, 'Advance Rental', advanceRental); yl += 9;
    putRow(xl, xl + 55, xl + 80, yl, 'Security Deposit', securityDeposit); yl += 9;
    putRow(xl, xl + 55, xl + 80, yl, 'Utility Deposit', utilityDeposit); yl += 9;
    putRow(xl, xl + 55, xl + 80, yl, 'Access Card Deposit', accessCardDeposit); yl += 9;
    putRow(xl, xl + 55, xl + 80, yl, 'Indah Water', indahWater); yl += 9;
    putRow(xl, xl + 55, xl + 80, yl, 'Others', otherDeposit); yl += 12;

    const totalCollection =
      toNumber(advanceRental) +
      toNumber(securityDeposit) +
      toNumber(utilityDeposit) +
      toNumber(accessCardDeposit) +
      toNumber(indahWater) +
      toNumber(otherDeposit);

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

    // Right side (fees)
    putRow(xr, xr + 55, xr + 80, yr, 'Serv. Fee + SST', d.tnServ.total); yr += 9;
    putRow(xr, xr + 55, xr + 80, yr, 'Admin', d.tnAdm.total); yr += 9;
    putRow(xr, xr + 55, xr + 80, yr, 'Stamping', tnStamping); yr += 9;
    putRow(xr, xr + 55, xr + 80, yr, 'Refund to REN', 0); yr += 12;

    const totalRight = d.tnServ.total + d.tnAdm.total + toNumber(tnStamping);

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

    const boxHeight = 22;
    doc.rect(20, remarksTop + 4, 170, boxHeight);
    doc.text(' ', 22, remarksTop + 12);

    doc.save('statement.pdf');
  } catch (err: any) {
    console.error('Generate Statement Error:', err);
    alert(`Generate Statement failed: ${err?.message ?? String(err)}`);
  }
};


  const buttonDisabled = saving || refreshing;
  const buttonLabel = saving ? (refreshing ? 'Refreshing…' : 'Saving…') : 'Update Details';

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
        <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
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

          {/* LANDLORD */}
          <div className="mb-6">
            <div className="bg-gray-200 px-4 py-2 rounded font-semibold uppercase">VENDOR</div>
            <div className="mt-4 space-y-4">
              <RowThree
                label="Professional Fees"
                value={llProfessionalFees}
                onValueChange={(v) => setLlProfessionalFees(toNumString(v))}
                sstChecked={llProfessionalSst}
                onSstChange={setLlProfessionalSst}
                sstAmt={d.llProf.sst}
                total={d.llProf.total}
              />
              <div className="text-right font-semibold mt-2">Grand Total: RM {currency(d.landlordGrand)}</div>

              <div className="flex items-center gap-2">
                <label className="w-4/5 text-sm font-medium text-gray-700">Reimburse to</label>
                <select
                  value={llReimburseTo}
                  onChange={(e) => setLlReimburseTo(e.target.value)}
                  className="w-2/5 border border-gray-300 rounded px-2 py-1"
                  disabled={renOptions.length === 0}
                >
                  <option value="">{renOptions.length ? '-- Select --' : '-- No REN --'}</option>
                  {renOptions.map((o) => (
                    <option key={`${o.value}-${o.label}`} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* TENANT */}
          <div className="mb-6">
            <div className="bg-gray-200 px-4 py-2 rounded font-semibold uppercase">BUYER</div>
            <div className="mt-4 space-y-4">
              <RowThree
                label="Service Fees"
                value={tnServiceFees}
                onValueChange={(v) => setTnServiceFees(toNumString(v))}
                sstChecked={tnServiceSst}
                onSstChange={setTnServiceSst}
                sstAmt={d.tnServ.sst}
                total={d.tnServ.total}
              />
              <div className="text-right font-semibold mt-2">Grand Total: RM {currency(d.tenantGrand)}</div>

              <div className="flex items-center gap-2">
                <label className="w-4/5 text-sm font-medium text-gray-700">Reimburse to</label>
                <select
                  value={tnReimburseTo}
                  onChange={(e) => setTnReimburseTo(e.target.value)}
                  className="w-2/5 border border-gray-300 rounded px-2 py-1"
                  disabled={renOptions.length === 0}
                >
                  <option value="">{renOptions.length ? '-- Select --' : '-- No REN --'}</option>
                  {renOptions.map((o) => (
                    <option key={`${o.value}-${o.label}`} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* OTHERS */}
          <div className="mb-6">
            <div className="bg-gray-200 px-4 py-2 rounded font-semibold uppercase">OTHERS</div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-1">Selling Price</div>
                <input
                  type="text"
                  value={rentalOrSalePrice}
                  onChange={(e) => setRentalOrSalePrice(toNumString(e.target.value))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-right"
                />
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-1">Earnest Deposit</div>
                <input
                  type="text"
                  value={earnestDeposit}
                  onChange={(e) => setEarnestDeposit(toNumString(e.target.value))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-right"
                />
              </div>

              <div>{/* intentionally blank */}</div>
            </div>

            {/* Payment For */}
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-700 mb-1">Release of Earnest Deposit</div>
              <select
                value={paymentFor}
                onChange={(e) => setPaymentFor(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="">-- Select --</option>

                <option value="To be treated as professional fees from vendor">
                  - To be treated as professional fees from vendor
                </option>

                <option value="To be released to vendor directly">- To be released to vendor directly</option>

                <option value="To be release to vendor solicitor">- To be release to vendor solicitor</option>

                <option value="To be release to vendor agent">- To be release to vendor agent</option>
              </select>
            </div>

            {/* ✅ Only unhide for solicitor / agent */}
            {showEdBankDetails && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">EdToBanker</div>
                  <input
                    type="text"
                    value={EdToBanker}
                    onChange={(e) => setEdToBanker(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">EdToBankAcNo</div>
                  <input
                    type="text"
                    value={EdToBankAcNo}
                    onChange={(e) => setEdToBankAcNo(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">EdToBankHolder</div>
                  <input
                    type="text"
                    value={EdToBankHolder}
                    onChange={(e) => setEdToBankHolder(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                </div>
              </div>
            )}
          </div>

          {/* INTRODUCER */}
          <div className="mb-6">
            <div className="bg-gray-200 px-4 py-2 rounded font-semibold uppercase">INTRODUCER DETAIL</div>

            {/* Introducer Party */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
              <label className="text-sm font-medium text-gray-700">Introducer From</label>
              <select
                value={introducerParty}
                onChange={(e) => setIntroducerParty(e.target.value)}
                className="md:col-span-3 w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="">-- Select --</option>
                <option value="Landlord">Seller</option>
                <option value="Tenant">Buyer</option>
              </select>
            </div>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                <label className="text-sm font-medium text-gray-700">Name as per IC</label>
                <input
                  type="text"
                  value={introducerName}
                  onChange={(e) => setIntroducerName(e.target.value)}
                  className="md:col-span-3 w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                <label className="text-sm font-medium text-gray-700">NRIC No</label>
                <input
                  type="text"
                  value={introducerNric}
                  onChange={(e) => setIntroducerNric(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
                <label className="text-sm font-medium text-gray-700">Intro Fees (RM)</label>
                <input
                  type="text"
                  value={introducerCommAmt}
                  onChange={(e) => setIntroducerCommAmt(toNumString(e.target.value))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-right"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                <label className="text-sm font-medium text-gray-700 pt-2">Address</label>
                <textarea
                  rows={3}
                  value={introducerAddress}
                  onChange={(e) => setIntroducerAddress(e.target.value)}
                  className="md:col-span-3 w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                <label className="text-sm font-medium text-gray-700">Postal Code</label>
                <input
                  type="text"
                  value={introducerPostalCode}
                  onChange={(e) => setIntroducerPostalCode(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
                <label className="text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={introducerEmail}
                  onChange={(e) => setIntroducerEmail(e.target.value)}
                  className="w-full md:col-span-1 border border-gray-300 rounded px-3 py-2"
                />
                
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                <label className="text-sm font-medium text-gray-700">Tel No</label>
                <input
                  type="text"
                  value={introducerTelNo}
                  onChange={(e) => setIntroducerTelNo(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
                <label className="text-sm font-medium text-gray-700">TIN No</label>
                <input
                  type="text"
                  value={introducerTinNo}
                  onChange={(e) => setIntroducerTinNo(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              {/* Bank A/C No + Holder */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                <label className="text-sm font-medium text-gray-700">Bank A/C No</label>
                <input
                  type="text"
                  value={introducerBankAcNo}
                  onChange={(e) => setIntroducerBankAcNo(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
                <label className="text-sm font-medium text-gray-700">Bank A/C Holder Name</label>
                <input
                  type="text"
                  value={introducerBankHolderName}
                  onChange={(e) => setIntroducerBankHolderName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              {/* Introducer Banker (NEW) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                <label className="text-sm font-medium text-gray-700">Bank</label>
                <input
                  type="text"
                  value={IntroBanker}
                  onChange={(e) => setIntroBanker(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
                <div className="hidden md:block" />
                <div className="hidden md:block" />
              </div>

              
            </div>
          </div>

          <div className="flex flex-row justify-center items-stretch pt-2 space-x-3 text-sm">
            <button
              onClick={handleUpdateBilling}
              disabled={buttonDisabled}
              className={`flex-1 bg-green-600 text-white px-4 py-2 rounded-lg font-medium ${
                buttonDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-green-700'
              }`}
              type="button"
            >
              {buttonLabel}
            </button>

            {false && 
            <button
              onClick={handleGenerateStatement}
              className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700"
              type="button"
            >
              Generate Statement
            </button>
            }
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingDetailsForSales;
