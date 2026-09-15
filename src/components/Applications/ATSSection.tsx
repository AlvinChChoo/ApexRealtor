import { API_ENDPOINTS } from '../../config/apiConfig';
// ATSSection.tsx
import React, { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown, Users, Calendar, Info } from 'lucide-react';

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

    (pdfMake as any).vfs = vfs;
    if (typeof pdfMake.createPdf !== 'function') throw new Error('pdfMake.createPdf is not a function');
    return pdfMake;
  })();
  return __pdfMakeOnce;
}

/* =======================================================================
   Tiny inline HTML → pdfmake runs helper (no deps)
   Supports: <b>, <u>, <i>, <p>. Good for simple inline styles.
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
  const w = (img as HTMLImageElement).naturalWidth || img.width;
  const h = (img as HTMLImageElement).naturalHeight || img.height;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/* =======================================================================
   Helpers
======================================================================= */
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

/** Simple 0–20 number → words for the interest dropdown */
function numberToWords(n: number): string {
  const words = [
    'zero', 'one', 'two', 'three', 'four',
    'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
    'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
    'twenty',
  ];
  if (Number.isNaN(n)) return 'zero';
  if (n >= 0 && n <= 20) return words[n];
  return String(n);
}

function formatDurationPretty(durationText: string) {
  // expects: "X month(s), Y day(s)"
  const m = /(\d+)\s*month\(s\)\s*,\s*(\d+)\s*day\(s\)/i.exec(durationText || '');
  if (!m) return (durationText || '').trim();

  const months = parseInt(m[1], 10) || 0;
  const days = parseInt(m[2], 10) || 0;

  if (days > 0) return `${months} month(s), ${days} day(s)`;
  return `${months} month(s)`;
}


/* ---------- date format converters ---------- */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function serverDateToISO(s?: string): string {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // already ISO
  const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(s.trim()); // dd-MMM-yyyy
  if (!m) return '';
  const [, dd, mon, yyyy] = m;
  const idx = MONTHS.findIndex(x => x.toLowerCase() === mon.toLowerCase());
  if (idx < 0) return '';
  return `${yyyy}-${String(idx + 1).padStart(2,'0')}-${dd}`;
}

