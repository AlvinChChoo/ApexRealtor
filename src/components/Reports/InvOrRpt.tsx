import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useCallback, useMemo, useState } from "react";
import { AlertCircle, Calendar, UserCheck } from "lucide-react";
import * as XLSX from "xlsx-js-style";

const INV_OR_GET_URL = API_ENDPOINTS.INV_OR_GET;
const TEMPLATE_FILE_URL = "/excel-template/InvOrRptTemplate.xlsx";

type InvOrRow = {
  Nric_Name: string;
  RenId?: string;
  RenName?: string;
  InvoiceNo1Date: any;
  NewTransId?: string;
  InvoiceNo1: string;
  Client_Name: string;
  InvoiceTotal: number | string;
  InvoiceFees: number | string;
  InvoiceSst: number | string;
  InvoiceAdminCharges: number | string;
  InvoiceAdminSst?: number | string;
  InvoiceStampDuty: number | string;
  SubmissionDate: string;
  PayoutDate: string;
  PayoutDate1?: string;
  TransId?: string;
  TransId1?: string;
};

const InvOrRpt: React.FC = () => {
  const [payoutDate, setPayoutDate] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [rows, setRows] = useState<InvOrRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanValue = (value: any): string => {
    if (value == null) return "";
    const s = String(value).trim();
    if (!s || s.toLowerCase() === "nil" || s.toLowerCase() === "null") return "";
    return s;
  };

  const toNumber = (value: any): number => {
    if (value == null) return 0;
    const s = String(value).trim();
    if (!s || s.toLowerCase() === "nil" || s.toLowerCase() === "null") return 0;
    const n = parseFloat(s.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const getRowTotalAmount = (row: InvOrRow): number => {
    return (
      toNumber(row.InvoiceFees) +
      toNumber(row.InvoiceSst) +
      toNumber(row.InvoiceAdminCharges) +
      toNumber(row.InvoiceAdminSst) +
      toNumber(row.InvoiceStampDuty)
    );
  };

  const formatCurrency = (amount: string | number) => {
    const num =
      typeof amount === "string"
        ? parseFloat((amount || "0").replace(/,/g, ""))
        : amount || 0;

    return Number.isFinite(num)
      ? `${num.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "0.00";
  };

  const formatDateTime = (v: any) => {
    if (v == null) return "";
    const s = String(v).trim();
    if (!s || s.toLowerCase() === "nil" || s.toLowerCase() === "null") return "";
    return s;
  };

  const formatDateForExcel = (value: any): string => {
    if (value == null) return "-";

    const s = String(value).trim();
    if (!s || s.toLowerCase() === "nil" || s.toLowerCase() === "null") return "-";

    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;

    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);

    return `${dd}-${mm}-${yy}`;
  };

  const getDisplayNewTransId = (row: InvOrRow) => {
    return cleanValue(row.TransId) || cleanValue(row.TransId1) || cleanValue(row.NewTransId) || "";
  };

  const getDisplayPayoutDate = (row: InvOrRow) => {
    return cleanValue(row.PayoutDate) || cleanValue(row.PayoutDate1) || "";
  };

  const fetchInvOr = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const formData = new URLSearchParams();
      formData.append("PayoutDate", payoutDate);

      const resp = await fetch(INV_OR_GET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const json = await resp.json();

      if (json?.status === "success") {
        setRows(Array.isArray(json.data) ? json.data : []);
      } else if (json?.status === "no_data_found") {
        setRows([]);
      } else {
        throw new Error(json?.data || json?.error || "Unknown error");
      }
    } catch (e: any) {
      setRows([]);
      setError(e?.message || "Failed to load InvOr list");
    } finally {
      setLoading(false);
    }
  }, [payoutDate]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.totalAmount += getRowTotalAmount(r);
        acc.fees += toNumber(r.InvoiceFees);
        acc.feesSst += toNumber(r.InvoiceSst);
        acc.admin += toNumber(r.InvoiceAdminCharges);
        acc.adminSst += toNumber(r.InvoiceAdminSst);
        acc.stamp += toNumber(r.InvoiceStampDuty);
        return acc;
      },
      {
        totalAmount: 0,
        fees: 0,
        feesSst: 0,
        admin: 0,
        adminSst: 0,
        stamp: 0,
      }
    );
  }, [rows]);

  const clearWorksheetData = (ws: XLSX.WorkSheet) => {
    Object.keys(ws).forEach((key) => {
      if (!key.startsWith("!")) {
        delete (ws as any)[key];
      }
    });
    delete (ws as any)["!ref"];
  };

  const exportToExcel = useCallback(async () => {
    try {
      setExporting(true);
      setError(null);

      const title = "IN/CN/DN/OR Listing Report";
      const filterLine = `Payout Date: ${payoutDate}`;

      const data = rows.map((r, idx) => ({
        Row: idx + 1,
        "Trans Id": getDisplayNewTransId(r) || "-",
        "REN Name": cleanValue(r.RenName) || "-",
        "Doc Date": formatDateForExcel(r.InvoiceNo1Date),
        "Doc No": cleanValue(r.InvoiceNo1) || "-",
        "Client Name": cleanValue(r.Client_Name) || "-",
        "Total Amount": getRowTotalAmount(r),
        Fees: toNumber(r.InvoiceFees),
        "Fees SST": toNumber(r.InvoiceSst),
        Admin: toNumber(r.InvoiceAdminCharges),
        "Admin SST": toNumber(r.InvoiceAdminSst),
        Stamp: toNumber(r.InvoiceStampDuty),
        "Submission Date": formatDateForExcel(r.SubmissionDate),
        "Payout Date": formatDateForExcel(getDisplayPayoutDate(r)),
      }));

      const headers = [
        "Row",
        "Trans Id",
        "REN Name",
        "Doc Date",
        "Doc No",
        "Client Name",
        "Total Amount",
        "Fees",
        "Fees SST",
        "Admin",
        "Admin SST",
        "Stamp",
        "Submission Date",
        "Payout Date",
      ];

      const aoa: any[][] = [
        [title],
        [filterLine],
        [],
        headers,
        ...data.map((r) => [
          r["Row"],
          r["Trans Id"],
          r["REN Name"],
          r["Doc Date"],
          r["Doc No"],
          r["Client Name"],
          r["Total Amount"],
          r["Fees"],
          r["Fees SST"],
          r["Admin"],
          r["Admin SST"],
          r["Stamp"],
          r["Submission Date"],
          r["Payout Date"],
        ]),
        [
          "",
          "",
          "",
          "",
          "",
          "Summary",
          totals.totalAmount,
          totals.fees,
          totals.feesSst,
          totals.admin,
          totals.adminSst,
          totals.stamp,
          "",
          "",
        ],
      ];

      let wb: XLSX.WorkBook;
      let ws: XLSX.WorkSheet;
      let targetSheetName = "InvOrRpt";

      try {
        const templateResp = await fetch(TEMPLATE_FILE_URL, { cache: "no-store" });
        if (!templateResp.ok) {
          throw new Error(`Template file not found: ${TEMPLATE_FILE_URL}`);
        }

        const templateArrayBuffer = await templateResp.arrayBuffer();
        wb = XLSX.read(templateArrayBuffer, {
          type: "array",
          cellStyles: true,
        });

        if (!wb.SheetNames || wb.SheetNames.length === 0) {
          throw new Error("Template workbook has no sheet.");
        }

        targetSheetName = wb.SheetNames.includes("InvOrRpt")
          ? "InvOrRpt"
          : wb.SheetNames[0];

        ws = wb.Sheets[targetSheetName];
        clearWorksheetData(ws);
      } catch (templateErr) {
        wb = XLSX.utils.book_new();
        ws = {};
        XLSX.utils.book_append_sheet(wb, ws, targetSheetName);
      }

      XLSX.utils.sheet_add_aoa(ws, aoa, { origin: "A1" });

      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 13 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 13 } },
      ];

      ws["!cols"] = [
        { wch: 3 },   // Row
        { wch: 6 },   // Trans Id
        { wch: 11 },  // REN Name
        { wch: 7 },   // Doc Date
        { wch: 10 },  // Doc No
        { wch: 18 },  // Client Name
        { wch: 10 },  // Total Amount
        { wch: 8 },   // Fees
        { wch: 7 },   // Fees SST
        { wch: 7 },   // Admin
        { wch: 7 },   // Admin SST
        { wch: 7 },   // Stamp
        { wch: 7 },   // Submission Date
        { wch: 6 },   // Payout Date
      ];

      ws["!rows"] = [
        { hpt: 22 },
        { hpt: 18 },
        { hpt: 8 },
      ];

      const range = XLSX.utils.decode_range(ws["!ref"] || "A1:N1");

      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellAddress]) continue;

          (ws[cellAddress] as any).s = {
            font: {
              name: "Arial",
              sz: 8,
            },
            alignment: {
              vertical: "center",
              horizontal: C >= 6 && C <= 11 ? "right" : "left",
              wrapText: C === 12 || C === 13 ? false : true,
              shrinkToFit: C === 12 || C === 13 ? true : false,
            },
            border: {
              top: { style: "thin", color: { rgb: "D9D9D9" } },
              bottom: { style: "thin", color: { rgb: "D9D9D9" } },
              left: { style: "thin", color: { rgb: "D9D9D9" } },
              right: { style: "thin", color: { rgb: "D9D9D9" } },
            },
          };

          if (R >= 4 && R <= range.e.r) {
            if (C >= 6 && C <= 11 && typeof ws[cellAddress].v === "number") {
              (ws[cellAddress] as any).z = "#,##0.00";
            }
          }
        }
      }

      const titleCell = "A1";
      if (ws[titleCell]) {
        (ws[titleCell] as any).s = {
          font: { name: "Arial", sz: 11, bold: true },
          alignment: { horizontal: "center", vertical: "center" },
        };
      }

      const filterCell = "A2";
      if (ws[filterCell]) {
        (ws[filterCell] as any).s = {
          font: { name: "Arial", sz: 8, italic: true },
          alignment: { horizontal: "left", vertical: "center" },
        };
      }

      for (let C = 0; C < headers.length; C++) {
        const headerCell = XLSX.utils.encode_cell({ r: 3, c: C });
        if (!ws[headerCell]) continue;

        (ws[headerCell] as any).s = {
          font: { name: "Arial", sz: 8, bold: true },
          fill: { fgColor: { rgb: "EDEDED" } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: {
            top: { style: "thin", color: { rgb: "A6A6A6" } },
            bottom: { style: "thin", color: { rgb: "A6A6A6" } },
            left: { style: "thin", color: { rgb: "A6A6A6" } },
            right: { style: "thin", color: { rgb: "A6A6A6" } },
          },
        };
      }

      const summaryRowIndex = aoa.length - 1;
      for (let C = 0; C < headers.length; C++) {
        const summaryCell = XLSX.utils.encode_cell({ r: summaryRowIndex, c: C });
        if (!ws[summaryCell]) continue;

        (ws[summaryCell] as any).s = {
          font: { name: "Arial", sz: 8, bold: true },
          fill: { fgColor: { rgb: "F5F5F5" } },
          alignment: {
            vertical: "center",
            horizontal: C >= 6 && C <= 11 ? "right" : "left",
            wrapText: C === 12 || C === 13 ? false : true,
            shrinkToFit: C === 12 || C === 13 ? true : false,
          },
          border: {
            top: { style: "thin", color: { rgb: "A6A6A6" } },
            bottom: { style: "thin", color: { rgb: "A6A6A6" } },
            left: { style: "thin", color: { rgb: "A6A6A6" } },
            right: { style: "thin", color: { rgb: "A6A6A6" } },
          },
        };

        if (C >= 6 && C <= 11 && typeof ws[summaryCell].v === "number") {
          (ws[summaryCell] as any).z = "#,##0.00";
        }
      }

      ws["!autofilter"] = {
        ref: "A4:N4",
      };

      if (!(ws as any)["!pageSetup"]) {
        (ws as any)["!pageSetup"] = {
          paperSize: 9,
          orientation: "landscape",
          fitToWidth: 1,
          fitToHeight: 0,
          scale: 68,
        };
      }

      if (!(ws as any)["!margins"]) {
        (ws as any)["!margins"] = {
          left: 0.25,
          right: 0.25,
          top: 0.4,
          bottom: 0.4,
          header: 0.2,
          footer: 0.2,
        };
      }

      (wb as any).Workbook = {
        ...(wb as any).Workbook,
        Views: [{ RTL: false }],
      };

      XLSX.writeFile(wb, `InvOrRpt_${payoutDate}.xlsx`);
    } catch (e: any) {
      setError(e?.message || "Failed to export Excel file");
    } finally {
      setExporting(false);
    }
  }, [rows, totals, payoutDate]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <UserCheck className="text-blue-600" size={32} />
            IN/CN/DN/OR Listing Report
          </h1>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row gap-4 md:items-end">
          <div className="w-full md:w-72">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payout Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="date"
                value={payoutDate}
                onChange={(e) => setPayoutDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            onClick={fetchInvOr}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search
          </button>

          <button
            onClick={exportToExcel}
            disabled={rows.length === 0 || exporting}
            className={`px-4 py-2 rounded-lg transition-colors ${
              rows.length === 0 || exporting
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {exporting ? "Exporting..." : "Export to Excel"}
          </button>
        </div>

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>

      {loading && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading payout list...</p>
        </div>
      )}

      {!loading && error && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            Error Loading Data
          </h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={fetchInvOr}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-lg p-6 overflow-x-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-600">
              Showing results for <span className="font-semibold">{payoutDate}</span>
            </div>
            <div className="text-sm text-gray-500">
              Total: <span className="font-semibold">{rows.length}</span>
            </div>
          </div>

          <table className="min-w-full text-xs md:text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Row</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Trans Id</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">REN Name</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Doc Date</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Doc No</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Client Name</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Total Amount</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Fees</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Fees Sst</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Admin</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Admin SST</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Stamp</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Submission Date</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Payout Date</th>
              </tr>
            </thead>

            <tbody>
              {rows.length > 0 ? (
                <>
                  {rows.map((r, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2">{idx + 1}</td>
                      <td className="px-3 py-2">{getDisplayNewTransId(r) || "-"}</td>
                      <td className="px-3 py-2">{cleanValue(r.RenName) || "-"}</td>
                      <td className="px-3 py-2">{formatDateTime(r.InvoiceNo1Date) || "-"}</td>
                      <td className="px-3 py-2">{cleanValue(r.InvoiceNo1) || "-"}</td>
                      <td className="px-3 py-2">{cleanValue(r.Client_Name) || "-"}</td>
                      <td className="px-3 py-2">{formatCurrency(getRowTotalAmount(r))}</td>
                      <td className="px-3 py-2">{formatCurrency(r.InvoiceFees)}</td>
                      <td className="px-3 py-2">{formatCurrency(r.InvoiceSst)}</td>
                      <td className="px-3 py-2">{formatCurrency(r.InvoiceAdminCharges)}</td>
                      <td className="px-3 py-2">{formatCurrency(r.InvoiceAdminSst ?? 0)}</td>
                      <td className="px-3 py-2">{formatCurrency(r.InvoiceStampDuty)}</td>
                      <td className="px-3 py-2">{cleanValue(r.SubmissionDate) || "-"}</td>
                      <td className="px-3 py-2">{getDisplayPayoutDate(r) || "-"}</td>
                    </tr>
                  ))}

                  <tr className="border-t bg-gray-50 font-semibold">
                    <td className="px-3 py-2" colSpan={6}>
                      Summary
                    </td>
                    <td className="px-3 py-2">{formatCurrency(totals.totalAmount)}</td>
                    <td className="px-3 py-2">{formatCurrency(totals.fees)}</td>
                    <td className="px-3 py-2">{formatCurrency(totals.feesSst)}</td>
                    <td className="px-3 py-2">{formatCurrency(totals.admin)}</td>
                    <td className="px-3 py-2">{formatCurrency(totals.adminSst)}</td>
                    <td className="px-3 py-2">{formatCurrency(totals.stamp)}</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan={14} className="px-3 py-3 text-center text-gray-500">
                    No data loaded yet. Please select a date and click Search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InvOrRpt;