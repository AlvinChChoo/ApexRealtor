import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useMemo, useState } from "react";
import { Calendar, FileText, Download } from "lucide-react";

const PropertyTransactedRpt: React.FC = () => {
  // ✅ defaults: current year/month
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = String(today.getMonth() + 1).padStart(2, "0");

  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any[]>([]);

  // ✅ your PHP endpoint
  const API_URL =
    API_ENDPOINTS.PROPERTY_TRANSACTED_RPT_GET;

  // ✅ Year options (last 10 years incl current)
  const years = useMemo(
    () => Array.from({ length: 10 }, (_, i) => currentYear - i),
    [currentYear]
  );

  // ✅ Month dropdown
  const months = useMemo(
    () => [
      { value: "01", label: "January" },
      { value: "02", label: "February" },
      { value: "03", label: "March" },
      { value: "04", label: "April" },
      { value: "05", label: "May" },
      { value: "06", label: "June" },
      { value: "07", label: "July" },
      { value: "08", label: "August" },
      { value: "09", label: "September" },
      { value: "10", label: "October" },
      { value: "11", label: "November" },
      { value: "12", label: "December" },
    ],
    []
  );

  const monthLabel =
    months.find((m) => m.value === selectedMonth)?.label || selectedMonth;

  // ✅ derive StartDate and EndDate from selected month/year
  const { startDate, endDate } = useMemo(() => {
    const y = Number(selectedYear);
    const m = Number(selectedMonth); // 1-12

    const start = `${selectedYear}-${selectedMonth}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${selectedYear}-${selectedMonth}-${String(lastDay).padStart(
      2,
      "0"
    )}`;

    return { startDate: start, endDate: end };
  }, [selectedYear, selectedMonth]);

  // =========================
  // ✅ Formatting helpers (NO UI change)
  // =========================

  // number format: ##,##0
  const nf0 = useMemo(
    () => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }),
    []
  );

  const toNumber = (v: any): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const s = String(v).trim();
    if (!s) return null;

    // allow strings like "1,234.56" or "1234"
    const cleaned = s.replace(/,/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  };

  const formatInt = (v: any): string => {
    const n = toNumber(v);
    if (n === null) return "-";
    return nf0.format(Math.round(n));
  };

  // date format: dd-MM-yyyy (from Date object or string)
  const formatSubmissionDate = (v: any): string => {
    if (v === null || v === undefined || v === "") return "-";

    let d: Date | null = null;

    if (v instanceof Date) {
      d = v;
    } else {
      const s = String(v).trim();

      // handle "YYYY-MM-DD HH:mm:ss" or ISO
      const isoCandidate = s.includes("T") ? s : s.replace(" ", "T");
      const tryDate = new Date(isoCandidate);
      if (!Number.isNaN(tryDate.getTime())) d = tryDate;

      // handle strict "YYYY-MM-DD"
      if (!d) {
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      }

      // handle strict "YYYY-MM-DD HH:mm:ss"
      if (!d) {
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+/);
        if (m) d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      }
    }

    if (!d || Number.isNaN(d.getTime())) return "-";

    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  const validate = () => {
    if (!selectedYear || !selectedMonth) return "Year and Month are required.";
    if (Number.isNaN(Number(selectedYear))) return "Invalid year selected.";
    return null;
  };

  const handleGenerateReport = async () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    setLoading(true);
    setError(null);
    setReportData([]);

    try {
      const body = new URLSearchParams();
      body.append("StartDate", startDate);
      body.append("EndDate", endDate);

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} - Failed to load report.`);
      }

      const json = await res.json();

      if (!json?.success) {
        const serverMsg = json?.message || "Server returned fail.";
        throw new Error(serverMsg);
      }

      setReportData(Array.isArray(json.data) ? json.data : []);
    } catch (err: any) {
      setError(err?.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Export to CSV (no libs)
  const handleExport = () => {
    if (!reportData.length) return;

    const headers = [
      "REN (DisplayName)",
      "PropertyAddress",
      "ProjectName",
      "Location",
      "PropertyType",
      "TransType",
      "Rental/Sales Price",
      "Profession Fees",
      "FeesCollectionPctg",
      "Build Up Area",
      "Land Area",
      "PropertyCondition",
      "SubmissionDate",
    ];

    const escapeCsv = (v: any) => {
      const s = v === null || v === undefined ? "" : String(v);
      const needsQuotes = /[",\n\r]/.test(s);
      const safe = s.replace(/"/g, '""');
      return needsQuotes ? `"${safe}"` : safe;
    };

    // ✅ Export with the SAME formatted display values
    const rows = reportData.map((r) => [
      r.DisplayName ?? "",
      r.PropertyAddress ?? "",
      r.ProjectName ?? "",
      r.PropertyLocation ?? "",
      r.PropertyType ?? "",
      r.TransType ?? "",
      toNumber(r.AtlRentalAmt) === null ? "" : nf0.format(Math.round(toNumber(r.AtlRentalAmt)!)),
      toNumber(r.AtlProFees) === null ? "" : nf0.format(Math.round(toNumber(r.AtlProFees)!)),
      r.FeesCollectionPctg ?? "",
      toNumber(r.PropertyBuildUpArea) === null ? "" : nf0.format(Math.round(toNumber(r.PropertyBuildUpArea)!)),
      toNumber(r.PropertyLandArea) === null ? "" : nf0.format(Math.round(toNumber(r.PropertyLandArea)!)),
      r.PropertyCondition ?? "",
      formatSubmissionDate(r.SubmissionDate) === "-" ? "" : formatSubmissionDate(r.SubmissionDate),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `PropertyTransacted_${selectedYear}-${selectedMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const total = reportData.length;

  const rangeLabel = useMemo(() => {
    return `${monthLabel} ${selectedYear} (${startDate} to ${endDate})`;
  }, [monthLabel, selectedYear, startDate, endDate]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Monthly Property Transacted Report
          </h1>
        </div>

        {reportData.length > 0 && (
          <button
            onClick={handleExport}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors"
          >
            <Download size={20} />
            <span>Export</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Submission Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Submission  Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              onClick={handleGenerateReport}
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                loading
                  ? "bg-blue-300 text-white cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              <Calendar size={20} />
              <span>{loading ? "Generating..." : "Generate Report"}</span>
            </button>
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Using range: <span className="font-medium">{startDate}</span> to{" "}
          <span className="font-medium">{endDate}</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <div className="text-red-600">⚠</div>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {reportData.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">
              Property Transactions ({rangeLabel})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    REN
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Property Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Property Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trans Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sales Price / Rental Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gross Fees
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Collection Pctg
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Build Up Area
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Land Area
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    FF/PF/UF
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submission Date
                  </th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {row.DisplayName || "-"}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.PropertyAddress || "-"}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.ProjectName || "-"}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.PropertyLocation || "-"}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.PropertyType || "-"}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.TransType || "-"}
                    </td>

                    {/* ✅ ##,##0 */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatInt(row.AtlRentalAmt)}
                    </td>

                    {/* ✅ ##,##0 */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatInt(row.AtlProFees)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.FeesCollectionPctg ?? "-"}
                    </td>

                    {/* ✅ ##,##0 */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatInt(row.PropertyBuildUpArea)}
                    </td>

                    {/* ✅ ##,##0 */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatInt(row.PropertyLandArea)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.PropertyCondition ?? "-"}
                    </td>

                    {/* ✅ dd-MM-yyyy */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatSubmissionDate(row.SubmissionDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Total Transactions:{" "}
                <span className="font-semibold">{total}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && reportData.length === 0 && (
        <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            No Report Generated
          </h3>
          <p className="text-gray-500">
            Select Year/Month, then click "Generate Report".
          </p>
        </div>
      )}
    </div>
  );
};

export default PropertyTransactedRpt;