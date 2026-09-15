import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';


// --- module-level "global" (visible to everything in this file) ---
let __wtaApplication: any = null;
const setWtaApplication = (app: any) => { __wtaApplication = app; };

/* -------- Money helpers -------- */
const toMoneyString = (s: string) => {
  const cleaned = (s || '').replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join('')}`;
};
const parseMoney = (s: string) => {
  const n = parseFloat((s || '0').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const fmt2 = (n: number) => n.toFixed(2);

/* =======================================================================
   (CLONED) pdfmake loader (ESM-safe, once) — from AtrSession
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
   (CLONED) Tiny inline HTML → pdfmake runs helper (no deps)
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
   (CLONED) Public asset -> PNG dataURL (expects files under /public)
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
   (CLONED) Misc helpers used by the generate flow
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

/* =======================================================================
   (CLONED) Build a helpful CORS hint
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
        `• Add a same-origin proxy (e.g. /api/${endpointLabel}) that POSTs to ${u.origin}), or\n` +
        `• Ensure the server allows CORS (Access-Control-Allow-Origin: *) and that your host/firewall allows OPTIONS/POST.`
      );
    }
  } catch {}
  return `Network error calling ${endpointLabel}. Check server is reachable.`;
}

/* =======================================================================
   (CLONED) Compact table row builders for pdfmake
======================================================================= */
const depositRowBase = {
  layout: 'noBorders',
  
  //margin: [-5, -2, -5, -2],
  margin: [-5, -2, -5, -2],
} as const;

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

function signatureRow(value1: string, value2: string, value3: string, value4: string) {
  return {
    ...depositRowBase,
    table: {
      widths: ['33%', '33%', '33%',],
      heights: (_row: number) => 8,            // must be inside `table`
      body: [[
        { text: value1, style: 'terms' },        
        { text: value2, style: 'terms' },        
        { text: value3, style: 'terms' },        
        //{ text: 'value4', style: 'termsNumber' },                
      ]]
    }
  };
}

function signatureRow_1(v1: string, v2: string, v3: string, v4: string) {
  return {
    ...depositRowBase,
    table: {
      widths: ['33%', '33%', '33%'],
      heights: (_row: number) => 8,
      body: [[
        { text: v1, style: 'termsNumber' },
        { text: v2, style: 'termsNumber' },
        { text: v3, style: 'termsNumber' },
        
      ]]
    }
  };
}


function preferredPropertyRow(
  typeOfProperty: string,
  location: string,
  landArea: string,
  builtUp: string
) {
  return {
    table: {
      widths: ['50%', '50%'], // 2 columns
      body: [
        [
          { text: 'Preferred:-', bold: false, colSpan: 2, alignment: 'left',style: 'terms' },
          {}
        ],
        [



          
          { text: `b) Type of property : ${__wtaApplication?.PropertyType}`, style: 'terms' },
          { text: `c) Location : ${__wtaApplication?.PropertyLocation}`, style: 'terms' }
        ],
        [
          { text: `d) Land Area : ${__wtaApplication?.PropertyLandArea} Sq ft`, style: 'terms' },
          { text: `e) Built Up : ${__wtaApplication?.PropertyBuildUpArea} Sq ft`, style: 'terms' }
        ]
      ]
    },
    layout: 'noBorders',
  };
}

function oneRowText(valueHtml: string) {
  return {
    ...depositRowBase,
    table: {
      widths: ['100%'],
      heights: (_row: number) => 8,
      body: [[
        { text: htmlToPdfmakeLite(valueHtml), style: 'terms',alignment:'justify' }
      ]]
    }
  };
}

function blankDivider(valueHtml: string, lh = 1) {
  return {
    ...depositRowBase,
    table: {
      widths: ['100%'],
      body: [[
        { text: htmlToPdfmakeLite(valueHtml), style: 'terms', lineHeight: lh }
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
      body: [[
        {
          text: htmlToPdfmakeLite(valueHtml),
          style: 'terms',
          alignment: 'right'
        }
      ]]
    }
  };
}

/* =======================================================================
   (CLONED) PDF doc definition builder (GATL-style)
   (Kept exactly as in ATR; you will edit content later for TAL/WTA)
======================================================================= */

// TAL-specific template
const buildDocDefinitionTal = (title: string, logoDataUrl?: string, footerDataUrl?: string, _ctx?: { refNo?: string; docMLogId?: string }) => ({
  info: { title, author: 'InteRealtor', subject: 'Buyer Appointing Letter', keywords: 'TAL, InteRealtor' },
  pageSize: 'A4',
  pageMargins: [40, 110, 40, 95],
  
  
  
  header: (_p: number, _pc: number, pageSize: any) => ({
  margin: [40, 20, 40, 10],
  stack: [
    {
      columns: [
        logoDataUrl
          ? { image: 'logo', width: 160, margin: [0, 8, 20, 0] }
          : { text: '', width: 160 },

        { text: '', width: '*' },

        {
          alignment: 'right',
          table: {
            widths: ['auto'],
            body: [[
              {
                text: 'BUYER APPOINTING LETTER',
                color: '#fff',
                bold: true,
                alignment: 'center',
                fontSize: 11,
                margin: [20, 6, 20, 6],
                fillColor: '#000',
                noWrap: true,
              }
            ]]
          },
          layout: 'noBorders',
        },
      ],
    },
    {
      canvas: [
        { type: 'line', x1: 0, y1: 0, x2: pageSize.width - 60, y2: 0, lineWidth: 1 }
      ],
      margin: [0, 6, 0, 0]
    },
  ],
}),
  
  
    
  /*
  header: (_p: number, _pc: number, pageSize: any) => ({
    margin: [40, 20, 40, 10],
    stack: [
      {
        columns: [
          
          { text: '', width: '*' },
          logoDataUrl ? { image: 'logo', width: 160, margin: [0, 8, 20, 0] } : { text: '', width: 160 },
          
          
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: pageSize.width - 80, y2: 0, lineWidth: 1 }], margin: [0, 6, 0, 0] },
    ],
  }),
  */
  



  
  footer: (_p: number, _pc: number, pageSize: any) => ({
    margin: [0,0,0,0],
    stack: [footerDataUrl ? { image: 'footerBanner', width: pageSize.width } : { text: '' }]
  }),
  styles: {    
    terms: { fontSize: 9, lineHeight: 1.1 },
    termsNumber: { bold: false, fontSize: 11 },
  },
  images: {
    ...(logoDataUrl ? { logo: logoDataUrl } : {}),
    ...(footerDataUrl ? { footerBanner: footerDataUrl } : {}),
  },
  content: [    
    oneRowTextRightAlign(`Reference Number : ${_ctx?.refNo ?? ''}`),  
    oneRowText('To'),
    oneRowText('Interealtor Sdn. Bhd'),
    oneRowText('(hereinafter referred to as Interealtor)'),
    oneRowText('26 (1st floor) Jalan Perusahaan Jelutong 2'),
    oneRowText('Fortune Park, 11600 Penang.'),
    
    
    oneRowText(''),
    oneRowText(''),
    oneRowText('Dear Sir,'),
    oneRowText('<b>RE: APPOINTMENT OF INTEREALTOR TO SECURE A PROPERTY FOR PURCHASE</b>'),
    oneRowText(''),
      
oneRowText('I/We the undersigned, do hereby appoint InteRealtor to secure a property for PURCHASE, subject to the following requirements:'),
    blankDivider(' ',0.5),
oneRowText(
  `a) The purchase price for the said property shall not exceed <u>RM ${Number(__wtaApplication?.AtlRentalAmt ?? 0).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}</u>`
),
preferredPropertyRow(),    

    blankDivider(' ',0.5),
oneRowText('This appointment shall be valid for 30 days from the date of this letter.'),
    blankDivider(' ',0.5),



    
oneRowText('Upon successful deal, I/we, hereby agree to pay InteRealtor professional fees in accordance to the scale fees in the Seventh Schedule set by the Board of Valuers, Appraisers, Estate Agents and Property Managers.'),

    
blankDivider(' ',0.5),
oneRowText('Further, I have no objection in InteRealtors Negotiator making Additional Claims for expenses incurred in rendering of your value added services as in accordance to the Act 1981 (Act 242) & Rules under the Seventh Schedule C4, provided always such claim is reasonable and fair.'),
    
blankDivider(' ',0.5),
oneRowText(
  `Hence, I am agreeable to pay RM ${currency(
    (
      parseFloat(String(__wtaApplication?.AtlProFees ?? '0').replace(/,/g, '')) +
      parseFloat(String(__wtaApplication?.AtlProFeesSstAmt ?? '0').replace(/,/g, ''))
    ).toFixed(2)
  )} as professional fees upon signing the Sale & Purchase Agreement directly to InteRealtor Sdn Bhd (Clients' Acc - PBB 32 1707 6233).`
), 
    blankDivider(' ',0.5),

    blankDivider(' ',0.5),
