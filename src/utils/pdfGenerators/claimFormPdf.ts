import { API_ENDPOINTS_DEV_AWARE } from '../../config/apiConfig';
// claimFormPdf.ts
import { RentalApplication } from "../../types";
import { ensurePdfMakeOnce, assetToDataUrl } from "./pdfUtils";
import { toNum, to2 } from "../paymentUtils";

/** ✅ DEV proxy vs PROD real server */

const PAYMENT_HISTORY_URL = API_ENDPOINTS_DEV_AWARE.UPLOADED_FILE_GET;
const DOC_UPLOAD_URL = API_ENDPOINTS_DEV_AWARE.INT_DOC_UPLOAD_GET;

// ✅ NEW: Invoice endpoint
const INT_INVOICE_GET_URL = API_ENDPOINTS_DEV_AWARE.INT_INVOICE_GET;

export const printClaimForm = async (_application: RentalApplication) => {
  try {
    const application = _application as any;

    const pdfMake = await ensurePdfMakeOnce();

    const pct = (v: any) => {
      const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) ? `${n.toFixed(2)}%` : "—";
    };

    const str = (v: any, fb = "—") =>
      v === null || v === undefined || String(v).trim() === "" ? fb : String(v);

    const pickFirst = (row: any, keys: string[]) => {
      for (const k of keys) {
        if (row && row[k] != null && String(row[k]).trim() !== "") return row[k];
      }
      return "";
    };

    // ✅ helper for picking from application itself
    const pickApp = (keys: string[]) => pickFirst(application, keys);

    /* =========================================================
   ✅ NEW: Transaction Type (Rental vs Sales)
   - source: application.TransType
========================================================= */
const transTypeRaw = String(application?.TransType ?? "").trim();
const transTypeNorm = transTypeRaw.toUpperCase();

// adjust mapping if your DB uses other codes
const isSales =
  transTypeNorm === "S" ||
  transTypeNorm === "SALE" ||
  transTypeNorm === "SALES" ||
  transTypeNorm.includes("SALE");

const transTypeLabel = isSales ? "Sales" : "Rental";

// ✅ OPTIONAL: pick the correct amount field for Sales later if needed
// For now, your existing rental field stays as default.
const transAmount = isSales
  ? pickApp(["SalesAmt", "SaleAmt", "SalesPrice", "SalePrice", "SellingPrice", "PurchasePrice"]) // <-- change to your real field if any
  : application.AtlRentalAmt;

    /* =========================================================
       ✅ NEW: Fetch invoice/proforma/receipt info from IntInvoiceGet.php
    ========================================================= */
    type InvoiceRow = {
      InvoiceId?: string | number; // ✅ for sorting (InvoiceId desc)
      InvoiceNo?: string; // Proforma No
      InvoiceNo1?: string; // Invoice No
      ReceiptNo?: string; // Receipt No

      AddDate?: string; // Proforma date
      InvoiceNo1Date?: string; // Invoice date
      ReceiptDate?: string; // Receipt date

      InvoiceDate?: string; // fallback if AddDate missing
      InvoiceTotal?: string;
      ClaimType?: string;
      InvoiceType?: string; // 'L' or 'T'
    };

    type InvoiceLine = {
      invoiceNo: string; // Proforma No (InvoiceNo)
      invoiceId: number; // ✅ for sorting

      proformaNo: string; // Invoice No (InvoiceNo1)
      receiptNo: string; // Receipt No (ReceiptNo)

      addDate: string; // AddDate (for Proforma)
      proformaDate: string; // InvoiceNo1Date (for Invoice)
      receiptDate: string; // ReceiptDate (for Receipt)

      amount: string; // InvoiceTotal
      invoiceType: string; // 'L' or 'T'
    };

    let invoiceLines: InvoiceLine[] = [];

    try {
      const appId =
        application?.ApplicationId ??
        application?.RentalApplicationId ??
        application?.LoanApplicationId;

      if (appId) {
        const fd = new FormData();
        fd.append("ApplicationId", String(appId));

        const res = await fetch(INT_INVOICE_GET_URL, { method: "POST", body: fd });

        if (res.ok) {
          const json: any = await res.json();

          if (json && json.status === "success" && Array.isArray(json.data) && json.data.length > 0) {
            invoiceLines = (json.data as InvoiceRow[]).map((r: InvoiceRow) => {
              // ✅ InvoiceId (for sorting desc)
              const rawInvId = pickFirst(r as any, ["InvoiceId", "InvoiceID", "InvId"]);
              const invoiceId = (() => {
                const n = parseInt(String(rawInvId ?? "0").replace(/[^0-9]/g, ""), 10);
                return Number.isFinite(n) ? n : 0;
              })();

              // Proforma = InvoiceNo
              const invoiceNo = str(pickFirst(r, ["InvoiceNo", "ProformaNo", "ProformaNo1"]), "—");

              // Invoice = InvoiceNo1
              const proformaNo = str(pickFirst(r, ["InvoiceNo1", "InvoiceNo_1", "Invoice1No"]), "—");

              // Receipt = ReceiptNo
              const receiptNo = str(pickFirst(r, ["ReceiptNo", "ReceiptNo1"]), "—");

              // Dates
              const addDate = str(pickFirst(r, ["AddDate", "InvoiceDate", "ProformaDate"]), "—");
              const proformaDate = str(
                pickFirst(r, ["InvoiceNo1Date", "InvoiceDate1", "Invoice1Date"]),
                "—"
              );
              const receiptDate = str(pickFirst(r, ["ReceiptDate", "ReceiptNoDate", "Receipt1Date"]), "—");

              const amount = fmtAmt(pickFirst(r, ["InvoiceTotal"]), "—");

              const invoiceType = str(pickFirst(r, ["InvoiceType"]), "").trim().toUpperCase();

              return {
                invoiceId, // ✅ NEW
                proformaNo,
                receiptNo,
                invoiceNo,
                addDate,
                proformaDate,
                receiptDate,
                amount,
                invoiceType,
              };
            });

            // ✅ IMPORTANT: Sort by InvoiceId DESC (latest first)
            invoiceLines.sort((a, b) => (b.invoiceId || 0) - (a.invoiceId || 0));
          }
        } else {
          console.error("IntInvoiceGet HTTP error:", res.status, await res.text());
        }
      } else {
        console.warn("No ApplicationId found on application, skipping IntInvoiceGet.");
      }
    } catch (e) {
      console.error("IntInvoiceGet fetch error:", e);
    }

    // ✅ Split invoices by type (keeps the sorted order)
    //const invoiceLinesLandlord = invoiceLines.filter((x) => x.invoiceType === "L");
    const invoiceLinesLandlord = invoiceLines.filter((x) => {
      const t = String(x.invoiceType ?? "").trim().toUpperCase();
      return t === "L" || t === "LANDLORD";
    });
 
    //const invoiceLinesTenant = invoiceLines.filter((x) => x.invoiceType === "T");
    const invoiceLinesTenant = invoiceLines.filter((x) => {
    const t = String(x.invoiceType ?? "").trim().toUpperCase();
    return t === "T" || t === "TENANT";
  });

    // ✅ "No (Date)"
    const fmtNoDate = (no: any, dt: any) => `${str(no, "—")} (${str(dt, "—")})`;

    const renTable = (title: string, rows: Array<[any, any, any]>) => ({
      table: {
        headerRows: 2,
        widths: ["*", "auto", "auto"],
        body: [
          [
            {
              text: title,
              colSpan: 3,
              bold: true,
              color: "#fff",
              fillColor: "#111",
              alignment: "center",
              margin: [0, 0, 0, 0],
            },
            {},
            {},
          ],
          [
            { text: "REN", bold: true, fillColor: "#f2f2f2" },
            { text: "Individual %", bold: true, alignment: "right", fillColor: "#f2f2f2" },
            { text: "Sharing %", bold: true, alignment: "right", fillColor: "#f2f2f2" },
          ],
          ...rows.map(([n, i, s]) => [
            { text: str(n), margin: [0, 0, 0, 0] },
            { text: pct(i), alignment: "right", margin: [0, 0, 0, 0] },
            { text: pct(s), alignment: "right", margin: [0, 0, 0, 0] },
          ]),
        ],
      },
      layout: {
        hLineWidth: () => 0.6,
        vLineWidth: () => 0.6,
        hLineColor: () => "#cfcfcf",
        vLineColor: () => "#cfcfcf",
        paddingLeft: () => 6,
        paddingRight: () => 6,
        paddingTop: () => 3,
        paddingBottom: () => 3,
      },
    });

    const partyTable = (title: string, rows: Array<[any, any]>) => ({
      table: {
        headerRows: 2,
        widths: ["*", "auto"],
        body: [
          [
            {
              text: title,
              colSpan: 2,
              bold: true,
              color: "#fff",
              fillColor: "#111",
              alignment: "center",
              margin: [0, 0, 0, 0],
            },
            {},
          ],
          [
            { text: "Name", bold: true, fillColor: "#f2f2f2" },
            { text: "IC", bold: true, alignment: "left", fillColor: "#f2f2f2" },
          ],
          ...rows.map(([name, ic]) => [
            { text: str(name), margin: [0, 0, 0, 0] },
            { text: str(ic), margin: [0, 0, 0, 0] },
          ]),
        ],
      },
      layout: {
        hLineWidth: () => 0.6,
        vLineWidth: () => 0.6,
        hLineColor: () => "#cfcfcf",
        vLineColor: () => "#cfcfcf",
        paddingLeft: () => 6,
        paddingRight: () => 6,
        paddingTop: () => 3,
        paddingBottom: () => 3,
      },
    });

    const billingDetailsLandlord = (_title: string, _feeLabel1: string, _feeLabel2: string) => ({
      stack: [
        {
          table: {
            widths: ["*"],
            body: [
              [
                {
                  text: _title,

                  bold: true,
                  fontSize: 12,
                  margin: [10, 2, 0, 2],
                  fillColor: "#e5e7eb",
                  border: [false, false, false, false],
                },
              ],
            ],
          },
          layout: "noBorders",
          margin: [0, 0, 0, 0],
        },
        {
          table: {
            widths: ["28%", "22%", "1%", "13%", "12%", "4%", "20%"],
            body: [
              [
                { text: "Professional Fees", margin: [10, 0, 0, 0] },
                { text: fmtAmt(application.AtlProFees), margin: [0, 0, 0, 0] },
                { text: "", margin: [0, 0, 0, 0] },
                { text: "SST (8%)", bold: true, margin: [0, 0, 0, 0] },
                { text: fmtAmt(application.AtlProFeesSstAmt), bold: true, margin: [0, 0, 0, 0] },
                { text: " = ", bold: true, margin: [0, 0, 0, 0] },
                {
                  text: (() => {
                    const a =
                      parseFloat(String(application.AtlProFees ?? "0").replace(/[^0-9.\-]/g, "")) || 0;
                    const b =
                      parseFloat(String(application.AtlProFeesSstAmt ?? "0").replace(/[^0-9.\-]/g, "")) || 0;
                    return (a + b).toLocaleString("en-MY", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    });
                  })(),
                  bold: true,
                  alignment: "right",
                  margin: [0, 0, 0, 0],
                },
              ],
              [
                { text: "Stamp Duty", margin: [10, 0, 0, 0] },
                { text: application.LandlordStampingFees, margin: [0, 0, 0, 0] },
                { text: "", margin: [0, 0, 0, 0] },
                { text: "", bold: true, margin: [0, 0, 0, 0] },
                { text: "", bold: true, margin: [0, 0, 0, 0] },
                { text: " = ", bold: true, margin: [0, 0, 0, 0] },
                { text: fmtAmt(application.LandlordStampingFees), bold: true, alignment: "right", margin: [0, 0, 0, 0] },
              ],
              [
                { text: "Admin Charges", margin: [10, 0, 0, 0] },
                { text: fmtAmt(application.LandlordAdminFeesAmt), margin: [0, 0, 0, 0] },
                { text: "", margin: [0, 0, 0, 0] },
                { text: "SST (8%)", bold: true, margin: [0, 0, 0, 0] },
                { text: fmtAmt(application.LandlordAdminFeesSst), bold: true, margin: [0, 0, 0, 0] },
                { text: " = ", bold: true, margin: [0, 0, 0, 0] },
                {
                  text: (() => {
                    const a =
                      parseFloat(String(application.LandlordAdminFeesAmt ?? "0").replace(/[^0-9.\-]/g, "")) || 0;
                    const b =
                      parseFloat(String(application.LandlordAdminFeesSst ?? "0").replace(/[^0-9.\-]/g, "")) || 0;
                    return (a + b).toLocaleString("en-MY", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    });
                  })(),
                  bold: true,
                  alignment: "right",
                  margin: [10, 0, 0, 0],
                },
              ],
              [
                { text: "Total", margin: [10, 0, 0, 0] },
                { text: "", margin: [0, 0, 0, 0] },
                { text: "", margin: [0, 0, 0, 0] },
                { text: "", bold: true, margin: [0, 0, 0, 0] },
                { text: "", bold: true, margin: [0, 0, 0, 0] },
                { text: "", bold: true, margin: [0, 0, 0, 0] },
                {
                  text: (() => {
                    const a =
                      parseFloat(String(application.LandlordAdminFeesAmt ?? "0").replace(/[^0-9.\-]/g, "")) || 0;
                    const b =
                      parseFloat(String(application.LandlordAdminFeesSst ?? "0").replace(/[^0-9.\-]/g, "")) || 0;
                    const c =
                      parseFloat(String(application.LandlordStampingFees ?? "0").replace(/[^0-9.\-]/g, "")) || 0;
                    const d =
                      parseFloat(String(application.AtlProFees ?? "0").replace(/[^0-9.\-]/g, "")) || 0;
                    const e =
                      parseFloat(String(application.AtlProFeesSstAmt ?? "0").replace(/[^0-9.\-]/g, "")) || 0;
                    return (a + b + c + d + e).toLocaleString("en-MY", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    });
                  })(),
                  bold: true,
                  alignment: "right",
                  margin: [10, 0, 0, 0],
                },
              ],
            ],
          },
          layout: "noBorders",
        },
      ],
    });

    const invoiceDetailsLandlord = (_title?: string, _feeLabel1?: string, _feeLabel2?: string) => ({
      stack: [
        {
          table: {
            widths: ["26%", "26%", "20%", "28%"],
            fontSize: 8,
            body: [
              [
                { text: "Proforma", bold: true, fillColor: "#f3f4f6", margin: [5, 4, 5, 4] },
                { text: "Invoice", bold: true, fillColor: "#f3f4f6", margin: [5, 4, 5, 4] },
                { text: "Receipt", bold: true, fillColor: "#f3f4f6", margin: [5, 4, 5, 4] },
                {
                  text: "Amount",
                  bold: true,
                  alignment: "right",
                  fillColor: "#f3f4f6",
                  margin: [5, 4, 5, 4],
                },
              ],
              ...(invoiceLinesLandlord.length > 0
                ? invoiceLinesLandlord.map((x) => [
                    { text: fmtNoDate(x.invoiceNo, x.addDate), margin: [5, 4, 5, 4] },
                    { text: fmtNoDate(x.proformaNo, x.proformaDate), margin: [5, 4, 5, 4] },
                    { text: fmtNoDate(x.receiptNo, x.receiptDate), margin: [5, 4, 5, 4] },
                    { text: x.amount, alignment: "right", margin: [5, 4, 5, 4] },
                  ])
                : [
                    [
                      {
                        text: "No invoice records found",
                        colSpan: 4,
                        italics: true,
                        alignment: "center",
                        margin: [0, 6, 0, 6],
                      },
                      {},
                      {},
                      {},
                    ],
                  ]),
            ],
          },
          layout: {
            hLineWidth: () => 0.6,
            vLineWidth: () => 0.6,
            hLineColor: () => "#cfcfcf",
            vLineColor: () => "#cfcfcf",
            paddingLeft: () => 5,
            paddingRight: () => 5,
            paddingTop: () => 2,
            paddingBottom: () => 2,
          },
          margin: [0, 0, 0, 8],
        },
      ],
    });

    const invoiceDetailsTenant = (_title?: string, _feeLabel1?: string, _feeLabel2?: string) => ({
      stack: [
        {
          table: {
            widths: ["26%", "26%", "20%", "28%"],
            fontSize: 8,
            body: [
              [
                { text: "Proforma", bold: true, fillColor: "#f3f4f6", margin: [5, 4, 5, 4] },
                { text: "Invoice", bold: true, fillColor: "#f3f4f6", margin: [5, 4, 5, 4] },
                { text: "Receipt", bold: true, fillColor: "#f3f4f6", margin: [5, 4, 5, 4] },
                {
                  text: "Amount",
                  bold: true,
                  alignment: "right",
                  fillColor: "#f3f4f6",
                  margin: [5, 4, 5, 4],
                },
              ],
              ...(invoiceLinesTenant.length > 0
                ? invoiceLinesTenant.map((x) => [
                    { text: fmtNoDate(x.invoiceNo, x.addDate), margin: [5, 4, 5, 4] },
                    { text: fmtNoDate(x.proformaNo, x.proformaDate), margin: [5, 4, 5, 4] },
                    { text: fmtNoDate(x.receiptNo, x.receiptDate), margin: [5, 4, 5, 4] },
                    { text: x.amount, alignment: "right", margin: [5, 4, 5, 4] },
                  ])
                : [
                    [
                      {
                        text: "No invoice records found",
                        colSpan: 4,
                        italics: true,
                        alignment: "center",
                        margin: [0, 6, 0, 6],
                      },
                      {},
                      {},
                      {},
                    ],
                  ]),
            ],
          },
          layout: {
            hLineWidth: () => 0.6,
            vLineWidth: () => 0.6,
            hLineColor: () => "#cfcfcf",
            vLineColor: () => "#cfcfcf",
            paddingLeft: () => 5,
            paddingRight: () => 5,
            paddingTop: () => 2,
            paddingBottom: () => 2,
          },
          margin: [0, 0, 0, 8],
        },
      ],
    });

    const billingDetailsTenant = (_title: string, _feeLabel1: string, _feeLabel2: string) => ({
      stack: [
        {
          table: {
            widths: ["*"],
            body: [
              [
                {
                  text: _title,

                  bold: true,
                  fontSize: 12,
                  margin: [10, 2, 0, 2],
                  fillColor: "#e5e7eb",
                  border: [false, false, false, false],
                },
              ],
            ],
          },
          layout: "noBorders",
          margin: [0, 0, 0, 0],
        },
        {
          table: {
            widths: ["28%", "22%", "1%", "13%", "12%", "4%", "20%"],
            body: [
              [
                { text: "Service Fees", margin: [10, 0, 0, 0] },
                { text: application.TalServiceFeesAmt, margin: [0, 0, 0, 0] },
                { text: "", margin: [0, 0, 0, 0] },
                { text: "SST (8%)", bold: true, margin: [0, 0, 0, 0] },
                { text: application.TalProfessionalFeesSstAmt, bold: true, margin: [0, 0, 0, 0] },
                { text: " = ", bold: true, margin: [0, 0, 0, 0] },
                {
                  text: (() => {
                    const a =
                      parseFloat(String(application.TalServiceFeesAmt ?? "0").replace(/[^0-9.\-]/g, "")) || 0;
                    const b =
                      parseFloat(String(application.TalProfessionalFeesSstAmt ?? "0").replace(/[^0-9.\-]/g, "")) || 0;
                    return (a + b).toLocaleString("en-MY", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    });
                  })(),
                  bold: true,
                  alignment: "right",
                  margin: [0, 0, 0, 0],
                },
              ],
              [
                { text: "Stamp Duty", margin: [10, 0, 0, 0] },
                { text: application.TenantStampingFees, margin: [0, 0, 0, 0] },
                { text: "", margin: [0, 0, 0, 0] },
                { text: "", bold: true, margin: [0, 0, 0, 0] },
                { text: "", bold: true, margin: [0, 0, 0, 0] },
                { text: " = ", bold: true, margin: [0, 0, 0, 0] },
                { text: application.TenantStampingFees, bold: true, alignment: "right", margin: [0, 0, 0, 0] },
              ],
              [
                { text: "Admin Charges", margin: [10, 0, 0, 0] },
                // NOTE: keeping your existing field usage unchanged
                { text: application.TenantAdminFeesAmt, margin: [0, 0, 0, 0] },
                { text: "", margin: [0, 0, 0, 0] },
                { text: "SST (8%)", bold: true, margin: [0, 0, 0, 0] },
                { text: fmtAmt(application.TenantAdminFeesSst), bold: true, margin: [0, 0, 0, 0] },
                { text: " = ", bold: true, margin: [0, 0, 0, 0] },
                {
                  text: (() => {
                    const a =
                      parseFloat(String(application.TenantAdminFeesAmt ?? "0").replace(/[^0-9.\-]/g, "")) || 0;
                    const b =
                      parseFloat(String(application.TenantAdminFeesSst ?? "0").replace(/[^0-9.\-]/g, "")) || 0;
                    return (a + b).toLocaleString("en-MY", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    });
                  })(),
                  bold: true,
                  alignment: "right",
                  margin: [10, 0, 0, 0],
                },
              ],
              [
                { text: "Total", margin: [10, 0, 0, 0] },
                { text: "", margin: [0, 0, 0, 0] },
                { text: "", margin: [0, 0, 0, 0] },
                { text: "", bold: true, margin: [0, 0, 0, 0] },
                { text: "", bold: true, margin: [0, 0, 0, 0] },
                { text: "", bold: true, margin: [0, 0, 0, 0] },
                {
                  text: (() => {
                    const a =
                      parseFloat(String(application.TalServiceFeesAmt ?? "0").replace(/[^0-9.\-]/g, "")) || 0;
                    const b =
                      parseFloat(String(application.TalProfessionalFeesSstAmt ?? "0").replace(/[^0-9.\-]/g, "")) || 0;
                    const c =
                      parseFloat(String(application.TenantStampingFees ?? "0").replace(/[^0-9.\-]/g, "")) || 0;
                    const d =
                      parseFloat(String(application.TenantAdminFeesAmt ?? "0").replace(/[^0-9.\-]/g, "")) || 0;
                    const e =
                      parseFloat(String(application.TenantAdminFeesSst ?? "0").replace(/[^0-9.\-]/g, "")) || 0;
                    return (a + b + c + d + e).toLocaleString("en-MY", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    });
                  })(),
                  bold: true,
                  alignment: "right",
                  margin: [10, 0, 0, 0],
                },
              ],
            ],
          },
          layout: "noBorders",
        },
      ],
    });

    /* =========================================================
       ✅ PAYMENT BREAKDOWN FOR LANDLORD
    ========================================================= */

    // ✅ Force all printed amounts: ##,##0.00
