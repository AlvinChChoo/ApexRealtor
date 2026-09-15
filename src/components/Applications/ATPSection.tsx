import { API_ENDPOINTS } from '../../config/apiConfig';
// ATPSection.tsx
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
const fmtDate = (iso: string) => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso || '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return iso || '';
  }
};




function toNumString(x: string) {
  const cleaned = (x || '').replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned || '0';
}

// Builds on your existing numberToWords (0–99)
function numberToWordsUpTo999(n: number) {
  if (n < 100) return numberToWords(n);
  const ones = ['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine'];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return `${ones[hundreds]} Hundred${rest ? ' and ' + numberToWords(rest) : ''}`;
}

function numberToWordsLarge(n: number) {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const scales: Array<[string, number]> = [
    ['Billion', 1_000_000_000],
    ['Million', 1_000_000],
    ['Thousand', 1_000],
  ];
  for (const [label, value] of scales) {
    const chunk = Math.floor(n / value) % 1000;
    if (chunk) parts.push(`${numberToWordsUpTo999(chunk)} ${label}`);
  }
  const remainder = n % 1000;
  if (remainder) parts.push(numberToWordsUpTo999(remainder));
  return parts.join(' ');
}


// --- NEW helper for spelling months like "Nine"
function spellOutInt(val: any): string {
  const n = parseInt(String(val ?? 0), 10);
  if (isNaN(n) || n <= 0) return '';
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen', 'Twenty', 'Twenty-one', 'Twenty-two',
    'Twenty-three', 'Twenty-four', 'Twenty-five', 'Twenty-six', 'Twenty-seven',
    'Twenty-eight', 'Twenty-nine', 'Thirty', 'Thirty-one', 'Thirty-two',
    'Thirty-three', 'Thirty-four', 'Thirty-five', 'Thirty-six'
  ];
  return ones[n] || String(n);
}


