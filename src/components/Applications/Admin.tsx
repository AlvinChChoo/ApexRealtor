import { API_ENDPOINTS } from '../../config/apiConfig';
// src/pages/staff/Admin.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Search, Eye, Plus } from 'lucide-react';
import AdminDetails from './AdminDetails';
import AddAdmin from './AddAdmin';

export type Employee = {
  UserName: string;
  Branch: string | null;
  Nric: string | null;
  NricName: string | null;
  DisplayName: string | null;
  LastLogin: string | null;
  Active: number | string | null;
  EmpType: string | null;
  Dept: string | null;
  OriRecruitDate: string | null;
  RecruitDate: string | null;
  Resign: number | string | null;
  ResignDate: string | null;
  MobilePhone: string | null;
  HousePhone: string | null;
  Email: string | null;
  Address: string | null;
  City: string | null;
  State: string | null;
  PostCode: string | null;
  Country: string | null;
  CreatedOn: string | null;
  CreatedBy: string | null;
  PayoutDueAmt: number | string | null;
  BankName: string | null;
  BankAcc: string | null;
  BdsAc: string | null;
  Remarks: string | null;
  RenNo: string | null;
  RefererL4: string | null;
  RefererL3: string | null;
  RefererL2: string | null;
  RefererL1: string | null;
  RefererL1Percent: number | string | null;
  RefererL2Percent: number | string | null;
  RefererL3Percent: number | string | null;
  RefererL4Percent: number | string | null;
  PettyCashAmt: number | string | null;
  EmpGroups: string | null;
  IndividualPctg: number | string | null;
};

type ApiSuccess = { status: 'success'; data: Employee[] };
type ApiNoData  = { status: 'no_data_found'; error?: string };
type ApiError   = { status: 'error'; error?: string; detail?: any };
type ApiResp    = ApiSuccess | ApiNoData | ApiError;

const ENDPOINT = API_ENDPOINTS.INT_EMP_GET;

interface AdminProps {
  /** Called when user clicks "View" on a row. Optional; defaults to no-op. */
  onView?: (userName: string) => void;
}

type ViewMode = 'list' | 'details' | 'add';

const Admin: React.FC<AdminProps> = ({ onView = () => {} }) => {
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedUserName, setSelectedUserName] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    setErr('');
    try {
      const body = new URLSearchParams();
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body.toString(),
      });
      const json: ApiResp = await res.json();

      if (json.status === 'success') {
        setRows(json.data);
      } else if (json.status === 'no_data_found') {
        setRows([]);
        setErr(json.error || 'No data found.');
      } else {
        setRows([]);
        setErr(json.error || 'Server error.');
      }
    } catch (e: any) {
      setRows([]);
      setErr(e?.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const haystack = [
        r.NricName,
        r.DisplayName,
        r.UserName,
        r.Email,
        r.MobilePhone,
        r.RenNo,
        r.Branch,
        r.EmpGroups,
        r.Dept,
      ]
        .map((x) => (x ?? '').toString().toLowerCase())
        .join(' ');
      return haystack.includes(q);
    });
  }, [rows, query]);

  const handleViewClick = (userName: string) => {
    setSelectedUserName(userName);
    setViewMode('details');
    onView(userName);
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedUserName('');
    // optional: refresh list after returning
    fetchData();
  };

  const handleAddNew = () => {
    setSelectedUserName('');
    setViewMode('add');
  };

  // Details mode
  if (viewMode === 'details' && selectedUserName) {
    return <AdminDetails userName={selectedUserName} onBack={handleBackToList} />;
  }

  // Add mode
  if (viewMode === 'add') {
    return <AddAdmin onBack={handleBackToList} />;
  }

  // List mode
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">Admin</h2>
          <p className="text-sm text-slate-500">Employee master listing</p>
        </div>
        <div className="flex items-center gap-2">
          {/* NEW: Add New Admin */}
          <button
            type="button"
            onClick={handleAddNew}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:bg-slate-50"
            title="Add New Admin"
          >
            <Plus size={16} />
            <span>ADD NEW ADMIN</span>
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
              loading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-50'
            }`}
            title="Refresh"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5" size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, username, email, REN no., branch, dept..."
            className="pl-9 pr-3 py-2 w-full max-w-md border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Status / Errors */}
      {err && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {err}
        </div>
      )}

      {/* Table */}
      <div className="overflow-auto rounded-lg border">
        <table className="min-w-[720px] w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left">User ID</th>
              <th className="px-3 py-2 text-left">Display Name</th>
              <th className="px-3 py-2 text-left">Team</th>
              <th className="px-3 py-2 text-left">LTD SALES</th>
              <th className="px-3 py-2 text-left">Ind %</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={5}>
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="animate-spin" size={16} />
                    Loading…
                  </span>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={5}>
                  No rows.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.UserName} className="border-t">
                  <td className="px-3 py-2">{r.UserName}</td>
                  <td className="px-3 py-2">{r.DisplayName || '-'}</td>
                  <td className="px-3 py-2">{r.Dept || '-'}</td>
                  
                  <td className="px-3 py-2">0.00</td>
                  
                  <td className="px-3 py-2">{r.IndividualPctg ?? '-'}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      title="View details"
                      onClick={() => handleViewClick(r.UserName)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                    >
                      <Eye size={18} /> View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Admin;