function isoToServerDate(iso?: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [yyyy, mm, dd] = iso.split('-');
  const mon = MONTHS[Number(mm) - 1];
  if (!mon) return '';
  return `${dd}-${mon}-${yyyy}`; // dd-MMM-yyyy
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

/* =======================================================================
   Small tooltip label
======================================================================= */
const LabelWithTip: React.FC<{ text: string; tip: string; className?: string }> = ({
  text,
  tip,
  className = '',
}) => (
  <div className={`flex items-center space-x-2 ${className}`}>
    <label className="text-sm font-medium text-gray-700 whitespace-nowrap">{text}</label>
    <span title={tip} className="inline-flex items-center">
      <Info className="w-4 h-4 text-gray-400 hover:text-gray-600" />
    </span>
  </div>
);

/* =======================================================================
   Props
======================================================================= */
interface ATSSectionProps {
  applicationId?: number | string;
  application?: any;
  insertUrl?: string;  
  insertProxyUrl?: string;  
  docMUid?: string;       // EATL Document UID
  docContent1?: string;   // 'Exclusive Authorisation To Let (EATL)' 
  uploadUrl?: string;
  uploadProxyUrl?: string;
  gatlDocMUid?: string;       // GATL Document UID
  gatlDocContent1?: string;   // 'General Authorisation To Sell (GATL)'
  onRefresh?: () => Promise<void>; 
}

/* =======================================================================
   Component (clone of ATLSection, exported as ATSSection)
======================================================================= */
const ATSSection: React.FC<ATSSectionProps> = ({
  applicationId,
  application,

  insertUrl = API_ENDPOINTS.INT_FORM_INSERT,
  insertProxyUrl, // e.g. '/api/IntFormInsert'
  docMUid = 'EC706F64-7CB5-420D-B3E7-ABC49D42F965',
  docContent1 = 'Exclusive Authorisation To Sell (EATS)',
  onRefresh,
  uploadUrl = API_ENDPOINTS.UPLOAD,
  uploadProxyUrl, // e.g. '/api/Upload'
  gatlDocMUid = '6223706A-9A76-4D14-A92D-B5692135001F',
  gatlDocContent1 = 'General Authorisation To Sell (GATS)',
}) => {
  console.log('ATSSection rendering with applicationId:', applicationId, 'application:', application);

  const [resolvedAppId, setResolvedAppId] = useState<string | null>(null);

  // Date validation helper
  const isValidDate = (dateString: string): boolean => {
    if (!dateString) return true;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return false;
    const [year, month, day] = dateString.split('-').map(Number);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  };

  // Fees and amounts (UI)
  const [professionalFees, setProfessionalFees] = useState('10500');
  const [sstChecked, setSstChecked] = useState(true);
  const [sstAmount, setSstAmount] = useState('840.00');
  const [totalAmount, setTotalAmount] = useState('11340.00');
  const [monthlyRentalAmount, setMonthlyRentalAmount] = useState('5500');
  const [earnestDeposit, setEarnestDeposit] = useState('10000');

  // Authorisation (UI)
  const [attorneyDate, setAttorneyDate] = useState('');
  const [authorisationGivenOption, setAuthorisationGivenOption] = useState<number>(1);

  // --- derived text for "capacity as ..." (underlined in PDF)
  const conditionText = React.useMemo(() => {
    switch (authorisationGivenOption) {
      case 1:
        return 'Registered proprietor of the said property';
      case 2:
        return `The Attorney of the owner of the said Property pursuant to the Power of Attorney dated`;
      case 3:
        return 'Trustee for the legal owner(s) / Personal Representative (Executor or Administrator) of the owner (deceased)';
      default:
        return '';
    }
  }, [authorisationGivenOption, attorneyDate]);

  // Period
  const [commencingFromDate, setCommencingFromDate] = useState('2025-08-01'); // ISO for <input type="date">
  const [commencingToDate, setCommencingToDate] = useState('2025-08-31');     // ISO for <input type="date">
  const [duration, setDuration] = useState('1 month(s), 0 day(s)');

  // ====== Balance of purchase price options (event descriptions) ======
  const balanceOfPurchasePrice: string[] = [
    'Execution of the SPA',
    'Date of receipt by the Purchaser`s Solicitor of the relevant consent from the Statutory Body',
    'Developer`s consent',
    'Developer`s confirmation',
    'FIC',
    'State Authorities',
    'Extract of LA',
    'Extract of Grant',
    'Extract of the court order for sale',
  ];

  // NEW: numeric dropdowns
  const balanceMthsCnt = Array.from({ length: 10 }, (_, i) => String(i + 1));   // 1–10 months (Atp90PctgBalPaidWithinNo)
  const interestMthsCnt = Array.from({ length: 15 }, (_, i) => String(i + 1));  // 1–15 months (UnpaidBalanceInterestNo)

  const [balanceMonths, setBalanceMonths] = useState('1');   // maps to Atp90PctgBalPaidWithinNo
  const [interestMonths, setInterestMonths] = useState('1'); // maps to UnpaidBalanceInterestNo

  const propertySaleCondition = [
    'With vacant possession',
    'non-vacant possession - subject to existing tenancy',
  ];
  
  const [propertySaleOption, setPropertySaleOption] = useState<string>(application?.DeliveryOfPossessionOption || '');  
  const [balanceOption, setBalanceOption] = useState<string>(balanceOfPurchasePrice[0]);
  const [atp90PctgBalPaidWithinNo, setAtp90PctgBalPaidWithinNo] = useState('1');
  const [withinFromDate, setWithinFromDate] = useState<string>(application?.WithinFromDate || '');
  const [extensionMonths, setExtensionMonths] = useState<string>(application?.ExpiryExtensionPeriodNo || ''); 
  const [unpaidInterestRate, setUnpaidInterestRate] = useState<string>(application?.UnpaidBalanceInterestNo || '');  
  const [refNo, setRefNo] = useState(''); // replaced by IntFormInsert
  const [propertyType, setPropertyType] = useState<string>(application?.PropertyType || 'Retail Lot');
  const [propertyAddress, setPropertyAddress] = useState<string>(application?.PropertyAddress || 'Property Address');  
  const [docMLogId, setDocMLogId] = useState<string | null>(null);  
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdf, setShowPdf] = useState(false);
  const [generating, setGenerating] = useState(false);  
  const [isExpanded, setIsExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<null | { type: 'ok' | 'err'; text: string }>(null);
  const [dateError, setDateError] = useState<string | null>(null);


  useEffect(() => {
  if (application?.DeliveryOfPossessionOption) {
    setPropertySaleOption(application.DeliveryOfPossessionOption);
  }
}, [application?.DeliveryOfPossessionOption]);

useEffect(() => {
  const raw = application?.Atp90PctgBalPaidWithinNo;
  if (raw == null || raw === '') return;

  const num = Math.round(Number(raw));
  if (!Number.isFinite(num)) return;

  const clamped = Math.min(Math.max(num, 1), 10);
  const v = String(clamped);

  setAtp90PctgBalPaidWithinNo(prev => (prev === v ? prev : v));
}, [application?.Atp90PctgBalPaidWithinNo]);

  
  useEffect(() => {
    const raw = (application as any)?.Atp90PctgBalPaidWithinNo;
    if (raw == null || raw === '') return;

    const num = Math.round(Number(raw));
    if (!Number.isFinite(num)) return;

    const clamped = Math.min(Math.max(num, 1), 10); // 1–10
    const v = String(clamped);
    setBalanceMonths(prev => (prev === v ? prev : v));
  }, [application?.Atp90PctgBalPaidWithinNo]);

  // Hydrate interestMonths from backend UnpaidBalanceInterestNo
  useEffect(() => {
    const raw = (application as any)?.UnpaidBalanceInterestNo;
    if (raw == null || raw === '') return;

    const num = Math.round(Number(raw));
    if (!Number.isFinite(num)) return;

    const clamped = Math.min(Math.max(num, 1), 15); // 1–15
    const v = String(clamped);
    setInterestMonths(prev => (prev === v ? prev : v));
  }, [application?.UnpaidBalanceInterestNo]);

  const closePdf = () => {
    if (pdfUrl && pdfUrl.startsWith('blob:')) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setShowPdf(false);
  };

  /* Resolve ApplicationId once */
  useEffect(() => {
    const id = deriveApplicationId(applicationId, application);
    if (id) {
      setResolvedAppId(id);
      localStorage.setItem('ApplicationId', id);
    } else {
      setResolvedAppId(null);
    }
  }, [applicationId, application]);

  /* Pick AuthorisationGivenOption from application if present */
  useEffect(() => {
    const val = Number(application?.AuthorisationGivenOption);
    if (val === 1 || val === 2 || val === 3) {
      setAuthorisationGivenOption(val);
    }
  }, [application?.AuthorisationGivenOption]);


  /* Hydrate AttorneyDate from server format dd-MMM-yyyy -> ISO for input */
useEffect(() => {
  const attorneyISO = serverDateToISO(application?.AttorneyDate);
  if (attorneyISO) {
    setAttorneyDate(attorneyISO);
  } else {
    setAttorneyDate('');
  }
}, [application?.AttorneyDate]);
  
  /* Hydrate dates from server format dd-MMM-yyyy -> ISO for input */
  useEffect(() => {
    const fromISO = serverDateToISO(application?.PoaFrom);
    if (fromISO) setCommencingFromDate(fromISO);
    const toISO = serverDateToISO(application?.PoaTo);
    if (toISO) setCommencingToDate(toISO);
  }, [application?.PoaFrom, application?.PoaTo]);

  /* Keep property header fields in sync with application */
  useEffect(() => {
    if (application?.PropertyType) setPropertyType(application.PropertyType);
    if (application?.PropertyAddress) setPropertyAddress(application.PropertyAddress);
  }, [application?.PropertyType, application?.PropertyAddress]);

  /* Fees -> SST totals */
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

  /* ===================== Calendar-accurate duration (end-date inclusive) ===================== */
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
  function calcMonthsDays(fromISO?: string, toISO?: string) {
    const from = parseYMD(fromISO);
    const to = parseYMD(toISO);
    if (!from || !to || to < from) return { months: 0, days: 0, totalDays: 0 };

    const toInclusive = new Date(to.getTime() + 86400000); // +1 day to include end date

    let months = 0;
    while (true) {
      const next = addMonthsUTC(from, months + 1);
      if (next > toInclusive) break;
      months += 1;
      if (months > 1200) break; // safety
    }

    const anchor = addMonthsUTC(from, months);
    const days = Math.max(0, Math.floor((toInclusive.getTime() - anchor.getTime()) / 86400000));
    const totalDays = Math.max(0, Math.floor((toInclusive.getTime() - from.getTime()) / 86400000));

    return { months, days, totalDays };
  }

  /* Duration calc */
  useEffect(() => {
    if (commencingFromDate && commencingToDate) {
      const { months, days, totalDays } = calcMonthsDays(commencingFromDate, commencingToDate);
      if (totalDays > 0) {
        setDuration(`${months} month(s), ${days} day(s)`);
      }
    }
  }, [commencingFromDate, commencingToDate]);

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
        const newRefNo: string = row.RefNo || row.RefNo1 || '';
        const newDocMLogId: string = String(row.DocMLogId || '');
        if (!newRefNo || !newDocMLogId) throw new Error('Missing RefNo/DocMLogId from IntFormInsert (proxy).');
        return { refNo: newRefNo, docMLogId: newDocMLogId };
      }
      const hint = buildCorsHint('IntFormInsert.php', insertUrl);
      throw new Error(`${err?.message || String(err)}\n\n${hint}`);
    }
  }

  /* =====================================================================
     PDF doc definitions
  ====================================================================== */
  const earnestDepositTxt = money(String(application?.AtlEdFullAmt ?? '0'));
  const proFeesTxt      = money(String(application?.AtlProFees ?? professionalFees ?? '0'));
  const proFeesSstTxt   = money(String(application?.AtlProFeesSstAmt ?? sstAmount ?? '0'));
  const proFeesTotalTxt = money(String(application?.AtlProFeesTotalAmt ?? totalAmount ?? '0'));
  const fromTxt = isoToServerDate(commencingFromDate);
  const toTxt   = isoToServerDate(commencingToDate);
  const rentalTxt = money(String(application?.AtlRentalAmt ?? monthlyRentalAmount ?? '0'));





  const buildDocDefinitionEATL = (title: string, logoDataUrl?: string, footerDataUrl?: string, refNoValue?: string) =>
    ({
      info: {
        title,
        author: 'InteRealtor',
        subject: 'General Authorisation To Sell',
        keywords: 'ATL, GATL, Tenancy, InteRealtor',
      },
      pageSize: 'A4',
      //pageMargins: [40, 110, 40, 95],
      pageMargins: [25, 75, 25, 95],
      header: (_currentPage: number, _pageCount: number, pageSize: any) => ({
        margin: [40, 20, 40, 10],
        
        stack: [
          {
            columns: [
              logoDataUrl
                ? { image: 'logo', width: 160, margin: [0, 8, 20, 0] }
                : { text: '', width: 160, margin: [0, 8, 20, 0] },
              {
                width: '*',
                alignment: 'right',
                table: {
                  widths: ['*'],
                  body: [
                    [
                      {
                        text: 'EXCLUSIVE AUTHORISATION TO SELL',
                        color: '#fff',
                        bold: true,
                        alignment: 'center',
                        fontSize: 12,
                        margin: [0, 8, 0, 8],
                        fillColor: '#000',
                      },
                    ],
                  ],
                },
                layout: 'noBorders',
              },
            ],
            columnGap: 20,
          },
          {
            canvas: [{ type: 'line', x1: 0, y1: 0, x2: pageSize.width - 80, y2: 0, lineWidth: 1 }],
            margin: [0, 6, 0, 0],  
          },
        ],
      }),
      footer: (_currentPage: number, _pageCount: number, pageSize: any) => {
        return {
          margin: [0, 0, 0, 0],
          stack: [
            footerDataUrl
              ? { image: 'footerBanner', width: pageSize.width }
              : { text: '' }
          ]
        };
      },
      styles: {
        headerTitle: { fontSize: 14, bold: true },
        headerMeta: { fontSize: 9, color: '#555' },
        h1: { fontSize: 13, bold: true, margin: [0, 8, 0, 8] },
        //sectionTitle: { fontSize: 12, bold: true, color: '#1f4f8b', margin: [0, 12, 0, 6] },
        sectionTitle: { fontSize: 12, bold: true, color: '#1f4f8b', margin: [0, , 0, 6] },
        label: { bold: true },
        small: { fontSize: 7, color: '#444' },        
        terms: { fontSize: 7, lineHeight: 1.4 },
        listItem: { fontSize: 7, margin: [0, 2, 0, 2] },
        tableHeader: { bold: true, fillColor: '#efefef' },
        termsNumber: { fontSize: 7 },
      },
      images: {
        ...(logoDataUrl ? { logo: logoDataUrl } : {}),
        ...(footerDataUrl ? { footerBanner: footerDataUrl } : {}),
      },
      content: [
        
        { text: `Reference Number : ${refNo || refNoValue || ''}`, alignment: 'right', fontSize: 8, margin: [0, -2, 0, 5] },
        {
  text: [
    'Property Type: ',
    {
  text: `${['', 'N/A'].includes((application?.PropertyStoreyDesc || '').trim()) ? '' : application?.PropertyStoreyDesc} ${application?.PropertyType || ''}`
    .replace(/\s+/g, ' ')
    .trim(),
  decoration: 'underline'
},
    '          Address: ',
    {
      text: `${propertyAddress} ${application?.PropertyPostalCode || ''} ${application?.PropertyLocation || ''} ${application?.PropertyTown || ''} ${application?.PropertyState || ''}`
        .replace(/\s+/g, ' ')
        .trim(),
      decoration: 'underline'
    }
  ],
  margin: [0, 0, 0, 5],
  style: 'terms'
},
        {
          text: htmlToPdfmakeLite(
            `I/We, registered proprietor for the said property do hereby appoint InteRealtor to be my/our EXCLUSIVE AGENT for a period of <u>${application.PoaDuration}</u> commencing from <u>${application.PoaFrom} to ${application.PoaTo}</u> for the sale of the said Property to any Purchaser at the selling price of ${rentalTxt} only or nearest offer ('Sale Price')to be agreed by the Vendor(s) upon the following terms and conditions:`
          ),
          style: 'terms',
          margin: [0, 0, 0, 5],
        },

        {
          table: {
            widths: ['3%', '97%'],
            body: [
              [
                { text: '1.', style: 'termsNumber' },
                {
                  text: htmlToPdfmakeLite(
  `In consideration of InteRealtor providing the service for the sale of the Property, the Vendor(s) hereby agrees to pay InteRealtor in accordance to the Valuer, Appraisers, Estate Agents and Property Managers Act 1981 (Act 242) & Rules, a Professional Fees of <u>${money(
    Number(application?.AtlProFees ?? 0) + Number(application?.AtlProFeesSstAmt ?? 0)
  )}</u> of the Sale Price of the Property, upon the execution of the Sale & Purchase Agreement ("SPA") :-`
),
                  style: 'terms'
                  ,alignment: 'justify'
                }
              ]
            ]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 5],
        },



        {
          columns: [
            {
              width: '*',
              stack: [
                { text: '', style: 'terms' },               
              ],
            },
            {
              width: 'auto',
              margin: [20, 0, 0, 0],
              table: {
  widths: ['*', 'auto'],
  body: [
    [{ text: 'Professional Fees', fontSize: 8 }, { text: money(application.AtlProFees), alignment: 'right', fontSize: 8 }],
    [{ text: 'SST (8%)', fontSize: 8 }, { text: money(application.AtlProFeesSstAmt), alignment: 'right', fontSize: 8 }],
    [{
      text: 'Total',
      fontSize: 8
    }, {
      text: money(
        (Number(application.AtlProFees ?? 0) + Number(application.AtlProFeesSstAmt ?? 0)).toString()
      ),
      alignment: 'right',
      fontSize: 8
    }],
  ],
},
              layout: {
                hLineWidth: (i: number, node: any) => {
                  const lastLine = node.table.body.length;
                  return (i === 0 || i === lastLine || i === lastLine - 1) ? 1 : 0;
                },
                vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 1 : 0),
                hLineColor: () => '#000',
                vLineColor: () => '#000',
                paddingLeft: () => 10,
                paddingRight: () => 10,
                paddingTop: () => 2,
                paddingBottom: () => 2,
              },
            }
          ],
          margin: [0, 0, 0, 5],
        },
        
        {
          table: { widths: ['3%','3%', '94%'], body: [[
            { text: '', style: 'termsNumber' },    
            { text: 'a)', style: 'termsNumber' },
            {
            text: `During the Exclusive Period, InteRealtor procured a purchaser on the terms specified herein and upon the execution of the formal SPA or,`,
            style: 'terms' }]] }, layout: 'noBorders', margin: [0, 0, 0, 0] },

        {table: { widths: ['3%','3%', '94%'], body: [[{ text: '', style: 'termsNumber' }, { text: 'b)', style: 'termsNumber' }, {
            text: `During the Exclusive Period, the Property is sold or contracted to be sold by me/us, the Vendor(s) personally or through other agent/person other than InteRealtor or`,
            style: 'terms' }]] }, layout: 'noBorders', margin: [0, 0, 0, 0] },

        {table: { widths: ['3%','3%', '94%'], body: [[{ text: '', style: 'termsNumber' }, { text: 'c)', style: 'termsNumber' }, {
            text: `During the Exclusive Period, this authorisation is revoked/terminated by the Vendor(s); or`,
            style: 'terms' }]] }, layout: 'noBorders', margin: [0, 0, 0, 0] },

        {table: { widths: ['3%','3%', '94%'], body: [[{ text: '', style: 'termsNumber' }, { text: 'd)', style: 'termsNumber' }, {
            text: `After the expiry of the Exclusive Period, the Vendor(s) entered into a SPA with purchaser who was introduced, sourced or procured by InteRealtor prior to the expiry of the Exclusive Period.`,
            style: 'terms' }]] }, layout: 'noBorders', margin: [0, 0, 0, 0] },

        {
          table: { widths: ['3%', '97%'], body: [[{ text: '2.', style: 'termsNumber' }, {
            text: `This exclusive authorisation shall be considered as renewed for a period equivalent to the original term unless it is terminated in writing by either party. The extended Exclusive Period shall expire at the end of the extended term unless it is renewed by the parties hereto by mutual consent and upon new terms and conditions to be agreed between the parties.`,
            style: 'terms' }]] }, layout: 'noBorders', margin: [0, 0, 0, 0] },

        {
          table: { widths: ['3%', '97%'], body: [[{ text: '3.', style: 'termsNumber' }, {
            text: `InteRealtor is hereby authorised to accept and receive on behalf of the Vendor(s) an Earnest Deposit equivalent to ${earnestDepositTxt} as a Stakeholder and InteRealtor is authorised to deduct the said agreed professional fee from the Earnest Deposit before releasing the balance, if any to the Vendor(s). In the event the Earnest Deposit is insufficient to pay the Professional Fee, the Vendor(s) agrees and undertakes to remit the shortfall immediately.`,
            style: 'terms',alignment: 'justify' }]] }, layout: 'noBorders', margin: [0, 0, 0, 0] },
        {
          table: { widths: ['3%', '97%'], body: [[{ text: '4.', style: 'termsNumber' }, { text: `In the event the Earnest Deposit has been paid and the sale transaction is aborted by the Vendor(s) or the Purchaser before the execution of the SPA, the Vendor(s) agrees to pay InteRealtor a fee equivalent to 50% of the Earnest Deposit or forfeitable deposit or 50% of the agreed full fees, plus the relevant applicable SST, whichever is lesser, as a proportion of the Professional Fee for the services already rendered in relation to the sale of the Property by InteRealtor.`, style: 'terms',alignment: 'justify' }]] }, layout: 'noBorders', margin: [0, 0, 0, 0] },
        {
          table: { widths: ['3%', '97%'], body: [[{ text: '5.', style: 'termsNumber' }, { text: `The Vendor(s) agree to fully indemnify InteRealtor against any and all losses, damages and claims by the Purchaser if the Vendor(s) for any reasons whatsoever fail to execute, or does not proceed to execute the SPA after the Earnest Deposit has been paid or collected.`, style: 'terms' }]] }, layout: 'noBorders', margin: [0, 0, 0, 0] },
        {
          table: { widths: ['3%', '97%'], body: [[{ text: '6.', style: 'termsNumber' }, { text: `The Vendor(s) hereby authorise InteRealtor to put up a "FOR SALE" signboard at the Property and/or to advertise through any form of media to promote the sale of the Property`, style: 'terms',alignment: 'justify' }]] }, layout: 'noBorders', margin: [0, 0, 0, 0] },
        {
          table: { widths: ['3%', '97%'], body: [[{ text: '7.', style: 'termsNumber' }, { text: `Terms and Conditions of sale :`, style: 'terms',alignment: 'justify' }]] }, layout: 'noBorders', margin: [0, 0, 0, 0] },

        {table: { widths: ['5%','5%', '90%'], body: [[
          
          { text: '', style: 'termsNumber',alignment: 'justify' }, 
          { text: 'a)', style: 'termsNumber' }, 
          {text: `10% of the Purchase Price (Inclusive of Earnest Deposit) to be paid by the Purchaser upon the execution of the SPA`,

          
            style: 'terms',alignment: 'justify' }]] }, layout: 'noBorders', margin: [0, 0, 0, 0] },
 
        {table: { widths: ['5%', '5%','95%'], body: [[
          { text: '', style: 'termsNumber',alignment: 'justify' }, 
            { text: 'b)', style: 'termsNumber' }, 
            {text: `The balance 90% of the Purchase Price to be paid:-`,
            style: 'terms' }]] }, layout: 'noBorders', margin: [0, 0, 0, 0] },

        {table: { widths: ['10%','5%', '85%'], body: [[
          { text: '', style: 'termsNumber',alignment: 'justify' }, 
            { text: 'i.', style: 'termsNumber' }, 
            {
             //text: `Within Three (3) months of the ${application.WithinFromDate}`,      

text: `Within ${numberToWords(application.Atp90PctgBalPaidWithinNo)} (${application.Atp90PctgBalPaidWithinNo}) months of the ${application.WithinFromDate}`,                  
            style: 'terms' }]] }, layout: 'noBorders', margin: [0, 0, 0, -2] },
      
        {table: { widths: ['10%','5%', '85%'], body: [[
          { text: '', style: 'termsNumber' }, 
          { text: 'ii.', style: 'termsNumber' },      
          {          
            text: `An extension of a further ${numberToWords(application.ExpiryExtensionPeriodNo)} (${application.ExpiryExtensionPeriodNo}) month may be granted to the Purchaser to enable him to settle in full the balance sum PROVIDED that interest shall be chargeable on the unpaid balance at ${application.UnpaidBalanceInterestNo}% (${numberToWords(application.UnpaidBalanceInterestNo)} percent) per annum calculated on daily basis.`,
            style: 'terms' ,alignment: 'justify'}]] }, layout: 'noBorders', margin: [0, 0, 0, -2] },

        application?.DeliveryOfPossessionOption === '2'
    ? {
        table: {
          widths: ['5%', '95%'],
          body: [[
            { text: 'c)', style: 'termsNumber' },
            {
              text: `The said Property shall be sold on As Is Where Is Basis : with non-vacant possession subject to existing tenancy upon full settlement of the balance Purchase Price`,
              style: 'terms'
            }
          ]]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 0]
      }
    : {
        table: {
          widths: ['5%','5%', '90%'],
          body: [[
            { text: '', style: 'termsNumber' },
            { text: 'c)', style: 'termsNumber' },
            {
              text: `The said Property shall be sold on As Is Where Is Basis : with vacant possession to be given upon full settlement of the balance Purchase Price`,
              style: 'terms'
            }
          ]]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 0]
      },

      
    
        {
          table: { widths: ['3%', '97%'], body: [[{ text: '8', style: 'termsNumber' }, { text: `I/we hereby declare that I/we have not appointed any other real estate agency firm as of this date of appointment.`, style: 'terms',alignment: 'justify' }]] }, layout: 'noBorders', margin: [0, 0, 0, 0] },
        
      
        {
          table: { widths: ['25%', '25%', '25%', '25%'], body: [[{ text: 'OFFER', style: 'termsNumber' }, { text: 'X', style: 'termsNumber' }, { text: 'x', style: 'termsNumber' }, { text: 'Signed in the presence of', style: 'termsNumber' }]] },
          layout: 'noBorders',
          margin: [0, 0, 0, 2],
        },
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
      {
        table: { widths: ['*'], body: [[
          { text: ' ' + (application?.Landlord1Name ?? ''), style: 'termsNumber', border: [false, false, false, true] }
        ]] },
        layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 }
      },
      {
        table: { widths: ['*'], body: [[
          { text: ' ' + (application?.Landlord2Name ?? ''), style: 'termsNumber', border: [false, false, false, true] }
        ]] },
        layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 }
      },

      // ✅ Signed in the presence of (Witness) — show ListerDisplayName
      {
        table: { widths: ['*'], body: [[
          { text: '  ', style: 'termsNumber', border: [false, false, false, true] }
        ]] },
        layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 }
      },
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
              { table: { widths: ['*'], body: [[{ text: '  ' , style: 'termsNumber', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 } },
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

  
  
  const buildDocDefinitionGATL = (title: string, logoDataUrl?: string, footerDataUrl?: string, refNoValue?: string) =>
    ({
      info: {
        title,
        author: 'InteRealtor',
        subject: 'General Authorisation To Sell',
        keywords: 'ATL, GATL, Tenancy, InteRealtor',
      },
      pageSize: 'A4',
      //pageMargins: [40, 110, 40, 95],
      pageMargins: [25, 75, 25, 95],
      
      header: (_currentPage: number, _pageCount: number, pageSize: any) => ({
        margin: [40, 20, 40, 10],
        stack: [
          {
            columns: [
              logoDataUrl
                ? { image: 'logo', width: 160, margin: [0, 8, 20, 0] }
                : { text: '', width: 160, margin: [0, 8, 20, 0] },
              {
                width: '*',
                alignment: 'right',
                table: {
                  widths: ['*'],
                  body: [
                    [
                      {
                        text: 'GENERAL AUTHORISATION TO SELL',
                        color: '#fff',
                        bold: true,
                        alignment: 'center',
                        fontSize: 12,
                        margin: [0, 8, 0, 8],
                        fillColor: '#000',
                      },
                    ],
                  ], 
                },
                layout: 'noBorders',
              },
            ],
            columnGap: 20,
          },
          {
            canvas: [{ type: 'line', x1: 0, y1: 0, x2: pageSize.width - 80, y2: 0, lineWidth: 1 }],
            margin: [0, 6, 0, 0],
          },
        ],
      }),
      footer: (_currentPage: number, _pageCount: number, pageSize: any) => {
        return {
          margin: [0, 0, 0, 0],
          stack: [
            footerDataUrl
              ? { image: 'footerBanner', width: pageSize.width }
              : { text: '' }
          ]
        };
      },
      styles: {
        headerTitle: { fontSize: 14, bold: true },
        headerMeta: { fontSize: 9, color: '#555' },
        h1: { fontSize: 13, bold: true, margin: [0, 8, 0, 8] },
        sectionTitle: { fontSize: 12, bold: true, color: '#1f4f8b', margin: [0, 12, 0, 6] },
        label: { bold: true },
        small: { fontSize: 8, color: '#444' },
        terms: { fontSize: 8, lineHeight: 1.15 },
        listItem: { fontSize: 8, margin: [0, 2, 0, 2] },
        tableHeader: { bold: true, fillColor: '#efefef' },
        termsNumber: { fontSize: 8 },
      },
      images: {
        ...(logoDataUrl ? { logo: logoDataUrl } : {}),
        ...(footerDataUrl ? { footerBanner: footerDataUrl } : {}),
      },
      content: [
        { text: `Reference Number : ${refNo || refNoValue || ''}`, alignment: 'right', fontSize: 8, margin: [0, -2, 0, 14] },
       

    {
  text: [
    'Property Type: ',      
{
  text: `${['', 'N/A'].includes((application?.PropertyStoreyDesc || '').trim()) ? '' : application?.PropertyStoreyDesc} ${application?.PropertyType || ''}`
    .replace(/\s+/g, ' ')
    .trim(),
  decoration: 'underline'
},
    
    
    { text: ' ' },  
    '       Address: ',

    {
    text:
      `${application?.PropertyAddress || ''} ${application?.PropertyPostalCode || ''} ${application?.PropertyLocation || ''} ${application?.PropertyTown || ''} ${application?.PropertyState || ''}
          `.trim(),
    decoration: 'underline'
  },
    
  ],
  margin: [0, 0, 0, 10],
  style: 'terms'
}, 

...(application?.AuthorisationGivenOption == 1 ? [{
  text: htmlToPdfmakeLite(
    `This authorisation to sell is hereby given by me/us, the undersigned Vendor(s), to Interealtor Sdn. Bhd. (816059-H) [E(1)1930] ("InteRealtor") in the capacity as <u>registered proprietor of the said property</u>`
  ),
  style: 'terms',
  margin: [0, 0, 0, 10],
}] : []),
//  {application.PoaFrom}
...(application?.AuthorisationGivenOption == 2 ? [{
  text: htmlToPdfmakeLite(
    `This authorisation to sell is hereby given by me/us, the undersigned Vendor(s), to Interealtor Sdn. Bhd. (816059-H) [E(1)1930] ("InteRealtor") in the capacity as <u>the Attorney of the owner of the said Property pursuant to the Power of Attorney dated ${
      attorneyDate && /^\d{4}-\d{2}-\d{2}$/.test(application.AttorneyDate)
        ? `${application.AttorneyDate.slice(8, 10)}-${application.AttorneyDate.slice(5, 7)}-${application.AttorneyDate.slice(2, 4)}`
        : (application.AttorneyDate || '')
    }</u>`
  ),
  style: 'terms',
  margin: [0, 0, 0, 10],
}] : []),

...(application?.AuthorisationGivenOption == 3 ? [{
  text: htmlToPdfmakeLite(
    ` This authorisation to sell is hereby given by me/us, the undersigned Vendor(s), to Interealtor Sdn. Bhd. (816059-H) [E(1)1930] ("InteRealtor") in the capacity as <u>trustee for the legal owner(s) / Personal Representative (Executor or Administrator) of the owner (deceased)</u>`
  ),
  style: 'terms',
  margin: [0, 0, 0, 10],
}] : []),

        
        { 
          text: htmlToPdfmakeLite(
            `I/We, do hereby appoint InteRealtor to be my/our AGENT for a period of <u>${application.PoaDuration}</u> commencing from <u>${application.PoaFrom} to ${application.PoaTo}</u> for the sale of the said Property to any Purchaser at the selling price of <u>${rentalTxt}</u> only or nearest offer ('Sale Price')to be agreed by the Vendor(s) upon the following terms and conditions:`
            //  application.PoaDuration
            //  asdf 
          ),
          style: 'terms',alignment:'justify',          
          margin: [0, 0, 0, 10],
        },

        {
          table: {
            widths: ['5%', '95%'],
            body: [
              [
                { text: '1.', style: 'termsNumber' },
                {
                  text: htmlToPdfmakeLite(
                    `In consideration of InteRealtor providing the service for the sale of the Property, the Vendor(s) hereby agrees to pay InteRealtor in accordance to the Valuer, Appraisers, Estate Agents and Property Managers Act 1981 (Act 242) & Rules, a Professional Fees of <u>${proFeesTotalTxt}</u>, upon the execution of the Sale & Purchase Agreement ("SPA") :-`
                  ),
                  style: 'terms',alignment: 'justify'
                }
              ]
            ]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 10],
        },
{
          columns: [
            {
              width: '*',
              stack: [
                { text: '', style: 'terms' },
             
              ],
            },
            {
              width: 'auto',
              margin: [20, 0, 0, 0],
              table: {
                widths: ['*', 'auto'],
                body: [
  [{ text: 'Professional Fees', fontSize: 10 }, { text: money(application.AtlProFees), alignment: 'right', fontSize: 8 }],
  [{ text: 'SST (8%)', fontSize: 9 }, { text: money(application.AtlProFeesSstAmt), alignment: 'right', fontSize: 8 }],
  [{ text: 'Total', fontSize: 9 }, { text: money((Number(application.AtlProFees ?? 0) + Number(application.AtlProFeesSstAmt ?? 0)).toFixed(2)), alignment: 'right', fontSize: 8 }],
],
              },
              layout: {
  hLineWidth: (i: number, node: any) => {
    const lastLine = node.table.body.length;
    return (i === 0 || i === lastLine || i === lastLine - 1) ? 1 : 0;
  },
  vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 1 : 0),
  hLineColor: () => '#000',
  vLineColor: () => '#000',
  paddingLeft: () => 10,
  paddingRight: () => 10,
  paddingTop: () => 2,
  paddingBottom: () => 2,
},
            }
          ],
          margin: [0, 0, 0, 10],
        },

        {
          table: {
            widths: ['5%', '95%'],
            body: [
              [
                { text: '2.', style: 'termsNumber' },
                {
                  text: htmlToPdfmakeLite(
                    `InteRealtor is hereby authorised to accept and receive on behalf of the Vendor(s) an Earnest Deposit amounting to ${money(application.AtlEdFullAmt)} of the Sale Price as a Stakeholder and InteRealtor is authorised to deduct the said agreed Professional Fee from the Earnest Deposit before releasing the balance, if any to the Vendor(s). In the event the Earnest Deposit is insufficient to pay the Professional Fee, the Vendor(s) agrees and undertakes to remit the shortfall immediately.`
                  ),
                  style: 'terms',alignment: 'justify'
                }
              ]
            ]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 10],
        },


        {
          table: {
            widths: ['5%', '95%'],
            body: [
              [
                { text: '3.', style: 'termsNumber' },
                {
                  text: htmlToPdfmakeLite(
                    `In the event the Earnest Deposit has been paid and the sale transaction is aborted by the Vendor(s) or the Purchaser before the execution of the SPA, the Vendor(s) agree to pay InteRealtor a fee equivalent to 50% of the Earnest Deposit or forfeitable deposit or 50% of the agreed full fees, plus the relevant applicable SST, whichever is lesser, as a proportion of the Professional Fee for the services already rendered in relation to the sale of the Property by InteRealtor.`
                  ),
                  style: 'terms',alignment: 'justify'
                }
              ]
            ]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 10],
        },




        {
          table: {
            widths: ['5%', '95%'],
            body: [
              [
                { text: '4.', style: 'termsNumber' },
                {
                  text: htmlToPdfmakeLite(
                    `The Vendor(s) agrees to fully indemnify InteRealtor against any and all losses, damages, and claims by the Purchaser if the Vendor(s) for any reason whatsoever fails to execute or does not proceed to execute the SPA after the Earnest Deposit has been paid or collected.`
                  ),
                  style: 'terms',alignment: 'justify'
                }
              ]
            ]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 10],
        },


        {
          table: {
            widths: ['5%', '95%'],
            body: [
              [
                { text: '5.', style: 'termsNumber' },
                {
                  text: htmlToPdfmakeLite(
                    `The Vendor(s) hereby authorises InteRealtor to put up a "FOR SALE" signboard at the Property and/or to advertise through any form of media to promote the sale of the Property.`
                  ),
                  style: 'terms',alignment: 'justify'
                }
              ]
            ]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 10],
        },


{
          table: {
            widths: ['5%', '95%'],
            body: [
              [
                { text: '6.', style: 'termsNumber' },
                {
                  text: htmlToPdfmakeLite(
                    `Terms and Conditions of sale :`
                  ),
                  style: 'terms',alignment: 'justify'
                }
              ]
            ]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 2],
        },

{table: { widths: ['5%','5%', '90%'], body: [[
  {text: '', style: 'termsNumber' },
  { text: 'a)', style: 'termsNumber' }, 
        
        {text: `10% of the Sale Price (Inclusive of Earnest Deposit) to be paid by the Purchaser upon the execution of the SPA`,
            style: 'terms',alignment: 'justify' }]] }, layout: 'noBorders', margin: [0, 0, 0, 2] },
        
{table: { widths: ['5%','5%', '90%'], body: [[
  
  {text: '', style: 'termsNumber' },
  { text: 'b)', style: 'termsNumber' }, {
            text: `The balance 90% of the Purchase Price to be paid:-`,
            style: 'terms',alignment: 'justify' }]] }, layout: 'noBorders', margin: [0, 0, 0, -2] },


        
        {table: { widths: ['10%', '5%', '85%'], body: [[
          {text: '    ', style: 'termsNumber' },                                                 
          {text: 'i. ', style: 'termsNumber',alignment: 'justify' }, 
          {text: htmlToPdfmakeLite(            
            `Within <u>one (1) </u> months of the <u>${application.WithinFromDate}</u> `        
          ),
            style: 'terms' }]] }, layout: 'noBorders', margin: [0, 0, 0, 0] },


        
        
        
      {table: { widths: ['10%', '5%', '85%'], body: [[
          {text: '    ', style: 'termsNumber' },                                                 
          {text: ' ii. ', style: 'termsNumber',alignment: 'justify' }, 
          {text: htmlToPdfmakeLite(
            
  `An extension of a further <u>${numberToWords(application.ExpiryExtensionPeriodNo)} (${application.ExpiryExtensionPeriodNo})</u> month may be granted to the Purchaser to enable him to settle in full the balance sum PROVIDED that interest shall be chargeable on the unpaid balance at <u>${application.UnpaidBalanceInterestNo}% (${numberToWords(application.UnpaidBalanceInterestNo)})</u> percent per annum calculated on daily basis.`
              
),
            style: 'terms' }]] }, layout: 'noBorders', margin: [0, 0, 0, 10] },




 application?.DeliveryOfPossessionOption === '2'
    ? {
        table: {
          widths: ['5%', '95%'],
          body: [[
            { text: 'c)', style: 'termsNumber' },
            {

              
              text: htmlToPdfmakeLite(`The said Property shall be sold on As Is Where Is Basis : with <u>non-vacant possession subject to existing tenancy upon full settlement of the balance Purchase Price<u>`),


              
              style: 'terms',alignment: 'justify'
            }
          ]]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 10]
      }
    : {
        table: {
          widths: ['5%', '95%'],
          body: [[
            { text: 'c)', style: 'termsNumber' },
            {
              text: htmlToPdfmakeLite(`The said Property shall be sold on As Is Where Is Basis : with <u>vacant possession to be given upon full settlement of the balance Purchase Price<u>`),
              style: 'terms'
            }
          ]]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 10]
      },






        
{
          table: {
            widths: ['5%', '95%'],
            body: [
              [
                { text: '7.', style: 'termsNumber',alignment: 'justify' },
                {
                  text: htmlToPdfmakeLite(
                    `This authorisation shall be considered as renewed for a period equivalent to the original term if neither gives notice of the termination in writing`
                  ),
                  style: 'terms'
                }
              ]
            ]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 10],
        },

        // Signature block
        {
          table: { widths: ['25%', '25%', '25%', '25%'], body: [[{ text: 'OFFER', style: 'termsNumber' }, { text: '', style: 'termsNumber' }, { text: '', style: 'termsNumber' }, { text: 'Signed in the presence of', style: 'termsNumber' }]] },
          layout: 'noBorders',
          margin: [0, 0, 0, 2],
        },
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
              { table: { widths: ['*'], body: [[{ text: '  ' , style: 'termsNumber', border: [false, false, false, true] }]] }, layout: { defaultBorder: false, paddingLeft: () => 5, paddingRight: () => 5 } },
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

  /* =====================================================================
     Upload PDF -> PHP
  ====================================================================== */
  async function uploadPdfBlob(
    pdfBlob: Blob,
    appIdForFile: string,
    docLogId?: string | number,
    filePrefix: 'EATL' | 'GATL' = 'EATL'
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
      if ((json as any)?.status !== 'success') throw new Error((json as any)?.data || 'Upload failed at server.');
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
     Preview + IntFormInsert + PDF + Upload
  ====================================================================== */
  async function runFullFlow(
    // kind: 'EATL' | 'GATL',
    kind: 'EATS' | 'GATS',
    title: string,
    docUid: string,
    docContent: string
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

      // Assets + pdfmake
      const [pdfMake, logoDataUrl, footerDataUrl] = await Promise.all([
        ensurePdfMakeOnce(),
        assetToDataUrl('/inte-logo.png'),
        assetToDataUrl('/Int_Footer.jpeg'),
      ]);

      // Build the correct document
      const docDefinition =
        kind === 'EATS'
          ? buildDocDefinitionEATL(title, logoDataUrl, footerDataUrl, newRefNo)
          : buildDocDefinitionGATL(title, logoDataUrl, footerDataUrl, newRefNo);

      const pdf = (pdfMake as any).createPdf(docDefinition);

      pdf.getBlob(async (blob: Blob) => {
        const objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
        setShowPdf(true);

        try {
          await uploadPdfBlob(blob, resolvedAppId, newDocId, kind === 'EATS' ? 'EATL' : 'GATL');
        } catch (e: any) {
          console.error(`[${kind}] Failed to upload PDF:`, e);
          alert(e?.message || 'Failed to upload PDF.');
        } finally {
          setGenerating(false);
        }
      });
    } catch (e: any) {
      console.error(`[${kind}] Failed to generate PDF:`, e);
      alert(e?.message || 'Failed to generate PDF.');
      setGenerating(false);
    }
  }

  const handlePreviewEATL = () =>
    runFullFlow('EATS', 'Exclusive Authorisation To Sell (EATS)', 'EC706F64-7CB5-420D-B3E7-ABC49D42F965', docContent1);

  const handlePreviewGATL = () =>
    runFullFlow('GATS', 'General Authorisation To Sell (GATS)', '6223706A-9A76-4D14-A92D-B5692135001F', gatlDocContent1);

  const handleUpdateATL = async () => {
    try {
      setSaving(true);
      setSaveMsg(null);

      if (!resolvedAppId || resolvedAppId === 'undefined' || resolvedAppId === 'null') {
        setSaveMsg({
          type: 'err',
          text:
            'Missing ApplicationId. Pass it as a prop, include it in the URL (?ApplicationId=123), or store it in localStorage.',
        });
        return;
      }

      const AuthorisationGivenOption = authorisationGivenOption;
      const form = new URLSearchParams();
      form.set('ApplicationId', resolvedAppId);
      form.set('UnpaidInterestRate', unpaidInterestRate);      
      form.set('WithinFromDate', withinFromDate);      
      //form.set('AtlProFees', toNumString(professionalFees));
      //form.set('AtlProFeesSstAmt', toNumString(sstAmount));
      //form.set('AtlProFeesTotalAmt', toNumString(totalAmount));
      //form.set('AtlRentalAmt', toNumString(monthlyRentalAmount));
      //form.set('AtlEdFullAmt', toNumString(earnestDeposit));
      form.set('PoaFrom', isoToServerDate(commencingFromDate));
      form.set('PoaTo', isoToServerDate(commencingToDate));    
      const poaDurationPretty = formatDurationPretty(duration);
      form.set('PoaDuration', poaDurationPretty);
      form.set('AuthorisationGivenOption', String(AuthorisationGivenOption));
      if (
        Number(AuthorisationGivenOption) === 2 &&
        attorneyDate &&
        /^\d{4}-\d{2}-\d{2}$/.test(attorneyDate)
      ) {
        form.set('AttorneyDate', isoToServerDate(attorneyDate));
      }
            
      form.set('DeliveryOfPossessionOption', propertySaleOption);    
      form.set('Atp90PctgBalPaidWithinNo', String(atp90PctgBalPaidWithinNo || '0'));
      form.set('ExpiryExtensionPeriodNo', String(extensionMonths || '0'));    
      // NEW: interest months on unpaid balance (1–15)
      form.set('UnpaidBalanceInterestNo', String(unpaidInterestRate || '0'));

      //const res = await fetch(API_ENDPOINTS.INT_APPLICATION_ATL_SET, {
      const res = await fetch(API_ENDPOINTS.INT_SP_APPLICATION_ATS_SET, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if ((json as any)?.status === 'success') {
        if (onRefresh) await onRefresh();
        setSaveMsg({ type: 'ok', text: (json as any)?.data || 'ATS details updated successfully.' });
      } else {
        throw new Error((json as any)?.data || (json as any)?.message || 'Update failed.');
      }
    } catch (err: any) {
      console.error('Update ATS error:', err);
      setSaveMsg({ type: 'err', text: err?.message || 'Failed to update ATS details.' });
    } finally {
      setSaving(false);
    }
  };

  console.log('ATSSection about to render, resolvedAppId:', resolvedAppId, 'isExpanded:', isExpanded);

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
        {/* Header */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full bg-gray-400 hover:bg-gray-500 text-white px-6 py-4 flex items-center justify-between cursor-pointer select-none rounded-xl transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <h2 className="text-lg font-semibold">AUTHORISATION TO SELL (ATS)</h2>
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="p-6 bg-gray-50">
            {/* Server message */}
            {saveMsg && (
              <div
                className={`mb-4 p-3 rounded-lg ${
                  saveMsg.type === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}
              >
                {saveMsg.text}
              </div>
            )}

            {/* Authorisation Given As */}
            <div className="mb-8">
              <h3 className="text-lg font-medium text-blue-600 text-center mb-4">Authorisation Given As</h3>
              <div className="space-y-3">
                <label className="flex items-center space-x-3" title="POST: AuthorisationGivenOption (1)">
                  <input
                    type="radio"
                    name="authOption"
                    value="1"
                    checked={authorisationGivenOption === 1}
                    onChange={() => setAuthorisationGivenOption(1)}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Registered proprietor of the said property</span>
                </label>

<div className="flex items-center space-x-3" title="POST: AuthorisationGivenOption (2) + AttorneyDate">
  <input
    type="radio"
    name="authOption"
    value="2"
    checked={authorisationGivenOption === 2}
    onChange={() => setAuthorisationGivenOption(2)}
    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
  />

  <label className="text-sm text-gray-700">
    The Attorney of the owner of the said Property pursuant to the Power of Attorney dated: (
  </label>

  {/* REAL CALENDAR PICKER (stores ISO yyyy-MM-dd) */}
  <input
    type="date"
    id="attorneyDate"
    name="attorneyDate"
    value={attorneyDate}
    onChange={(e) => setAttorneyDate(e.target.value)}
    disabled={authorisationGivenOption !== 2}
    className={`border border-gray-300 rounded px-2 py-1 w-44 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
      authorisationGivenOption !== 2 ? 'bg-gray-100 text-gray-400' : ''
    }`}
  />

  <span className="text-sm text-gray-700">)</span>
  <Calendar className="w-4 h-4 text-gray-400" />
</div>
            
                <label className="flex items-center space-x-3" title="POST: AuthorisationGivenOption (3)">
                  <input
                    type="radio"
                    name="authOption"
                    value="3"
                    checked={authorisationGivenOption === 3}
                    onChange={() => setAuthorisationGivenOption(3)}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    Trustee for the legal owner(s) / Personal Representative (Executor or Administrator) of the owner(deceased)
                  </span>
                </label>
              </div>
            </div>

            {/* Period Of Authorisation */}
            <div className="mb-8">
              <h3 className="text-lg font-medium text-blue-600 text-center mb-4">Period Of Authorisation</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
                <LabelWithTip text="Commencing From" tip="POST: PoaFrom — endpoint: intApplicationAtlSet.php" />
                <div>
                  <input
                    type="date"
                    value={commencingFromDate}
                    onChange={(e) => setCommencingFromDate(e.target.value)}
                    onBlur={(e) => {
                      const input = e.target;
                      const newDate = input.value;
                      if (newDate && !isValidDate(newDate)) {
                        setDateError('Invalid date for Commencing From. Please check the date (e.g., Sept only has 30 days).');
                        setCommencingFromDate('');
                        setTimeout(() => setDateError(null), 5000);
                      } else if (input.validity && !input.validity.valid && newDate) {
                        setDateError('Invalid date for Commencing From. Please check the date.');
                        setCommencingFromDate('');
                        setTimeout(() => setDateError(null), 5000);
                      }
                    }}
                    className="border border-gray-300 rounded px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <LabelWithTip text="Commencing To" tip="POST: PoaTo — endpoint: intApplicationAtlSet.php" />
                <div>
                  <input
                    type="date"
                    value={commencingToDate}
                    onChange={(e) => setCommencingToDate(e.target.value)}
                    onBlur={(e) => {
                      const input = e.target;
                      const newDate = input.value;
                      if (newDate && !isValidDate(newDate)) {
                        setDateError('Invalid date for Commencing To. Please check the date (e.g., Sept only has 30 days).');
                        setCommencingToDate('');
                        setTimeout(() => setDateError(null), 5000);
                      } else if (input.validity && !input.validity.valid && newDate) {
                        setDateError('Invalid date for Commencing To. Please check the date.');
                        setCommencingToDate('');
                        setTimeout(() => setDateError(null), 5000);
                      }
                    }}
                    className="border border-gray-300 rounded px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center space-x-3">
                  <label className="text-sm font-medium text-gray-700">DURATION :</label>
                  <span className="text-sm text-gray-900 font-medium" title="Calculated client-side, not posted">
                    {formatDurationPretty(duration)}
                  </span>
                </div>
              </div>
            </div>

            {/* Terms & Conditions of Sale */}
            <div className="mb-8">
              <h3 className="text-lg font-medium text-blue-600 text-center mb-4">
                Terms & Conditions of Sale
              </h3>


              {/* ===== Row 1: 90% balance within ===== */}
<div className="flex flex-row items-center gap-3 mb-3">
  <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
    90% balance of purchase price paid within
  </label>

  <select
  name="Atp90PctgBalPaidWithinNo"
  value={atp90PctgBalPaidWithinNo}
  onChange={(e) => setAtp90PctgBalPaidWithinNo(e.target.value)}
  className="px-3 py-2 border border-gray-300 rounded-lg bg-white w-24 text-sm"
>
  {Array.from({ length: 10 }, (_, i) => i + 1).map(m => (
    <option key={m} value={String(m)}>{m}</option>
  ))}
</select>


  <span className="text-sm text-gray-700 whitespace-nowrap">month(s)</span>
</div>


{/* ===== Row 2: From the date of ===== */}
<div className="flex flex-row items-center gap-3 mb-3">
  <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
    From the date of
  </label>

  <select
    name="WithinFromDate"
    value={withinFromDate}
    onChange={(e) => setWithinFromDate(e.target.value)}
    className="px-3 py-2 border border-gray-300 rounded-lg bg-white flex-1 text-sm"
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
    <option value="Extract of the court order for sale">
      Extract of the court order for sale
    </option>
  </select>
</div>




  
  <div className="flex flex-row items-center gap-3 mb-3">
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



              <div className="flex flex-row items-center gap-3 mb-3">
  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Interest rate(%) charges on unpaid balance
                  </label>

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


              

              

              
              {/* === Your new four fields (inserted above the 90% balance block) === */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

                
                

                

                
                
              </div>

              {/* ==== Existing 90% balance / interest / property sale UI (unchanged) ==== */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
                
                
                {/* Property sale condition (label + dropdown) */}
                <div className="md:col-span-5">
                  <LabelWithTip
                    text="Property sale condition"
                    tip="UI only (not posted) — choose condition"
                    className="whitespace-normal leading-snug"
                  />
                </div>
                <div className="md:col-span-5">
                  <select
  value={propertySaleOption}
  onChange={(e) => setPropertySaleOption(e.target.value)}
  className="border border-gray-300 rounded px-3 py-2 w-full"
>
  <option value="1">With vacant possession</option>
  <option value="2">Non-vacant possession - subject to existing tenancy</option>
</select>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4">
              {/* server message (optional) */}
              {saveMsg && (
                <div
                  className={`mb-3 text-sm px-3 py-2 rounded ${
                    saveMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}
                >
                  {saveMsg.text}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={handleUpdateATL}
                  disabled={saving}
                  className={`bg-green-600 text-white text-sm px-6 py-3 rounded-lg font-medium transition-colors ${
                    saving ? 'opacity-60 cursor-not-allowed' : 'hover:bg-green-700'
                  }`}
                  title="Sends ATL fields including Atp90PctgBalPaidWithinNo & UnpaidBalanceInterestNo"
                >
                  {saving ? 'Saving…' : 'UPDATE ATS DETAILS'}
                </button>

                <button
                  onClick={handlePreviewEATL}
                  disabled={generating}
                  className={`bg-red-600 text-white text-sm px-6 py-3 rounded-lg font-medium transition-colors ${
                    generating ? 'opacity-60 cursor-not-allowed' : 'hover:bg-red-700'
                  }`}
                >
                  {generating ? 'Generating…' : 'GENERATE EATS'}
                </button>

                <button
                  onClick={handlePreviewGATL}
                  disabled={generating}
                  className={`bg-red-600 text-white text-sm px-6 py-3 rounded-lg font-medium transition-colors ${
                    generating ? 'opacity-60 cursor-not-allowed' : 'hover:bg-red-700'
                  }`}
                >
                  {generating ? 'Generating…' : 'GENERATE GATS'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Date Error Snackbar */}
      {dateError && (
        <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{dateError}</span>
        </div>
      )}

      {/* Modal PDF Viewer */}
      {showPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white w-[90vw] h-[90vh] rounded-lg overflow-hidden shadow-xl relative">
            <div className="absolute top-2 right-2 flex gap-2">
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  download={`${(refNo || 'ATL').replace(/[\/\\:*?"<>|]+/g, '_')}.pdf`}
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

export default ATSSection;