const fmtAmt = (v: any, fallback = "—") => {
  if (v === null || v === undefined) return fallback;

  const s = String(v).trim();
  if (!s) return fallback;

  // strip RM, commas, spaces, etc.
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(n)) return fallback;

  return n.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// ✅ numeric version when you need calculations
const amtNum = (v: any) => {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};


    
    const money = (v: any) => {
      const n = parseFloat(String(v ?? "0").replace(/[^0-9.\-]/g, ""));
      const ok = Number.isFinite(n) ? n : 0;
      return ok.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const moneyNum = (v: any) => {
      const n = parseFloat(String(v ?? "0").replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };

    const fmtRMOnlyNumber = (v: any) => {
      const s = String(v ?? "").trim();
      if (!s) return "—";
      const n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n)
        ? n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : s;
    };

    const paymentBreakdownForLandlordTable = () => {
      const earnest = amtNum(application.AtrRentalAmt);

      const security = amtNum(application.AtrSecurityDepositAmt);
      const utility = amtNum(application.AtrUtilityDepositAmt);
      const accessCard = amtNum(application.AtrAccessCard);
      const indahWater = amtNum(application.AtrIndahWater);
      const others = amtNum(application.AtrOtherDepositAmt);

      const total =
        (parseFloat(String(application.AtlEdFullAmt ?? "0").replace(/[^0-9.\-]/g, "")) || 0) +
        earnest +
        security +
        utility +
        accessCard +
        indahWater +
        others;

      return {
        stack: [
          {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    text: isSales ? "PAYMENT BREAKDOWN FOR VENDOR" : "PAYMENT BREAKDOWN FOR LANDLORD",

                    bold: true,
                    fontSize: 12,
                    margin: [10, 6, 0, 6],
                    fillColor: "#e5e7eb",
                    border: [false, false, false, false],
                  },
                ],
              ],
            },
            layout: "noBorders",
            margin: [0, 0, 0, 8],
          },
          {
            table: {
              widths: ["18%", "15%", "18%", "15%", "18%", "16%"],
              body: [
                [
                  { text: "Earnest Deposit / Advance Rental", bold: false, margin: [10, 2, 0, 2] },
                  { text: `RM ${fmtAmt(application.AtlEdFullAmt)}`, bold: true, alignment: "right", margin: [0, 2, 10, 2] },
                  { text: "Security Deposit", bold: false, margin: [10, 2, 0, 2] },
                  { text: `RM ${fmtAmt(security)}`, bold: true, alignment: "right", margin: [0, 2, 10, 2] },
                  { text: "Utility Deposit", bold: false, margin: [10, 2, 0, 2] },
                  { text: `RM ${money(utility)}`, bold: true, alignment: "right", margin: [0, 2, 10, 2] },
                ],
                [
                  { text: "Access Card", bold: false, margin: [10, 2, 0, 2] },
                  { text: `RM ${money(accessCard)}`, bold: true, alignment: "right", margin: [0, 2, 10, 2] },
                  { text: "Indah Water", bold: false, margin: [10, 2, 0, 2] },
                  { text: `RM ${money(indahWater)}`, bold: true, alignment: "right", margin: [0, 2, 10, 2] },
                  { text: "Reimburse to REN", bold: false, margin: [10, 2, 0, 2] },
                  { text: `RM ${money(others)}`, bold: true, alignment: "right", margin: [0, 2, 10, 2] },
                ],
                [
                  { text: "Total", bold: false, margin: [10, 4, 0, 4], colSpan: 5 },
                  {},
                  {},
                  {},
                  {},
                  { text: `RM ${money(total)}`, bold: true, alignment: "right", margin: [0, 4, 10, 4] },
                ],
              ],
            },
            layout: {
              hLineWidth: () => 0.6,
              vLineWidth: () => 0.6,
              hLineColor: () => "#cfcfcf",
              vLineColor: () => "#cfcfcf",
              paddingLeft: () => 4,
              paddingRight: () => 4,
              paddingTop: () => 2,
              paddingBottom: () => 2,
            },
            margin: [0, 0, 0, 10],
          },
        ],
      };
    };

    // 🔹 Payment history row type (✅ includes AppRejRem)
    type PaymentHistoryRow = {
      date: string;
      fileName: string;
      amt: string;
      appRejRem: string;
    };

    let tenantPaymentHistory: PaymentHistoryRow[] = [];
    let landlordPaymentHistory: PaymentHistoryRow[] = [];

    // 🔹 Fetch payment history from UploadedFileGet.php
    try {
      const appId =
        application?.ApplicationId ??
        application?.RentalApplicationId ??
        application?.LoanApplicationId;

      if (appId) {
        const formData = new FormData();
        formData.append("ApplicationId", String(appId));

        const res = await fetch(PAYMENT_HISTORY_URL, { method: "POST", body: formData });

        if (res.ok) {
          const json: any = await res.json();
          if (json && json.status === "success" && Array.isArray(json.data)) {
            json.data.forEach((row: any) => {
              const pick = (keys: string[]): any => {
                for (const k of keys) {
                  if (k in row && row[k] != null && String(row[k]).trim() !== "") return row[k];
                }
                return "";
              };

              // ✅ Only show APPROVED payment history
              const rawStatus = pick(["PaymentStatus", "Status", "ApprovalStatus"]);
              const status = String(rawStatus ?? "").trim().toUpperCase();
              if (status !== "APPROVED") return;

              const rawDate = pick(["PaymentDate", "PaidOn", "AddDate", "DocDate"]);
              const rawFileName = row.ActualFileName ?? row.FileName ?? "";
              const rawAmt = pick([
                "PaymentAmt",
                "Amount",
                "TotalReceived",
                "RefundToTenant",
                "RefundToLandlord",
                "FileAmt",
              ]);
              const rawAppRejRem = pick(["AppRejRem", "AppRejectRemark", "RejectRemark", "Remark", "Remarks"]);

              let amtStr = "";
              if (rawAmt !== "") {
                const num = parseFloat(String(rawAmt).replace(/[^0-9.\-]/g, ""));
                amtStr = Number.isFinite(num)
                  ? num.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : String(rawAmt);
              }

              const mapped: PaymentHistoryRow = {
                date: str(rawDate, "—"),
                fileName: str(rawFileName, "—"),
                amt: str(amtStr || rawAmt, "—"),
                appRejRem: str(rawAppRejRem, ""),
              };

              const claimParty = String(row.ClaimParty ?? "").trim().toLowerCase();
              if (claimParty === "tenant") tenantPaymentHistory.push(mapped);
              else if (claimParty === "landlord") landlordPaymentHistory.push(mapped);
              else tenantPaymentHistory.push(mapped);
            });
          }
        } else {
          console.error("Payment history HTTP error:", res.status, await res.text());
        }
      } else {
        console.warn("No ApplicationId on application, skipping payment history fetch.");
      }
    } catch (e) {
      console.error("Payment history fetch error:", e);
    }

    const paymentHistoryTable = (title: string, rows: PaymentHistoryRow[]) => ({
      stack: [
        {
          //table: { widths: ["*"], body: [[{ text: title, bold: true, fontSize: 10, margin: [10, 0, 0, 0], fillColor: "#e5e7eb", border: [false, false, false, false] }]]



          table: {
  widths: ["*"],
  body: [[
    {
      text: title,
      bold: true,
      fontSize: 10,
      color: "#ffffff",
      margin: [10, 0, 0, 0],
      fillColor: "#000000",
      border: [false, false, false, false]
    }
  ]]
}
          },


        
        {
          table: {
            widths: ["18%", "52%", "30%"],
            body: [
              [
                { text: "Date", bold: true, fillColor: "#f2f2f2", margin: [0, 3, 0, 3] },
                { text: "File Name", bold: true, fillColor: "#f2f2f2", margin: [0, 3, 0, 3] },
                { text: "Amount (RM)", bold: true, alignment: "right", fillColor: "#f2f2f2", margin: [0, 3, 0, 3] },
              ],
              ...(rows.length > 0
                ? rows.flatMap((r) => {
                    const rem = (r.appRejRem ?? "").toString().trim();
                    const hasRem = rem !== "";

                    const line1: any[] = [
                      { text: r.date, margin: [0, 2, 0, 2] },
                      { text: r.fileName, margin: [0, 2, 0, 2] },
                      { text: r.amt, alignment: "right", margin: [0, 2, 0, 2] },
                    ];

                    const line2: any[] = [
                      { text: hasRem ? `Remark: ${rem}` : "Remark: —", colSpan: 3, margin: [0, 0, 0, 4], alignment: "left" },
                      {},
                      {},
                    ];

                    return [line1, line2];
                  })
                : [
                    [
                      { text: "No payment records found", colSpan: 3, italics: true, alignment: "center", margin: [0, 4, 0, 4] },
                      {},
                      {},
                    ],
                  ]),
            ],
          },
          layout: {
            hLineWidth: () => 0.6,
            vLineWidth: () => 0.6,
            hLineColor: () => "#cfcfcf",
            vLineColor: () => "#cfcfcf",
            paddingLeft: () => 4,
            paddingRight: () => 4,
            paddingTop: () => 3,
            paddingBottom: () => 3,
          },
          margin: [0, 0, 0, 10],
        },
      ],
    });

    /* =========================================================
       ✅ REFUND DETAILS (NEW TABLE)
    ========================================================= */
    type RefundRow = {
  label: string;
  name: string;
  rm: string;
  date: string;

  // ✅ NEW
  banker: string;
  bankAcNo: string;
  bankHolder: string;
};


    const refundDetailsTable = (rows: RefundRow[]) => ({
  stack: [
    {
      table: {
        widths: ["*"],
        body: [
          [
            {
              text: "REFUND DETAILS",
              bold: true,
              fontSize: 12,
              margin: [10, 6, 0, 6],
              fillColor: "#e5e7eb",
              border: [false, false, false, false],
            },
          ],
        ],
      },
      layout: "noBorders",
      margin: [0, 0, 0, 8],
    },
    {
      table: {
        // keep original layout widths
        widths: ["26%", "34%", "20%", "20%"],
        body: [
          ...(rows && rows.length > 0
            ? rows.flatMap((r) => {
                const line1: any[] = [
                  { text: str(r.label, "—"), margin: [6, 4, 6, 4] },
                  { text: `Name : ${str(r.name, "—")}`, margin: [6, 4, 6, 4] },
                  { text: `RM : ${str(r.rm, "—")}`, alignment: "right", margin: [6, 4, 6, 4] },
                  { text: `Date : ${str(r.date, "—")}`, margin: [6, 4, 6, 4] },
                ];

                // ✅ NEW: extra bank lines (full width)
                const line2: any[] = [
                  {
                    text: `Bank : ${str(r.banker, "—")}    A/C No : ${str(r.bankAcNo, "—")}`,
                    colSpan: 4,
                    margin: [6, 0, 6, 2],
                  },
                  {},
                  {},
                  {},
                ];

                const line3: any[] = [
                  {
                    text: `A/C Holder : ${str(r.bankHolder, "—")}`,
                    colSpan: 4,
                    margin: [6, 0, 6, 4],
                  },
                  {},
                  {},
                  {},
                ];

                return [line1, line2, line3];
              })
            : [
                [
                  { text: "No refund records found", colSpan: 4, italics: true, alignment: "center", margin: [0, 6, 0, 6] },
                  {},
                  {},
                  {},
                ],
              ]),
        ],
      },
      layout: {
        hLineWidth: () => 0.6,
        vLineWidth: () => 0.6,
        hLineColor: () => "#cfcfcf",
        vLineColor: () => "#cfcfcf",
        paddingLeft: () => 4,
        paddingRight: () => 4,
        paddingTop: () => 2,
        paddingBottom: () => 2,
      },
      margin: [0, 0, 0, 10],
    },
  ],
});


    // ✅ Refund rows (uses application fields if exist; safe fallbacks, never crashes)
    const refundRows: RefundRow[] = [
  {
    label: isSales ? "Refund to Vendor" : "Refund to Landlord",
    name: str(pickApp(["RefundLandlordName", "RefundToLandlordName", "LandlordRefundName", "Landlord1Name"]), "—"),
    rm: fmtRMOnlyNumber(pickApp(["RefundToLandlord", "RefundLandlordAmt", "LandlordRefundAmt"])),
    date: str(pickApp(["RefundToLandlordDate", "RefundLandlordDate", "LandlordRefundDate"]), "—"),

    // ✅ NEW (Landlord/Seller bank info)
    banker: str(pickApp(["Landlord1Banker"]), "—"),
    bankAcNo: str(pickApp(["Landlord1BankAcNo"]), "—"),
    bankHolder: str(pickApp(["Landlord1BankHolderName"]), "—"),
  },
  {
    label: isSales ? "Refund to Buyer" : "Refund to Tenant",
    name: str(pickApp(["RefundTenantName", "RefundToTenantName", "TenantRefundName", "Tenant1Name"]), "—"),
    rm: fmtRMOnlyNumber(pickApp(["RefundToTenant", "RefundTenantAmt", "TenantRefundAmt"])),
    date: str(pickApp(["RefundToTenantDate", "RefundTenantDate", "TenantRefundDate"]), "—"),

    // ✅ NEW (Tenant/Buyer bank info)
    banker: str(pickApp(["Tenant1Banker"]), "—"),
    bankAcNo: str(pickApp(["Tenant1BankAcNo"]), "—"),
    bankHolder: str(pickApp(["Tenant1BankHolderName"]), "—"),
  },
  {
    label: "Refund to Ren",
    name: str(pickApp(["RefundRenName", "RefundToRenName", "RenRefundName", "RenName"]), "—"),
    rm: fmtRMOnlyNumber(pickApp(["RefundToRen", "RefundRenAmt", "RenRefundAmt"])),
    date: str(pickApp(["RefundToRenDate", "RefundRenDate", "RenRefundDate"]), "—"),

    // ✅ NEW (no fields given for Ren — keep as "—")
    banker: "—",
    bankAcNo: "—",
    bankHolder: "—",
  },
];



    /* =========================================================
       ✅ NEW: INTRODUCER DETAILS (AFTER REFUND DETAILS)
    ========================================================= */
    type IntroducerRow = {
      name: string;
      ic: string;
      amount: string;
      payoutDate: string;
    };

    const introducerRow: IntroducerRow = {
      name: str(pickApp(["IntroducerName", "IntroducerDisplayName", "IntroducerFullName", "Introducer"]), "—"),
      ic: str(pickApp(["IntroducerIC", "IntroducerIcNo", "IntroducerICNo", "IntroducerNRIC", "IntroducerNric"]), "—"),
      amount: fmtRMOnlyNumber(pickApp(["IntroducerAmount", "IntroducerAmt", "IntroducerFee", "IntroducerFees"])),
      payoutDate: str(pickApp(["IntroducerPayoutDate", "IntroducerPayDate", "IntroducerPayoutOn"]), "—"),
    };

    // ✅ FULL regenerated introducerDetailsTable() (drop-in replacement)
