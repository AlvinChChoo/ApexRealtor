import { API_ENDPOINTS_DEV_AWARE } from '../../config/apiConfig';
// src/utils/pdfGenerators/receiptPdf.ts
import { IntInvoiceBundle } from "../../types/payment";
import { ensurePdfMakeOnce, assetToDataUrl } from "./pdfUtils";
import footerPng from "../../assets/footer_a4_2026.png";


const INT_INVOICE_GET_URL = API_ENDPOINTS_DEV_AWARE.INT_INVOICE_GET;

export const printReceiptPdf = async (bundle: IntInvoiceBundle) => {
  const inv = bundle.header;
  const details = bundle.details || [];
  const application = bundle.application;

  const toNum = (x: any) => {
    const s = String(x ?? "0").replace(/,/g, "").trim();
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  };

  const money = (x: any) =>
    toNum(x).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const RIGHT_BOX_W = 260;
  const META_LABEL_W = 95;
  const META_COLON_W = 12;
  const META_VALUE_X = META_LABEL_W + META_COLON_W;

  const invoiceId =
    String((inv as any)?.InvoiceId ?? "").trim() ||
    String((inv as any)?.InvoiceID ?? "").trim();

  const receiptNo =
    String((inv as any)?.ReceiptNo ?? "").trim() ||
    (inv as any)?.ReceiptNo1 ||
    invoiceId ||
    "OR-YYMM/xxxx";

  const receiptDate =
    inv.InvoiceDate ?? (inv as any)?.Invoice_Date ?? "DD/MM/YYYY";

  const invoiceType = inv.InvoiceType ?? "Tenant";
  const isTenant = String(invoiceType).toLowerCase().includes("tenant");

  const recipientName = isTenant
    ? application?.Tenant1Name || (application as any)?.TenantName || ""
    : application?.Landlord1Name || (application as any)?.LandlordName || "";

  const propertyAddress =
    [
      (application as any)?.PropertyAddress,
      (application as any)?.PropertyLocation,
      (application as any)?.PropertyTown,
      (application as any)?.PropertyState,
    ]
      .filter(Boolean)
      .join(", ") ||
    (application as any)?.PropertyFullAddress ||
    "";

  const transactionId =
    String((inv as any)?.PaymentTransId ?? "").trim() ||
    String((application as any)?.RefNo ?? "").trim() ||
    String((application as any)?.ApplicationId ?? "").trim() ||
    "";

  const refNo =
    String((application as any)?.RefNo ?? "").trim() ||
    String((inv as any)?.RefNo ?? "").trim() ||
    transactionId ||
    "";

  const renName =
    String((inv as any)?.RenName ?? "").trim() ||
    String((application as any)?.REN1Name ?? "").trim() ||
    String((application as any)?.RenName ?? "").trim() ||
    "";

  const renId =
    String((inv as any)?.RenId ?? "").trim() ||
    String((application as any)?.REN1No ?? "").trim() ||
    String((application as any)?.RenNo ?? "").trim() ||
    "";

  const renDisplay = `${renName}${renId ? ` (REN ${renId})` : ""}`.trim();

  // =========================================================
  // GET AMOUNT FROM IntInvoiceGet.php USING InvoiceId
  // Formula:
  // InvoiceFees + InvoiceSst + InvoiceAdminCharges + InvoiceStampDuty + InvoiceAdminSst
  // =========================================================
  let amountDue = 0;

  if (invoiceId) {
    try {
      const body = new URLSearchParams();
      body.append("InvoiceId", invoiceId);

      const res = await fetch(INT_INVOICE_GET_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      const data = await res.json();

      const row =
        data?.data?.[0] ||
        data?.data ||
        data?.header?.[0] ||
        data?.header ||
        data?.result?.[0] ||
        data?.result ||
        {};

      amountDue =
        toNum(row?.InvoiceFees) +
        toNum(row?.InvoiceSst) +
        toNum(row?.InvoiceAdminCharges) +
        toNum(row?.InvoiceStampDuty) +
        toNum(row?.InvoiceAdminSst);
    } catch (err) {
      console.error("Failed to load IntInvoiceGet.php:", err);
      amountDue = 0;
    }
  }

  // fallback if endpoint fails or returns 0
  if (amountDue <= 0) {
    const detailsNetSum = details.reduce(
      (s: number, r: any) => s + toNum(r?.ItemNet ?? r?.ItemGross ?? 0),
      0
    );

    const serviceFeesItem = details.find(
      (d: any) =>
        String(d.ItemDesc || "").toLowerCase().includes("service fees") ||
        String(d.ItemDesc || "").toLowerCase().includes("professional fees") ||
        String(d.ItemDesc || "").toLowerCase().includes("our fees")
    );

    const adminFeesItem = details.find(
      (d: any) =>
        String(d.ItemDesc || "").toLowerCase().includes("administrative fees") ||
        String(d.ItemDesc || "").toLowerCase().includes("admin")
    );

    const stampingFeesItem = details.find(
      (d: any) =>
        String(d.ItemDesc || "").toLowerCase().includes("stamping fees") ||
        String(d.ItemDesc || "").toLowerCase().includes("stamp duty")
    );

    const ourFeesGross = serviceFeesItem?.ItemGross || "0";
    const ourFeesSst = serviceFeesItem?.ItemSst || "0";
    const adminCharges = adminFeesItem?.ItemGross || "0";
    const adminChargesSst = adminFeesItem?.ItemSst || "0";
    const stampDuty = stampingFeesItem?.ItemGross || "0";
    const stampDutySst = stampingFeesItem?.ItemSst || "0";

    const totalBeforeSst =
      toNum(ourFeesGross) + toNum(adminCharges) + toNum(stampDuty);
    const totalSst =
      toNum(ourFeesSst) + toNum(adminChargesSst) + toNum(stampDutySst);
    const computedTotalDue = totalBeforeSst + totalSst;

    amountDue = detailsNetSum > 0 ? detailsNetSum : computedTotalDue;
  }

  const descriptionText =
    "Being Professional Fees + Disbursements for Printing, Photocopies & Submission for stamping for Rental of property at :";

  const receiptNoteLines = [
    {
      text: "(This Receipt is Valid Subject to Bank Clearance of the Cheque)",
      fontSize: 12,
      margin: [40, 0, 40, 3],
    },
    {
      text: "This is a computer-generated receipt.",
      fontSize: 12,
      margin: [40, 0, 40, 3],
    },
    {
      text: "No signature is required.",
      fontSize: 12,
      margin: [40, 0, 40, 8],
    },
  ];

  const [logoDataUrl, footerDataUrl] = await Promise.all([
    assetToDataUrl("/inte-logo.png").catch((err) => {
      console.error("Failed to load logo:", err);
      return "";
    }),
    assetToDataUrl(footerPng).catch((err) => {
      console.error("Failed to load footer:", err);
      return "";
    }),
  ]);

  const spellRinggit = (value: any) => {
    const n = Math.max(0, toNum(value));
    const ringgit = Math.floor(n + 1e-9);
    const sen = Math.round((n - ringgit) * 100);

    const ones = [
      "Zero",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    const toWordsUnder1000 = (x: number): string => {
      let s = "";
      const h = Math.floor(x / 100);
      const r = x % 100;

      if (h > 0) s += `${ones[h]} Hundred`;
      if (r > 0) {
        if (s) s += " ";
        if (r < 20) s += ones[r];
        else {
          const t = Math.floor(r / 10);
          const u = r % 10;
          s += tens[t] + (u ? ` ${ones[u]}` : "");
        }
      }
      return s || "Zero";
    };

    const toWords = (x: number): string => {
      if (x === 0) return "Zero";
      const parts: string[] = [];

      const billions = Math.floor(x / 1_000_000_000);
      x %= 1_000_000_000;
      const millions = Math.floor(x / 1_000_000);
      x %= 1_000_000;
      const thousands = Math.floor(x / 1000);
      const rest = x % 1000;

      if (billions) parts.push(`${toWordsUnder1000(billions)} Billion`);
      if (millions) parts.push(`${toWordsUnder1000(millions)} Million`);
      if (thousands) parts.push(`${toWordsUnder1000(thousands)} Thousand`);
      if (rest) parts.push(`${toWordsUnder1000(rest)}`);

      return parts.join(" ");
    };

    const ringgitWords = toWords(ringgit);
    const senWords = sen > 0 ? toWords(sen) : "Zero";

    if (sen > 0) {
  return `${ringgitWords} Ringgit and ${senWords} Cents Only`;
}
return `${ringgitWords} Ringgit Only`;
  };

  const docDefinition: any = {
    pageSize: "A4",
    pageMargins: [40, 100, 40, 260],

    header: (_p: number, _pc: number) => ({
      margin: [40, 30, 40, 20],
      columns: [
        logoDataUrl
          ? {
              image: "logo",
              fit: [180, 60],
              alignment: "left",
            }
          : { text: "" },
        { width: "*", text: "" },
      ],
    }),

    footer: (currentPage: number, pageCount: number, pageSize: any) => {
      const showNotes = currentPage === pageCount;

      const proformaNotes = showNotes
        ? {
            margin: [40, 0, 40, 6],
            stack: [
              { text: "E. & O.E.", fontSize: 10, margin: [0, 0, 0, 8] },
              { text: "Notes :", bold: true, fontSize: 10, margin: [0, 0, 0, 3] },
              { text: "All payments should be made payable to", fontSize: 9, margin: [0, 0, 0, 2] },
              { text: "INTEREALTOR SDN BHD - Client A/C", bold: true, fontSize: 9, margin: [0, 0, 0, 8] },
              { text: "Bank : PUBLIC BANK BERHAD, Lebuh Macallum Branch.", bold: true, fontSize: 9, margin: [0, 0, 0, 2] },
              { text: "A/C No : 32-1707-6233       Swift Code No : PBBEMYKL", bold: true, fontSize: 9, margin: [0, 0, 0, 8] },
              { text: "Kindly send us the bank in slip via email : ", fontSize: 9, margin: [0, 0, 0, 0] },
              { text: "account@interealtor.com, please state the unit no.", bold: true, fontSize: 9, margin: [0, 0, 0, 0] },
              { text: "An interest penalty of 10% p.a. will be imposed on the late payment.", fontSize: 9, margin: [0, 0, 0, 0] },
              { text: "SST No.: P11-1808-32000013", fontSize: 9, margin: [0, 0, 0, 0] },
            ],
          }
        : null;

      const banner = footerDataUrl
        ? { image: "footerBanner", width: pageSize.width, height: 80, margin: [0, 0, 0, 0] }
        : { text: "" };

      return {
        margin: [0, 0, 0, 0],
        stack: [
          ...(proformaNotes ? [proformaNotes] : []),
          banner,
        ],
      };
    },

    images: {
      ...(logoDataUrl ? { logo: logoDataUrl } : {}),
      ...(footerDataUrl ? { footerBanner: footerDataUrl } : {}),
    },

    defaultStyle: {
      fontSize: 11,
      lineHeight: 1.25,
    },

    content: [
      {
        columns: [
          { width: "*", text: "" },
          {
            width: 260,
            stack: [
              {
                text: "OFFICIAL RECEIPT",
                bold: true,
                fontSize: 14,
                alignment: "left",
                margin: [0, 5, 0, 10],
              },
              {
                table: {
                  widths: [95, 12, "*"],
                  body: [
                    [
                      { text: "Receipt No.", fontSize: 12, alignment: "left" },
                      { text: ":", fontSize: 12, alignment: "center" },
                      { text: String(receiptNo), fontSize: 12, bold: true, alignment: "left" },
                    ],
                    [
                      { text: "Date", fontSize: 12, alignment: "left", margin: [0, 6, 0, 0] },
                      { text: ":", fontSize: 12, alignment: "center", margin: [0, 6, 0, 0] },
                      { text: String(receiptDate), fontSize: 12, bold: true, alignment: "left", margin: [0, 6, 0, 0] },
                    ],
                  ],
                },
                layout: "noBorders",
              },
            ],
          },
        ],
        margin: [0, 0, 0, 10],
      },

      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "Received From :", bold: true, fontSize: 12, alignment: "left", margin: [0, 0, 0, 6] },
              { text: `1.  ${recipientName || "—"}`, bold: true, fontSize: 12, alignment: "left" },
            ],
          },
          {
            width: RIGHT_BOX_W,
            stack: [
              { text: "REN", bold: false, fontSize: 12, alignment: "left", margin: [META_VALUE_X, 0, 0, 6] },
              { text: renDisplay || "—", bold: false, fontSize: 12, alignment: "left", margin: [META_VALUE_X, 0, 0, 0] },
            ],
          },
        ],
        margin: [0, 0, 0, 18],
      },

      {
        columns: [
          { width: "*", text: "Particular", bold: true, fontSize: 13, alignment: "left" },
          {
            width: RIGHT_BOX_W,
            text: "Transaction ID",
            bold: false,
            fontSize: 12,
            alignment: "left",
            margin: [META_VALUE_X, 0, 0, 0],
          },
        ],
        margin: [0, 0, 0, 8],
      },

      {
        columns: [
          { width: "*", text: descriptionText, fontSize: 13, alignment: "left" },
          {
            width: RIGHT_BOX_W,
            text: refNo || "—",
            fontSize: 12,
            bold: false,
            alignment: "left",
            margin: [META_VALUE_X, 0, 0, 0],
          },
        ],
        margin: [0, 0, 0, 0],
      },

      { text: propertyAddress || "—", fontSize: 12, margin: [0, 0, 0, 22] },

      {
        columns: [
          { width: "*", text: "Received Amount", bold: true, fontSize: 12, alignment: "left" },
          { width: 120, text: "Amount", bold: true, fontSize: 12, alignment: "right" },
        ],
        margin: [0, 0, 0, 2],
      },
      {
        columns: [
          { width: "*", text: "" },
          { width: 120, text: `RM ${money(amountDue)}`, bold: true, fontSize: 12, alignment: "right" },
        ],
        margin: [0, 0, 0, 6],
      },
      {
        text: `Ringgit Malaysia : ${spellRinggit(amountDue)}`,
        fontSize: 12,
        alignment: "left",
        margin: [0, 0, 0, 10],
      },
    ],
  };

  const filename = `Receipt_${String(receiptNo).replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

  const pdfMake = await ensurePdfMakeOnce();
  pdfMake.createPdf(docDefinition).download(filename);
};