import { API_ENDPOINTS } from '../../config/apiConfig';
import { IntInvoiceBundle } from "../../types/payment";
import { ensurePdfMakeOnce, assetToDataUrl } from "./pdfUtils";
import footerPng from "../../assets/footer_a4_2026.png";

const INT_INVOICE_GET_URL =
  API_ENDPOINTS.INT_INVOICE_GET;

export const printInvoice1Pdf = async (bundle: IntInvoiceBundle) => {
  const inv = bundle.header;
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

  const invoiceId = String(
    (inv as any)?.InvoiceId ??
      (inv as any)?.InvoiceID ??
      (inv as any)?.invoiceId ??
      ""
  ).trim();

  if (!invoiceId) {
    alert("InvoiceId not found. Cannot print invoice.");
    return;
  }

  const fetchInvoicePrintData = async (invoiceIdValue: string) => {
    const formData = new FormData();
    formData.append("InvoiceId", invoiceIdValue);

    const response = await fetch(INT_INVOICE_GET_URL, {
      method: "POST",
      body: formData,
    });

    const json = await response.json();

    if (
      json?.status !== "success" ||
      !Array.isArray(json?.data) ||
      json.data.length === 0
    ) {
      throw new Error(json?.error || "Failed to load invoice print data");
    }

    return json.data[0];
  };

  let invoiceApi: any;

  try {
    invoiceApi = await fetchInvoicePrintData(invoiceId);
    console.log("invoiceApi =", invoiceApi);
  } catch (error) {
    console.error("Failed to fetch invoice print data:", error);
    alert("Failed to load invoice print data.");
    return;
  }

  const invoiceNo =
    invoiceApi?.InvoiceNo1 ??
    (inv as any)?.InvoiceNo1 ??
    (inv as any)?.invoiceNo1 ??
    invoiceApi?.InvoiceNo ??
    (inv as any)?.InvoiceNo ??
    (inv as any)?.Invoice_No ??
    (inv as any)?.invoiceNo ??
    "Inv-YYMM/xxxx";

  const rawInvoiceDate =
    invoiceApi?.InvoiceDate ?? inv.InvoiceDate ?? (inv as any).Invoice_Date ?? "";

  const formatDate = (d: any) => {
    const s = String(d ?? "").trim();
    if (!s) return "DD/MM/YYYY";

    if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(s)) return s;

    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      const dd = String(dt.getDate()).padStart(2, "0");
      const mmm = dt.toLocaleString("en-GB", { month: "short" });
      const yyyy = dt.getFullYear();
      return `${dd}-${mmm}-${yyyy}`;
    }

    return s;
  };

  const invoiceDate = formatDate(rawInvoiceDate);

  const docType = invoiceApi?.DocType ?? inv.DocType ?? "INVOICE";
  const invoiceType = invoiceApi?.InvoiceType ?? inv.InvoiceType ?? "Tenant";
  const terms =
    invoiceApi?.Terms ??
    (inv as any)?.Terms ??
    (inv as any)?.PaymentTerms ??
    "CASH";

  const invoiceDescRaw =
    invoiceApi?.InvoiceDesc ??
    (inv as any)?.InvoiceDesc ??
    (inv as any)?.Invoice_Desc ??
    (inv as any)?.invoiceDesc ??
    "";

  const invoiceDescLines = String(invoiceDescRaw || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const headerTo = String(
    invoiceApi?.InvoiceTo ??
      (inv as any)?.InvoiceTo ??
      (inv as any)?.Invoice_To ??
      (inv as any)?.invoiceTo ??
      ""
  ).trim();

  const headerAddress = String(
    invoiceApi?.InvoiceAddress ??
      (inv as any)?.InvoiceAddress ??
      (inv as any)?.Invoice_Address ??
      (inv as any)?.invoiceAddress ??
      ""
  ).trim();

  const isTenant = String(invoiceType || "").toLowerCase().includes("tenant");

  const fallbackName = isTenant
    ? application?.Tenant1Name || application?.TenantName || ""
    : application?.Landlord1Name || application?.LandlordName || "";

  const fallbackAddress = isTenant
    ? [
        application?.Tenant1Add1,
        application?.Tenant1Add2,
        application?.Tenant1Add3,
      ]
        .filter(Boolean)
        .join(", ")
    : [
        application?.Landlord1Add1,
        application?.Landlord1Add2,
        application?.Landlord1Add3,
      ]
        .filter(Boolean)
        .join(", ");

  const recipientName = headerTo || fallbackName || "";
  const recipientAddress = headerAddress || fallbackAddress || "";

  const propertyAddress =
    [
      application?.PropertyAddress,
      application?.PropertyLocation,
      application?.PropertyTown,
      application?.PropertyState,
    ]
      .filter(Boolean)
      .join(", ") ||
    application?.PropertyFullAddress ||
    "";

  const propertyValue =
    application?.TalRentalAmt || application?.PropertyPrice || "";

  const transactionId =
    invoiceApi?.TransId ||
    (inv as any)?.PaymentTransId ||
    application?.ApplicationId ||
    application?.RefNo ||
    "";

  const refNo =
    application?.RefNo || String(invoiceApi?.TransId ?? "").trim() || "-";

  const ourFeesGross = invoiceApi?.InvoiceFees ?? "0.00";
  const ourFeesSst = invoiceApi?.InvoiceSst ?? "0.00";
  const adminCharges = invoiceApi?.InvoiceAdminCharges ?? "0.00";
  const adminChargesSst = invoiceApi?.InvoiceAdminSst ?? "0.00";
  const stampDuty = invoiceApi?.InvoiceStampDuty ?? "0.00";
  const stampDutySst = "0.00";

  const totalBeforeSst =
    toNum(ourFeesGross) + toNum(adminCharges) + toNum(stampDuty);
  const totalSst =
    toNum(ourFeesSst) + toNum(adminChargesSst) + toNum(stampDutySst);
  const totalDue = totalBeforeSst + totalSst;

  const tableBody: any[] = [
    [
      {
        text: "Description",
        bold: true,
        fontSize: 11,
        color: "white",
        fillColor: "black",
      },
      {
        text: "Amount",
        bold: true,
        alignment: "right",
        fontSize: 11,
        color: "white",
        fillColor: "black",
      },
      {
        text: "SST (8%)",
        bold: true,
        alignment: "right",
        fontSize: 11,
        color: "white",
        fillColor: "black",
      },
    ],
    [
      "Our Fees",
      { text: money(ourFeesGross), alignment: "right" },
      { text: money(ourFeesSst), alignment: "right" },
    ],
  ];

  if (toNum(adminCharges) > 0 || toNum(adminChargesSst) > 0) {
    tableBody.push([
      "Administrative Fees",
      { text: money(adminCharges), alignment: "right" },
      {
        text: toNum(adminChargesSst) > 0 ? money(adminChargesSst) : "-",
        alignment: "right",
      },
    ]);
  } else {
    tableBody.push([
      "Administrative Fees",
      { text: "", alignment: "right" },
      { text: "-", alignment: "right" },
    ]);
  }

  if (toNum(stampDuty) > 0 || toNum(stampDutySst) > 0) {
    tableBody.push([
      "Stamping Fees",
      { text: money(stampDuty), alignment: "right" },
      {
        text: toNum(stampDutySst) > 0 ? money(stampDutySst) : "-",
        alignment: "right",
      },
    ]);
  } else {
    tableBody.push([
      "Stamping Fees",
      { text: "", alignment: "right" },
      { text: "-", alignment: "right" },
    ]);
  }

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

  const numToWordsEn = (n: number): string => {
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
    const tens = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];

    const under1000 = (x: number): string => {
      let s = "";
      const h = Math.floor(x / 100);
      const r = x % 100;

      if (h > 0) s += ones[h] + " Hundred" + (r ? " " : "");
      if (r > 0) {
        if (r < 20) s += ones[r];
        else {
          const t = Math.floor(r / 10);
          const u = r % 10;
          s += tens[t] + (u ? " " + ones[u] : "");
        }
      }
      return s || "Zero";
    };

    if (!Number.isFinite(n) || n < 0) return "Zero";
    if (n === 0) return "Zero";

    const parts: string[] = [];
    const billions = Math.floor(n / 1_000_000_000);
    const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
    const thousands = Math.floor((n % 1_000_000) / 1000);
    const rest = n % 1000;

    if (billions) parts.push(under1000(billions) + " Billion");
    if (millions) parts.push(under1000(millions) + " Million");
    if (thousands) parts.push(under1000(thousands) + " Thousand");
    if (rest) parts.push(under1000(rest));

    return parts.join(" ").replace(/\s+/g, " ").trim();
  };

  const amountInWords = (() => {
    const whole = Math.floor(totalDue + 1e-9);
    const sen = Math.round((totalDue - whole) * 100);

    const wholeWords = numToWordsEn(whole);
    if (sen > 0) {
      const senWords = numToWordsEn(sen);
      return `Ringgit Malaysia : ${wholeWords} And ${senWords} Cents Only`;
    }
    return `Ringgit Malaysia : ${wholeWords} Only`;
  })();

  const docDefinition: any = {
    pageSize: "A4",
    pageMargins: [40, 100, 40, 260],

    header: (_p: number, _pc: number) => ({
      margin: [40, 30, 40, 20],
      columns: [
        logoDataUrl
          ? { image: "logo", fit: [180, 60], alignment: "left" }
          : { text: "" },
        { width: "*", text: "" },
      ],
    }),

    footer: (currentPage: number, pageCount: number, pageSize: any) => {
      const showNotes = currentPage === pageCount;

      const notes = showNotes
        ? {
            margin: [40, 0, 40, 6],
            stack: [
              { text: "E. & O.E.", fontSize: 10, margin: [0, 0, 0, 8] },
              {
                text: "Notes :",
                bold: true,
                fontSize: 10,
                margin: [0, 0, 0, 3],
              },
              {
                text: "All payments should be made payable to",
                fontSize: 9,
                margin: [0, 0, 0, 2],
              },
              {
                text: "INTEREALTOR SDN BHD - Client A/C",
                bold: true,
                fontSize: 9,
                margin: [0, 0, 0, 8],
              },
              {
                text: "Bank : PUBLIC BANK BERHAD, Lebuh Macallum Branch.",
                bold: true,
                fontSize: 9,
                margin: [0, 0, 0, 2],
              },
              {
                text: "A/C No : 32-1707-6233       Swift Code No : PBBEMYKL",
                bold: true,
                fontSize: 9,
                margin: [0, 0, 0, 8],
              },
              {
                text: "Kindly send us the bank in slip via email : ",
                fontSize: 9,
                margin: [0, 0, 0, 0],
              },
              {
                text: "account@interealtor.com, please state the unit no.",
                fontSize: 9,
                bold: true,
                margin: [0, 0, 0, 0],
              },
              {
                text: "An interest penalty of 10% p.a. will be imposed on the late payment.",
                fontSize: 9,
                margin: [0, 0, 0, 0],
              },
              {
                text: "SST No.: P11-1808-32000013",
                fontSize: 9,
                margin: [0, 0, 0, 0],
              },
            ],
          }
        : null;

      const banner = footerDataUrl
        ? {
            image: "footerBanner",
            width: pageSize.width,
            height: 80,
            margin: [0, 0, 0, 0],
          }
        : { text: "" };

      return {
        margin: [0, 0, 0, 0],
        stack: [...(notes ? [notes] : []), banner],
      };
    },

    images: {
      ...(logoDataUrl ? { logo: logoDataUrl } : {}),
      ...(footerDataUrl ? { footerBanner: footerDataUrl } : {}),
    },

    defaultStyle: { fontSize: 10, lineHeight: 1.3 },

    content: [
      {
        table: {
          widths: ["*", 180],
          body: [
            [
              { text: "" },
              {
                table: {
                  widths: [70, 100],
                  body: [
                    [
                      {
                        text: "INVOICE",
                        colSpan: 2,
                        fontSize: 18,
                        bold: true,
                        alignment: "left",
                        margin: [0, -30, 0, 10],
                      },
                      {},
                    ],
                    [
                      {
                        text: "Invoice No.",
                        bold: true,
                        alignment: "left",
                        fontSize: 10,
                      },
                      {
                        text: String(invoiceNo),
                        alignment: "left",
                        fontSize: 10,
                      },
                    ],
                  ],
                },
                layout: "noBorders",
                margin: [0, 0, 0, 0],
              },
            ],
            [
              { text: "" },
              {
                table: {
                  widths: [70, 100],
                  body: [
                    [
                      {
                        text: "Date",
                        bold: true,
                        alignment: "left",
                        fontSize: 10,
                      },
                      {
                        text: String(invoiceDate),
                        alignment: "left",
                        fontSize: 10,
                      },
                    ],
                  ],
                },
                layout: "noBorders",
                margin: [0, -7, 0, 0],
              },
            ],
            [
              { text: "M/S", bold: true, fontSize: 11, margin: [0, 2, 0, 0] },
              {
                table: {
                  widths: [70, 100],
                  body: [
                    [
                      {
                        text: "Terms",
                        bold: true,
                        alignment: "left",
                        fontSize: 10,
                      },
                      {
                        text: String(terms),
                        alignment: "left",
                        fontSize: 10,
                      },
                    ],
                  ],
                },
                layout: "noBorders",
                margin: [0, -7, 0, 0],
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 0],
      },

      {
        table: {
          widths: ["*", 100],
          body: [
            [
              {
                text: recipientName || "—",
                alignment: "left",
                fontSize: 11,
                margin: [0, 2, 0, 0],
              },
              { text: "REN", alignment: "left", fontSize: 11 },
            ],
            [
              {
                text: recipientAddress || "",
                alignment: "left",
                fontSize: 10,
                margin: [0, 2, 0, 0],
              },
              {
                text: `${String(
                  invoiceApi?.RenName ?? (inv as any)?.RenName ?? ""
                ).trim()}\n${
                  String(
                    invoiceApi?.RenId ?? (inv as any)?.RenId ?? ""
                  ).trim()
                    ? `(REN ${String(
                        invoiceApi?.RenId ?? (inv as any)?.RenId ?? ""
                      ).trim()})`
                    : ""
                }`.trim(),
                alignment: "left",
                fontSize: 11,
              },
            ],
            [
              {
                text: "Particular",
                alignment: "left",
                fontSize: 11,
                bold: true,
                margin: [0, 8, 0, 0],
              },
              {
                text: "Transaction ID",
                alignment: "left",
                fontSize: 11,
                bold: true,
                margin: [0, 8, 0, 0],
              },
            ],
            [
              {
                text:
                  invoiceDescLines.length > 0
                    ? invoiceDescLines.join("\n")
                    : invoiceDescRaw || "",
                alignment: "left",
                fontSize: 10,
                margin: [0, 6, 10, 0],
              },
              {
                text: String(refNo || transactionId || "-"),
                alignment: "left",
                fontSize: 10,
                margin: [0, 1, 0, 0],
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 10, 0, 12],
      },

      { text: "", margin: [0, 0, 0, 0] },

      {
        table: { headerRows: 1, widths: ["*", 100, 80], body: tableBody },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 0,
          hLineColor: () => "#000000",
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: (_rowIndex: number) => 4,
          paddingBottom: (_rowIndex: number) => 4,
        },
        margin: [0, 5, 0, 0],
      },

      {
        columns: [
          {
            width: 250,
            stack: [
              { text: "", margin: [0, 10, 0, 5] },
              {
                text: "",
                fontSize: 10,
                alignment: "center",
                margin: [0, 0, 0, 5],
              },
              { text: "", fontSize: 10, alignment: "center" },
            ],
          },
          {
            width: "*",
            stack: [
              {
                columns: [
                  {
                    width: "*",
                    text: "Total Before SST :",
                    alignment: "right",
                    bold: true,
                    fontSize: 10,
                  },
                  {
                    width: 100,
                    text: money(totalBeforeSst),
                    alignment: "right",
                    fontSize: 10,
                  },
                ],
                margin: [0, 10, 0, 3],
              },
              {
                columns: [
                  {
                    width: "*",
                    text: "Add SST (8%)",
                    alignment: "right",
                    bold: true,
                    fontSize: 10,
                  },
                  {
                    width: 100,
                    text: money(totalSst),
                    alignment: "right",
                    fontSize: 10,
                  },
                ],
                margin: [0, 0, 0, 5],
              },
              {
                columns: [
                  { width: "*", text: "" },
                  {
                    width: 185,
                    canvas: [
                      { type: "line", x1: 0, y1: 0, x2: 185, y2: 0, lineWidth: 1 },
                    ],
                  },
                ],
                margin: [0, 0, 0, 5],
              },
              {
                columns: [
                  {
                    width: "*",
                    text: "Amount Due MYR",
                    alignment: "right",
                    bold: true,
                    fontSize: 11,
                  },
                  {
                    width: 100,
                    text: money(totalDue),
                    alignment: "right",
                    bold: true,
                    fontSize: 11,
                  },
                ],
                margin: [0, 0, 0, 0],
              },
              {
                columns: [
                  { width: "*", text: "" },
                  {
                    width: 185,
                    canvas: [
                      { type: "line", x1: 0, y1: 0, x2: 185, y2: 0, lineWidth: 2 },
                    ],
                  },
                ],
                margin: [0, 2, 0, 0],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 15],
      },

      
    ],
  };

  const safeNo = String(invoiceNo).replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `Invoice_${safeNo}.pdf`;

  const pdfMake = await ensurePdfMakeOnce();
  pdfMake.createPdf(docDefinition).download(filename);
};