oneRowText('This letter is given to InteRealtor in my/our capacity as the Purchaser.'),


    contentRow('',''),
    {  
  margin: [120, 10, 120, 10],  // [left, top, right, bottom]

  table: {
    widths: ['*'],
    body: [[
      {
        table: {
  widths: ['*', 'auto'],
  body: [
    [            
      { text: 'Professional Fees', style: 'terms' },
      { text: `RM ${currency(toNumString(__wtaApplication?.AtlProFees ?? '0'))}`, alignment: 'right', style: 'terms' },
    ],

    [
      { text: 'SST (8%)', style: 'terms' },
      {
        text: `RM ${currency(toNumString(__wtaApplication?.AtlProFeesSstAmt ?? '0'))}`,
        style: 'terms',
        alignment: 'right',
        border: [false, false, false, true]
      }
    ],

    [
      { text: 'Total', style: 'terms' },
      {
        text: `RM ${currency(
          (
            parseFloat(String(__wtaApplication?.AtlProFees ?? '0').replace(/,/g, '')) +
            parseFloat(String(__wtaApplication?.AtlProFeesSstAmt ?? '0').replace(/,/g, ''))
          ).toFixed(2)
        )}`,
        style: 'terms',
        alignment: 'right',
        border: [false, false, false, true],
      }
    ],
  ]
},
        
        layout: {
          defaultBorder: false,
          paddingLeft:  () => 16,
          paddingRight: () => 16,
          paddingTop:   () => 2,
          paddingBottom:() => 2,
        }
      }
    ]]
  },
  // keep default layout so the OUTER table draws the box border
},


        contentRow('',''),
            contentRow('',''),
            contentRow('',''),
    contentRow('',''),
    contentRow('',''),
    
                    