function numberToWords(n: number) {
  const ones = ['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  if (n < 20) return ones[n] || '';
  return n % 10 === 0 ? tens[n / 10] : `${tens[Math.floor(n / 10)]}-${ones[n % 10]}`;
}


function formatAmountWithWords(val?: string | number) {
  const numStr = toNumString(String(val ?? '0'));
  const num = parseFloat(numStr);
  if (isNaN(num)) return { formatted: '', words: '' };

  const formatted = num.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const [ringgitPart, senPart] = formatted.split('.');
  const ringgitNum = parseInt((ringgitPart || '0').replace(/,/g, ''), 10) || 0;
  const senNum = parseInt(senPart || '0', 10) || 0;

  let words = `Ringgit Malaysia ${numberToWordsLarge(ringgitNum)}`;
  if (senNum > 0) {
    words += ` and ${numberToWords(senNum)} Sen`;
  }
  words += ' Only';

  return { formatted, words };
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
function calcMonthsDays(fromISO?: string, toISO?: string) {
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

/* ---------- Props ---------- */
interface ATPSectionProps {
  application: RentalApplication;
  onRefresh?: () => Promise<void> | void; // parent silent refresh
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
  gatlDocMUid?: string;     // GATL Document UID
  gatlDocContent1?: string; // 'AUTHORISATION TO RENT (ATR)'

  /** Unused here, kept for parity */
  docMUid?: string;
  docContent1?: string;
}

const ATPSection: React.FC<ATPSectionProps> = ({
  application,
  formatCurrency,
  formatDate,
  applicationId,
  applicationRaw,

  insertUrl = API_ENDPOINTS.INT_FORM_INSERT,
  insertProxyUrl,
  uploadUrl = API_ENDPOINTS.UPLOAD,
  uploadProxyUrl,

  gatlDocMUid = '149E7E30-A22D-487F-927C-B067D3C31260',
  gatlDocContent1 = 'AGREEMENT TO PURCHASE (ATP)',

  docMUid,
  docContent1,

  onRefresh, // 🔑 we will call this after saving
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // ===== Existing ATR state (controlled) =====
  const [advRental, setAdvRental] = useState<string>('');
  const [securityDeposit, setSecurityDeposit] = useState<string>('');
  const [utilityDeposit, setUtilityDeposit] = useState<string>('');
  const [executeSpaWithinDays, setExecuteSpaWithinDays] = useState(
  application?.ExecuteSpaWithinDays ? String(application.ExecuteSpaWithinDays) : '14'
);
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


    setExecuteSpaWithinDays(
  application?.ExecuteSpaWithinDays ? String(application.ExecuteSpaWithinDays) : '14'
);
    
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

  // Terms option state
  const [termsOption, setTermsOption] = useState<number>(
    Number(application?.TenancyTermsOption) || 0
  );
  const [termsMonths, setTermsMonths] = useState<string>(
    String(application?.TenancyTermsOption1Mths ?? '0')
  );
  useEffect(() => {
    const opt = Number(application?.TenancyTermsOption);
    const mths = application?.TenancyTermsOption1Mths;
    setTermsOption([1, 2, 3].includes(opt) ? opt : 0);
    setTermsMonths(String(mths ?? '0'));
  }, [application?.TenancyTermsOption, application?.TenancyTermsOption1Mths]);

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

  // NEW local state for Payment Terms visuals
  const [balanceWithinMonths, setBalanceWithinMonths] = useState(
    application.Atp90PctgBalPaidWithinNo ? String(application.Atp90PctgBalPaidWithinNo) : '1'
  );

  const [withinFromDate, setWithinFromDate] = useState(
    application.WithinFromDate ?? 'Execution of the SPA'
  );

  const [extensionMonths, setExtensionMonths] = useState('1');
  const [unpaidInterestRate, setUnpaidInterestRate] = useState('10');

  const [refNo, setRefNo] = useState(''); // returned by IntFormInsert
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
        widths: ['25%', '70%', '5%'],
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
        widths: ['5%', '95%'],
        body: [[
          { text: num, style: 'termsNumber' },
          {
            stack: [{ text: htmlToPdfmakeLite(valueHtml), style: 'terms' }],
            border: [false, false, false, true],
            margin: [0, 5, 0, -2],
          }
        ]],
      },
      layout: {
        defaultBorder: false,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 2,
        paddingBottom: () => 0,
      },
    };
  }

  function contentRow(num: string, valueHtml: string) {
    return {
      ...depositRowBase,
      table: {
        widths: ['5%', '95%'],
        heights: (_row: number) => 8,
        body: [[
          { text: num, style: 'termsNumber' },
          { text: htmlToPdfmakeLite(valueHtml), style: 'terms' }
        ]]
      }
    };
  }

  function signatureRow(value1: string,value2: string,value3: string,value4: string) {
    return {
      ...depositRowBase,
      table: {
        widths: ['25%', '25%', '25%', '25%'],
        heights: (_row: number) => 8,
        body: [[
          { text: value1, style: 'termsNumber' },
          { text: value2, style: 'termsNumber' },
          { text: value3, style: 'termsNumber' },
          { text: value4, style: 'termsNumber' },
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
        body: [[{ text: htmlToPdfmakeLite(valueHtml), style: 'terms' }]]
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
        subject: 'Agreement to Purchase',
        keywords: 'ATP, InteRealtor',
      },
      pageSize: 'A4',
      
      pageMargins: [25, 75, 25, 95],
header: (_currentPage: number, _pageCount: number, pageSize: any) => ({
  margin: [25, 20, 25, 10],
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
            body: [[{
              text: 'AGREEMENT TO PURCHASE',
              color: '#fff',
              bold: true,
              alignment: 'center',
              fontSize: 12,
              margin: [20, 6, 20, 6],
              fillColor: '#000',
            }]],
          },
          layout: 'noBorders',
        },
      ],
      columnGap: 2,
    },
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: pageSize.width - 80, y2: 0, lineWidth: 1 }],
      margin: [0, 6, 0, 0],
    },
  ],
}),
      
      footer: (_currentPage: number, _pageCount: number, pageSize: any) => ({
        
        margin: [25, 10, 25, 10],
        stack: [footerDataUrl ? { image: 'footerBanner', width: pageSize.width } : { text: '' }]
      }),
      styles: {
        headerTitle: { fontSize: 13, bold: true },
        headerMeta: { fontSize: 8, color: '#555' },
        h1: { fontSize: 11, bold: true, margin: [0, 8, 0, 8] },
        sectionTitle: { fontSize: 11, bold: true, color: '#1f4f8b', margin: [0, 12, 0, 6] },
        label: { bold: true },
        small: { fontSize: 9, color: '#444' },
        
        terms: { fontSize: 8, lineHeight: 1.1 },
        listItem: { fontSize: 8, margin: [0, 2, 0, 2] },
        tableHeader: { bold: true, fillColor: '#efefef' },
        termsNumber: { fontSize: 8 }
      },
      images: {
        ...(logoDataUrl ? { logo: logoDataUrl } : {}),
        ...(footerDataUrl ? { footerBanner: footerDataUrl } : {}),
      },
      content: [
        oneRowTextRightAlign(`Reference Number : ${_ctx?.refNo ?? ''}`),
        oneRowText(''),
        oneRowText('To Vendor(s),'),
        oneRowText(''),     
       oneRowText(
  `Property Type : <u>${app?.PropertyStoreyDesc || ''}  ${app?.PropertyType || ''}</u>      Address : <u>${[
    app?.PropertyAddress,
    app?.PropertyPostalCode,
    app?.PropertyLocation,
    app?.PropertyState,
  ]
    .filter(Boolean)
    .join(', ')}</u>`
),
        oneRowText(''),
clauseRow2Col(
  '25%',
  '75%',
  '1.      PURCHASE PRICE',
  ((f) =>
    `<u>RM ${f.formatted} (${f.words})</u>`
  )(formatAmountWithWords(app?.AtlRentalAmt))
),



        clauseRow2Col('3%', '97%', '', `I/We, the undersigned Purchaser(s) have viewed the above mentioned Property, we hereby confirm our intention to purchase the same at a price as stated above with the following terms and conditions:`),


//clauseRow2Col('25%', '75%', '2', `PAYMENT TERMS`),



clauseRow2Col('3%', '97%', '2.', `PAYMENT TERMS - Payment of the Purchase Price shall be made in the following manner :-`),
          
clauseRow2Col('3%','97%','',
  `a) <u>RM ${formatAmountWithWords(app?.AtlEdFullAmt).formatted} (${formatAmountWithWords(app?.AtlEdFullAmt).words})</u> being Earnest Deposit upon signing of this Agreement To Purchase.`
),

clauseRow2Col('3%', '97%', '', `b). 10% (ten percent) less the Earnest Deposit, to be paid upon signing of the formal Sale & Purchase Agreement ("SPA")`),

        // --- FIXED: show both numeric and spelled-out month count
(() => {
  const monthsNum = Number(application?.Atp90PctgBalPaidWithinNo || 0);
  const monthsWord = spellOutInt(monthsNum);
  return clauseRow2Col(
    '3%',
    '97%',
    '',
    `c). 90% (ninety percent) being the balance Purchase Price to be paid within ${monthsNum} (${monthsWord}) months from date of ${app?.WithinFromDate}, whichever is the later and applicable`
  );
})(),


clauseRow2Col(
  '3%',
  '97%',
  '',
  `d). Upon the expiry of the period stipulated in clause 2c, to grant an extension period of ${application?.ExtensionMonths} (${numberToWords(parseInt(application?.ExtensionMonths || '0', 10))}) months on the unpaid balance sum at an interest rate of ${application?.UnpaidInterestRate}% (${numberToWords(parseInt(application?.UnpaidInterestRate || '0', 10))} percent) per annum calculated on a daily basis.`
),

clauseRow2Col('3%','97%','3','DELIVERY OF POSSESSION'),
clauseRow2Col('3%','97%','',`${app?.DeliveryOfPossessionWord}`),



    
clauseRow2Col('3%', '97%', '4','EXECUTION'),


clauseRow2Col('3%', '97%', '', `a). The Purchaser(s) hereby undertake to execute the SPA within ${application.ExecuteSpaWithinDays} working days(the Said Period) from the date of acceptance of this offer by the Vendor(s) provided that there is no delay on the part of the Vendor(s) or Vendor's lawyer in agreeing to the terms and conditions of the SPA failing which the said Earnest Deposit (as defined under Clause 7 herein) shall be forfeited by the Vendor(s) as agreed liquidated damages PROVIDED ALWAYS that the non-execution by the Purchaser(s) is not caused or attributable to the Vendor's misrepresentation, misconduct and/or fraudulent acts. Thereinafter this agreement shall be terminated and be null and void and neither party shall have any further claims against each other`),


        
//  clauseRow2Col('25%', '75%', '', `b). In the event that the Purchaser(s) have executed the SPA and the Vendor(s) shall         
clauseRow2Col('3%', '97%', '', `b). In the event that the Purchaser(s) have executed the SPA and the Vendor(s) shall fail to execute the same within the Said Period,the Purchaser(s) shall be entitled to the relief of specific performance. In the alternative, the Purchaser(s) shall elect for the refund by the Vendor(s) of the said Earnest Deposit together with an additional sum equivalent to the Earnest Deposit as agreed liquidated damages and upon such refund this Agreement shall be terminated and neither party shall have no further claims against one another.`),




        
        
clauseRow2Col('3%', '97%', '5.', `Notwithstanding the payment and clearance of the cheque for the said Earnest Deposit, this Agreement to Purchase shall only take effect upon the signing of this Agreement by the Vendor(s) and the Purchaser(s) and notwithstanding that the SPA execution is pending, this Agreement to Purchase shall constitute a legal binding document between the parties herein.`),
        (
  application?.DeliveryOfPossessionOption == '2'
    ? clauseRow2Col(
        '3%',
        '97%',
        '6.',
        `The Said Property shall be sold on an As Is Where Is Basis : with non-vacant possession subject to existing tenancy upon full settlement of the balance Purchase Price`
      )
    : clauseRow2Col(
        '3%',
        '97%',
        '6.',
        `The Said Property shall be sold on an As Is Where Is Basis : with vacant possession to be given upon full settlement of the balance Purchase Price`
      )
),

clauseRow2Col('3%', '97%', '7.', `OTHER Special Conditions, subject to the inventory list as per annexure (if any) : ` + application?.OtherSpecialCondition),
        
clauseRow2Col('3%', '97%', '8.', `This Agreement may be executed by the parties herein in any number of counterpart and on separate counterpart. Each counterpart when executed, whether physically or by digital means, shall be deemed to constitute the same effective instrument.`),    
        // Signature block (safe optional chaining)
        {
          table: { widths: ['25%', '25%', '25%', '25%'], body: [[{ text: 'Signed by the Purchaser(s)', style: 'termsNumber' }, { text: '', style: 'termsNumber' }, { text: '', style: 'termsNumber' }, { text: 'Signed in the presence of', style: 'termsNumber' }]] },
          layout: 'noBorders',
          margin: [0, 0, 0, 2],
        },              
        
        clauseRow2Col('5%', '95%', '', ``),
        {
          table: {
            widths: ['25%', '25%', '25%', '25%'],
            body: [[
              { text: '', style: 'termsNumber' },
              { table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 20, paddingRight: () => 20, paddingTop: () => 0, paddingBottom: () => 20 } },
              { table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 20, paddingRight: () => 20, paddingTop: () => 0, paddingBottom: () => 20 } },
              { table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 20, paddingRight: () => 20, paddingTop: () => 0, paddingBottom: () => 20 } },
            ]]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 2],
        },       
        {
          table: {
            widths: ['25%', '25%', '25%', '25%'],
            body: [[
              { text: 'NAME', style: 'termsNumber' },
              { table: { widths: ['*'], body: [[{ text: ' ' + (application?.Tenant1Name ?? ''), style: 'termsNumber', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 } },
              { table: { widths: ['*'], body: [[{ text: ' ' + (application?.Tenant2Name ?? ''), style: 'termsNumber', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 } },
              { table: { widths: ['*'], body: [[{ text: '  ', style: 'termsNumber', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 } },
            ]]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 0],
        },
        {
          table: {
            widths: ['25%', '25%', '25%', '25%'],
            body: [[
              { text: 'NRIC NO', style: 'termsNumber' },
              { table: { widths: ['*'], body: [[{ text: ' ' + (application?.Tenant1Id ?? ''), style: 'termsNumber', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 } },
              { table: { widths: ['*'], body: [[{ text: ' ' + (application?.Tenant2Id ?? ''), style: 'termsNumber', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 } },
              { table: { widths: ['*'], body: [[{ text: '  ', style: 'termsNumber', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 } },
            ]]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 2],
        },
        {
          table: {
            widths: ['25%', '25%', '25%', '25%'],
            body: [[
              { text: 'SIGNED ON', style: 'termsNumber' },
              { table: { widths: ['*'], body: [[{ text: ' ', style: 'termsNumber', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 } },
              { table: { widths: ['*'], body: [[{ text: ' ', style: 'termsNumber', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 } },
              { table: { widths: ['*'], body: [[{ text: ' ', style: 'termsNumber', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 } },
            ]]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 2],
        },
                
        contentRow('',''),
        
                {
          table: { widths: ['25%', '25%', '25%', '25%'], body: [[{ text: 'Signed by the Vendor(s)', style: 'termsNumber' }, { text: '', style: 'termsNumber' }, { text: '', style: 'termsNumber' }, { text: 'Signed in the presence of', style: 'termsNumber' }]] },
          layout: 'noBorders',
          margin: [0, 0, 0, 2],
        },              
        
        clauseRow2Col('5%', '95%', '', ``),
        {
          table: {
            widths: ['25%', '25%', '25%', '25%'],
            body: [[
              { text: '', style: 'termsNumber' },
              { table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 20, paddingRight: () => 20, paddingTop: () => 0, paddingBottom: () => 20 } },
              { table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 20, paddingRight: () => 20, paddingTop: () => 0, paddingBottom: () => 20 } },
              { table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 20, paddingRight: () => 20, paddingTop: () => 0, paddingBottom: () => 20 } },
            ]]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 2],
        },       
        {
          table: {
            widths: ['25%', '25%', '25%', '25%'],
            body: [[
              { text: 'NAME', style: 'termsNumber' },
              { table: { widths: ['*'], body: [[{ text: ' ' + (application?.Landlord1Name ?? ''), style: 'termsNumber', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 } },
              { table: { widths: ['*'], body: [[{ text: ' ' + (application?.Landlord2Name ?? ''), style: 'termsNumber', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 } },
              { table: { widths: ['*'], body: [[{ text: '  ', style: 'termsNumber', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 } },
            ]]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 0],
        },
        {
          table: {
            widths: ['25%', '25%', '25%', '25%'],
            body: [[
              { text: 'NRIC NO', style: 'termsNumber' },
              { table: { widths: ['*'], body: [[{ text: ' ' + (application?.Landlord1Id ?? ''), style: 'termsNumber', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 } },
              { table: { widths: ['*'], body: [[{ text: ' ' + (application?.Landlord2Id ?? ''), style: 'termsNumber', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 } },
              { table: { widths: ['*'], body: [[{ text: '  ', style: 'termsNumber', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 } },
            ]]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 2],
        },
        {
          table: {
            widths: ['25%', '25%', '25%', '25%'],
            body: [[
              { text: 'SIGNED ON', style: 'termsNumber' },
              { table: { widths: ['*'], body: [[{ text: ' ', style: 'termsNumber', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 } },
              { table: { widths: ['*'], body: [[{ text: ' ', style: 'termsNumber', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 } },
              { table: { widths: ['*'], body: [[{ text: ' ', style: 'termsNumber', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 } },
            ]]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 2],
        },        
      ],
    } as any);

  function clauseRow2Col(param1: any, param2: any, param3: any, param4: string) {
    return {
      table: {
        widths: [param1, param2],
        body: [[
          { text: String(param3), style: 'termsNumber' },
          { text: htmlToPdfmakeLite(param4), style: 'terms',alignment:'justify' }
        ]]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 0],
    };
  }

  function clauseRow3Col(size1: any, size2: any, size3: any,
                         str1: string, str2: string, str3: string) {
    return {
      table: {
        widths: [size1, size2, size3],
        body: [[
          { text: String(str1), style: 'termsNumber' },
          { text: htmlToPdfmakeLite(str2), style: 'terms' },
          { text: htmlToPdfmakeLite(str3), style: 'terms' },
        ]]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, -3],
    };
  }
  
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

      // Create log (RefNo + DocMLogId)
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
        appSnapshot // ⬅️ use latest values (state merged with props)
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
    // tenancy/renew
    TenancyPeriodFrom: tenancyFrom || application.TenancyPeriodFrom,
    TenancyPeriodTo: tenancyTo || application.TenancyPeriodTo,
    OptionToRenewFrom: renewFrom || application.OptionToRenewFrom || application.RenewPeriodFrom,
    OptionToRenewTo: renewTo || application.OptionToRenewTo || application.RenewPeriodTo,
    // deposits/amounts
    AtrAdvRentalAmt: advRental || application.AtrAdvRentalAmt,
    AtrSecurityDepositAmt: securityDeposit || application.AtrSecurityDepositAmt,
    AtrUtilityDepositAmt: utilityDeposit || application.AtrUtilityDepositAmt,
    AtrAccessCard: accessCard || application.AtrAccessCard,
    AtrIndahWater: indahWater || application.AtrIndahWater,
    AtrOtherDepositAmt: otherDeposit || application.AtrOtherDepositAmt,
    AtrOtherDepositRem: atrOtherDepositRem ?? application.AtrOtherDepositRem,
    // attended + special conditions
    AttDay: attDay || application.AttDay,
    AttMonth: attMonth || application.AttMonth,
    SpecialCondition1: special1 ?? application.SpecialCondition1,
    SpecialCondition2: special2 ?? application.SpecialCondition2,
    SpecialCondition3: special3 ?? application.SpecialCondition3,
    OtherSpecialCondition: otherSpecial ?? application.OtherSpecialCondition,
    // delivery of possession
    VpDay: vpDay || application.VpDay,
    VpMonth: vpMonth || application.VpMonth,
  });

  const handlePreviewGATL = async () => {
    const snapshot = buildSnapshot();
    await runFullFlowGATL('AGREEMENT TO PURCHASE (ATP)', gatlDocMUid, gatlDocContent1, snapshot);
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

      // TenancyTermsOption must be INT: 1=Fixed, 2=Fixed with Expat, 3=Non Fixed
      const fixed = (formEl.querySelector('#fixedTerms') as HTMLInputElement)?.checked;
      const fixedExpat = (formEl.querySelector('#fixedTermsExpat') as HTMLInputElement)?.checked;
      const nonFixed = (formEl.querySelector('#nonFixedTerms') as HTMLInputElement)?.checked;

      let TenancyTermsOption = termsOption; // 1 / 2 / 3
      let TenancyTermsOption1Mths = toNumString(termsMonths || '0');

      if (fixed) {
        TenancyTermsOption = 1;
        TenancyTermsOption1Mths = val('FixedTermsMonths', '0');
      } else if (fixedExpat) {
        TenancyTermsOption = 2;
        TenancyTermsOption1Mths = val('FixedTermsExpatMonths', '0');
      } else if (nonFixed) {
        TenancyTermsOption = 3;
        TenancyTermsOption1Mths = val('NonFixedTermsMonths', '0');
      }

      // PayableTo mapping
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

      // Build x-www-form-urlencoded
      const body = new URLSearchParams();

      body.set('ApplicationId', resolvedAppId);
      body.set('TenancyPeriodFrom', tenancyFrom);
      body.set('TenancyPeriodTo', tenancyTo);
      body.set('OptionToRenewFrom', renewFrom);
      body.set('OptionToRenewTo', renewTo);

      // Controlled fields
      body.set('AttDay', attDay);
      body.set('AttMonth', attMonth);
      body.set('SpecialCondition1', special1);
      body.set('SpecialCondition2', special2);
      body.set('SpecialCondition3', special3);
      body.set('OtherSpecialCondition', otherSpecial);

      // Delivery of Possession     
      body.set('VpDay', vpDay);
      body.set('VpMonth', vpMonth);
      body.set('VpStampDutyAmt', toNumString(vpStampDutyAmt));
      body.set('VpStampDutyPaidBy', vpStampDutyPaidBy);
      body.set('VpAdminChargesAmt', toNumString(vpAdminChargesAmt));
      body.set('VpAdminChargesPaidBy', vpAdminChargesPaidBy);

      // Earnest deposit + payments
      body.set('AtrEdFullAmt', toNumString(val('AtrEdFullAmt', '0')));
      body.set('AtrPaymentType', val('AtrPaymentType'));

      // NEW: extra Payment Terms fields
      body.set('BalanceWithinMonths', val('BalanceWithinMonths', balanceWithinMonths));
      body.set('WithinFromDate',     withinFromDate);
      body.set('ExtensionMonths',    val('ExtensionMonths', extensionMonths));
      body.set('UnpaidInterestRate', val('UnpaidInterestRate', unpaidInterestRate));

      body.set('ExecuteSpaWithinDays', val('ExecuteSpaWithinDays', '14'));


      // Terms + payable to
      body.set('PayableToText', PayableToText);
      body.set('TenancyTermsOption', String(TenancyTermsOption));
      body.set('TenancyTermsOption1Mths', toNumString(TenancyTermsOption1Mths));
      body.set('PayableToOption', PayableToOption);

      // Deposits (from controlled state)
      body.set('AtrAdvRentalAmt', toNumString(advRental));
      body.set('AtrSecurityDepositAmt', toNumString(securityDeposit));
      body.set('AtrUtilityDepositAmt', toNumString(utilityDeposit));
      body.set('AtrAccessCard', toNumString(accessCard));
      body.set('AtrIndahWater', toNumString(indahWater));
      body.set('AtrOtherDepositAmt', toNumString(otherDeposit));

      //  asdf
      //body.set('Atp90PctgBalPaidWithinNo', toNumString(monthsNum));
      body.set(
  'Atp90PctgBalPaidWithinNo',
  toNumString(val('BalanceWithinMonths', balanceWithinMonths))
);

      
      body.set('AtrOtherDepositRem', atrOtherDepositRem);

     const selectedDelivery = (formEl.querySelector('input[name="DeliveryPossession"]:checked') as HTMLInputElement)?.value || '1';

body.set('DeliveryOfPossessionOption', selectedDelivery);
body.set(
  'DeliveryOfPossessionWord',
  selectedDelivery === '2'
    ? 'Non-vacant possession subject to existing tenancy upon full settlement of the balance Purchase Price'
    : 'Vacant possession to be given upon full settlement of the balance of Purchase Price'
);


      const res = await fetch(API_ENDPOINTS.INT_APPLICATION_ATR_SET, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (json?.status === 'success') {
        await onRefresh?.();
        window.alert(json?.data || 'ATP details updated successfully.');
      } else {
        window.alert(json?.data || json?.message || 'ATP details update FAILED. Please try again.');
      }
    } catch (e: any) {
      console.error('ATS update error:', e);
      window.alert(e?.message || 'Failed to update ATP details.');
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
            <h2 className="text-lg font-semibold">AGREEMENT TO PURCHASE (ATP)</h2>
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="p-6 bg-gray-50">
            <form ref={formRef} className="space-y-6">
              

              {/* ======= NEW: Payment Terms (as per screenshot) ======= */}
              <div className="mb-6 p-4 bg-gray-100 rounded-lg">
                <h4 className="text-sky-600 font-semibold mb-4 text-center text-xl">Payment Terms</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  

                  {/* Payment Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type</label>
                    <select
                      id="AtrPaymentType"
                      name="AtrPaymentType"
                      defaultValue=""
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="" disabled>Choose…</option>
                      <option value="CASH">Cash</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="ONLINE_TRANSFER">Online Payment</option>
                      
                      
                    </select>
                  </div>
{/* Earnest Deposit Amt */}
                  <div>
                    
                  </div>
                  
                  {/* Payable To */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payable To
                    </label>
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex items-center gap-2">
                        <input
                          id="payableToInterealtor"
                          type="checkbox"
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          defaultChecked
                        />
                        <span>InteRealtor Sdn Bhd (Clients` Acc - PBB 32 1707 6233)</span>
                      </label>

                      <div className="flex items-center gap-3">
                        <input
                          id="payableToOther"
                          type="checkbox"
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <input
                          name="PayableToOtherText"
                          type="text"
                          placeholder="Other payee (enter name/bank detail)…"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 90% balance within (months) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      90% balance of purchase price paid within
                    </label>
                    <select
                      name="BalanceWithinMonths"
                      value={balanceWithinMonths}
                      onChange={(e) => setBalanceWithinMonths(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={String(m)}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* From the date of */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      From the date of
                    </label>
                    <select
                      name="WithinFromDate"
                      value={withinFromDate}
                      onChange={(e) => setWithinFromDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="Execution of the SPA">Execution of the SPA</option>
  <option value="Date of receipt by the Purchaser`s Solicitor of the relevant consent from the Statutory Body">
    Date of receipt by the Purchaser`s Solicitor of the relevant consent from the Statutory Body
  </option>
  <option value="Developer`s consent">Developer`s consent</option>
  <option value="Developer`s confirmation">Developer`s confirmation</option>
  <option value="FIC">FIC</option>
  <option value="State Authorities">State Authorities</option>
  <option value="Extract of LA">Extract of LA</option>
  <option value="Extract of Grant">Extract of Grant</option>
  <option value="Extract of the court order for sale">Extract of the court order for sale</option>
                    </select>
                  </div>

                  {/* Expiry extension period (months) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expiry extension period (months)
                    </label>
                    <select
                      name="ExtensionMonths"
                      value={extensionMonths}
                      onChange={(e) => setExtensionMonths(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={String(m)}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Unpaid balance interest rate (%) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unpaid balance interest rate (%)
                    </label>
                    <div className="flex items-center gap-3">
                      <select
                        name="UnpaidInterestRate"
                        value={unpaidInterestRate}
                        onChange={(e) => setUnpaidInterestRate(e.target.value)}
                        className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      >
                        {[...Array(21)].map((_, i) => (
                          <option key={i} value={String(i)}>{i}</option>
                        ))}
                      </select>
                      <span className="text-sm text-gray-600 inline-flex items-center">
                        <span className="inline-block px-2 py-1 border border-gray-300 rounded bg-white">
                          {numberToWords(parseInt(unpaidInterestRate || '0', 10))}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Execute SPA Within (days) */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    To Execute the SPA within (days)
  </label>

  <select
    name="ExecuteSpaWithinDays"
    value={executeSpaWithinDays}
    onChange={(e) => setExecuteSpaWithinDays(e.target.value)}

    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
  >
    {[7, 14, 21, 28, 35].map((d) => (
      <option key={d} value={String(d)}>
        {d}
      </option>
    ))}
  </select>
</div>

                  
                </div>
              </div>
              {/* ======= END Payment Terms ======= */}

              {/* Terms Option */}
              <div className="bg-white rounded-xl shadow-lg p-6">          
                {/* Special Conditions */}
                <div className="space-y-4">
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Other Special Condition, subject to the inventory list as per annexure (if any)</label>
                    <textarea
                      name="OtherSpecialCondition"
                      rows={1}
                      value={otherSpecial}
                      onChange={(e) => setOtherSpecial(e.target.value)}
                      placeholder="Enter other special conditions"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>



              {/* Delivery of Possession */}

{/* Delivery of Possession */}
<div className="mb-6 p-4 bg-gray-100 rounded-lg">
  <h4 className="text-sky-600 font-semibold mb-4 text-center text-xl">
    Delivery of possession
  </h4>

  <div className="flex flex-col gap-3">
    {/* 1 = Vacant */}
    <label className="inline-flex items-center gap-2">
      <input
        type="radio"
        name="DeliveryPossession"
        value="1"
        defaultChecked={String(application?.DeliveryOfPossessionOption ?? '1') !== '2'}
        className="w-5 h-5 text-blue-600 border-gray-300"
      />
      <span>Vacant possession to be given upon full settlement of the balance of Purchase Price</span>
    </label>

    {/* 2 = Non-vacant */}
    <label className="inline-flex items-center gap-2">
      <input
        type="radio"
        name="DeliveryPossession"
        value="2"
        defaultChecked={String(application?.DeliveryOfPossessionOption ?? '1') === '2'}
        className="w-5 h-5 text-blue-600 border-gray-300"
      />
      <span>Non-vacant possession subject to existing tenancy upon full settlement of the balance Purchase Price</span>
    </label>
  </div>
</div>
              
              

              {/* Buttons */}
              <div className="mt-6 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={handleUpdateATR}
                  disabled={saving}
                  className={`bg-green-600 text-white px-6 py-2 rounded-lg transition-colors font-medium ${saving ? 'opacity-60 cursor-not-allowed' : 'hover:bg-green-700'}`}
                >
                  {saving ? 'Saving…' : 'UPDATE ATP DETAILS'}
                </button>

                <button
                  type="button"
                  onClick={handlePreviewGATL}
                  disabled={generating}
                  className={`bg-red-600 text-white px-6 py-2 rounded-lg transition-colors font-medium ${generating ? 'opacity-60 cursor-not-allowed' : 'hover:bg-red-700'}`}
                >
                  {generating ? 'Generating…' : 'GENERATE ATP'}
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

export default ATPSection;
