import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useEffect, useState } from "react";
import { FileText, Calendar, Search } from "lucide-react";

/** ====== NEW: report row returned by PHP/SP ====== */
interface SummaryItem {
  UserName: string;
  DisplayName: string;
  OpeningBal: number;
  TotalIn: number;
  TotalOut: number;
  ClosingBal: number;
} 

interface RenOption {
  id: string;
  label: string;
}

const EMP_GET_URL =
  API_ENDPOINTS.INT_EMP_ONLY_GET;

/** ✅ NEW endpoint (calls stored procedure) */
const TRANS_GET_URL =
  API_ENDPOINTS.PETTY_CASH_SUMMARY_REPORT_GET;

const toYmd = (val: any): string => {
  if (!val) return "";

  if (typeof val === "string") {
    const s = val.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
      const [dd, mm, yyyy] = s.split(/[\/\s]/);
      if (dd && mm && yyyy) return `${yyyy}-${mm}-${dd}`;
    }
  }

  const d = new Date(val);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return String(val);
};

const todayYmd = () => new Date().toISOString().slice(0, 10);

const firstDayOfCurrentYearYmd = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  return `${yyyy}-01-01`;
};

const PettyCashSummaryReport: React.FC = () => {
  const [dateFromInput, setDateFromInput] = useState<string>(
    firstDayOfCurrentYearYmd()
  );
  const [dateToInput, setDateToInput] = useState<string>(todayYmd());
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");

  const [renOptions, setRenOptions] = useState<RenOption[]>([]);
  const [renLoading, setRenLoading] = useState<boolean>(true);
  const [renError, setRenError] = useState<string | null>(null);

  const [summaryData, setSummaryData] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRenList = async () => {
      try {
        setRenLoading(true);
        setRenError(null);

        const resp = await fetch(EMP_GET_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ RequestJson: "{}" }).toString(),
        });

        if (!resp.ok) {
          throw new Error(`Network error: ${resp.status}`);
        }

        const data = await resp.json();

        if (!data || data.status !== "success" || !Array.isArray(data.data)) {
          throw new Error("Invalid data from server");
        }

        const options: RenOption[] = data.data.map((emp: any) => {
          const empId = String(emp.EmpId ?? "");
          const name = String(emp.Name ?? "Unknown");
          const email = String(emp.Email ?? "");
          return {
            id: empId,
            label: email ? `${name} / ${email}` : name,
          };
        });

        setRenOptions(options);
      } catch (err: any) {
        setRenError(err.message || "Failed to load REN list");
      } finally {
        setRenLoading(false);
      }
    };

    fetchRenList();
  }, []);

  const handleSearch = async () => {
    try {
      setLoading(true);
      setError(null);

      const from = toYmd(dateFromInput);
      const to = toYmd(dateToInput);

      if (!from || !to) {
        alert("Please select both From Date and To Date");
        setLoading(false);
        return;
      }

      setAppliedDateFrom(from);
      setAppliedDateTo(to);

      /** ✅ NEW: send StartDate/EndDate to PHP */
      const params = new URLSearchParams();
      params.set("StartDate", from);
      params.set("EndDate", to);

      const resp = await fetch(TRANS_GET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (!resp.ok) {
        throw new Error(`Network error: ${resp.status}`);
      }

      const data = await resp.json();

      if (!data || data.status !== "success" || !Array.isArray(data.data)) {
        throw new Error(data?.error || "Invalid data from server");
      }

      /** ✅ NEW: load rows directly (no more summarizing in TSX) */
      const rows: SummaryItem[] = data.data.map((r: any) => ({
  UserName: String(r.UserName ?? ""),
  DisplayName: String(r.DisplayName ?? ""),
  OpeningBal: Number(String(r.OpeningBal ?? "0").replace(/,/g, "")),
  TotalIn: Number(String(r.TotalIn ?? "0").replace(/,/g, "")),
  TotalOut: Number(String(r.TotalOut ?? "0").replace(/,/g, "")),
  ClosingBal: Number(String(r.ClosingBal ?? "0").replace(/,/g, "")),
}));

setSummaryData(rows); // ✅ keep JSON order

    } catch (err: any) {
      setError(err.message || "Failed to load summary data");
      setSummaryData([]);
    } finally {
      setLoading(false);
    }
  };

  const totalOpening = summaryData.reduce((sum, r) => sum + (r.OpeningBal || 0), 0);
  const totalIn = summaryData.reduce((sum, r) => sum + (r.TotalIn || 0), 0);
  const totalOut = summaryData.reduce((sum, r) => sum + (r.TotalOut || 0), 0);
  const totalClosing = summaryData.reduce((sum, r) => sum + (r.ClosingBal || 0), 0);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">
              Petty Cash Summary Report
            </h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                From Date
              </label>
              <input
                type="date"
                value={dateFromInput}
                onChange={(e) => setDateFromInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                To Date
              </label>
              <input
                type="date"
                value={dateToInput}
                onChange={(e) => setDateToInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={handleSearch}
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                {loading ? "Loading..." : "Search"}
              </button>
            </div>
          </div>

          {appliedDateFrom && appliedDateTo && (
            <div className="text-sm text-gray-600 bg-blue-50 px-4 py-2 rounded-lg">
              Showing summary from <strong>{appliedDateFrom}</strong> to{" "}
              <strong>{appliedDateTo}</strong>
            </div>
          )}

          {/* Optional: show REN list load error (kept from your code) */}
          {renError && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-lg">
              REN list warning: {renError}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {summaryData.length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      REN
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      User Id
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold">
                      Opening Bal (RM)
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold">
                      Total Top Up (RM)
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold">
                      Total Purchase (RM)
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold">
                      Closing Bal (RM)
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {summaryData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-blue-50 transition-colors">
                      
                      <td className="px-6 py-4 text-sm text-gray-800">
                        {item.DisplayName}
                      </td>
<td className="px-6 py-4 text-sm text-gray-800">
                        {item.UserName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 text-right">
                        {item.OpeningBal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 text-right">
                        {item.TotalIn.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 text-right">
                        {item.TotalOut.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 text-right font-semibold">
                        {item.ClosingBal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}

                  <tr className="bg-blue-100 font-bold">
                    <td className="px-6 py-4 text-sm text-gray-900" colSpan={2}>
                      Total
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {totalOpening.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {totalIn.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {totalOut.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {totalClosing.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && summaryData.length === 0 && appliedDateFrom && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
            No data found for the selected date range.
          </div>
        )}
      </div>
    </div>
  );
};

export default PettyCashSummaryReport;