// ✅ Put this inside content: [ ... ] in buildDocDefinitionTal
{
  unbreakable: true,
  stack: [
    // (optional) if you want a little spacing before signature block:
    // contentRow('', ''),

    signatureRow('Yours faithfully', '', '', ''),

    {
      table: {
        widths: ['33%', '33%', '33%'],
        body: [
          [
            { text: '', style: 'termsNumber' },
            {
              table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] },
              layout: {
                defaultBorder: false,
                paddingLeft: function () { return 20; },
                paddingRight: function () { return 20; },
                paddingTop: function () { return 0; },
                paddingBottom: function () { return 30; },
              },
            },
            {
              table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] },
              layout: {
                defaultBorder: false,
                paddingLeft: function () { return 20; },
                paddingRight: function () { return 20; },
                paddingTop: function () { return 0; },
                paddingBottom: function () { return 30; },
              },
            },
          ],
        ],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 2],
    },

    signatureRow(
      'NAME',
      __wtaApplication?.Tenant1Name || '',
      __wtaApplication?.Tenant2Name || '',
      __wtaApplication?.Tenant3Name || ''
    ),

    signatureRow(
      'NRIC NO',
      __wtaApplication?.Tenant1Id || '',
      __wtaApplication?.Tenant2Id || '',
      __wtaApplication?.Tenant3Id || ''
    ),

    signatureRow('SIGNED ON', '', '', ''),
  ],
},

    contentRow('',''),
    contentRow('',''),
      
  ],
} as any);

