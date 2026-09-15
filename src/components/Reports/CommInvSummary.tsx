import { API_ENDPOINTS } from '../../config/apiConfig';
// CommInvSummary.tsx
import React, { useCallback, useMemo, useState } from "react";
import { AlertCircle, Calendar, UserCheck } from "lucide-react";

const INV_OR_GET_URL = API_ENDPOINTS.INV_OR_GET;

type InvOrRow = {
  Nric_Name: string;
  InvoiceNo1Date: any;
  InvoiceNo1: string; // <- InvoiceNo from PHP (we will show as InvoiceNo column)
  Client_Name: string;

  InvoiceTotal: number | string;
  InvoiceFees: number | string;
  InvoiceSst: number | string;
  InvoiceAdminCharges: number | string;
  InvoiceStampDuty: number | string;

  SubmissionDate: string;
  PayoutDate: string;
};

const CommInvSummary: React.FC = () => {
  // ✅ Default payout date = today (YYYY-MM-DD) BUT DO NOT AUTO CALL API
  const [payoutDate, setPayoutDate] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [rows, setRows] = useState<InvOrRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanValue = (value: any): string => {
    if (value == null) return "";
    const s = String(value).trim();
    if (!s || s.toLowerCase() === "nil") return "";
    return s;
  };

  const toNumber = (value: any): number => {
    if (value == null) return 0;
    const s = String(value).trim();
    if (!s || s.toLowerCase() === "nil") return 0;
    const n = parseFloat(s.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  // ✅ number format like ##,##0 (no decimals)
  // ✅ number format like ##,##0.00 (2 decimals)
const formatNum2 = (v: any) => {
  const n = toNumber(v);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  // ✅ Derived rows for the single combined table
  const combinedRows = useMemo(() => {
    return rows.map((r) => {
      const fees = toNumber(r.InvoiceFees);
      const sst = toNumber(r.InvoiceSst);
      const admin = toNumber(r.InvoiceAdminCharges);
      const fixedSst0 = 0; // ✅ Column 6 fixed "0"
      const stamp = toNumber(r.InvoiceStampDuty);

      const invoiceAmt = fees + sst + admin + fixedSst0 + stamp; // ✅ Column 8 total (3→7)

      return {
        ...r,
        _fees: fees,
        _sst: sst,
        _admin: admin,
        _fixed0: fixedSst0,
        _stamp: stamp,
        _invoiceAmt: invoiceAmt,
        _invoiceNo: cleanValue(r.InvoiceNo1) || "-", // ✅ Column 9 InvoiceNo
      };
    });
  }, [rows]);

  const sumFees = useMemo(() => combinedRows.reduce((s, r: any) => s + (r._fees || 0), 0), [combinedRows]);
  const sumSst = useMemo(() => combinedRows.reduce((s, r: any) => s + (r._sst || 0), 0), [combinedRows]);
  const sumAdmin = useMemo(() => combinedRows.reduce((s, r: any) => s + (r._admin || 0), 0), [combinedRows]);
  const sumFixed0 = useMemo(() => combinedRows.reduce((s, r: any) => s + (r._fixed0 || 0), 0), [combinedRows]);
  const sumStamp = useMemo(() => combinedRows.reduce((s, r: any) => s + (r._stamp || 0), 0), [combinedRows]);
  const sumInvoiceAmt = useMemo(
    () => combinedRows.reduce((s, r: any) => s + (r._invoiceAmt || 0), 0),
    [combinedRows]
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <UserCheck className="text-blue-600" size={32} />
            Payout Invoice Summary
          </h1>
        </div>
      </div>

      {/* ✅ Filter: Payout Date + Search (ONLY on click call API) */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row gap-4 md:items-end">
          <div className="w-full md:w-72">
            <label className="block text-sm font-medium text-gray-700 mb-1">Payout Date</label>
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
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Error Loading Data</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={fetchInvOr}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ✅ Single combined table */}
      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-lg p-6 overflow-x-auto">
          <div className="flex items-center justify-between mb-4">
            
            <div className="text-sm text-gray-500">
              Total: <span className="font-semibold">{combinedRows.length}</span>
            </div>
          </div>

          <table className="min-w-full text-xs md:text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">REN</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Client Name</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">Gross Fees</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">Sst</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">Admin</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">SST</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">Stamping Fees</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">Invoice Amt</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Invoice No</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Submission Date</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Payout Date</th>
              </tr>
            </thead>

            <tbody>
              {combinedRows.length > 0 ? (
                <>
                  {combinedRows.map((r: any, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2">{cleanValue(r.Nric_Name) || "-"}</td>
                      <td className="px-3 py-2">{cleanValue(r.Client_Name) || "-"}</td>
                      <td className="px-3 py-2 text-right">{formatNum2(r._fees)}</td>
                      <td className="px-3 py-2 text-right">{formatNum2(r._sst)}</td>
                      <td className="px-3 py-2 text-right">{formatNum2(r._admin)}</td>
                      <td className="px-3 py-2 text-right">{formatNum2(r._fixed0)}</td>
                      <td className="px-3 py-2 text-right">{formatNum2(r._stamp)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatNum2(r._invoiceAmt)}</td>
                      <td className="px-3 py-2">{r._invoiceNo}</td>
                      <td className="px-3 py-2">{cleanValue(r.SubmissionDate) || "-"}</td>
                      <td className="px-3 py-2">{cleanValue(r.PayoutDate) || "-"}</td>
                    </tr>
                  ))}

                  {/* ✅ Optional total row */}
                  <tr className="border-t bg-gray-50 font-semibold">
                    <td className="px-3 py-2" colSpan={2}>
                      Total
                    </td>
                    <td className="px-3 py-2 text-right">{formatNum2(sumFees)}</td>
<td className="px-3 py-2 text-right">{formatNum2(sumSst)}</td>
<td className="px-3 py-2 text-right">{formatNum2(sumAdmin)}</td>
<td className="px-3 py-2 text-right">{formatNum2(sumFixed0)}</td>
<td className="px-3 py-2 text-right">{formatNum2(sumStamp)}</td>
<td className="px-3 py-2 text-right">{formatNum2(sumInvoiceAmt)}</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan={11} className="px-3 py-3 text-center text-gray-500">
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

export default CommInvSummary;