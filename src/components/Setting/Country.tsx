import { API_ENDPOINTS } from '../../config/apiConfig';
// Country.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Globe, RefreshCw, Save } from "lucide-react";

type CountryRow = {
  CountryId: string;
  CountryCode: string;
  CountryName: string;
  Sel: string; // "Y" / "N"
};

type ApiResp =
  | { status: "success"; data: CountryRow[] }
  | { status: "no_data_found"; error?: string }
  | { status: "error"; error?: string }
  | { status: string; data?: any; error?: string };

const COUNTRY_GET_URL = API_ENDPOINTS.COUNTRY_GET;
const SEL_COUNTRY_UPLOAD_URL = API_ENDPOINTS.SEL_COUNTRY_UPLOAD;

const normYN = (v: any) => (String(v ?? "").trim().toUpperCase() === "Y" ? "Y" : "N");

const toIntOrZero = (v: any) => {
  const n = parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) ? n : 0;
};

const Country: React.FC = () => {
  const [rows, setRows] = useState<CountryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [selFilter, setSelFilter] = useState<string>("");

  // keep original Sel for dirty tracking
  const initialSelByIdRef = useRef<Map<string, string>>(new Map());

  const fetchCountries = async (sel: string) => {
    setLoading(true);
    setError("");

    try {
      const form = new URLSearchParams();
      form.append("Sel", sel ?? "");

      const res = await fetch(COUNTRY_GET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: form.toString(),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

      const json: ApiResp = await res.json();

      if (json.status === "success" && Array.isArray(json.data)) {
        const cleaned = json.data.map((r) => ({
          ...r,
          Sel: normYN(r.Sel),
        }));

        setRows(cleaned);

        const m = new Map<string, string>();
        cleaned.forEach((r) => m.set(String(r.CountryId), normYN(r.Sel)));
        initialSelByIdRef.current = m;
        return;
      }

      if (json.status === "no_data_found") {
        setRows([]);
        initialSelByIdRef.current = new Map();
        setError(json.error || "No data found");
        return;
      }

      setRows([]);
      initialSelByIdRef.current = new Map();
      setError(json.error || `Unexpected status: ${json.status}`);
    } catch (e: any) {
      setRows([]);
      initialSelByIdRef.current = new Map();
      setError(e?.message || "Failed to load countries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCountries("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const countText = useMemo(() => {
    if (loading) return "Loading…";
    return `${rows.length} record(s)`;
  }, [rows.length, loading]);

  // changed rows (for UI pending count + enable update)
  const changedRows = useMemo(() => {
    const init = initialSelByIdRef.current;
    return rows.filter((r) => {
      const orig = init.get(String(r.CountryId));
      if (orig == null) return false;
      return normYN(r.Sel) !== normYN(orig);
    });
  }, [rows]);

  // ✅ NEW: selected rows (this is what we will send)
  const selectedRows = useMemo(() => {
    return rows.filter((r) => normYN(r.Sel) === "Y");
  }, [rows]);

  const toggleSel = (countryId: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (String(r.CountryId) !== String(countryId)) return r;
        const next = normYN(r.Sel) === "Y" ? "N" : "Y";
        return { ...r, Sel: next };
      })
    );
  };

  // ✅ Update sends ALL selected (Y) countries, not only changed ones
  const handleUpdate = async () => {
    if (changedRows.length === 0) return;

    const payload = selectedRows
      .map((r) => ({
        CountryId: toIntOrZero(r.CountryId),
        Sel: "Y" as const,
      }))
      .filter((x) => x.CountryId > 0);

    if (payload.length === 0) {
      setError("No selected CountryId to update.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const form = new URLSearchParams();
      form.append("countryList", JSON.stringify(payload));

      const res = await fetch(SEL_COUNTRY_UPLOAD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: form.toString(),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

      const json: any = await res.json();

      if (json?.status === "success") {
        await fetchCountries(selFilter);
        return;
      }

      setError(json?.data || json?.error || "Failed to update");
    } catch (e: any) {
      setError(e?.message || "Failed to update");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Globe className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Country</h1>
            <p className="text-sm text-gray-500">{countText}</p>
          </div>
        </div>

        <button
          onClick={() => fetchCountries(selFilter)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm"
          disabled={loading}
          type="button"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Country Management</h2>
            {changedRows.length > 0 ? (
              <p className="text-sm text-amber-700 mt-1">{changedRows.length} change(s) pending</p>
            ) : null}
          </div>

          {/* Optional Sel filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Sel</label>
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={selFilter}
              onChange={(e) => {
                const v = e.target.value;
                setSelFilter(v);
                fetchCountries(v);
              }}
              disabled={loading}
            >
              <option value="">All</option>
              <option value="Y">Y</option>
              <option value="N">N</option>
            </select>
          </div>
        </div>

        {/* Error */}
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        ) : null}

        {/* Table */}
        <div className="overflow-x-auto border rounded-xl">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Country ID</th>
                <th className="text-left px-4 py-3 font-semibold">Code</th>
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Sel</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={4}>
                    Loading countries…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={4}>
                    No records
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isOn = normYN(r.Sel) === "Y";
                  const orig = initialSelByIdRef.current.get(String(r.CountryId));
                  const isDirty = orig != null && normYN(orig) !== normYN(r.Sel);

                  return (
                    <tr key={`${r.CountryId}-${r.CountryCode}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{r.CountryId}</td>
                      <td className="px-4 py-3">{r.CountryCode}</td>
                      <td className="px-4 py-3">{r.CountryName}</td>

                      {/* ✅ Sel Toggle */}
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSel(r.CountryId)}
                          className={[
                            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
                            isOn
                              ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                              : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100",
                            isDirty ? "ring-2 ring-amber-200" : "",
                          ].join(" ")}
                          title={isOn ? "Yes" : "No"}
                        >
                          <span
                            className={[
                              "inline-block h-3 w-3 rounded-full border",
                              isOn ? "bg-green-500 border-green-600" : "bg-gray-300 border-gray-400",
                            ].join(" ")}
                          />
                          {isOn ? "Yes" : "No"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ✅ Bottom actions */}
        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm"
            onClick={() => fetchCountries(selFilter)}
            disabled={loading}
          >
            Reload
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleUpdate}
            disabled={loading || changedRows.length === 0}
            title={changedRows.length === 0 ? "No changes to update" : "Update changes"}
          >
            <Save className="w-4 h-4" />
            Update
          </button>
        </div>
      </div>
    </div>
  );
};

export default Country;