// WTA-specific template
const buildDocDefinitionWta = (title: string, logoDataUrl?: string, footerDataUrl?: string , ctx?: { refNo?: string; docMLogId?: string }) => ({
  info: { title, author: 'InteRealtor', subject: 'Warrant To Act', keywords: 'WTA, InteRealtor' },
  pageSize: 'A4',
  pageMargins: [40, 110, 40, 95],
  header: (_p: number, _pc: number, pageSize: any) => ({
    margin: [40, 20, 40, 10],
    stack: [
      {
        columns: [

          {
            width: '*',
            alignment: 'right',
            table: { widths: ['auto'], body: [[{ text: 'WTAB', color: '#fff', bold: true, alignment: 'center', fontSize: 12, margin: [20,6,20,6], fillColor: '#000' }]] },
            layout: 'noBorders',
          },
          { text: '', width: '*' },
          logoDataUrl ? { image: 'logo', width: 160, margin: [0, 8, 20, 0] } : { text: '', width: 160 },
          
          
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: pageSize.width - 60, y2: 0, lineWidth: 1 }], margin: [0, 6, 0, 0] },
    ],
  }),
  footer: (_p: number, _pc: number, pageSize: any) => ({
    margin: [0,0,0,0],
    stack: [footerDataUrl ? { image: 'footerBanner', width: pageSize.width } : { text: '' }]
  }),
  styles: {    
    terms: { fontSize: 9, lineHeight: 1.25 },
    termsNumber: { bold: false, fontSize: 9 },
  },
  images: {
    ...(logoDataUrl ? { logo: logoDataUrl } : {}),
    ...(footerDataUrl ? { footerBanner: footerDataUrl } : {}),
  },
  content: [
  oneRowTextRightAlign(`Reference Number : ${ctx?.refNo ?? ''}`),      

contentRow('TO :',`<b>INTEREALTOR SDN BHD </b>`),
contentRow('','No.26 (1st Floor) Jalan Perusahaan Jelutong 2, Fortune Park, 11600 Penang, Malaysia'),


oneRowText(''),  
oneRowText('I/We the undersigned, do hereby engage INTEREALTOR SDN BHD a real estate firm registered with the Board of Valuers, Appraisers, Estate Agents and Property Managers, to assist in My/Our purchasing process.'),
oneRowText('') ,
oneRowText('Services and assistance I/We may require from InteRealtor including but not limited to the following:'),
oneRowText('') ,

oneRowText('- To provide Comparative Market Analysis report on the sale of the subject property.'),
oneRowText('- To assist in sourcing for financial institution/bank for loan application.'),
oneRowText('- To assist in loan applications.'),
oneRowText('- To introduce a reliable legal firm.'),
oneRowText('- To assist in sourcing for logistic and movers.'),
oneRowText('- To coordinate and facilitate the signing of the Sale & Purchase Agreement (SPA).'),
oneRowText('- To assist during collection of Vacant Possession and keys.'),
oneRowText('- To provide property inspection before Vacant Possession and to confirm items recorded in the inventory list.'),
oneRowText('- To assist in applications for utility supply.'),
oneRowText('- To assist in sourcing for cleaning service.'),
oneRowText('- To recommend reliable interior designer and contractor for renovation.'),
oneRowText('- To assist in sourcing & procuring of furniture, curtain etc.'),
oneRowText('- Others : ' + __wtaApplication.WtatExtraServices ),



    
                        
oneRowText(''),
oneRowText('I/We are fully aware that is upon our request that you are providing your value-added services till the completion of the said purchase.'),
oneRowText(''),

oneRowText(
  'I/We hereby agree to pay you a service fees of RM ' +
  (
    Number(__wtaApplication.TalServiceFeesAmt ?? 0) +
    Number(__wtaApplication.TalProfessionalFeesSstAmt ?? 0)
  ).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) +
  ' inclusive 8% SST to INTEREALTOR SDN BHD'
),
        
oneRowText(''),
oneRowText('The parties hereby do agree that no further fees shall be payable to the real estate agent in connection with the sourcing of properties for Me/Us, except otherwise agreed in writing by the parties.'),
    

  
contentRow('',''),
    {  
  margin: [120, 3, 120, 3],  // [left, top, right, bottom]

  table: {
    widths: ['*'],
    body: [[
      {
        table: {
  widths: ['*', 'auto'],
  body: [
    [
      { text: 'Service Fees', style: 'terms' },
      {
        text: `RM ${Number(__wtaApplication.TalServiceFeesAmt ?? 0).toLocaleString('en-MY', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        alignment: 'right',
        style: 'terms',
      },
    ],

    [
      { text: 'SST (8%)', style: 'terms' },
      {
        text: `RM ${Number(__wtaApplication.TalProfessionalFeesSstAmt ?? 0).toLocaleString('en-MY', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        style: 'terms',
        alignment: 'right',
        border: [false, false, false, true],
      },
    ],

    [
      { text: 'Total', style: 'terms' },
      {
        text: `RM ${(
          Number(__wtaApplication.TalServiceFeesAmt ?? 0) +
          Number(__wtaApplication.TalProfessionalFeesSstAmt ?? 0)
        ).toLocaleString('en-MY', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        style: 'terms',
        alignment: 'right',
        border: [false, false, false, true],
      },
    ],
  ]
},
        
        layout: {
          defaultBorder: false,
          paddingLeft:  () => 16,
          paddingRight: () => 16,
          paddingTop:   () => 0,
          paddingBottom:() => 0,
        }
      }
    ]]
  },
},
    contentRow('',''),
    signatureRow('Signed by the Purchaser(s)','',''),            
{
          table: {
            widths: ['33%', '33%', '33%'],
            body: [
              [
                { text: '', style: 'termsNumber' },
                {
                  table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] },
                  layout: {
                    defaultBorder: false,
                    paddingLeft: function() { return 20; },
                    paddingRight: function() { return 20; },
                    paddingTop: function() { return 0; },
                    paddingBottom: function() { return 30; }
                  }
                },
                {
                  table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] },
                  layout: {
                    defaultBorder: false,
                    paddingLeft: function() { return 20; },
                    paddingRight: function() { return 20; },
                    paddingTop: function() { return 0; },
                    paddingBottom: function() { return 30; }
                  }
                },
                
              ]
            ]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 2],
        },

signatureRow(
  'NAME',
  __wtaApplication.Tenant1Name || '',
  __wtaApplication.Tenant2Name || '',
  __wtaApplication.Tenant3Name || ''
),


signatureRow('NRIC NO',
__wtaApplication.Tenant1Id || '', __wtaApplication.Tenant2Id || '',
__wtaApplication.Tenant3Id || '',),                    
signatureRow('SIGNED ON','','',''),

contentRow('',''),
signatureRow('Signed in the Presence of.','','',''),            
    {
          table: {
            widths: ['33%', '33%', '33%'],
            body: [
              [
                { text: '', style: 'termsNumber' },
                {
                  table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] },
                  layout: {
                    defaultBorder: false,
                    paddingLeft: function() { return 20; },
                    paddingRight: function() { return 20; },
                    paddingTop: function() { return 0; },
                    paddingBottom: function() { return 30; }
                  }
                },
                {
                  table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] },
                  layout: {
                    defaultBorder: false,
                    paddingLeft: function() { return 20; },
                    paddingRight: function() { return 20; },
                    paddingTop: function() { return 0; },
                    paddingBottom: function() { return 30; }
                  }
                },
                
              ]
            ]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 2],
        },
    
signatureRow('REN / NAME',__wtaApplication.CloserName,__wtaApplication.Closer1Name,''),            
signatureRow('REN NO / NRIC',__wtaApplication.CloserIcNo,__wtaApplication.Closer1IcNo,''),                    
signatureRow('DATE','','',''),                    
    
  ],
} as any);


const buildDocDefinitionGATL = (title: string, logoDataUrl?: string, footerDataUrl?: string, _ctx?: { refNo?: string; docMLogId?: string }) =>
  ({
    info: {
      title,
      author: 'InteRealtor',
      subject: 'General Authorisation To Let',
      keywords: 'ATL, GATL, Tenancy, InteRealtor',
    },
    pageSize: 'A4',
    pageMargins: [40, 110, 40, 95],
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
                body: [
                  [
                    {
                      text: 'AGREEMENT TO RENT',
                      color: '#fff',
                      bold: true,
                      alignment: 'center',
                      fontSize: 12,
                      margin: [20, 6, 20, 6],
                      fillColor: '#000',
                    },
                  ],
                ],
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
    footer: (_currentPage: number, _pageCount: number, pageSize: any) => {
      return {
        margin: [0, 0, 0, 0],
        stack: [
          footerDataUrl ? { image: 'footerBanner', width: pageSize.width } : { text: '' }
        ]
      };
    },
    styles: {
      headerTitle: { fontSize: 14, bold: true },
      headerMeta: { fontSize: 9, color: '#555' },
      h1: { fontSize: 13, bold: true, margin: [0, 8, 0, 8] },
      sectionTitle: { fontSize: 12, bold: true, color: '#1f4f8b', margin: [0, 12, 0, 6] },
      label: { bold: true },
      small: { fontSize: 11, color: '#444' },
      //terms: { fontSize: 11, lineHeight: 1.25 },
      terms: { fontSize: 11, lineHeight: 1.25 },
      listItem: { fontSize: 10, margin: [0, 2, 0, 2] },
      tableHeader: { bold: true, fillColor: '#efefef' },
    },
    images: {
      ...(logoDataUrl ? { logo: logoDataUrl } : {}),
      ...(footerDataUrl ? { footerBanner: footerDataUrl } : {}),
    },
    content: [
      oneRowTextRightAlign('Reference No : '),
      oneRowText(''),
      oneRowText('To Landlord(s),'),
      oneRowText(''),
      oneRowText('Property Type : <u>Commercial land</u>      Address : <u>Property Address</u>'), 



      oneRowText('??I/We, the undersigned Purchaser(s) do hereby engage INTEREALTOR SDN BHD a real estate firm registered with the Board of Valuers, Appraisers, Estate Agents and Property Managers, to assist in My/Our purchasing process.'),
      
oneRowText('Services and assistance I/We may require from InteRealtor including but not limited to the following:'),
oneRowText(''),




      
      depositRow('1.', 'Earnest Deposit / Advance Rental', `<u>RM 3,300.00</u>`),
      depositRow('', 'Security Deposit', `<u>RM 4,400.00</u>`),
      depositRow('', 'Utility Deposit', `<u>RM 5,500.00</u>`),
      depositRow('', 'Indah Water', `<u>RM 7,700.00</u>`),
      depositRow('', 'Access Card Deposit', `<u>RM 6,600.00</u>`),
      depositRow('', 'Stamping Fees', `<u>RM 1,000.00</u> (Paid By Owner)`),
      depositRow('', 'Admin Charges', `<u>RM 200.00</u> (Paid By Lawyer)`),
      depositRow('', 'Tenancy Period', `<u>From 12-Dec-2025 to 12-Dec-2026</u>`),
      depositRow('', 'Option to Renew', `<u>From 07-Jul-2000 to 10-Oct-2020</u>`),
      contentRow('',''),
      contentRow('2.', `It is mutually agreed upon by the parties hereby that the following item need to be attended to by
the Landlord(s) on/before the 10 day of 12 : -`),
      contentRow('', `a. `),
      contentRow('', `b.`),
      contentRow('', `c.`),
      contentRow('',''),
      contentRow('3.', `Other special condition(s):`),
      contentRow('','SPECIAL CONDITION ABC'),
      contentRow('',''),
      contentRow('4.', `Vacant possession shall be given to the Tenant(s) on/before the 8th day of August AND the
Tenant(s) undertakes to sign the tenancy agreement with all necessary payments on/before 8th day
of August`),
      contentRow('',''),
      contentRow('5.', `In the event the Tenant shall fail to execute the tenancy agreement within the stipulated time for any reason whatsoever, the Tenant(s) hereby agrees that the Earnest Deposit (as defined under
clause 8 herein) shall be fully forfeited by the Landlord(s) as liquidated damages.`),
      contentRow('',''),
      contentRow('6.', 'In the event the Landlord(s) accepts this offer by executing this Agreement and later refuses to sign the tenancy agreement within the stipulated time for any reason whatsoever, the Landlord(s) shall refund to the Tenant(s) the Earnest Deposit free of interest together with the sum equivalent to the Earnest Deposit as compensation.'),
      contentRow('',''),
      contentRow('7.', 'Notwithstanding the payment and clearance of the cheque for the Earnest Deposit and/or the tenancy agreement pending execution this Agreement shall take effect and constitute a legally binding document between the parties herein upon the execution of this Agreement.'),
      contentRow('',''),
      contentRow('8.', 'This Agreement may be executed by the parties herein in any number of counterparts and on separate counterparts. Each counterpart when executed, whether physically or by digital means, shall be deemed to constitute the same effective instrument.'),
      contentRow('',''),
      oneRowText('I/we hereby pay the sum of RM 2200 ( )being earnest deposit toward the rental of the property("Earnest Deposit") to as Stakeholder. In the even the Landlord(s) rejects this offer, the Earnest Deposit shall be fully refunded to the Tenant(s) free of interest.'),
      contentRow('',''),
      contentRow('',''),
      contentRow('',''),
      contentRow('',''),
      contentRow('',''),
      signatureRow('Signed by the Purchaser(s) :','','',''),
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
                  paddingLeft: function() { return 20; },
                  paddingRight: function() { return 20; },
                  paddingTop: function() { return 0; },
                  paddingBottom: function() { return 20; }
                }
              },
              {
                table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] },
                layout: {
                  defaultBorder: false,
                  paddingLeft: function() { return 20; },
                  paddingRight: function() { return 20; },
                  paddingTop: function() { return 0; },
                  paddingBottom: function() { return 20; }
                }
              },
              {
                table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] },
                layout: {
                  defaultBorder: false,
                  paddingLeft: function() { return 20; },
                  paddingRight: function() { return 20; },
                  paddingTop: function() { return 0; },
                  paddingBottom: function() { return 20; }
                }
              }
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 2],
      },
      signatureRow('NAME','MEL Tan 111','Tan Boon How',''),
      signatureRow('NRIC NO','790310071111','790310072222',''),
      signatureRow('SIGNED ON 3','10-Jan-2023','10-Jan-2023',''),
      contentRow('',''),
      contentRow('',''),
      contentRow('',''),
      contentRow('',''),
      contentRow('',''),
      signatureRow('Signed in the Presence of..','','',''),
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
                  paddingLeft: function() { return 20; },
                  paddingRight: function() { return 20; },
                  paddingTop: function() { return 0; },
                  paddingBottom: function() { return 20; }
                }
              },
              {
                table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] },
                layout: {
                  defaultBorder: false,
                  paddingLeft: function() { return 20; },
                  paddingRight: function() { return 20; },
                  paddingTop: function() { return 0; },
                  paddingBottom: function() { return 20; }
                }
              },
              {
                table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true] }]] },
                layout: {
                  defaultBorder: false,
                  paddingLeft: function() { return 20; },
                  paddingRight: function() { return 20; },
                  paddingTop: function() { return 0; },
                  paddingBottom: function() { return 20; }
                }
              }
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 2],
      },
      signatureRow('REN','','',''),
      signatureRow('REN NO','','',''),
      signatureRow('DATE','','',''),
    ],
  } as any);

/* =======================================================================
   (CLONED) Upload PDF -> PHP
======================================================================= */
async function uploadPdfBlob(
  pdfBlob: Blob,
  appIdForFile: string,
  docLogId?: string | number,
  //filePrefix: 'EATL' | 'GATL' = 'GATL',
  filePrefix: string = 'GATL',
  uploadUrl?: string,
  uploadProxyUrl?: string,
  refNo?: string
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
  //const filename = `${refNo || filePrefix + '_' + appIdForFile}_${Date.now()}.pdf`;


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

  const primaryUpload = uploadUrl || API_ENDPOINTS.UPLOAD;

  try {
    const server = await postFormData(primaryUpload);
    return { filename, server };
  } catch (err: any) {
    const isTypeError = err?.name === 'TypeError' || /Failed to fetch/i.test(err?.message || '');
    if (isTypeError && uploadProxyUrl) {
      const server = await postFormData(uploadProxyUrl);
      return { filename, server };
    }
    const hint = buildCorsHint('Upload.php', primaryUpload);
    throw new Error(`${err?.message || String(err)}\n\n${hint}`);
  }
}

/* =======================================================================
   (CLONED) IntFormInsert.php BEFORE generating — returns RefNo + DocMLogId
======================================================================= */
async function createFormLog(
  appId: string,
  docUid: string,
  docContent: string,
  insertUrl?: string,
  insertProxyUrl?: string
) {
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

   
  const primaryInsert = insertUrl || API_ENDPOINTS.INT_FORM_INSERT;

  try {
    const json = await postAndParse(primaryInsert);
    if (json?.status !== 'success' || !Array.isArray(json?.data) || !json.data.length) {
      throw new Error('IntFormInsert returned no data.');
    }
    const row = json.data[0] || {};
    //const newRefNo: string = row.RefNo || row.RefNo1 || '';
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
    const hint = buildCorsHint('IntFormInsert.php', primaryInsert);
    throw new Error(`${err?.message || String(err)}\n\n${hint}`);
  }
}

/* =======================================================================
   (CLONED) Full generate flow (Insert + PDF + Upload) returning Blob
======================================================================= */
// CHANGE this signature in WTABSection.tsx
async function runFullFlowGATL(opts: {
  title: string;
  appId: string;
  docUid: string;
  docContent: string;
  setRefNo: (s: string) => void;
  setDocMLogId: (s: string) => void;
  insertUrl?: string;
  insertProxyUrl?: string;
  uploadUrl?: string;
  uploadProxyUrl?: string;
  
  //buildDocDefinition?: (title: string, logo?: string, footer?: string) => any; // NEW
  buildDocDefinition?: (
  title: string,
  logo?: string,
  footer?: string,
  ctx?: { refNo?: string; docMLogId?: string }
) => any;
  
  filePrefix?: string; // NEW e.g. 'TAL' | 'WTA'
}) {
  const {
    title, appId, docUid, docContent,
    setRefNo, setDocMLogId,
    insertUrl, insertProxyUrl, uploadUrl, uploadProxyUrl,
    buildDocDefinition, filePrefix = 'GATL',
  } = opts;

  const { refNo: newRefNo, docMLogId: newDocId } =
    await createFormLog(appId, docUid, docContent, insertUrl, insertProxyUrl);
  setRefNo(newRefNo);
  setDocMLogId(newDocId);

  const [pdfMake, logoDataUrl, footerDataUrl] = await Promise.all([
    ensurePdfMakeOnce(),
    assetToDataUrl('/inte-logo.png'),
    assetToDataUrl('/Int_Footer.jpeg'),
  ]);

  const docDef = (buildDocDefinition ?? buildDocDefinitionGATL)(title, logoDataUrl, footerDataUrl , { refNo: newRefNo, docMLogId: newDocId });
  const pdf = pdfMake.createPdf(docDef);

  const blob: Blob = await new Promise((resolve) => pdf.getBlob(resolve));
  await uploadPdfBlob(blob, appId, newDocId, filePrefix, uploadUrl, uploadProxyUrl); // 👈 use filePrefix
  return blob;
}


export interface WTABSectionProps {
  /** Full application object from your main screen */
  onRefresh?: () => Promise<void>;

  application?: any;
  /** Optional override if you want to pass it separately */
  applicationId?: string | number;
  /** Default if application.FormType is empty */
  defaultFormType?: 'WTA' | 'TAL';
  /** SST rate (default 8%) */
  defaultSSTRate?: number;

  /* Optional overrides for endpoints */
  insertUrl?: string;
  insertProxyUrl?: string;
  uploadUrl?: string;
  uploadProxyUrl?: string;

  /* Optional doc identifiers */
  talDocMUid?: string;
  talDocContent1?: string;
  wtaDocMUid?: string;
  wtaDocContent1?: string;  
}

const WTABSection: React.FC<WTABSectionProps> = ({
  application,
  applicationId,
  onRefresh,
  defaultFormType = 'TAL',
  defaultSSTRate = 0.08,

  // endpoints
  insertUrl = API_ENDPOINTS.INT_FORM_INSERT,
  insertProxyUrl, 
  uploadUrl = API_ENDPOINTS.UPLOAD,
  uploadProxyUrl,

  // per-doc config (placeholders; replace later if needed)
  talDocMUid = '821A9206-46D8-4021-8A2C-7F2DE60BFD2C',
  talDocContent1 = 'BUYER APPOINTING LETTER (TAL)',
  //wtaDocMUid = '5FF181C4-AA38-42C2-818A-13776F1EE031',
  wtaDocMUid = '916C4AAB-8D6A-40CB-A99C-57CB50249C1E',
  //  wtaDocContent1 = 'WARRANT TO ACT (WTA)',
  wtaDocContent1 = 'WARRANT TO ACT BUYER (WTAB)',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const resolvedAppId =
    (application?.ApplicationId ?? applicationId ?? '').toString().trim() || '';

  /* ---------- Common ---------- */
  const [FormType, setFormType] = useState<'WTA' | 'TAL'>(
    (application?.FormType as 'WTA' | 'TAL') || defaultFormType
  );

  /* ---------- TAL fields ---------- */
  const [TalRentalAmt, setTalRentalAmt] = useState<string>(
    String(application?.TalRentalAmt ?? '0.00')
  );
  const [TalServiceFeesAmt, setTalServiceFeesAmt] = useState<string>(
    String(application?.TalServiceFeesAmt ?? '0.00')
  );
  const [TalProfFeesSstExclude, setTalProfFeesSstExclude] = useState<boolean>(() => {
    const raw = application?.TalProfFeesSstExclude;
    if (raw === undefined || raw === null) return false; // default include SST
    if (typeof raw === 'boolean') return raw;
    const s = String(raw).toUpperCase();
    return s === '1' || s === 'Y' || s === 'TRUE';
  });

  const talFeesNum = useMemo(() => parseMoney(TalServiceFeesAmt), [TalServiceFeesAmt]);
  const TalProfessionalFeesSstAmt = useMemo(
    () => fmt2(TalProfFeesSstExclude ? 0 : talFeesNum * defaultSSTRate),
    [TalProfFeesSstExclude, talFeesNum, defaultSSTRate]
  );
  const TalProfessionalFeesTotalAmt = useMemo(
    () => fmt2(talFeesNum + parseMoney(TalProfessionalFeesSstAmt)),
    [talFeesNum, TalProfessionalFeesSstAmt]
  );

  /* ---------- WTA fields ---------- */
  const [WtatExtraServices, setWtatExtraServices] = useState<string>(
    String(application?.WtatExtraServices ?? '')
  );
  const [WtatServiceFeesAmt, setWtatServiceFeesAmt] = useState<string>(
    String(application?.WtatServiceFeesAmt ?? '0.00')
  );
  const [WtaServiceFeesSstExclude, setWtaServiceFeesSstExclude] = useState<boolean>(() => {
    const raw = application?.WtaServiceFeesSstExclude ?? application?.WtatServiceFeesSstExclude;
    if (raw === undefined || raw === null) return false; // default include SST
    if (typeof raw === 'boolean') return raw;
    const s = String(raw).toUpperCase();
    return s === '1' || s === 'Y' || s === 'TRUE';
  });

  const wtaFeesNum = useMemo(() => parseMoney(WtatServiceFeesAmt), [WtatServiceFeesAmt]);
  const WtatServiceFeesSstAmt = useMemo(
    () => fmt2(WtaServiceFeesSstExclude ? 0 : wtaFeesNum * defaultSSTRate),
    [WtaServiceFeesSstExclude, wtaFeesNum, defaultSSTRate]
  );
  const WtatServiceFeesTotalAmt = useMemo(
    () => fmt2(wtaFeesNum + parseMoney(WtatServiceFeesSstAmt)),
    [wtaFeesNum, WtatServiceFeesSstAmt]
  );


  useEffect(() => {
    if (application) setWtaApplication(application);
  }, [application]);
  
  /* ---------- Rehydrate when application changes ---------- */
  useEffect(() => {
    if (!application) return;

    setFormType((application?.FormType as 'WTA' | 'TAL') || defaultFormType);

    setTalRentalAmt(String(application?.TalRentalAmt ?? '0.00'));
    setTalServiceFeesAmt(String(application?.TalServiceFeesAmt ?? '0.00'));
    {
      const raw = application?.TalProfFeesSstExclude;
      if (raw === undefined || raw === null) setTalProfFeesSstExclude(false);
      else if (typeof raw === 'boolean') setTalProfFeesSstExclude(raw);
      else {
        const s = String(raw).toUpperCase();
        setTalProfFeesSstExclude(s === '1' || s === 'Y' || s === 'TRUE');
      }
    }

    setWtatExtraServices(String(application?.WtatExtraServices ?? ''));
    setWtatServiceFeesAmt(String(application?.WtatServiceFeesAmt ?? '0.00'));
    {
      const raw = application?.WtaServiceFeesSstExclude ?? application?.WtatServiceFeesSstExclude;
      if (raw === undefined || raw === null) setWtaServiceFeesSstExclude(false);
      else if (typeof raw === 'boolean') setWtaServiceFeesSstExclude(raw);
      else {
        const s = String(raw).toUpperCase();
        setWtaServiceFeesSstExclude(s === '1' || s === 'Y' || s === 'TRUE');
      }
    }
  }, [application, defaultFormType]);

  /* ---------- Save to PHP ---------- */
  const [saving, setSaving] = useState(false);

  const handleUpdate = async () => {
    if (!resolvedAppId) {
      alert('Missing ApplicationId. Cannot save.');
      return;
    }
    try {
      setSaving(true);

      const body = new URLSearchParams();
      body.set('ApplicationId', resolvedAppId);
      body.set('FormType', FormType);

      // WTA set
      body.set('WtatExtraServices', WtatExtraServices);
      //body.set('WtatServiceFeesAmt', fmt2(parseMoney(WtatServiceFeesAmt)));
      //body.set('WtaServiceFeesSstExclude', WtaServiceFeesSstExclude ? 'Y' : 'N');
      //body.set('WtatServiceFeesSstAmt', WtatServiceFeesSstAmt);
      //body.set('WtatServiceFeesTotalAmt', WtatServiceFeesTotalAmt);

      // TAL set
      //body.set('TalRentalAmt', fmt2(parseMoney(TalRentalAmt)));
      //body.set('TalServiceFeesAmt', fmt2(parseMoney(TalServiceFeesAmt)));
      //body.set('TalProfessionalFeesSstAmt', TalProfessionalFeesSstAmt);
      //body.set('TalProfessionalFeesTotalAmt', TalProfessionalFeesTotalAmt);
      //body.set('TalProfFeesSstExclude', TalProfFeesSstExclude ? 'Y' : 'N');

      const res = await fetch(
        API_ENDPOINTS.INT_APPLICATION_WTA_SET,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      alert(json?.data || json?.message || 'WTA/TAL details updated successfully.');
      if (onRefresh) await onRefresh();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'WTA/TAL update failed.');
    } finally {
      setSaving(false);
    }
  };

  /* ---------- FLOW STATE for preview (Modal A) ---------- */
  const [generating, setGenerating] = useState(false);
  const [refNo, setRefNo] = useState('');
  const [docMLogId, setDocMLogId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdf, setShowPdf] = useState(false);

  const closePdf = () => {
    if (pdfUrl && pdfUrl.startsWith('blob:')) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setShowPdf(false);
  };

  /* ---------- Public wrappers (clone behavior): TAL / WTA ---------- */
 const generateTal = async () => {
  if (!resolvedAppId) { alert('Missing ApplicationId. Cannot generate.'); return; }
  try {
    setGenerating(true);
    const blob = await runFullFlowGATL({
      title: 'BUYER APPOINTING LETTER (BAL)',
      appId: resolvedAppId,
      docUid: talDocMUid,          // set these props/values as you already do
      docContent: talDocContent1,
      setRefNo,
      setDocMLogId: (id) => setDocMLogId(id),
      insertUrl,
      insertProxyUrl,
      uploadUrl,
      uploadProxyUrl,
      buildDocDefinition: buildDocDefinitionTal, // 👈 use TAL template
      filePrefix: 'TAL',                         // 👈 nicer filenames server-side
    });
    const url = URL.createObjectURL(blob);
    setPdfUrl(url);
    setShowPdf(true);
  } catch (e: any) {
    console.error('[TAL] generate error:', e);
    alert(e?.message || 'Failed to generate BAL');
  } finally {
    setGenerating(false);
  }
};

const generateWta = async () => {
  if (!resolvedAppId) { alert('Missing ApplicationId. Cannot generate.'); return; }
  try {
    setGenerating(true);
    const blob = await runFullFlowGATL({
      title: 'WARRANT TO ACT (WTA)',
      appId: resolvedAppId,
      docUid: wtaDocMUid,
      docContent: wtaDocContent1,
      setRefNo,
      setDocMLogId: (id) => setDocMLogId(id),
      insertUrl,
      insertProxyUrl,
      uploadUrl,
      uploadProxyUrl,
      buildDocDefinition: buildDocDefinitionWta, // 👈 use WTA template
      
      filePrefix: 'WTA',                         // 👈 nicer filenames server-side
    });
    const url = URL.createObjectURL(blob);
    setPdfUrl(url);
    setShowPdf(true);
  } catch (e: any) {
    console.error('[WTA] generate error:', e);
    alert(e?.message || 'Failed to generate WTA.');
  } finally {
    setGenerating(false);
  }
};


  const isTAL = FormType === 'TAL';

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
        {/* Header */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full bg-gray-400 hover:bg-gray-500 text-white px-6 py-4 flex items-center justify-between cursor-pointer select-none rounded-xl transition-colors"
        >
          <h2 className="text-lg font-semibold">
            WARRANT TO ACT (WTA)/ BUYER APPOINTING LETTER (BAL)
          </h2>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>

        {isExpanded && (
          <div className="p-6 bg-gray-50">
            {/* Form Type */}
            <div className="grid grid-cols-12 gap-4 mb-6 items-center">
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">Form Type</label>
              </div>
              <div className="col-span-10">
                <select
                  value={FormType}
                  onChange={(e) => setFormType(e.target.value as 'WTA' | 'TAL')}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="TAL">BUYER APPOINTING LETTER - BAL</option>
                  <option value="WTA">WARRANT TO ACT - WTA</option>
                </select>
              </div>
            </div>

            {/* TAL layout */}
            {isTAL && (
              <>
                {/* Monthly Rental */}
                <div className="grid grid-cols-12 gap-4 mb-6 items-center">
                  
                  <div className="col-span-7" />
                </div>

                
              </>
            )}

            {/* WTA layout */}
            {!isTAL && (
              <>
                {/* Other Service */}
                <div className="grid grid-cols-12 gap-4 mb-6 items-center">
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-700">Other Service</label>
                  </div>
                  <div className="col-span-10">
                    <input
                      type="text"
                      value={WtatExtraServices}
                      onChange={(e) => setWtatExtraServices(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                
              </>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center space-x-4">
              <button
                type="button"
                onClick={handleUpdate}
                disabled={saving}
                className={`px-6 py-2 rounded-lg text-white font-medium ${
                  saving ? 'bg-green-600/60 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {saving ? 'Saving…' : (isTAL ? 'UPDATE BAL DETAILS' : 'UPDATE WTA DETAILS')}
              </button>

              <button
                type="button"
                onClick={isTAL ? generateTal : generateWta}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                {`GENERATE ${isTAL ? 'BAL' : 'WTA'}`}
                
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal PDF Viewer (same behavior pattern as ATR) */}
      {showPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white w-[90vw] h-[90vh] rounded-lg overflow-hidden shadow-xl relative">
            <div className="absolute top-2 right-2 flex gap-2">
              {pdfUrl && (
               <a
  href={pdfUrl}
  download={`${refNo || 'Document'}.pdf`}   // 👈 use RefNo1 value from state
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

export default WTABSection;