const introducerDetailsTable = (row: IntroducerRow) => ({
  stack: [
    {
      table: {
        widths: ["*"],
        body: [
          [
            {
              text: "INTRODUCER",
              bold: true,
              fontSize: 12,
              margin: [10, 6, 0, 6],
              fillColor: "#e5e7eb",
              border: [false, false, false, false],
            },
          ],
        ],
      },
      layout: "noBorders",
      margin: [0, 0, 0, 8],
    },
    {
      table: {
        widths: ["50%", "50%"],
        body: [
          [
            { text: `Name : ${str(row.name, "—")}`, margin: [6, 4, 6, 4] },
            { text: `IC No : ${str(row.ic, "—")}`, margin: [6, 4, 6, 4] },
          ],
          [
            { text: `Amount : ${str(row.amount, "—")}`, margin: [6, 4, 6, 4] },
            { text: `Payout Date : ${str(row.payoutDate, "—")}`, margin: [6, 4, 6, 4] },
          ],

          // ✅ NEW: Extra introducer payment/bank info
          [
            { text: `Bank : ${str((row as any).introBanker, "—")}`, margin: [6, 4, 6, 4] },
            { text: `Bank Account No : ${str((row as any).introBankAccNo, "—")}`, margin: [6, 4, 6, 4] },
          ],
          [
            { text: `Account Holder : ${str((row as any).introBankHolder, "—")}`, margin: [6, 4, 6, 4] },
            { text: `Contact No : ${str((row as any).introCommAmt, "—")}`, margin: [6, 4, 6, 4] },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 0.6,
        vLineWidth: () => 0.6,
        hLineColor: () => "#cfcfcf",
        vLineColor: () => "#cfcfcf",
        paddingLeft: () => 4,
        paddingRight: () => 4,
        paddingTop: () => 2,
        paddingBottom: () => 2,
      },
      margin: [0, 0, 0, 10],
    },
  ],
});


    /* =========================================================
       ✅ Uploaded documents (your existing block kept)
    ========================================================= */
    type UploadedDocRow = {
      addDate: string;
      docType: string;
      docName: string;
      attName: string;
    };

    let uploadedDocs: UploadedDocRow[] = [];

    try {
      const refNo = application?.RefNo;

      if (refNo) {
        const fd = new FormData();
        fd.append("RefNo", String(refNo));

        const res = await fetch(DOC_UPLOAD_URL, { method: "POST", body: fd });

        if (res.ok) {
          const json: any = await res.json();
          if (json && json.status === "success" && Array.isArray(json.data)) {
            uploadedDocs = json.data.map((r: any) => ({
              addDate: str(r.AddDate, "—"),
              docType: str(r.DocType, "—"),
              docName: str(r.DocName, "—"),
              attName: str(r.AttName, ""),
            }));
          }
        } else {
          console.error("Uploaded docs HTTP error:", res.status, await res.text());
        }
      } else {
        console.warn("No RefNo on application, skipping uploaded docs fetch.");
      }
    } catch (e) {
      console.error("Uploaded docs fetch error:", e);
    }

    const uploadedDocsTable = (title: string, rows: UploadedDocRow[]) => ({
      stack: [
        {
          table: {
            widths: ["*"],
            body: [
              [
                {
                  text: title,
                  bold: true,
                  fontSize: 12,
                  margin: [10, 6, 0, 6],
                  fillColor: "#e5e7eb",
                  border: [false, false, false, false],
                },
              ],
            ],
          },
          layout: "noBorders",
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            headerRows: 1,
            widths: ["55%", "15%", "30%"],
            body: [
              [
                { text: "FILE", bold: true, color: "#6b7280", margin: [0, 6, 0, 6] },
                { text: "DATE", bold: true, color: "#6b7280", margin: [0, 6, 0, 6] },
                { text: "TYPE", bold: true, color: "#6b7280", margin: [0, 6, 0, 6] },
              ],
              ...(rows.length > 0
                ? rows.map((r) => [
                    { text: r.docName || "—", bold: true, color: "#111827", margin: [0, 10, 0, 10] },
                    { text: r.addDate || "—", color: "#374151", margin: [0, 10, 0, 10] },
                    { text: r.docType || "—", color: "#374151", margin: [0, 10, 0, 10] },
                  ])
                : [
                    [
                      { text: "No uploaded documents found", colSpan: 3, italics: true, alignment: "center", color: "#6b7280", margin: [0, 10, 0, 10] },
                      {},
                      {},
                    ],
                  ]),
            ],
          },
          layout: {
            hLineWidth: (i: number) => (i === 0 ? 0 : 1),
            vLineWidth: () => 0,
            hLineColor: () => "#e5e7eb",
            paddingLeft: () => 0,
            paddingRight: () => 0,
            paddingTop: () => 0,
            paddingBottom: () => 0,
          },
          margin: [0, 0, 0, 10],
        },
      ],
    });

    const [logoDataUrl, footerDataUrl] = await Promise.all([
      assetToDataUrl("/inte-logo.png"),
      assetToDataUrl("/Footer_A4.png"),
    ]);

    const docDefinition: any = {
      pageSize: "A4",
      pageMargins: [20, 80, 20, 80],
      defaultStyle: { fontSize: 9 },
      header: (_currentPage: number, _pageCount: number, pageSize: any) => ({
        margin: [40, 20, 40, 10],
        stack: [
          {
  columns: [
    logoDataUrl
      ? { image: "logo", width: 160, margin: [0, 8, 20, 0] }
      : { text: "", width: 160 },

    { text: "", width: "*" },

    {
      width: 170,
      table: {
        widths: [170],
        body: [[
          {
            text: "CLAIM FORM",
            color: "#fff",
            bold: true,
            alignment: "center",
            fontSize: 12,
            margin: [0, 10, 0, 10],
            fillColor: "#000",
            noWrap: true,
            border: [false, false, false, false],
          },
        ]],
      },
      layout: "noBorders",
    },

    {
      width: "auto",
      text: transTypeLabel.toUpperCase(),
      bold: true,
      fontSize: 12,
      noWrap: true,
      margin: [14, 10, 0, 0],
      alignment: "left",
    },
  ],
},
          {
            canvas: [{ type: "line", x1: 0, y1: 0, x2: pageSize.width - 80, y2: 0, lineWidth: 1 }],
            margin: [0, 6, 0, 0],
          },
        ],
      }),
      images: {
        ...(logoDataUrl ? { logo: logoDataUrl } : {}),
        ...(footerDataUrl ? { footerBanner: footerDataUrl } : {}),
      },

      content: [


        {
  columns: [
    { width: "15%", text: "Ref No", bold: true },
    { width: 20, text: ":", bold: true, alignment: "center" },
    {
      width: "*",
      columns: [
        { width: "auto", text: str(application.RefNo, "—") },      
        { width: 16, text: "", bold: true, alignment: "center" },        
        { width: "auto", text: "Submission Date", bold: true },
        { width: 16, text: ":", bold: true, alignment: "center" },



        {
  width: "auto",
  text: (() => {
    const s = String(application.SubmissionDate ?? "").trim();
    const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m1) return `${m1[3]}-${m1[2]}-${m1[1].slice(-2)}`;

    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = String(d.getFullYear()).slice(-2);
      return `${dd}-${mm}-${yy}`;
    }

    return s || "—";
  })(),
},

        
        { width: 18, text: "  " }, // gap
        { width: "auto", text: "Payout Date", bold: true },
        { width: 16, text: ":", bold: true, alignment: "center" },
        {
          width: "auto",
          text: (() => {
            const s = String(application.PayoutDate ?? "").trim();
            const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (m1) return `${m1[3]}-${m1[2]}-${m1[1].slice(-2)}`;
        
            const d = new Date(s);
            if (!isNaN(d.getTime())) {
              const dd = String(d.getDate()).padStart(2, "0");
              const mm = String(d.getMonth() + 1).padStart(2, "0");
              const yy = String(d.getFullYear()).slice(-2);
              return `${dd}-${mm}-${yy}`;
            }
        
            return s || "—";
          })(),
        },
      ],
    },
  ],
  margin: [0, 0, 0, 0],
},

        {
          columns: [
            { width: "15%", text: "Property Address ", bold: true },
            { width: 20, text: " : ", bold: true, alignment: "center" }, 
            {
              width: "80%",
              text: [
                "",
                str(application.PropertyAddress, ""),
                application.PropertyPostalCode ? `, ${application.PropertyPostalCode}` : "",
                application.PropertyLocation ? `, ${application.PropertyLocation}` : "",
                application.PropertyTown ? `, ${application.PropertyTown}` : "",
                application.PropertyState ? `, ${application.PropertyState}` : "",
              ].join(""),
            },
          ],
          margin: [0, 0, 0, 4],
        },

        {
  columns: [
    { width: "15%", text: transTypeLabel, bold: true }, // ✅ was "Rental"
    { width: 20, text: " : ", bold: true, alignment: "center" },     
    { width: "80%", text: ` RM ${fmtAmt(transAmount)}` },
  ],
  margin: [0, 0, 0, 4],
},


        

        // ✅ Show Tenancy Period only for Rental
...(!isSales
  ? [
      {
        columns: [
          { width: "15%", text: "Tenancy Period", bold: true },
          { width: 20, text: " : ", bold: true, alignment: "center" }, 
          {
            width: "80%",
            text:
              ` ${str(application.TenancyPeriodFrom, "")} to ${str(application.TenancyPeriodTo, "")}` 
              //+ ` (${str(application.TenancyPeriodTotalPeriod, "—")})`,
          },
        ],
        margin: [0, 0, 0, 10],
      },
    ]
  : []),


        {
          columns: [
            renTable(
              "LISTER",
              [
                [application.ListerDisplayName, application.ListerInvPctg, application.ListerSharingPctg],
                [application.Lister1DisplayName, application.ListerInvPctg1, application.ListerSharingPctg1],
                [application.Lister2DisplayName, application.ListerInvPctg2, application.ListerSharingPctg2],
              ].filter(([name]) => ((name ?? "").toString().trim() !== ""))
            ),
            renTable(
              "CLOSER",
              [
                [application.CloserDisplayName, application.CloserInvPctg, application.CloserSharingPctg],
                [application.Closer1DisplayName, application.CloserInvPctg1, application.CloserSharingPctg1],
                [application.Closer2DisplayName, application.CloserInvPctg2, application.CloserSharingPctg2],
              ].filter(([name]) => ((name ?? "").toString().trim() !== ""))
            ),
          ],
          columnGap: 12,
          margin: [0, 0, 0, 5],
        },

        {
  columns: [
    partyTable(
      isSales ? "VENDOR" : "LANDLORD",
      [
        [application.Landlord1Name, application.Landlord1Id],
        [application.Landlord2Name, application.Landlord2Id],
        [application.Landlord3Name, application.Landlord3Id],
      ].filter(([name]) => ((name ?? "").toString().trim() !== ""))
    ),
    partyTable(
      isSales ? "BUYER" : "TENANT",
      [
        [application.Tenant1Name, application.Tenant1Id],
        [application.Tenant2Name, application.Tenant2Id],
        [application.Tenant3Name, application.Tenant3Id],
      ].filter(([name]) => ((name ?? "").toString().trim() !== ""))
    ),
  ],
  columnGap: 12,
  margin: [0, 0, 0, 10],
},


        
        //{ text: " ", margin: [0, 6, 0, 6] },
        
        paymentHistoryTable(isSales ? "BUYER PAYMENT HISTORY" : "TENANT PAYMENT HISTORY", tenantPaymentHistory),


        // 2) Landlord Payment History
        //{ text: " ", margin: [0, 6, 0, 6] },
        //paymentHistoryTable("LANDLORD PAYMENT HISTORY", landlordPaymentHistory),
        paymentHistoryTable(isSales ? "VENDOR PAYMENT HISTORY" : "LANDLORD PAYMENT HISTORY", landlordPaymentHistory),






        

        

        // 3) Billing Details - Tenant
        { text: " ", margin: [0, 3, 0, 3] },
        billingDetailsTenant(isSales ? "BILLING DETAILS - BUYER" : "BILLING DETAILS - TENANT", "Service Fees", "Admin Fees"),

        invoiceDetailsTenant("INTRODUCER DETAILS", "Service Fees", "Admin Fees"),

        // 4) Payment Breakdown For Landlord (middle)
        { text: " ", margin: [0, 0, 0, 0] },
        paymentBreakdownForLandlordTable(),

        // 5) Billing Details - Landlord (last)
        { text: " ", margin: [0, 3, 0, 3] },
        billingDetailsLandlord(isSales ? "BILLING DETAILS - VENDOR" : "BILLING DETAILS - LANDLORD", "Professional Fees", "Admin Fees"),

        invoiceDetailsLandlord("INTRODUCER DETAILS", "Service Fees", "Admin Fees"),

        // ✅ NEW (AFTER invoiceDetailsLandlord): REFUND DETAILS
        { text: " ", margin: [0, 3, 0, 3] },
        refundDetailsTable(refundRows),

        // ✅ NEW (AFTER Refund details): INTRODUCER TABLE YOU REQUESTED
        { text: " ", margin: [0, 3, 0, 3] },
        introducerDetailsTable(introducerRow),

        // ✅ add here - end

        // (rest of your file continues unchanged)
      ],
      // footer etc continues unchanged in your full file
    };

    pdfMake.createPdf(docDefinition).download("ClaimForm.pdf");
  } catch (err) {
    console.error("Claim Form PDF Error:", err);
    alert("Failed to generate Claim Form PDF.");
  }
};
