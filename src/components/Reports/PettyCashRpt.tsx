import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useEffect, useState } from "react";
import { FileText, Filter, Download, Calendar, Search } from "lucide-react";

interface Transaction {
  id: number;

  InventoryTransactionId: string;
  Ren: string;
  ItemName: string;
  UnitPrice: string;
  Qty: number;
  TotalPrice: string;
  CreatedAt: string;  // YYYY-MM-DD
  CreatedBy: string;
  Remark: string;
}


interface RenOption {
  id: string;     // value sent to backend (eg 10001)
  label: string;  // what user sees (eg Ali / Email)
}

const OPENING_BALANCE = 100;

// ✅ Endpoints
const EMP_GET_URL = API_ENDPOINTS.INT_EMP_ONLY_GET;
const TRANS_GET_URL =
  API_ENDPOINTS.INT_INVENTORY_TRANS_GET;

// ✅ robust date -> YYYY-MM-DD
const toYmd = (val: any): string => {
  if (!val) return "";

  if (typeof val === "string") {
    const s = val.trim();

    // already yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // dd/mm/yyyy
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
      const [dd, mm, yyyy] = s.split(/[\/\s]/);
      if (dd && mm && yyyy) return `${yyyy}-${mm}-${dd}`;
    }
  }

  const d = new Date(val);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return String(val);
};

// ✅ yyyy-MM-dd for today
const todayYmd = () => new Date().toISOString().slice(0, 10);

// ✅ yyyy-01-01 for current year
const firstDayOfCurrentYearYmd = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  return `${yyyy}-01-01`;
};

