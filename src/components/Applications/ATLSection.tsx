import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useEffect, useMemo, useState } from 'react';
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

    pdfMake.vfs = vfs;
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
    if (part === '<b>' || part === '<u>' || part === '<i>') { stack.push(part); continue; }
    if (part === '</b>' || part === '</u>' || part === '</i>') { stack.pop(); continue; }
    if (part === '<p>') { out.push({ text: '\n\n' }); continue; }
    if (part === '</p>') { continue; }
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
const money = (s: string) =>
  `RM ${Number.parseFloat(s || '0').toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;


const moneyTemplate1 = (s: string) =>
  `${Number.parseFloat(s || '0').toLocaleString(undefined, {
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

function isoToDDMMMYYYY(iso?: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const mon = MONTHS[m - 1];
  return `${String(d).padStart(2, '0')}-${mon}-${y}`;
}


function toNumString(x: string) {
  const cleaned = (x || '').replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned || '0';
}

/* ---------- date format converters ---------- */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const depositRowBase = { layout: 'noBorders', margin: [0, -2, 0, -2] } as const;

function serverDateToISO(s?: string): string {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // already ISO

  // Try mm-dd-yyyy format
  const m1 = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s.trim());
  if (m1) {
    const [, mm, dd, yyyy] = m1;
    return `${yyyy}-${mm}-${dd}`;
  }

  // Try dd-MMM-yyyy format (legacy)
  const m2 = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(s.trim());
  if (m2) {
    const [, dd, mon, yyyy] = m2;
    const idx = MONTHS.findIndex(x => x.toLowerCase() === mon.toLowerCase());
    if (idx < 0) return '';
    return `${yyyy}-${String(idx + 1).padStart(2,'0')}-${dd}`;
  }

  return '';
}

function isoToServerDate(iso?: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}-${mm}-${yyyy.slice(-2)}`; // dd-MM-yy
}

/* =======================================================================
   Calendar-accurate month/day diff (inclusive end date)
======================================================================= */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUTCDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function daysInMonthUTC(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}
function addCalendarMonthsUTC(base: Date, months: number): Date {
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const d = base.getUTCDate();
  const targetMonth0 = m + months;
  const tmp = new Date(Date.UTC(y, targetMonth0, 1));
  const dim = daysInMonthUTC(tmp.getUTCFullYear(), tmp.getUTCMonth());
  tmp.setUTCDate(Math.min(d, dim));
  return tmp;
}
/** Inclusive-end calendar diff */
function calendarDiffText(fromISO: string, toISO: string): string {
  const start = toUTCDate(fromISO);
  const endInclusive = new Date(toUTCDate(toISO).getTime() + MS_PER_DAY); // inclusive
  if (isNaN(start.getTime()) || isNaN(endInclusive.getTime()) || endInclusive < start) {
    return '0 month(s), 0 day(s)';
  }
  let months = 0;
  while (true) {
    const next = addCalendarMonthsUTC(start, months + 1);
    if (next > endInclusive) break;
    months += 1;
    if (months > 1200) break;
  }
  const anchor = addCalendarMonthsUTC(start, months);
  const days = Math.max(0, Math.floor((endInclusive.getTime() - anchor.getTime()) / MS_PER_DAY));
  return `${months} month(s), ${days} day(s)`;
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
interface ATLSectionProps {
  applicationId?: number | string;
  application?: any;

  /** IntFormInsert endpoint (server) */
  insertUrl?: string;
  /** Optional same-origin proxy endpoint, e.g. '/api/IntFormInsert' */
  insertProxyUrl?: string;

  /** EATL identifiers */
  docMUid?: string;       // EATL Document UID
  docContent1?: string;   // 'Exclusive Authorisation To Let (EATL)'

  /** After generating PDF, upload to this URL (server) */
  uploadUrl?: string;
  /** Optional same-origin proxy endpoint for upload */
  uploadProxyUrl?: string;

  /** GATL identifiers (separate from EATL) */
  gatlDocMUid?: string;       // GATL Document UID
  gatlDocContent1?: string;   // 'General Authorisation To Let (GATL)'
  onSilentRefresh?: () => Promise<void> | void;
}

/* =======================================================================
   Component
======================================================================= */
const ATLSection: React.FC<ATLSectionProps> = ({
  applicationId,
  application,

  insertUrl = API_ENDPOINTS.INT_FORM_INSERT,
  insertProxyUrl, // e.g. '/api/IntFormInsert'

  // EATL defaults
  docMUid = 'FCA08ECD-71A3-4B75-A28B-33FDE29FB168',
  docContent1 = 'Exclusive Authorisation To Let (EATL)',

  uploadUrl = API_ENDPOINTS.UPLOAD,
  uploadProxyUrl, // e.g. '/api/Upload'

  // GATL defaults
  gatlDocMUid = '950D53F5-2C60-431C-ADEF-007717B8E601',
  gatlDocContent1 = 'General Authorisation To Let (GATL)',
  onSilentRefresh,
}) => {
  const [resolvedAppId, setResolvedAppId] = useState<string | null>(null);

  // === UPDATED: centralized edit gate (Active / Pending Review / Rejected) ===
  const canEdit = useMemo(() => {
    const s = String(application?.ApplicationStatus ?? '').trim().toUpperCase();
    return ['ACTIVE', 'PENDING REVIEW', 'REJECTED'].includes(s);
  }, [application?.ApplicationStatus]);

  // Date validation helper
  const isValidDate = (dateString: string): boolean => {
    if (!dateString) return true;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return false;
    const [year, month, day] = dateString.split('-').map(Number);
    return date.getFullYear() === year &&
           date.getMonth() === month - 1 &&
           date.getDate() === day;
  };

  // Fees and amounts (UI)
  const [professionalFees, setProfessionalFees] = useState('10500');
  const [sstChecked, setSstChecked] = useState(true);
  const [sstAmount, setSstAmount] = useState('840.00');
  const [totalAmount, setTotalAmount] = useState('11340.00');
  const [monthlyRentalAmount, setMonthlyRentalAmount] = useState('5500');
  const [earnestDeposit, setEarnestDeposit] = useState('10000');

  // Authorisation (UI)
  const [attorneyDate, setAttorneyDate] = useState('___21___'); // UI only
  const [authorisationGivenOption, setAuthorisationGivenOption] = useState<number>(1);

  // --- derived text for "capacity as ..." (underlined in PDF)
  const conditionText = React.useMemo(() => {
    switch (authorisationGivenOption) {
      case 1: return 'Registered proprietor of the said property';
      case 2: return `The Attorney of the owner of the said Property pursuant to the Power of Attorney dated`;
      case 3: return 'Trustee for the legal owner(s) / Personal Representative (Executor or Administrator) of the owner (deceased)';
      default: return '';
    }
  }, [authorisationGivenOption]);

  // Period
  const [commencingFromDate, setCommencingFromDate] = useState('2025-08-01'); // ISO
  const [commencingToDate, setCommencingToDate] = useState('2025-08-31');     // ISO
  const [duration, setDuration] = useState('1 month(s), 0 day(s)');

  // PDF header values
  const [refNo, setRefNo] = useState(''); // replaced by IntFormInsert
  const [propertyType, setPropertyType] = useState<string>(application?.PropertyType || 'Retail Lot');
  const [propertyAddress, setPropertyAddress] = useState<string>(application?.PropertyAddress || 'Property Address');

  // Upload will need the doc log id created by IntFormInsert
  const [docMLogId, setDocMLogId] = useState<string | null>(null);

  // PDF preview state
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdf, setShowPdf] = useState(false);
  const [generatingEATL, setGeneratingEATL] = useState(false);
  const [generatingGATL, setGeneratingGATL] = useState(false);

  // Save state
  const [isExpanded, setIsExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<null | { type: 'ok' | 'err'; text: string }>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const closePdf = () => {
    if (pdfUrl && pdfUrl.startsWith('blob:')) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setShowPdf(false);
  };
 

  useEffect(() => {
  const id = deriveApplicationId(applicationId, application);
  if (id) {
    setResolvedAppId(id);
    localStorage.setItem('ApplicationId', id);
  } else {
    setResolvedAppId(null);
  }

  // ❗ ADD THIS LINE to prevent mutation
  if (application) Object.freeze(application); // ⬅️ add this here

}, [applicationId, application]);

  
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

  /* Hydrate dates from server format dd-MMM-yyyy -> ISO for input */
  useEffect(() => {
    const fromISO = serverDateToISO(application?.PoaFrom);
    if (fromISO) setCommencingFromDate(fromISO);
    const toISO = serverDateToISO(application?.PoaTo);
    if (toISO) setCommencingToDate(toISO);
  }, [application?.PoaFrom, application?.PoaTo]);

  /* Hydrate attorneyDate (dd-MMM-yyyy or mm-dd-yyyy -> ISO) */
useEffect(() => {
  const iso = serverDateToISO(application?.AttorneyDate);
  if (iso) setAttorneyDate(iso);
}, [application?.AttorneyDate]);

  
  /* Hydrate duration from server if present */
  useEffect(() => {
    if (application?.PoaDuration) setDuration(application.PoaDuration);
  }, [application?.PoaDuration]);

  /* Keep property header fields in sync with application */
  useEffect(() => {
    if (application?.PropertyType) setPropertyType(application.PropertyType);
    if (application?.PropertyAddress) setPropertyAddress(application.PropertyAddress);
  }, [application?.PropertyType, application?.PropertyAddress]);

  /* >>> Sync fee/rental/deposit inputs with refreshed `application` <<< */
  useEffect(() => {
    if (!application) return;
    if (application.AtlProFees != null)         setProfessionalFees(String(application.AtlProFees));
    if (application.AtlProFeesSstAmt != null)   setSstAmount(String(application.AtlProFeesSstAmt));
    if (application.AtlProFeesTotalAmt != null) setTotalAmount(String(application.AtlProFeesTotalAmt));
    if (application.AtlRentalAmt != null)       setMonthlyRentalAmount(String(application.AtlRentalAmt));
    if (application.AtlEdFullAmt != null)       setEarnestDeposit(String(application.AtlEdFullAmt));
    if (application.AtlProFeesSstAmt != null)   setSstChecked(Number(application.AtlProFeesSstAmt) > 0);
  }, [
    application?.AtlProFees,
    application?.AtlProFeesSstAmt,
    application?.AtlProFeesTotalAmt,
    application?.AtlRentalAmt,
    application?.AtlEdFullAmt,
  ]);

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

  /* Duration calc */
  useEffect(() => {
    if (commencingFromDate && commencingToDate) {
      setDuration(calendarDiffText(commencingFromDate, commencingToDate));
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
  const buildDocDefinitionEATL = (title: string, logoDataUrl?: string, footerDataUrl?: string, refNoValue?: string) =>
    ({
      info: {
        title,
        author: 'InteRealtor',
        subject: 'Exclusive Authorisation To Let',
        keywords: 'ATL, EATL, Tenancy, InteRealtor',
      },
      pageSize: 'A4',
      //pageMargins: [40, 80, 40, 95],
      pageMargins: [25, 75, 25, 95],
      header: (_currentPage: number, _pageCount: number, pageSize: any) => ({
        margin: [40, 20, 40, 0],
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
                  body: [[{ text: 'EXCLUSIVE AUTHORISATION TO LET', color: '#fff', bold: true, alignment: 'center', fontSize: 12, margin: [0, 8, 0, 8], fillColor: '#000' }]],
                },
                layout: 'noBorders',
              },
            ],
            columnGap: 20,
          },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: pageSize.width - 80, y2: 0, lineWidth: 1 }], margin: [0, 6, 0, 0] },
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
        { text: `Reference Number : ${refNoValue || refNo || ''}`, alignment: 'right', fontSize: 8, margin: [0, 0, 0, 5] },



oneRowText(
  `  Property Type : <u>${propertyType || ''}</u>   Address: <u>${propertyAddress || ''}${application?.PropertyPostalCode ? ', ' + application.PropertyPostalCode : ''}${application?.PropertyState ? ', ' + application.PropertyState : ''}</u>`
),
        
        
 
        
        (

          
          (() => {

            const attyIso = attorneyDate || serverDateToISO(application?.AttorneyDate);
            
  if (application.AuthorisationGivenOption === '1') {
    return clauseRow2Col(
      '0%', '100%', '',
      `This authorisation to let is hereby given by me/us, to Interealtor Sdn. Bhd. (816059-H) [E(1)1930] ("InteRealtor") in the capacity as <u>Registered proprietor of the said property.</u>`
    );
  }

  if (application.AuthorisationGivenOption === '2') { 
    return clauseRow2Col('0%', '100%', '', `This authorisation to let is hereby given by me/us, to Interealtor Sdn. Bhd. (816059-H) [E(1)1930] ("InteRealtor") in the capacity as <u>The Attorney of the owner of the said Property pursuant to the Power of Attorney dated ${application.AttorneyDate}.</u>`);
  }


            if (application.AauthorisationGivenOption === '3') {
    return clauseRow2Col('0%', '100%', '', `This authorisation to let is hereby given by me/us, to Interealtor Sdn. Bhd. (816059-H) [E(1)1930] ("InteRealtor") in the capacity as <u>The Attorney of the owner of the said Property pursuant to the Power of Attorney dated ${application.AttorneyDate}.</u>`);
  }
            

  return clauseRow2Col(
    '0%', '100%', '',
    `This authorisation to let is hereby given by me/us, to Interealtor Sdn. Bhd. (816059-H) [E(1)1930] ("InteRealtor") in the capacity as <u>Trustee for the legal owner(s) / Personal Representative (Executor or Administrator) of the owner (deceased).</u>`
  );
})()
 
        ),
        clauseRow2Col(
  '0%',
  '100%',
  '',
  `I/We, do hereby appoint InteRealtor to be my/our EXCLUSIVE AGENT for a period of <u>${calendarDiffText(
    serverDateToISO(application?.PoaFrom),
    serverDateToISO(application?.PoaTo)
  )}</u>, commencing from <u>${isoToServerDate(serverDateToISO(application?.PoaFrom))}</u> to <u>${isoToServerDate(serverDateToISO(application?.PoaTo))}</u> (Exclusive Period) for the rental of the Property to any Tenant(s) at the rental of <u>${money(monthlyRentalAmount)}</u> (only) or nearest offer to be agreed by the Landlord(s) upon the following terms and conditions:`
),
        clauseRow2Col('3%', '97%', '1', `The Landlord(s) hereby confirms and agrees to pay InteRealtor a Professional Fee of <u>${money(application.AtlProFeesTotalAmt)}</u> inclusive of 8% SST on the Professional Fee upon the rental of the Property to any Tenant(s) procured or introduced by InteRealtor upon the execution of the Tenancy Agreement (TA), in accordance to the Seventh Schedule (Rule 84) of the Valuers, Appraisers, Estate Agents and Property Manager Act 1981 (Act 242).`),
        
        
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'For tenancy up to 3 years - 1.25 months gross rental', style: 'terms' , margin: [21, 4, 0, 0]},
                { text: 'Exceeding 3 years up to 4 years - 1.50 months gross rental', style: 'terms', margin: [21, 4, 0, 0] },
                { text: 'Exceeding 5 years - 1.75 months gross rental', style: 'terms', margin: [21, 4, 0, 0] },
                { text: 'For Rent Reviews - 50% of the fees chargeable.', style: 'terms', margin: [21, 4, 0, 0] },
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
                  [{ text: 'Total', fontSize: 8 }, { text: money(application.AtlProFeesTotalAmt), alignment: 'right', fontSize: 8 }],
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
        clauseRow2Col('3%', '97%', '', `a) During the Exclusive Period, InteRealtor procure a Tenant(s) on the term specified herein and upon the execution of the formal TA notwithstanding the relevant conditional precedent (if any) involving this rental transaction has yet to be obtained; or`),
        clauseRow2Col('3%', '97%', '', `b) During the Exclusive Period, the Property is leased/rented by the Landlord(s) personally or through other agent/person other than InteRealtor; or`),
        clauseRow2Col('3%', '97%', '', `c) During the Exclusive Period, the Property is sold, exchanged or otherwise transferred; or`),
        clauseRow2Col('3%', '97%', '', `d) During the Exclusive Period, the Property is withdrawn from the market or if this authorisation is revoked or terminated by the Landlord(s).`),
        clauseRow2Col('3%', '97%', '', `e) After the expiry of the Exclusive Period, the Landlord(s) entered into a lease/rent, sale exchange or other transfer of the property with a prospect who was introduced, sourced or procured by InteRealtor prior to the expiry of the Exclusive Period.`),
        clauseRow2Col('3%', '97%', '2.', `This exclusive authorisation shall be considered as renewed for a period equivalent to the original term unless it is terminated in writing by either party. The Exclusive Period shall expire at the end of the extended term unless it is renewed by the parties hereto by mutual consent and upon new terms and conditions to be agreed between the parties.`),
        clauseRow2Col('3%', '97%', '3.', `InteRealtor is hereby authorised to accept and receive on behalf of the Landlord(s) an earnest deposit amounting to  <u>${money(application.AtlEdFullAmt)}</u> (Earnest Deposit) as Stakeholder AND InteRealtor is authorised to deduct the said Professional Fee from the Earnest Deposit before releasing the balance (if any) to the Landlord(s). In the event the Earnest Deposit is insufficient to pay the Professional Fee, the Landlord(s) agrees and undertakes to remit the shortfall immediately.`),
        clauseRow2Col('3%', '97%', '4.', `In the event the Earnest Deposit/forfeitable deposit has been paid and the rental transaction is aborted by the Landlord(s) OR the Tenant(s) before the execution of the TA, the Landlord(s) agrees to pay InteRealtor a sum equivalent to 50% of the Earnest Deposit/forfeitable deposit OR 50% of the agreed full fees, whichever is lesser, plus the applicable SST, as a proportion of the Professional Fee for the services already rendered in relation to the Property by InteRealtor`),
        
        clauseRow2Col('3%', '97%', '5.', `The Landlord(s) hereby authorises InteRealtor to put up a TO LET signboard at the Property and/or to advertise through any form of media to promote the rental of the Property.`),

        clauseRow2Col('3%', '97%', '6.', `Terms and Conditions of Payment`),    
        
        clauseRowDualItemTemplate1(
          '4%', '18%', '3%', '25%',  
          '', 'RM',
          '', 'RM'
        ),
        
        clauseRowDualItem(
          '4%', '18%', '3%', '25%',  
          'Rental in Advance', moneyTemplate1(application.AtrAdvRentalAmt),
          'Security Deposit', moneyTemplate1(application.AtrSecurityDepositAmt)
        ),
        clauseRowDualItem(
          '4%', '18%', '3%', '25%',
          'Utility Deposit', moneyTemplate1(application.AtrUtilityDepositAmt),
          'Access Card', moneyTemplate1(application.AtrAccessCard)
        ),
        clauseRowDualItem(
          '4%', '18%', '3%', '25%',
          'Indah Water', moneyTemplate1(application.AtrIndahWater),
          'Others', moneyTemplate1(application.AtrOtherDepositAmt)
        ),

        clauseRow2Col('3%', '97%','',''),
        clauseRow2Col('3%', '97%', '7.', `I/We hereby declare that I/we have not appointed any other real estate agency firm as of this date of appointment.`),
        //clauseRow2Col('4%', '96%', '', ``),
        
        
        {
          table: { widths: ['25%', '25%', '25%', '25%'], body: [[{ text: '', style: 'termsNumber' }, { text: '', style: 'termsNumber' }, { text: '', style: 'termsNumber' }, { text: 'Signed in the presence of', style: 'termsNumber' }]] },
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

  const earnestDepositTxt = money(String(application?.AtlEdFullAmt ?? '0'));
  const proFeesTxt      = money(String(application?.AtlProFees ?? professionalFees ?? '0'));
  const proFeesSstTxt   = money(String(application?.AtlProFeesSstAmt ?? sstAmount ?? '0'));
  const proFeesTotalTxt = money(String(application?.AtlProFeesTotalAmt ?? totalAmount ?? '0'));

  const fromTxt = isoToServerDate(commencingFromDate);
  const toTxt   = isoToServerDate(commencingToDate);
  const rentalTxt = money(String(application?.AtlRentalAmt ?? monthlyRentalAmount ?? '0'));

  const buildDocDefinitionGATL = (title: string, logoDataUrl?: string, footerDataUrl?: string, refNoValue?: string) =>
    ({
      info: {
        title,
        author: 'InteRealtor',
        subject: 'General Authorisation To Let',
        keywords: 'ATL, GATL, Tenancy, InteRealtor',
      },
      pageSize: 'A4',
      //pageMargins: [40, 80, 40, 95],
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
                  body: [[{ text: 'GENERAL AUTHORISATION TO LET', color: '#fff', bold: true, alignment: 'center', fontSize: 12, margin: [0, 8, 0, 8], fillColor: '#000' }]],
                },
                layout: 'noBorders',
              },
            ],
            columnGap: 20,
          },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: pageSize.width - 80, y2: 0, lineWidth: 1 }], margin: [0, 6, 0, 0] },
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
        terms: { fontSize: 8, lineHeight: 1.25 },
        listItem: { fontSize: 8, margin: [0, 2, 0, 2] },
        tableHeader: { bold: true, fillColor: '#efefef' },
        termsNumber: { fontSize: 8 },
        
      },
      images: {
        ...(logoDataUrl ? { logo: logoDataUrl } : {}),
        ...(footerDataUrl ? { footerBanner: footerDataUrl } : {}),
      },
      content: [
        { text: `Reference Number : ${refNoValue || refNo || ''}`, alignment: 'right', fontSize: 8, margin: [0, 0, 0, 14] },
        
        
oneRowText(
  `Property Type : <u>${propertyType || ''}</u>   Address: <u>${propertyAddress || ''}${application?.PropertyPostalCode ? ', ' + application.PropertyPostalCode : ''}${application?.PropertyState ? ', ' + application.PropertyState : ''}</u>`
),        
        clauseRow2Col('0%', '100%', '', `This authorisation to let is hereby given by me/us,  to Interealtor Sdn. Bhd. (816059-H) [E(1)1930] ("InteRealtor") in the capacity as <u>${conditionText}</u>`),
        clauseRow2Col('0%', '100%', '', `I/We, do hereby appoint InteRealtor to be my/our AGENT for a period of <u>${duration}</u> commencing from <u>${fromTxt}</u> to <u>${toTxt}</u> for the rental of the Property to any tenant(s) at a monthly rental of <u>${rentalTxt}</u> only or any nearest offer to be agreed by the Landlord(s) upon the following terms and conditions : -`),
        clauseRow2Col('3%', '97%', '1. ', `The Landlord(s) hereby confirms and agrees to pay InteRealtor a Professional Fee of <u>${proFeesTotalTxt}</u> inclusive of 8% SST on the Professional Fee upon the rental of the Property to any Tenant procured or introduced by InteRealtor upon the execution of the Tenancy Agreement (TA), in accordance to the Seventh Schedule (Rule 84) of the Valuers, Appraisers, Estate Agents and Property Manager Act 1981(Act 242).`),
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'Up to 3 years — 1.25 months gross rental', style: 'terms' ,margin: [21, 4, 0, 0]},
                
                { text: 'Exceeding 3 up to 4 years — 1.50 months gross rental', style: 'terms', margin: [21, 4, 0, 0] },
                { text: 'Exceeding 5 years — 1.75 months gross rental', style: 'terms', margin: [21, 4, 0, 0] },
                { text: 'Rent Reviews — 50% of fees chargeable', style: 'terms', margin: [21, 4, 0, 0] },
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
                  [{ text: 'Total', fontSize: 8 }, { text: money(application.AtlProFeesTotalAmt), alignment: 'right', fontSize: 8}],
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
        clauseRow2Col('3%', '97%', '2. ', `InteRealtor is hereby authorised to accept and receive on behalf of the Landlord(s) an earnest deposit amounting to <u>${earnestDepositTxt}</u> (Earnest Deposit) as Stakeholder AND InteRealtor is authorised to deduct the said Professional Fee from the Earnest Deposit before releasing the balance (if any) to the Landlord(s). In the event the Earnest Deposit is insufficient to pay the Professional Fee, the Landlord(s) agrees and undertakes to remit the shortfall immediately.`),
        clauseRow2Col('3%', '97%', '3. ', `In the event the Earnest Deposit/forfeitable deposit has been paid and the rental transaction is aborted by the Landlord(s) OR the Tenant(s) before the execution of the TA, the Landlord(s) agrees to pay InteRealtor a sum equivalent to 50% of the Earnest Deposit/forfeitable deposit OR 50% of the agreed full fees, whichever is lesser, plus the applicable SST, as a proportion of the Professional Fee for the services already rendered in relation to the rental of the Property by InteRealtor.`),
        clauseRow2Col('3%', '97%', '4. ', `The Landlord(s) agrees to fully indemnify InteRealtor against any and all losses, damages and claims by the Tenant(s) if the Landlord(s) for any reasons whatsoever fail to execute, or does not proceed to execute the TA after the Earnest Deposit has been paid or collected.`),
        clauseRow2Col('3%', '97%', '5. ', `The Landlord(s) hereby authorises InteRealtor to put up a TO LET signboard at the Property and/or to advertise through any form of media to promote the rental of the Property.`),        
        clauseRow2Col('3%', '97%', '', ''),
        clauseRow2Col('3%', '97%', '6. ', `Terms and Conditions of Payment`),


        clauseRowDualItemTemplate1(
          '4%', '18%', '3%', '25%',  
          '', 'RM',
          '', 'RM'
        ),

        clauseRowDualItem(
          '4%', '18%', '3%', '25%',  
          'Rental in Advance', moneyTemplate1(application.AtrAdvRentalAmt),
          'Security Deposit', moneyTemplate1(application.AtrSecurityDepositAmt)
        ),
        clauseRowDualItem(
          '4%', '18%', '3%', '25%',
          'Utility Deposit', moneyTemplate1(application.AtrUtilityDepositAmt),
          'Access Card', moneyTemplate1(application.AtrAccessCard)
        ),
        clauseRowDualItem(
          '4%', '18%', '3%', '25%',
          'Indah Water', moneyTemplate1(application.AtrIndahWater),
          'Others', moneyTemplate1(application.AtrOtherDepositAmt)
        ),
      
        clauseRow2Col('3%', '97%', '', ''),
        clauseRow2Col('3%', '97%', '7. ', `This authorisation to let shall be considered as renewed for a period equivalent to the original term if neither party gives a notice of the termination in writing.`),
        
        clauseRow2Col('3%', '97%', '', ''),
        // Signature block (unchanged)
        {
          table: { widths: ['25%', '25%', '25%', '25%'], body: [[{ text: '', style: 'termsNumber' }, { text: '', style: 'termsNumber' }, { text: '', style: 'termsNumber' }, { text: 'Signed in the presence of', style: 'termsNumber' }]] },
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
 
  function clauseRow2Col(param1: any, param2: any, param3: any, param4: string) {
    return {
      table: {
        widths: [param1, param2],
        body: [[
          { text: String(param3), style: 'termsNumber' },
          {
            text: htmlToPdfmakeLite(param4),
            style: 'terms',
            alignment: 'justify'
          }
        ]]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 3],
    };
  }


  function clauseRowDualItem(
  numWidth: any,
  labelWidth: any,
  colonWidth: any,
  valueWidth: any,
  label1: string,
  value1: string,
  label2: string,
  value2: string
) {
  return {
    table: {
      widths: [numWidth, labelWidth, colonWidth, valueWidth, labelWidth, colonWidth, valueWidth],
      body: [[
        { text: '', style: 'termsNumber' },
        { text: htmlToPdfmakeLite(label1), style: 'terms', alignment: 'left' },
        { text: ':', style: 'terms', alignment: 'center' },
        { text: htmlToPdfmakeLite(`<u>${value1}</u>`), style: 'terms', alignment: 'right' },
        { text: htmlToPdfmakeLite(label2), style: 'terms', alignment: 'left' },
        { text: ':', style: 'terms', alignment: 'center' },
        { text: htmlToPdfmakeLite(`<u>${value2}</u>`), style: 'terms', alignment: 'right' },
      ]]
    },
    layout: 'noBorders',
    margin: [0, 0, 0, -3],
  };
}


  function clauseRowDualItemTemplate1(
  numWidth: any,
  labelWidth: any,
  colonWidth: any,
  valueWidth: any,
  label1: string,
  value1: string,
  label2: string,
  value2: string
) {
  return {
    table: {
      widths: [numWidth, labelWidth, colonWidth, valueWidth, labelWidth, colonWidth, valueWidth],
      body: [[
        { text: '', style: 'termsNumber' },
        { text: htmlToPdfmakeLite(label1), style: 'terms', alignment: 'left' },
        { text: '', style: 'terms', alignment: 'center' },
        { text: htmlToPdfmakeLite(`${value1}`), style: 'terms', alignment: 'right' },
        { text: htmlToPdfmakeLite(label2), style: 'terms', alignment: 'left' },
        { text: ':', style: 'terms', alignment: 'center' },
        { text: htmlToPdfmakeLite(`${value2}`), style: 'terms', alignment: 'right' },
      ]]
    },
    layout: 'noBorders',
    margin: [0, 0, 0, -3],
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
     Preview + IntFormInsert + PDF + Upload
  ====================================================================== */
  async function runFullFlow(
    kind: 'EATL' | 'GATL',
    title: string,
    docUid: string,
    docContent: string,
    setGeneratingState: (value: boolean) => void
  ) {
    // UPDATED guard message
    if (!canEdit) { alert('This section is read-only (status is not Active / Pending Review / Rejected).'); return; }

    try {
      setGeneratingState(true);

      if (!resolvedAppId) {
        alert('Missing ApplicationId. Cannot generate.');
        setGeneratingState(false);
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
        kind === 'EATL'
          ? buildDocDefinitionEATL(title, logoDataUrl, footerDataUrl, newRefNo)
          : buildDocDefinitionGATL(title, logoDataUrl, footerDataUrl, newRefNo);

      const pdf = pdfMake.createPdf(docDefinition);

      pdf.getBlob(async (blob: Blob) => {
        const objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
        setShowPdf(true);

        try {
          await uploadPdfBlob(blob, resolvedAppId, newDocId, kind);
        } catch (e: any) {
          console.error(`[${kind}] Failed to upload PDF:`, e);
          alert(e?.message || 'Failed to upload PDF.');
        } finally {
          setGeneratingState(false);
        }
      });
    } catch (e: any) {
      console.error(`[${kind}] Failed to generate PDF:`, e);
      alert(e?.message || 'Failed to generate PDF.');
      setGeneratingState(false);
    }
  }

  const handlePreviewEATL = () =>
    runFullFlow('EATL', 'Exclusive Authorisation To Let (EATL)', 'FCA08ECD-71A3-4B75-A28B-33FDE29FB168', docContent1, setGeneratingEATL);

  const handlePreviewGATL = () =>
    runFullFlow('GATL', 'General Authorisation To Let (GATL)', gatlDocMUid || docMUid, gatlDocContent1, setGeneratingGATL);

  /* =====================================================================
     SAVE ATL to PHP
  ====================================================================== */
  const handleUpdateATL = async () => {
  if (!canEdit) {
    alert('This application is read-only (status is not Active / Pending Review / Rejected).');
    return;
  }

  try {
    setSaving(true);
    setSaveMsg(null);

    if (!resolvedAppId || resolvedAppId === 'undefined' || resolvedAppId === 'null') {
      setSaveMsg({
        type: 'err',
        text: 'Missing ApplicationId. Pass it as a prop, include it in the URL (?ApplicationId=123), or store it in localStorage.',
      });
      return;
    }

    const AuthorisationGivenOption = authorisationGivenOption;
    const form = new URLSearchParams();
    form.set('ApplicationId', resolvedAppId);
    form.set('PoaFrom', isoToServerDate(commencingFromDate));
    form.set('PoaTo', isoToServerDate(commencingToDate));
    form.set('AuthorisationGivenOption', String(AuthorisationGivenOption));
    form.set('PoaDuration', duration);
    form.set('AttorneyDate', attorneyDate ? isoToDDMMMYYYY(attorneyDate) : '');

    const res = await fetch(API_ENDPOINTS.INT_APPLICATION_ATL_SET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();

    if (json?.status === 'success') {
      setSaveMsg(null);
      alert('ATL details updated successfully.');
      try {
        await onSilentRefresh?.();
      } catch (e) {
        console.warn('Parent refresh failed:', e);
      }
    } else {
      throw new Error(json?.data || json?.message || 'Update failed.');
    }
  } catch (err: any) {
    console.error('Update ATL error:', err);
    setSaveMsg({ type: 'err', text: err?.message || 'Failed to update ATL details.' });
  } finally {
    setSaving(false);
  }
};

  /* =====================================================================
     UI
  ====================================================================== */
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
            <h2 className="text-lg font-semibold">AUTHORISATION TO LET - ATL</h2>
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="p-6 bg-gray-50">
            {/* READ-ONLY banner */}
            {!canEdit && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-sm">
                This section is <b>read-only</b> because ApplicationStatus is <b>{String(application?.ApplicationStatus ?? 'N/A')}</b>.
                Editing is allowed only when status is <b>Active</b>, <b>Pending Review</b>, or <b>Rejected</b>.
              </div>
            )}

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

            {/* Wrap everything editable */}
            <fieldset disabled={!canEdit} aria-disabled={!canEdit} className={`${!canEdit ? 'opacity-75 select-none' : ''}`}>
              {/* Authorisation Given As */}
              <div className="mb-3">
                <h3 className="text-lg font-medium text-blue-600 text-center mb-2">Authorisation Given As</h3>
                <div className="space-y-1">
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
                      Trustee for the legal owner(s) / Personal Representative (Executor or Administrator) of the owner (deceased)
                    </span>
                  </label>
                </div>
              </div>

              {/* Period Of Authorisation */}
              <div className="mb-3">
                <h3 className="text-lg font-medium text-blue-600 text-center mb-2">Period Of Authorisation.</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-3">
                    <LabelWithTip text="Commencing From" tip="POST: PoaFrom — endpoint: intApplicationAtlSet.php" />
                    <div className="w-48">
                      <input
                        type="date"
                        lang="en-US"
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
                        className={`border border-gray-300 rounded px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          !canEdit ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-auto">
                      <LabelWithTip text="To.." tip="POST: PoaTo — endpoint: intApplicationAtlSet.php" />
                    </div>
                    <div className="w-48">
                      <input
                        type="date"
                        lang="en-US"
                        value={commencingToDate}
                        onChange={(e) => setCommencingToDate(e.target.value)}
                        onBlur={(e) => {
                          const input = e.target;
                          const newDate = input.value;
                          if (newDate && !isValidDate(newDate)) {
                            setDateError('Invalid date for To. Please check the date (e.g., Sept only has 30 days).');
                            setCommencingToDate('');
                            setTimeout(() => setDateError(null), 5000);
                          } else if (input.validity && !input.validity.valid && newDate) {
                            setDateError('Invalid date for To. Please check the date.');
                            setCommencingToDate('');
                            setTimeout(() => setDateError(null), 5000);
                          }
                        }}
                        className={`border border-gray-300 rounded px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          !canEdit ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700 whitespace-nowrap">DURATION :</label>
                    <span className="text-sm text-gray-900 font-medium" title="Calculated client-side, not posted">
                      {duration}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col items-center gap-3">
                <div className="flex gap-4">
                  <button
                    onClick={handleUpdateATL}
                    disabled={saving || !canEdit}
                    className={`bg-green-600 text-white px-6 py-2 rounded-lg transition-colors font-medium ${
                      saving || !canEdit ? 'opacity-60 cursor-not-allowed' : 'hover:bg-green-700'
                    }`}
                    title="Sends fields: AtlProFees, AtlProFeesSstAmt, AtlProFeesTotalAmt, AtlRentalAmt, AtlEdFullAmt, PoaFrom, PoaTo, AuthorisationGivenOption, Duration"
                  >
                    {saving ? 'Saving…' : 'UPDATE ATL DETAILS'}
                  </button>
                  <button
                    onClick={handlePreviewEATL}
                    disabled={generatingEATL || !canEdit}
                    className={`bg-red-600 text-white px-6 py-2 rounded-lg transition-colors font-medium ${
                      generatingEATL || !canEdit ? 'opacity-60 cursor-not-allowed' : 'hover:bg-red-700'
                    }`}
                  >
                    {generatingEATL ? 'Generating…' : 'GENERATE EATL'}
                  </button>
                  <button
                    onClick={handlePreviewGATL}
                    disabled={generatingGATL || !canEdit}
                    className={`bg-red-600 text-white px-6 py-2 rounded-lg transition-colors font-medium ${
                      generatingGATL || !canEdit ? 'opacity-60 cursor-not-allowed' : 'hover:bg-red-700'
                    }`}
                  >
                    {generatingGATL ? 'Generating…' : 'GENERATE GATL'}
                  </button>
                </div>

                {saveMsg && (
                  <div
                    className={`text-sm px-3 py-2 rounded ${
                      saveMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {saveMsg.text}
                  </div>
                )}
              </div>
            </fieldset>
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

export default ATLSection;
