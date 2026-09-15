import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, ScrollText, ListChecks, Calendar } from 'lucide-react';
import { RentalApplication } from '../../types';

/* =======================================================================
   pdfmake loader (ESM-safe, once)
======================================================================= */
let __pdfMakeOnce: Promise<any> | null = null;
function ensurePdfMakeOnce() {
  if (__pdfMakeOnce) return __pdfMakeOnce;
  __pdfMakeOnce = (async () => {
    const mod: any = await import('pdfmake/build/pdfmake.js');
    const pdfMake = mod?.default || mod?.pdfMake || (window as any)?.pdfMake;
    if (!pdfMake) throw new Error('pdfMake instance not found');

    const fonts: any = await import('pdfmake/build/vfs_fonts.js');
    const hasRoboto = (o: any) =>
      o && typeof o === 'object' && ('Roboto-Regular.ttf' in o || 'Roboto-Medium.ttf' in o);
    const vfs =
      fonts?.pdfMake?.vfs ||
      fonts?.default?.pdfMake?.vfs ||
      fonts?.vfs ||
      fonts?.default?.vfs ||
      (hasRoboto(fonts) ? fonts : undefined) ||
      (hasRoboto(fonts?.default) ? fonts.default : undefined);
    if (!vfs) throw new Error('pdfmake vfs not found');

    pdfMake.vfs = vfs;
    if (typeof pdfMake.createPdf !== 'function') throw new Error('pdfMake.createPdf is not a function');
    return pdfMake;
  })();
  return __pdfMakeOnce;
}

/* =======================================================================
   Tiny inline HTML → pdfmake runs helper (no deps)
   Supports: <b>, <u>, <i>, <p>.
======================================================================= */
function htmlToPdfmakeLite(html: string) {
  const parts = html.split(/(<\/?[buip]>)/g); // <b>,<u>,<i>,<p>
  const stack: string[] = [];
  const out: any[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (part === '<b>' || part === '<u>' || part === '<i>') {
      stack.push(part);
      continue;
    }
    if (part === '</b>' || part === '</u>' || part === '</i>') {
      stack.pop();
      continue;
    }
    if (part === '<p>') {
      out.push({ text: '\n\n' });
      continue;
    }
    if (part === '</p>') {
      continue;
    }

    const run: any = { text: part };
    if (stack.includes('<b>')) run.bold = true;
    if (stack.includes('<u>')) run.decoration = 'underline';
    if (stack.includes('<i>')) run.italics = true;
    out.push(run);
  }
  return out;
}

/* =======================================================================
   Public asset -> PNG dataURL (expects files under /public)
======================================================================= */
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