const PettyCashRpt: React.FC = () => {
  // ✅ REN dropdown value (send to backend). "all" means no filter.
  const [filterType, setFilterType] = useState<string>("all");

  // ✅ UI inputs (DEFAULTS REQUESTED)
  const [dateFromInput, setDateFromInput] = useState<string>(
    firstDayOfCurrentYearYmd()
  );
  const [dateToInput, setDateToInput] = useState<string>(todayYmd());

  // ✅ Applied display only
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");

  // ✅ REN list state
  const [renOptions, setRenOptions] = useState<RenOption[]>([]);
  const [renLoading, setRenLoading] = useState<boolean>(true);
  const [renError, setRenError] = useState<string | null>(null);

  // ✅ Transactions (ONLY loaded when Search)
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const showBalanceColumn = filterType !== "all";

  /**
   * ✅ ON LOAD: ONLY IntEmpGet.php
   */
  useEffect(() => {
    const fetchRenList = async () => {
      try {
        setRenLoading(true);
        setRenError(null);

        const resp = await fetch(EMP_GET_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "",
        });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const json = await resp.json();
        if (json.status !== "success" || !Array.isArray(json.data)) {
          throw new Error("Invalid response from server (REN list)");
        }

        const list: RenOption[] = json.data
          .map((row: any) => {
            // id to send to backend
            // ✅ Your IntEmpGet.php returns: UserName (ID), DisplayName (Name)
const id = String(row.UserName ?? "").trim();

const label = String(
  row.DisplayName ??        // ✅ preferred
  row.NricName ??           // fallback
  row.Email ??              // fallback
  id                        // final fallback
).trim();

if (!id) return null;

// show "Name (ID)" so user can recognize
return { id, label: label ? `${label} (${id})` : id };


            const sid = String(id ?? "").trim();
            const slabel = String(label ?? "").trim();

            if (!sid && !slabel) return null;

            // fallback: if no id, use label as id
            return { id: sid || slabel, label: slabel || sid };
          })
          .filter(Boolean) as RenOption[];

        // unique by id + sort
        const map = new Map<string, RenOption>();
        for (const r of list) {
          if (!map.has(r.id)) map.set(r.id, r);
        }
        const uniqueSorted = Array.from(map.values()).sort((a, b) =>
          a.label.localeCompare(b.label)
        );

        setRenOptions(uniqueSorted);
      } catch (e: any) {
        console.error("REN load error:", e);
        setRenError(e?.message || "Failed to load REN list");
        setRenOptions([]);
      } finally {
        setRenLoading(false);
      }
    };

    fetchRenList();
  }, []);

  /**
   * ✅ ONLY ON SEARCH: IntInventoryTransGet.php
   * NO client side filtering. Whatever backend returns, show it.
   */
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();

      // Backend filters
      if (filterType !== "all") params.set("RenId", filterType);
      if (dateFromInput) params.set("DateFrom", dateFromInput);
      if (dateToInput) params.set("DateTo", dateToInput);

      const resp = await fetch(TRANS_GET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const json = await resp.json();
      if (json.status !== "success" || !Array.isArray(json.data)) {
        throw new Error("Invalid response from server (transactions)");
      }

      const mapped: Transaction[] = json.data.map((row: any, index: number) => {
  const invId = String(row.InventoryTransactionId ?? "").trim();

  return {
    id: Number(invId) || index + 1,

    InventoryTransactionId: invId,
    Ren: String(row.Ren ?? "").trim(),
    ItemName: String(row.ItemName ?? "").trim(),
    UnitPrice: String(row.UnitPrice ?? "0.00"),
    Qty: Number(row.Qty ?? 0),
    TotalPrice: String(row.TotalPrice ?? "0.00"),
    CreatedAt: toYmd(row.CreatedAt),
    CreatedBy: String(row.CreatedBy ?? "").trim(),
    Remark: String(row.Remark ?? "").trim(),
  };
});


      setTransactions(mapped);

      // applied range display
      setAppliedDateFrom(dateFromInput);
      setAppliedDateTo(dateToInput);
    } catch (e: any) {
      console.error("Transaction load error:", e);
      setError(e?.message || "Failed to load transactions");
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (dateFromInput && dateToInput && dateFromInput > dateToInput) {
      window.alert("Date From cannot be later than Date To.");
      return;
    }
    fetchTransactions();
  };

  const handleClear = () => {
    setFilterType("all");

    // ✅ reset to your defaults
    setDateFromInput(firstDayOfCurrentYearYmd());
    setDateToInput(todayYmd());

    setAppliedDateFrom("");
    setAppliedDateTo("");
    setTransactions([]);
    setError(null);
  };

  const handleExportCsv = () => {
    if (transactions.length === 0) {
      window.alert("No transactions to export.");
      return;
    }

    const headers = [
      "Trans ID",
      "Branch",
      "Ren",
      "Type",
      "Amount",
      "Created At",
      "Created By",
      "Updated At",
      "Updated By",
      "Status",
    ];

    const escapeCell = (val: unknown): string => {
      const v = val == null ? "" : String(val);
      return `"${v.replace(/"/g, '""')}"`;
    };

    const lines: string[] = [];
    lines.push(headers.map(escapeCell).join(","));
    lines.push(Array(headers.length).fill("").map(escapeCell).join(","));

    transactions.forEach((t) => {
      lines.push(
        [
          t.transId,
          t.branch,
          t.performedBy,
          t.transactionType,
          t.total,
          t.createdAt,
          t.createdBy,
          t.updatedAt,
          t.updatedBy,
          t.status,
        ]
          .map(escapeCell)
          .join(",")
      );
    });

    lines.push(Array(headers.length).fill("").map(escapeCell).join(","));

    const csvContent = lines.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = todayYmd();
    const safeRen = (filterType || "all").replace(/[^a-zA-Z0-9_-]/g, "_");

    link.href = url;
    link.setAttribute("download", `petty_cash_${safeRen}_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const showClearButton =
    filterType !== "all" ||
    dateFromInput !== firstDayOfCurrentYearYmd() ||
    dateToInput !== todayYmd() ||
    appliedDateFrom ||
    appliedDateTo ||
    transactions.length > 0;

  let runningBalance = OPENING_BALANCE;

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <FileText className="text-blue-600" size={32} />
              Petty Cash Transaction Report
            </h1>
            <p className="text-gray-600 mt-1">
              View and export petty cash transaction reports
            </p>
          </div>

          <div className="flex items-center gap-3">
            {false && 
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download size={20} />
              Export to CSV
            </button>
            }
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            {/* REN */}
            <div className="relative">
              <Filter
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={renLoading}
              >
                <option value="all">All REN</option>
                {renOptions.map((ren) => (
                  <option key={ren.id} value={ren.id}>
                    {ren.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Date From
              </label>
              <div className="relative">
                <Calendar
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="date"
                  value={dateFromInput}
                  onChange={(e) => setDateFromInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Date To */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Date To
              </label>
              <div className="relative">
                <Calendar
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="date"
                  value={dateToInput}
                  onChange={(e) => setDateToInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Search */}
            <button
              onClick={handleSearch}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors"
              disabled={loading || renLoading}
              title="Search by date range"
            >
              <Search size={18} />
              Search
            </button>

            
          </div>

          {renLoading && (
            <div className="mt-3 text-sm text-gray-500">Loading REN list...</div>
          )}
          {renError && (
            <div className="mt-3 text-sm text-red-600">
              Failed to load REN list: {renError}
            </div>
          )}

          {loading && (
            <div className="mt-3 text-sm text-gray-500">
              Loading transactions...
            </div>
          )}
          {error && (
            <div className="mt-3 text-sm text-red-600">
              Failed to load transactions: {error}
            </div>
          )}

          
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
  <tr>
    
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      Ren
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      Item Name
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      Unit Price
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      Qty
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      Total Price
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      Created At
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      Created By
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      Remark
    </th>
  </tr>
</thead>


            <tbody className="bg-white divide-y divide-gray-200">
  {transactions.map((t) => (
    <tr key={t.id} className="hover:bg-gray-50">
      
      <td className="px-6 py-4">{t.Ren}</td>
      <td className="px-6 py-4 font-semibold">{t.ItemName}</td>
      <td className="px-6 py-4">{t.UnitPrice}</td>
      <td className="px-6 py-4">{t.Qty}</td>
      <td className="px-6 py-4">{t.TotalPrice}</td>
      <td className="px-6 py-4">{t.CreatedAt}</td>
      <td className="px-6 py-4 font-semibold">{t.CreatedBy}</td>
      <td className="px-6 py-4 font-semibold">{t.Remark}</td>
    </tr>
  ))}
</tbody>

          </table>
        </div>

        {!loading && transactions.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Click <b>Search</b> to load transactions.
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Showing {transactions.length} transactions
      </div>
    </div>
  );
};

export default PettyCashRpt;