/* =======================================================================
   Helpers
======================================================================= */
const currency = (n: string | number) => {
  const num = typeof n === 'string' ? parseFloat(n || '0') : n || 0;
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const money = (s: string) =>
  `RM ${Number.parseFloat(s || '0').toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDate_Ori = (iso: string) => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso || '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return iso || '';
  }
};

const fmtDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();

  return `${dd}-${mm}-${yyyy}`;
};

function toNumString(x: string) {
  const cleaned = (x || '').replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned || '0';
}

/* =======================================================================
   ApplicationId resolution
======================================================================= */
function deriveApplicationId(explicitId?: string | number, application?: any): string | null {
  if (explicitId !== undefined && explicitId !== null && String(explicitId).trim() !== '') {
    return String(explicitId);
  }
  const candidates = [
    application?.ApplicationId,
    application?.applicationId,
    application?.applicationID,
    application?.ApplicationID,
    application?.appId,
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null && String(c).trim() !== '') return String(c);
  }
  try {
    const qs = new URLSearchParams(window.location.search);
    const fromUrl = qs.get('ApplicationId') || qs.get('applicationId');
    if (fromUrl && fromUrl.trim() !== '') return fromUrl;
  } catch {}
  const ls = localStorage.getItem('ApplicationId') || localStorage.getItem('applicationId');
  if (ls && ls.trim() !== '') return ls;
  return null;
}

/* =======================================================================
   Build a helpful CORS hint
======================================================================= */
function buildCorsHint(endpointLabel: string, urlStr: string) {
  try {
    const u = new URL(urlStr);
    const sameOrigin = u.origin === window.location.origin;
    if (!sameOrigin) {
      return (
        `Browser blocked cross-origin call to ${endpointLabel}.\n` +
        `Fix one of these:\n` +
        `• Serve the frontend from the SAME origin (${u.origin}), or\n` +
        `• Add a same-origin proxy (e.g. /api/${endpointLabel}) that POSTs to ${u.origin}, or\n` +
        `• Ensure the server allows CORS (Access-Control-Allow-Origin: *) and that your host/firewall allows OPTIONS/POST.`
      );
    }
  } catch {}
  return `Network error calling ${endpointLabel}. Check server is reachable.`;
}

/* ---------- Helpers from original ATR ---------- */
function toDateInput(v?: string | null) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function calcMonthsDays_Ori(fromISO?: string, toISO?: string) {
  if (!fromISO || !toISO) return { months: 0, days: 0, totalDays: 0 };
  const from = new Date(fromISO);
  const to = new Date(toISO);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return { months: 0, days: 0, totalDays: 0 };
  }
  const diffMs = Math.abs(to.getTime() - from.getTime());
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(diffDays / 30);
  const days = diffDays % 30;
  return { months, days, totalDays: diffDays };
}

/* Calendar-accurate months & days difference */
function parseYMD(iso?: string) {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = +m[1], mm = +m[2], d = +m[3];
  return new Date(Date.UTC(y, mm - 1, d));
}
function addMonthsUTC(d: Date, months: number) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(y, m + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}
function daysBetweenUTC(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86400000);
}
/** end-date-inclusive, calendar-accurate */
function calcMonthsDays(fromISO?: string, toISO?: string) {
  const from = parseYMD(fromISO);
  const to = parseYMD(toISO);
  if (!from || !to || to < from) return { months: 0, days: 0, totalDays: 0 };
  const toInclusive = new Date(to.getTime() + 86400000);
  let months = 0;
  while (true) {
    const next = addMonthsUTC(from, months + 1);
    if (next > toInclusive) break;
    months += 1;
    if (months > 1200) break;
  }
  const anchor = addMonthsUTC(from, months);
  const days = Math.max(0, Math.floor((toInclusive.getTime() - anchor.getTime()) / 86400000));
  const totalDays = Math.max(0, Math.floor((toInclusive.getTime() - from.getTime()) / 86400000));
  return { months, days, totalDays };
}

/* ---------- Props ---------- */
interface ATRSectionProps {
  application: RentalApplication;
  onRefresh?: () => Promise<void> | void;
  formatCurrency?: (amount: string | number) => string;
  formatDate?: (dateStr: string) => string;
  applicationId?: number | string;
  applicationRaw?: any;

  /** IntFormInsert endpoint (server) */
  insertUrl?: string;
  insertProxyUrl?: string;

  /** After generating PDF, upload to this URL (server) */
  uploadUrl?: string;
  uploadProxyUrl?: string;

  /** GATL identifiers */
  gatlDocMUid?: string;
  gatlDocContent1?: string;

  /** Unused here, kept for parity */
  docMUid?: string;
  docContent1?: string;
}

const ATRSection: React.FC<ATRSectionProps> = ({
  application,
  formatCurrency,
  formatDate,
  applicationId,
  applicationRaw,

  insertUrl = API_ENDPOINTS.INT_FORM_INSERT,
  insertProxyUrl,
  uploadUrl = API_ENDPOINTS.UPLOAD,
  uploadProxyUrl,

  gatlDocMUid = '9EABAE44-F32B-4D9B-9D7B-BEF008A7F8A1',
  gatlDocContent1 = 'AUTHORISATION TO RENT (ATR)',

  docMUid,
  docContent1,

  onRefresh,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // ====== EDITABILITY (case-insensitive Active) ======
  // ===== EDITABILITY (Active, Pending Review, Rejected) =====
const status = String(application?.ApplicationStatus ?? '').toLowerCase().trim();
const editableStatuses = new Set(['active', 'pending review', 'rejected']);
const canEdit = editableStatuses.has(status);
const disabledAll = !canEdit;


  // ===== Existing ATR state (controlled) =====
  const [advRental, setAdvRental] = useState<string>('');
  const [securityDeposit, setSecurityDeposit] = useState<string>('');
  const [utilityDeposit, setUtilityDeposit] = useState<string>('');
  const [accessCard, setAccessCard] = useState<string>('');
  const [indahWater, setIndahWater] = useState<string>('');
  const [otherDeposit, setOtherDeposit] = useState<string>('');

  const [attDay, setAttDay] = useState<string>('');
  const [attMonth, setAttMonth] = useState<string>('');
  const [special1, setSpecial1] = useState<string>('');
  const [special2, setSpecial2] = useState<string>('');
  const [special3, setSpecial3] = useState<string>('');
  const [otherSpecial, setOtherSpecial] = useState<string>('');

  const [vpDay, setVpDay] = useState<string>('');
  const [vpMonth, setVpMonth] = useState<string>('');
  const [vpStampDutyAmt, setVpStampDutyAmt] = useState<string>('0');
  const [vpStampDutyPaidBy, setVpStampDutyPaidBy] = useState<string>('');
  const [vpAdminChargesAmt, setVpAdminChargesAmt] = useState<string>('0');
  const [vpAdminChargesPaidBy, setVpAdminChargesPaidBy] = useState<string>('');

  const [resolvedAppId, setResolvedAppId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  /* ---------- Hydrate from `application` ---------- */
  useEffect(() => {
    setAdvRental(String(application?.AtrAdvRentalAmt ?? ''));
    setSecurityDeposit(String(application?.AtrSecurityDepositAmt ?? ''));
    setUtilityDeposit(String(application?.AtrUtilityDepositAmt ?? ''));
    setAccessCard(String(application?.AtrAccessCard ?? ''));
    setIndahWater(String(application?.AtrIndahWater ?? ''));
    setOtherDeposit(String(application?.AtrOtherDepositAmt ?? ''));

    setAttDay(String(application?.AttDay ?? ''));
    setAttMonth(String(application?.AttMonth ?? ''));
    setSpecial1(application?.SpecialCondition1 ?? '');
    setSpecial2(application?.SpecialCondition2 ?? '');
    setSpecial3(application?.SpecialCondition3 ?? '');
    setOtherSpecial(application?.OtherSpecialCondition ?? '');

    setVpDay(String(application?.VpDay ?? ''));
    setVpMonth(String(application?.VpMonth ?? ''));
    setVpStampDutyAmt(String(application?.VpStampDutyAmt ?? '0'));
    setVpStampDutyPaidBy(application?.VpStampDutyPaidBy ?? '');
    setVpAdminChargesAmt(String(application?.VpAdminChargesAmt ?? '0'));
    setVpAdminChargesPaidBy(application?.VpAdminChargesPaidBy ?? '');
  }, [application]);

  // ===== Terms option state (MULTI-SELECT, hydrated from JSON) =====
  const [opt1, setOpt1] = useState<boolean>(application?.TenancyTermsOption1 === 'Y');
  const [opt2, setOpt2] = useState<boolean>(application?.TenancyTermsOption2 === 'Y');
  const [opt3, setOpt3] = useState<boolean>(application?.TenancyTermsOption3 === 'Y');

  const [months1, setMonths1] = useState<string>(String(application?.TenancyTermsOption1Mths ?? '0'));
  const [months2, setMonths2] = useState<string>(String(application?.TenancyTermsOption2Mths ?? '0'));
  const [months3, setMonths3] = useState<string>(String(application?.TenancyTermsOption3Mths ?? '0'));

  useEffect(() => {
    setOpt1(application?.TenancyTermsOption1 === 'Y');
    setOpt2(application?.TenancyTermsOption2 === 'Y');
    setOpt3(application?.TenancyTermsOption3 === 'Y');

    setMonths1(String(application?.TenancyTermsOption1Mths ?? '0'));
    setMonths2(String(application?.TenancyTermsOption2Mths ?? '0'));
    setMonths3(String(application?.TenancyTermsOption3Mths ?? '0'));
  }, [
    application?.TenancyTermsOption1,
    application?.TenancyTermsOption2,
    application?.TenancyTermsOption3,
    application?.TenancyTermsOption1Mths,
    application?.TenancyTermsOption2Mths,
    application?.TenancyTermsOption3Mths,
  ]);

  // Other remarks
  const [atrOtherDepositRem, setAtrOtherDepositRem] = useState<string>(
    application?.AtrOtherDepositRem ?? ''
  );
  useEffect(() => {
    setAtrOtherDepositRem(application?.AtrOtherDepositRem ?? '');
  }, [application]);

  // Resolve ApplicationId once
  useEffect(() => {
    const id = deriveApplicationId(applicationId, applicationRaw ?? application);
    if (id) {
      setResolvedAppId(id);
      localStorage.setItem('ApplicationId', id);
    } else {
      setResolvedAppId(null);
    }
  }, [applicationId, applicationRaw, application]);

  /* ---------- Dates + duration ---------- */
  const [tenancyFrom, setTenancyFrom] = useState<string>(toDateInput(application.TenancyPeriodFrom));
  const [tenancyTo, setTenancyTo] = useState<string>(toDateInput(application.TenancyPeriodTo));
  const [renewFrom, setRenewFrom] = useState<string>(toDateInput(application.RenewPeriodFrom));
  const [renewTo, setRenewTo] = useState<string>(toDateInput(application.RenewPeriodTo));
  useEffect(() => {
    setRenewFrom(toDateInput(application.OptionToRenewFrom ?? application.RenewPeriodFrom));
    setRenewTo(toDateInput(application.OptionToRenewTo ?? application.RenewPeriodTo));
  }, [
    application.OptionToRenewFrom,
    application.OptionToRenewTo,
    application.RenewPeriodFrom,
    application.RenewPeriodTo,
  ]);

  const tenancyDur = useMemo(() => calcMonthsDays(tenancyFrom, tenancyTo), [tenancyFrom, tenancyTo]);
  const renewDur = useMemo(() => calcMonthsDays(renewFrom, renewTo), [renewFrom, renewTo]);
  const tenancyTotalPeriodStr = tenancyDur.totalDays > 0 ? `${tenancyDur.months} month(s), ${tenancyDur.days} day(s)` : '';


  /* ---------- Buttons ---------- */
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  /* =======================================================================
     ==== PDF flow state (reused) ====
  ======================================================================== */
  const [professionalFees, setProfessionalFees] = useState('10500');
  const [sstChecked, setSstChecked] = useState(true);
  const [sstAmount, setSstAmount] = useState('840.00');
  const [totalAmount, setTotalAmount] = useState('11340.00');
  const [monthlyRentalAmount, setMonthlyRentalAmount] = useState('5500');
  const [earnestDeposit, setEarnestDeposit] = useState('10000');

  const [refNo, setRefNo] = useState('');
  const [propertyType] = useState('Retail Lot');
  const [propertyAddress] = useState('Property Address');

  const [docMLogId, setDocMLogId] = useState<string | null>(null);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdf, setShowPdf] = useState(false);

  const closePdf = () => {
    if (pdfUrl && pdfUrl.startsWith('blob:')) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setShowPdf(false);
  };

  // SST totals
  useEffect(() => {
    if (sstChecked && professionalFees) {
      const fees = parseFloat(toNumString(professionalFees)) || 0;
      const sst = fees * 0.08;
      setSstAmount(sst.toFixed(2));
      setTotalAmount((fees + sst).toFixed(2));
    } else {
      setSstAmount('0.00');
      setTotalAmount(toNumString(professionalFees) || '0.00');
    }
  }, [professionalFees, sstChecked]);

  /* =====================================================================
     IntFormInsert.php BEFORE generating — returns RefNo + DocMLogId
  ====================================================================== */
  async function createFormLog(appId: string, docUid: string, docContent: string) {
    const body = new URLSearchParams();
    body.set('ApplicationId', appId);
    body.set('DocMUid', docUid);
    body.set('DocContent1', docContent);

    const postAndParse = async (url: string) => {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status} ${resp.statusText}${t ? ` — ${t}` : ''}`);
      }
      return resp.json();
    };

    try {
      const json = await postAndParse(insertUrl);
      if (json?.status !== 'success' || !Array.isArray(json?.data) || !json.data.length) {
        throw new Error('IntFormInsert returned no data.');
      }
      const row = json.data[0] || {};
      const newRefNo: string = row.RefNo1 || '';
      const newDocMLogId: string = String(row.DocMLogId || '');
      if (!newRefNo || !newDocMLogId) throw new Error('Missing RefNo/DocMLogId from IntFormInsert.');
      return { refNo: newRefNo, docMLogId: newDocMLogId };
    } catch (err: any) {
      const isTypeError = err?.name === 'TypeError' || /Failed to fetch/i.test(err?.message || '');
      if (isTypeError && insertProxyUrl) {
        const json = await postAndParse(insertProxyUrl);
        if (json?.status !== 'success' || !Array.isArray(json?.data) || !json.data.length) {
          throw new Error('IntFormInsert (proxy) returned no data.');
        }
        const row = json.data[0] || {};
        const newRefNo: string = row.RefNo1 || '';
        const newDocMLogId: string = String(row.DocMLogId || '');
        if (!newRefNo || !newDocMLogId) throw new Error('Missing RefNo/DocMLogId from IntFormInsert (proxy).');
        return { refNo: newRefNo, docMLogId: newDocMLogId };
      }
      const hint = buildCorsHint('IntFormInsert.php', insertUrl);
      throw new Error(`${err?.message || String(err)}\n\n${hint}`);
    }
  }

  /* ====================== Compact row helpers for PDF ===================== */
  const depositRowBase = { layout: 'noBorders', margin: [0, -2, 0, -2] } as const;

  function depositRow(num: string, label: string, valueHtml: string) {
    return {
      ...depositRowBase,
      table: {
        widths: ['5%', '45%', '45%'],
        heights: (_row: number) => 8,
        body: [[
          { text: num, style: 'termsNumber' },
          { text: label, style: 'termsNumber' },
          { text: htmlToPdfmakeLite(valueHtml), style: 'terms' }
        ]]
      }
    };
  }

  function contentRowUnderline(num: string, valueHtml: string) {
    return {
      ...depositRowBase,
      table: {
        widths: ['2%', '98%'],
        body: [[
          { text: num, style: 'termsNumber' },
          {
            stack: [{ text: htmlToPdfmakeLite(valueHtml), style: 'terms' }],
            border: [false, false, false, true],
            margin: [0, -2, 0, -2],
          }
        ]],
      },
      layout: {
        defaultBorder: false,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      },
    };
  }

  function contentRow(num: string, valueHtml: string) {
  return {
    ...depositRowBase,
    table: {
      widths: ['2%', '98%'],
      heights: (_row: number) => 8,
      body: [[
        { text: num, style: 'termsNumber' },
        {
          text: htmlToPdfmakeLite(valueHtml),
          style: 'terms',
          alignment: 'justify',
        }
      ]]
    }
  };
}

  function makeFourUnderlineRow(underline1, underline2, underline3, underline4) {
    const border = (flag) => (flag === 'Y' ? [false, false, false, true] : [false, false, false, false]);
    return {
      table: {
        widths: ['25%', '25%', '25%', '25%'],
        body: [
          [
            {
              table: { widths: ['*'], body: [[{ text: '', border: border(underline1) }]] },
              layout: {
                defaultBorder: false,
                paddingLeft: () => 5,
                paddingRight: () => 5,
                paddingTop: () => 0,
                paddingBottom: () => -2,
              },
            },
            {
              table: { widths: ['*'], body: [[{ text: '', border: border(underline2) }]] },
              layout: {
                defaultBorder: false,
                paddingLeft: () => 5,
                paddingRight: () => 5,
                paddingTop: () => 0,
                paddingBottom: () => -2,
              },
            },
            {
              table: { widths: ['*'], body: [[{ text: '', border: border(underline3) }]] },
              layout: {
                defaultBorder: false,
                paddingLeft: () => 5,
                paddingRight: () => 5,
                paddingTop: () => 0,
                paddingBottom: () => -2,
              },
            },

            {
              table: { widths: ['*'], body: [[{ text: '', border: border(underline4) }]] },
              layout: {
                defaultBorder: false,
                paddingLeft: () => 5,
                paddingRight: () => 5,
                paddingTop: () => 0,
                paddingBottom: () => -2,
              },
            },
          ],
        ],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 2],
    };
  }

  function signatureRowWithUnderline(
    value1 = '',
    value2 = '',
    value3 = '',
    value4 = ''
  ) {
    const underlinedCell = (text = '') => ({
      table: {
        widths: ['*'],
        body: [[{ text, border: [false, false, false, true] }]]
      },
      layout: {
        defaultBorder: false,
        paddingLeft: () => 5,
        paddingRight: () => 5,
        paddingTop: () => 0,
        paddingBottom: () => 0
      }
    });

    return {
      table: {
        widths: ['25%', '25%', '25%', '25%'],
        body: [[
          { text: value1, style: 'termsNumber' },
          underlinedCell(value2),
          underlinedCell(value3),
          underlinedCell(value4),
        ]]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 2],
    };
  }

  function signatureRow(value1, value2, value3, value4) {
    return {
      ...depositRowBase,
      layout: {
        defaultBorder: false,
        hLineWidth: function (i, node) {
          return i === 1 ? 0.5 : 0;
        },
        vLineWidth: function () { return 0; },
        hLineColor: function () { return '#000000'; },
      },
      table: {
        widths: ['25%', '25%', '25%', '25%'],
        heights: () => 8,
        body: [[
          { text: value1, style: 'termsNumber' },
          { text: value2, style: 'termsNumber' },
          { text: value3, style: 'termsNumber' },
          { text: value4, style: 'termsNumber' },
        ]]
      }
    };
  }

  function signatureRow_Temp1(value1: string,value2: string,value3: string,value4: string) {
    return {
      ...depositRowBase,
      table: {
        widths: ['25%', '25%', '25%', '25%'],
        heights: (_row: number) => 8,
        body: [[
          { text: value1, style: 'termsNumber'},
          { text: value2, style: 'termsNumber', border: [false, false, false, true]  },
          { text: value3, style: 'termsNumber', border: [false, false, false, true]  },
          { text: value4, style: 'termsNumber', border: [false, false, false, true]  },
        ]]
      }
    };
  }

  function oneRowText(valueHtml: string) {
  return {
    ...depositRowBase,
    table: {
      widths: ['100%'],
      heights: (_row: number) => 8,
      body: [[
        { 
          text: htmlToPdfmakeLite(valueHtml), 
          style: 'terms',
          alignment: 'justify'
        }
      ]]
    }
  };
}

  function oneRowTextRightAlign(valueHtml: string) {
    return {
      ...depositRowBase,
      table: {
        widths: ['100%'],
        heights: (_row: number) => 8,
        body: [[{ text: htmlToPdfmakeLite(valueHtml), style: 'terms', alignment: 'right' }]]
      }
    };
  }

  /* =====================================================================
     PDF doc definition (GATL)
  ====================================================================== */
  const buildDocDefinitionGATL = (
  title: string,
  logoDataUrl?: string,
  footerDataUrl?: string,
  _ctx?: { refNo?: string; docMLogId?: string },
  app?: Partial<RentalApplication> | any
) =>
  ({
    info: {
      title,
      author: 'InteRealtor',
      subject: 'AGREEMENT TO RENT',
      keywords: 'ATR, InteRealtor, Agreement To Rent',
    },
    pageSize: 'A4',
    
    pageMargins: [25, 75, 25, 95],
    header: (_currentPage: number, _pageCount: number, pageSize: any) => ({
      margin: [40, 20, 40, 10],
      stack: [
        {
          columns: [
            logoDataUrl
              ? { image: 'logo', width: 160, margin: [0, 8, 20, 0] }
              : { text: '', width: 160, margin: [0, 8, 20, 0] },
            { text: '', width: '*' },
            {
              width: '*',
              alignment: 'right',
              table: {
                widths: ['auto'],
                body: [[
                  {
                    text: 'AGREEMENT TO RENT',
                    color: '#fff',
                    bold: true,
                    alignment: 'center',
                    fontSize: 12,
                    margin: [20, 6, 20, 6],
                    fillColor: '#000',
                  },
                ]],
              },
              layout: 'noBorders',
            },
          ],
          columnGap: 2,
        },
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: pageSize.width - 80,
              y2: 0,
              lineWidth: 1,
            },
          ],
          margin: [0, 6, 0, 0],
        },
      ],
    }),
    footer: (_currentPage: number, _pageCount: number, pageSize: any) => ({
      margin: [0, 0, 0, 0],
      stack: [footerDataUrl ? { image: 'footerBanner', width: pageSize.width } : { text: '' }],
    }),
    styles: {
      headerTitle: { fontSize: 14, bold: true },
      headerMeta: { fontSize: 9, color: '#555' },
      h1: { fontSize: 13, bold: true, margin: [0, 8, 0, 8] },
      sectionTitle: { fontSize: 12, bold: true, color: '#1f4f8b', margin: [0, 12, 0, 6] },
      label: { bold: true },
      small: { fontSize: 8, color: '#444' },
      
      listItem: { fontSize: 8, margin: [0, 2, 0, 2] },
      tableHeader: { bold: true, fillColor: '#efefef' },
      /* terms: { fontSize: 11, lineHeight: 1.25 }, */
      terms: { fontSize: 8, lineHeight: 1.1 },
      termsNumber: { fontSize: 8 },
    },
    images: {
      ...(logoDataUrl ? { logo: logoDataUrl } : {}),
      ...(footerDataUrl ? { footerBanner: footerDataUrl } : {}),
    },
    content: [
      oneRowTextRightAlign(`Reference Number : ${_ctx?.refNo ?? ''}`),
      oneRowText(''),
      oneRowText('To Landlord(s),'),
      oneRowText(''),

      oneRowText(
        `Property Type : <u>${app?.PropertyType || ''}</u>      Address : <u>${app?.PropertyAddress || ''}${app?.PropertyPostalCode ? ', ' + app.PropertyPostalCode : ''}${app?.PropertyState ? ', ' + app.PropertyState : ''}</u>`
      ),

      oneRowText(
        `I/we, the undersigned Tenant(s) hereby confirm our intention to rent the Property at a monthly rental of <u>RM ${(Number(app?.AtlRentalAmt || 0)).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}</u> subject to the following terms and conditions: -`
      ),
      oneRowText(''),

      {
        table: {
          widths: ['2%', '48%', '2%', '45%'],
          body: [
            [
              { text: '1.', style: 'termsNumber', margin: [0, 2, 0, 0] },

              {
                table: {
                  widths: ['*', 95],
                  body: [
                    [
                      { text: 'Advance Rental', style: 'terms', border: [false, false, false, false] },
                      {
                        text: `RM ${currency(app?.AtrAdvRentalAmt || 0)}`,
                        style: 'terms',
                        alignment: 'right',
                        border: [false, false, false, false],
                      },
                    ],
                    [
                      { text: 'Security Deposit', style: 'terms', border: [false, false, false, false] },
                      {
                        text: `RM ${currency(app?.AtrSecurityDepositAmt || 0)}`,
                        style: 'terms',
                        alignment: 'right',
                        border: [false, false, false, false],
                      },
                    ],
                    [
                      { text: 'Utility Deposit', style: 'terms', border: [false, false, false, false] },
                      {
                        text: `RM ${currency(app?.AtrUtilityDepositAmt || 0)}`,
                        style: 'terms',
                        alignment: 'right',
                        border: [false, false, false, false],
                      },
                    ],
                    [
                      { text: 'Indah Water', style: 'terms', border: [false, false, false, false] },
                      {
                        text: `RM ${currency(app?.AtrIndahWater || 0)}`,
                        style: 'terms',
                        alignment: 'right',
                        border: [false, false, false, false],
                      },
                    ],
                  ],
                },
                layout: {
                  defaultBorder: false,
                  paddingLeft: () => 0,
                  paddingRight: () => 0,
                  paddingTop: () => 0,
                  paddingBottom: () => 0,
                },
              },

              { text: '', border: [false, false, false, false] },

              {
                table: {
                  widths: ['*', 95],
                  body: [
                    [
                      { text: 'Access Card Deposit', style: 'terms', border: [false, false, false, false] },
                      {
                        text: `RM ${currency(app?.AtrAccessCard || 0)}`,
                        style: 'terms',
                        alignment: 'right',
                        border: [false, false, false, false],
                      },
                    ],
                    [
                      { text: 'Stamping Fees', style: 'terms', border: [false, false, false, false] },
                      {
                        text: `RM ${currency(app?.TenantStampingFees || 0)}`,
                        style: 'terms',
                        alignment: 'right',
                        border: [false, false, false, false],
                      },
                    ],
                    [
                      { text: 'Admin Charges', style: 'terms', border: [false, false, false, false] },
                      {
                        text: `RM ${currency(app?.TenantAdminFeesTotal || 0)}`,
                        style: 'terms',
                        alignment: 'right',
                        border: [false, false, false, false],
                      },
                    ],
                    [
                      { text: '', border: [false, false, false, false] },
                      { text: '', border: [false, false, false, false] },
                    ],
                  ],
                },
                layout: {
                  defaultBorder: false,
                  paddingLeft: () => 0,
                  paddingRight: () => 0,
                  paddingTop: () => 0,
                  paddingBottom: () => 0,
                },
              },
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 0],
      },

      {
  table: {
    widths: ['2%', '49%', '49%'],
    body: [
      [
        { text: '', style: 'termsNumber' },
        {
          text: `Tenancy Period From ${fmtDate(app?.TenancyPeriodFrom || '')} to ${fmtDate(app?.TenancyPeriodTo || '')}`,
          style: 'terms',
          border: [false, false, false, false],
        },
        {
          text: (() => {
            const from = app?.OptionToRenewFrom;
            const to = app?.OptionToRenewTo;
            const hasFrom = from && String(from).trim() !== '';
            if (!hasFrom) return 'Option to Renew : NIL';
            return `Option to Renew From ${fmtDate(from)} to ${fmtDate(to || '')}`;
          })(),
          style: 'terms',
          border: [false, false, false, false],
        }
      ]
    ]
  },
  layout: 'noBorders',
  margin: [0, 0, 0, 0],
},

      contentRow('', ''),
      {
  table: {
    widths: ['2%', '98%'],
    body: [[
      { text: '2', style: 'termsNumber', margin: [0, 0, 0, 0] },
      {
        text: `It is mutually agreed upon by the parties hereby that the following item need to be attended to by the Landlord(s) on/before the ${app?.AttDay} day of ${app?.AttMonth} : -`,
        style: 'terms',
        margin: [0, 0, 0, 0],
      }
    ]]
  },
  layout: {
    defaultBorder: false,
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 0,
    paddingBottom: () => 0,
  },
  margin: [0, 0, 0, 1],
},

{
  table: {
    widths: ['2%', '98%'],
    body: [[
      { text: '', style: 'termsNumber' },
      {
        text: `a. ${app?.SpecialCondition1 || ''}`,
        style: 'terms',
        border: [false, false, false, true],
        margin: [0, 0, 0, 0],
      }
    ]]
  },
  layout: {
    defaultBorder: false,
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 0,
    paddingBottom: () => 0,
  },
  margin: [0, 0, 0, 0],
},

{
  table: {
    widths: ['2%', '98%'],
    body: [[
      { text: '', style: 'termsNumber' },
      {
        text: `b. ${app?.SpecialCondition2 || ''}`,
        style: 'terms',
        border: [false, false, false, true],
        margin: [0, 0, 0, 0],
      }
    ]]
  },
  layout: {
    defaultBorder: false,
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 0,
    paddingBottom: () => 0,
  },
  margin: [0, 0, 0, 0],
},

{
  table: {
    widths: ['2%', '98%'],
    body: [[
      { text: '', style: 'termsNumber' },
      {
        text: `c. ${app?.SpecialCondition3 || ''}`,
        style: 'terms',
        border: [false, false, false, true],
        margin: [0, 0, 0, 0],
      }
    ]]
  },
  layout: {
    defaultBorder: false,
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 0,
    paddingBottom: () => 0,
  },
  margin: [0, 0, 0, 0],
},
      contentRow('', ''),
      contentRow('3.', `Other special condition(s):`),  
      contentRowUnderline('', app?.OtherSpecialCondition || ''),
      contentRow('', ''),
      contentRow(
        '4.',
        `Vacant possession shall be given to the Tenant(s) on/before the <u>${app?.VpDay || ''}</u> day of <u>${app?.VpMonth || ''}</u> AND the Tenant(s) undertakes to sign the tenancy agreement with all necessary payments on/before <u>${app?.VpDay || ''}</u> day of <u>${app?.VpMonth || ''}</u>`
      ),
      contentRow('', ''),
      contentRow(
        '5.',
        `In the event the Tenant shall fail to execute the tenancy agreement within the stipulated time for any reason whatsoever, the Tenant(s) hereby agrees that the Earnest Deposit (as defined under clause 8 herein) shall be fully forfeited by the Landlord(s) as liquidated damages.`
      ),
      contentRow('', ''),
      contentRow(
        '6.',
        'In the event the Landlord(s) accepts this offer by executing this Agreement and later refuses to sign the tenancy agreement within the stipulated time for any reason whatsoever, the Landlord(s) shall refund to the Tenant(s) the Earnest Deposit free of interest together with the sum equivalent to the Earnest Deposit as compensation.'
      ),
      contentRow('', ''),
      contentRow(
        '7.',
        'Notwithstanding the payment and clearance of the cheque for the Earnest Deposit and/or the tenancy agreement pending execution this Agreement shall take effect and constitute a legally binding document between the parties herein upon the execution of this Agreement.'
      ),
      contentRow('', ''),
      contentRow(
        '8.',
        'This Agreement may be executed by the parties herein in any number of counterparts and on separate counterparts. Each counterpart when executed, whether physically or by digital means, shall be deemed to constitute the same effective instrument.'
      ),
      contentRow('', ''),
      oneRowText(
        `I/we hereby pay the sum of <u>RM ${(Number(app?.AtlEdFullAmt || 0)).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}</u> being earnest deposit toward the rental of the property ("Earnest Deposit") to <b>Interealtor Sdn Bhd clients' accounts PBB 321 707 6233</b> as Stakeholder. In the event the Landlord(s) rejects this offer, the Earnest Deposit shall be fully refunded to the Tenant(s) free of interest.`
      ),
            
      contentRow('', ''),
      signatureRow('OFFER', '', '', 'Signed in the presence of'),
      signatureRow('Signed by the Tenant(s)', '', '', ''),
      contentRow('', ''),    
      contentRow('', ''),
      {
        table: {
          widths: ['25%', '25%', '25%', '25%'],
          body: [
            [
              { text: '', style: 'termsNumber' },
              {
                table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] },
                layout: {
                  defaultBorder: false,
                  paddingLeft: () => 20,
                  paddingRight: () => 20,
                  paddingTop: () => 0,
                  paddingBottom: () => 20,
                },
              },
              {
                table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] },
                layout: {
                  defaultBorder: false,
                  paddingLeft: () => 20,
                  paddingRight: () => 20,
                  paddingTop: () => 0,
                  paddingBottom: () => 20,
                },
              },
              {
                table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] },
                layout: {
                  defaultBorder: false,
                  paddingLeft: () => 20,
                  paddingRight: () => 20,
                  paddingTop: () => 0,
                  paddingBottom: () => 20,
                },
              },
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 2],
      },

      signatureRow('NAME', `${application.Tenant1Name}`, `${application.Tenant2Name}`, ''),
      makeFourUnderlineRow('N', 'Y', 'Y', 'Y'),

      signatureRow('NRIC NO', `${application.Tenant1Id}`, `${application.Tenant2Id}`, ''),
      makeFourUnderlineRow('N', 'Y', 'Y', 'Y'),

      signatureRow('SIGNED ON', '', '', ''),
      makeFourUnderlineRow('N', 'Y', 'Y', 'Y'),      
      contentRow('', ''),
      signatureRow('ACCEPTANCE', '', '', 'Signed in the presence of'),
      signatureRow('Signed by the Landlord(s)', '', '', ''),
      
      contentRow('', ''),
      contentRow('', ''),
      {
        table: {
          widths: ['25%', '25%', '25%', '25%'],
          body: [
            [
              { text: '', style: 'termsNumber' },
              {
                table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] },
                layout: {
                  defaultBorder: false,
                  paddingLeft: () => 20,
                  paddingRight: () => 20,
                  paddingTop: () => 0,
                  paddingBottom: () => 20,
                },
              },
              {
                table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] },
                layout: {
                  defaultBorder: false,
                  paddingLeft: () => 20,
                  paddingRight: () => 20,
                  paddingTop: () => 0,
                  paddingBottom: () => 20,
                },
              },
              {
                table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] },
                layout: {
                  defaultBorder: false,
                  paddingLeft: () => 20,
                  paddingRight: () => 20,
                  paddingTop: () => 0,
                  paddingBottom: () => 20,
                },
              },
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 2],
      },
      signatureRow('NAME', `${application.Landlord1Name}`, `${application.Landlord2Name}`, ''),
      makeFourUnderlineRow('N', 'Y', 'Y', 'Y'),

      signatureRow('NRIC NO', `${application.Landlord1Id}`, `${application.Landlord2Id}`, ''),
      makeFourUnderlineRow('N', 'Y', 'Y', 'Y'),

      signatureRow('SIGNED ON', '', '', ''),
      makeFourUnderlineRow('N', 'Y', 'Y', 'Y'),
    ],
  } as any);

  /* =====================================================================
     Upload PDF -> PHP
  ====================================================================== */
  async function uploadPdfBlob(
    pdfBlob: Blob,
    appIdForFile: string,
    docLogId?: string | number,
    filePrefix: 'EATL' | 'GATL' = 'GATL'
  ) {
    if (!docLogId) throw new Error('Missing DocMLogId — cannot upload.');
    const now = new Date();
    const unique =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0') +
      String(now.getMilliseconds()).padStart(3, '0') +
      Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    const filename = `${filePrefix}_${appIdForFile}_${unique}.pdf`;

    const fd = new FormData();
    fd.set('DocMLogId', String(docLogId));
    fd.set('FileName', filename);
    fd.append('imgFile', pdfBlob, filename);

    const postFormData = async (url: string) => {
      const resp = await fetch(url, { method: 'POST', body: fd });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`Upload HTTP ${resp.status} ${resp.statusText}${text ? ` — ${text}` : ''}`);
      }
      const json = await resp.json().catch(() => ({}));
      if (json?.status !== 'success') throw new Error(json?.data || 'Upload failed at server.');
      return json;
    };

    try {
      const server = await postFormData(uploadUrl);
      return { filename, server };
    } catch (err: any) {
      const isTypeError = err?.name === 'TypeError' || /Failed to fetch/i.test(err?.message || '');
      if (isTypeError && uploadProxyUrl) {
        const server = await postFormData(uploadProxyUrl);
        return { filename, server };
      }
      const hint = buildCorsHint('Upload.php', uploadUrl);
      throw new Error(`${err?.message || String(err)}\n\n${hint}`);
    }
  }

  /* =====================================================================
     Preview + IntFormInsert + PDF + Upload (GATL)
  ====================================================================== */
  async function runFullFlowGATL(
    title: string,
    docUid: string,
    docContent: string,
    appSnapshot: Partial<RentalApplication> | any
  ) {
    try {
      setGenerating(true);

      if (!resolvedAppId) {
        alert('Missing ApplicationId. Cannot generate.');
        setGenerating(false);
        return;
      }

      const { refNo: newRefNo, docMLogId: newDocId } = await createFormLog(resolvedAppId, docUid, docContent);
      setRefNo(newRefNo);
      setDocMLogId(newDocId);

      const [pdfMake, logoDataUrl, footerDataUrl] = await Promise.all([
        ensurePdfMakeOnce(),
        assetToDataUrl('/inte-logo.png'),
        assetToDataUrl('/Int_Footer.jpeg'),
      ]);

      const docDefinition = buildDocDefinitionGATL(
        title,
        logoDataUrl,
        footerDataUrl,
        { refNo: newRefNo, docMLogId: newDocId },
        appSnapshot
      );

      const pdf = pdfMake.createPdf(docDefinition);

      pdf.getBlob(async (blob: Blob) => {
        const objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
        setShowPdf(true);

        try {
          await uploadPdfBlob(blob, resolvedAppId, newDocId, 'GATL');
        } catch (e: any) {
          console.error(`[GATL] Failed to upload PDF:`, e);
          alert(e?.message || 'Failed to upload PDF.');
        } finally {
          setGenerating(false);
        }
      });
    } catch (e: any) {
      console.error(`[GATL] Failed to generate PDF:`, e);
      alert(e?.message || 'Failed to generate PDF.');
      setGenerating(false);
    }
  }

  // Build a snapshot that always has the latest values (state overrides > props)
  const buildSnapshot = (): Partial<RentalApplication> & Record<string, any> => ({
    ...application,
    TenancyPeriodFrom: tenancyFrom || application.TenancyPeriodFrom,
    TenancyPeriodTo: tenancyTo || application.TenancyPeriodTo,
    OptionToRenewFrom: renewFrom || application.OptionToRenewFrom || application.RenewPeriodFrom,
    OptionToRenewTo: renewTo || application.OptionToRenewTo || application.RenewPeriodTo,
    AtrAdvRentalAmt: advRental || application.AtrAdvRentalAmt,
    AtrSecurityDepositAmt: securityDeposit || application.AtrSecurityDepositAmt,
    AtrUtilityDepositAmt: utilityDeposit || application.AtrUtilityDepositAmt,
    AtrAccessCard: accessCard || application.AtrAccessCard,
    AtrIndahWater: indahWater || application.AtrIndahWater,
    AtrOtherDepositAmt: otherDeposit || application.AtrOtherDepositAmt,
    AtrOtherDepositRem: atrOtherDepositRem ?? application.AtrOtherDepositRem,
    AttDay: attDay || application.AttDay,
    AttMonth: attMonth || application.AttMonth,
    SpecialCondition1: special1 ?? application.SpecialCondition1,
    SpecialCondition2: special2 ?? application.SpecialCondition2,
    SpecialCondition3: special3 ?? application.SpecialCondition3,
    OtherSpecialCondition: otherSpecial ?? application.OtherSpecialCondition,
    VpDay: vpDay || application.VpDay,
    VpMonth: vpMonth || application.VpMonth,
  });

  const handlePreviewGATL = async () => {
    const snapshot = buildSnapshot();
    await runFullFlowGATL('AGREEMENT TO RENT (ATR)', gatlDocMUid, gatlDocContent1, snapshot);
  };

  /* ---------- Submit to PHP (ATR save) ---------- */
  const handleUpdateATR = async () => {
    if (!resolvedAppId) {
      window.alert('Missing ApplicationId. Please provide it (prop/URL/localStorage).');
      return;
    }
    try {
      setSaving(true);

      const formEl = formRef.current!;
      const fd = new FormData(formEl);
      const val = (name: string, fallback = '') => String(fd.get(name) ?? fallback);

      const fixed = (formEl.querySelector('#fixedTerms') as HTMLInputElement)?.checked;
      const fixedExpat = (formEl.querySelector('#fixedTermsExpat') as HTMLInputElement)?.checked;
      const nonFixed = (formEl.querySelector('#nonFixedTerms') as HTMLInputElement)?.checked;

      const m1 = toNumString(val('FixedTermsMonths', months1 || '0'));
      const m2 = toNumString(val('FixedTermsExpatMonths', months2 || '0'));
      const m3 = toNumString(val('NonFixedTermsMonths', months3 || '0'));

      const selectedOpts: string[] = [];
      const selectedMonths: string[] = [];

      if (fixed) { selectedOpts.push('1'); selectedMonths.push(m1 || '0'); }
      if (fixedExpat) { selectedOpts.push('2'); selectedMonths.push(m2 || '0'); }
      if (nonFixed) { selectedOpts.push('3'); selectedMonths.push(m3 || '0'); }

      const TenancyTermsOption = selectedOpts.join(',');
      const TenancyTermsOption1Mths = selectedMonths.join(',');

      const pInter = (formEl.querySelector('#payableToInterealtor') as HTMLInputElement)?.checked;
      const pOther = (formEl.querySelector('#payableToOther') as HTMLInputElement)?.checked;
      let PayableToOption = '';
      let PayableToText = '';
      if (pInter) {
        PayableToOption = 'Interealtor';
        PayableToText = 'InteRealtor Sdn Bhd (Clients` Acc - PBB 32 1707 6233)';
      } else if (pOther) {      
        PayableToOption = 'Other';
        PayableToText = val('PayableToOtherText', '');
      }

      const body = new URLSearchParams();

      body.set('ApplicationId', resolvedAppId);
      body.set('TenancyPeriodFrom', tenancyFrom);
      body.set('TenancyPeriodTo', tenancyTo);
      body.set('OptionToRenewFrom', renewFrom);
      body.set('OptionToRenewTo', renewTo);
      body.set('TenancyPeriodTotalPeriod', tenancyTotalPeriodStr);


      body.set('AttDay', attDay);
      body.set('AttMonth', attMonth);
      body.set('SpecialCondition1', special1);
      body.set('SpecialCondition2', special2);
      body.set('SpecialCondition3', special3);
      body.set('OtherSpecialCondition', otherSpecial);

      body.set('VpDay', vpDay);
      body.set('VpMonth', vpMonth);
      body.set('VpStampDutyAmt', toNumString(vpStampDutyAmt));
      body.set('VpStampDutyPaidBy', vpStampDutyPaidBy);
      body.set('VpAdminChargesAmt', toNumString(vpAdminChargesAmt));
      body.set('VpAdminChargesPaidBy', vpAdminChargesPaidBy);

      body.set('AtrEdFullAmt', toNumString(val('AtrEdFullAmt', '0')));
      body.set('AtrPaymentType', val('AtrPaymentType'));

      body.set('PayableToText', PayableToText);

      body.set('TenancyTermsOption1', fixed ? 'Y' : 'N');
      body.set('TenancyTermsOption2', fixedExpat ? 'Y' : 'N');
      body.set('TenancyTermsOption3', nonFixed ? 'Y' : 'N');

      body.set('TenancyTermsOption1Mths', fixed ? m1 : '0');
      body.set('TenancyTermsOption2Mths', fixedExpat ? m2 : '0');
      body.set('TenancyTermsOption3Mths', nonFixed ? m3 : '0');

      body.set('PayableToOption', PayableToOption);

      body.set('AtrAdvRentalAmt', toNumString(advRental));
      body.set('AtrSecurityDepositAmt', toNumString(securityDeposit));
      body.set('AtrUtilityDepositAmt', toNumString(utilityDeposit));
      body.set('AtrAccessCard', toNumString(accessCard));
      body.set('AtrIndahWater', toNumString(indahWater));
      body.set('AtrOtherDepositAmt', toNumString(otherDeposit));
      body.set('AtrOtherDepositRem', atrOtherDepositRem);

      const res = await fetch(API_ENDPOINTS.INT_APPLICATION_ATR_SET, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (json?.status === 'success') {
        await onRefresh?.();
        window.alert(json?.data || 'ATR details updated successfully.');
      } else {
        window.alert(json?.data || json?.message || 'ATR details update FAILED. Please try again.');
      }
    } catch (e: any) {
      console.error('ATR update error:', e);
      window.alert(e?.message || 'Failed to update ATR details.');
    } finally {
      setSaving(false);
    }
  };

  /* ============================== UI ============================== */
  return (
    <>
      <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
        {/* Header */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full bg-gray-400 hover:bg-gray-500 text-white px-6 py-4 flex items-center justify-between cursor-pointer select-none rounded-xl transition-colors"
        >
          <div className="flex items-center space-x-2">
            <ScrollText className="w-5 h-5" />
            <h2 className="text-lg font-semibold">AGREEMENT TO RENT (ATR)</h2>
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="p-6 bg-gray-50">
            <form ref={formRef} className="space-y-3">
              {/* Tenancy Period */}
              <div className="flex flex-col md:flex-row md:items-center md:flex-wrap gap-3 md:gap-2 text-blue-900 text-left">
                <div className="text-sm font-medium text-black md:mb-0">
                  Tenancy Period from
                </div>
            
                <div>
                  <input
                    type="date"
                    lang="en-GB"
                    value={tenancyFrom}
                    onChange={(e) => setTenancyFrom(e.target.value)}
                    disabled={disabledAll}
                    className="w-full md:w-auto px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  />
                </div>
            
                <div className="font-medium text-black">
                  to
                </div>
            
                <div>
                  <input
                    type="date"
                    lang="en-GB"
                    value={tenancyTo}
                    onChange={(e) => setTenancyTo(e.target.value)}
                    disabled={disabledAll}
                    className="w-full md:w-auto px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  />
                </div>
            
                <div className="font-medium text-blue-800">
                  :
                </div>
            
                <div className="font-medium text-blue-900">
                  {tenancyDur.totalDays > 0
                    ? `${tenancyDur.months} month(s), ${tenancyDur.days} day(s)`
                    : '—'}
                </div>
              </div>

              {/* Renew Period */}
              <div className="flex flex-col md:flex-row md:items-center md:flex-wrap gap-3 md:gap-2 text-green-900 text-left">
                <div className="text-sm font-medium text-black">
                  Renew Period from
                </div>
            
                <div>
                  <input
                    type="date"
                    lang="en-GB"
                    value={renewFrom}
                    onChange={(e) => setRenewFrom(e.target.value)}
                    disabled={disabledAll}
                    className="w-full md:w-auto px-3 py-2 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                  />
                </div>
            
                <div className="font-medium text-black">
                  to
                </div>
            
                <div>
                  <input
                    type="date"
                    lang="en-GB"
                    value={renewTo}
                    onChange={(e) => setRenewTo(e.target.value)}
                    disabled={disabledAll}
                    className="w-full md:w-auto px-3 py-2 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                  />
                </div>
            
                <div className="font-medium text-green-800">
                  :
                </div>
            
                <div className="font-medium text-green-900">
                  {renewDur.totalDays > 0
                    ? `${renewDur.months} month(s), ${renewDur.days} day(s)`
                    : '—'}
                </div>
              </div>

              {/* Terms Option */}                               
                <div className="flex flex-col md:flex-row md:items-center md:flex-wrap gap-4 md:gap-6 mb-6">
                  <div className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                    Terms Option :
                  </div>
                
                  {/* Fixed Terms */}
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <input
                      type="checkbox"
                      id="fixedTerms"
                      checked={opt1}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setOpt1(checked);
                        if (!checked) setMonths1('0');
                      }}
                      disabled={disabledAll}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="fixedTerms" className="text-sm font-medium text-gray-700">
                      Fixed Terms
                    </label>
                    <input
                      name="FixedTermsMonths"
                      type="number"
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                      value={months1}
                      onChange={(e) => setMonths1(toNumString(e.target.value) || '0')}
                      min={0}
                      disabled={disabledAll || !opt1}
                    />
                    <span className="text-sm text-gray-600">mth(s)</span>
                  </div>
                
                  {/* Fixed Terms with Expat */}
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <input
                      type="checkbox"
                      id="fixedTermsExpat"
                      checked={opt2}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setOpt2(checked);
                        if (!checked) setMonths2('0');
                      }}
                      disabled={disabledAll}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="fixedTermsExpat" className="text-sm font-medium text-gray-700">
                      Fixed Terms with Expat
                    </label>
                    <input
                      name="FixedTermsExpatMonths"
                      type="number"
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                      value={months2}
                      onChange={(e) => setMonths2(toNumString(e.target.value) || '0')}
                      min={0}
                      disabled={disabledAll || !opt2}
                    />
                    <span className="text-sm text-gray-600">mth(s)</span>
                  </div>
                
                  {/* Non Fixed Terms */}
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <input
                      type="checkbox"
                      id="nonFixedTerms"
                      checked={opt3}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setOpt3(checked);
                        if (!checked) setMonths3('0');
                      }}
                      disabled={disabledAll}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="nonFixedTerms" className="text-sm font-medium text-gray-700">
                      Non Fixed Terms
                    </label>
                    <input
                      name="NonFixedTermsMonths"
                      type="number"
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                      value={months3}
                      onChange={(e) => setMonths3(toNumString(e.target.value) || '0')}
                      min={0}
                      disabled={disabledAll || !opt3}
                    />
                    <span className="text-sm text-gray-600">mth(s)</span>
                  </div>
                </div>

                {/* Item(s) need to be attended by Landlord */}
                <div className="mb-6">
                  <div className="flex flex-col md:flex-row md:items-center md:flex-wrap gap-3 md:gap-2">
                    <h4 className="text-black font-medium mb-0 text-sm font-medium">


                      

                      
                      Item(s) need to be attended by Landlord.
                    </h4>
                
                    <div className="text-sm font-medium text-gray-700">
                      Attended
                    </div>
                
                    <div className="text-sm font-medium text-gray-700">
                      Day
                    </div>
                
                    <select
                      name="AttDay"
                      value={attDay}
                      onChange={(e) => setAttDay(e.target.value)}
                      disabled={disabledAll}
                      className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select day</option>
                      {Array.from({ length: 30 }, (_, i) => `${i + 1}${['st','nd','rd'][i] || 'th'}`).map(n => (
                        <option key={n} value={String(n)}>{n}</option>
                      ))}
                    </select>
                
                    <div className="text-sm font-medium text-gray-700">
                      Month
                    </div>
                
                    <select
                      name="AttMonth"
                      value={attMonth}
                      onChange={(e) => setAttMonth(e.target.value)}
                      disabled={disabledAll}
                      className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select month</option>
                      {["January","February","March","April","May","June","July","August","September","October","November","December"].map(n => (
                        <option key={n} value={String(n)}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Special Conditions */}
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4 items-center">
                      <label className="text-sm font-medium text-gray-700 md:col-span-1">
                        Special Condition 1
                      </label>
                      <textarea
                        name="SpecialCondition1"
                        rows={1}
                        value={special1}
                        onChange={(e) => setSpecial1(e.target.value)}
                        disabled={disabledAll}
                        className="w-full md:col-span-3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4 items-center">
                      <label className="text-sm font-medium text-gray-700 md:col-span-1">
                        Special Condition 2
                      </label>
                      <textarea
                        name="SpecialCondition2"
                        rows={1}
                        value={special2}
                        onChange={(e) => setSpecial2(e.target.value)}
                        disabled={disabledAll}
                        className="w-full md:col-span-3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4 items-center">
                      <label className="text-sm font-medium text-gray-700 md:col-span-1">
                        Special Condition 3
                      </label>
                      <textarea
                        name="SpecialCondition3"
                        rows={1}
                        value={special3}
                        onChange={(e) => setSpecial3(e.target.value)}
                        disabled={disabledAll}
                        className="w-full md:col-span-3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4 items-center">
                      <label className="text-sm font-medium text-gray-700 md:col-span-1">
                        Others
                      </label>
                      <textarea
                        name="OtherSpecialCondition"
                        rows={1}
                        value={otherSpecial}
                        onChange={(e) => setOtherSpecial(e.target.value)}
                        placeholder="Enter other special conditions..."
                        disabled={disabledAll}
                        className="w-full md:col-span-3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

              {/* Delivery Of Possession */}
              <div className="flex flex-col md:flex-row md:items-center md:flex-wrap gap-3 md:gap-2 text-left mb-4">
  <h4 className="text-sm text-black font-medium mb-0">

    
    
    Delivery Of Possession : Day
  </h4>

  <select
    name="VpDay"
    value={vpDay}
    onChange={(e) => setVpDay(e.target.value)}
    disabled={disabledAll}
    className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
  >
    <option value="">Select day</option>
    {Array.from({ length: 30 }, (_, i) => `${i + 1}${['st', 'nd', 'rd'][i] || 'th'}`).map(n => (
      <option key={n} value={String(n)}>{n}</option>
    ))}
  </select>

  <div className="text-black font-medium text-sm">
    
    Month
  </div>

  <select
    name="VpMonth"
    value={vpMonth}
    onChange={(e) => setVpMonth(e.target.value)}
    disabled={disabledAll}
    className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
  >
    <option value="">Select month</option>
    {["January","February","March","April","May","June","July","August","September","October","November","December"].map(n => (
      <option key={n} value={String(n)}>{n}</option>
    ))}
  </select>
</div>

              {/* Buttons */}
              <div className="mt-6 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={handleUpdateATR}
                  disabled={disabledAll || saving}
                  className={`bg-green-600 text-white px-6 py-2 rounded-lg transition-colors font-medium ${(disabledAll || saving) ? 'opacity-60 cursor-not-allowed' : 'hover:bg-green-700'}`}
                >
                  {saving ? 'Saving…' : 'UPDATE ATR DETAILS'}
                </button>

                <button
                  type="button"
                  onClick={handlePreviewGATL}
                  disabled={disabledAll || generating}
                  className={`bg-red-600 text-white px-6 py-2 rounded-lg transition-colors font-medium ${(disabledAll || generating) ? 'opacity-60 cursor-not-allowed' : 'hover:bg-red-700'}`}
                >
                  {generating ? 'Generating…' : 'GENERATE ATR'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Modal PDF Viewer */}
      {showPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white w-[90vw] h-[90vh] rounded-lg overflow-hidden shadow-xl relative">
            <div className="absolute top-2 right-2 flex gap-2">
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  download={`${refNo || 'document'}.pdf`}
                  className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-500"
                >
                  Download
                </a>
              )}
              <button onClick={closePdf} className="bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700">
                Close
              </button>
            </div>
            {pdfUrl ? (
              <iframe title="PDF Preview" src={pdfUrl} className="w-full h-full border-0" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-600">Preparing PDF…</div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ATRSection;
