import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Filter, Eye, UserCheck, Calendar,
  MapPin, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RentalApplication } from '../../types';

const LIST_URL = API_ENDPOINTS.RENTAL_APPLICATION_GET;
const SUMMARY_URL = API_ENDPOINTS.APPLICATION_STATUS_SUMMARY_GET;

type SummaryRow = { ApplicationStatus: string; Cnt: number };

const ClientList: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [properties, setProperties] = useState<RentalApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [summaryMap, setSummaryMap] = useState<Record<string, number>>({});
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const normalize = (s: string) => (s || '').toLowerCase().trim();

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const formData = new URLSearchParams();
      formData.append('UserName', '');
      formData.append('ReturnRowCnt', '50');

      const resp = await fetch(SUMMARY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();

      if (json?.status === 'success' && Array.isArray(json.data)) {
        const map: Record<string, number> = {};
        (json.data as SummaryRow[]).forEach(r => {
          const key = normalize(r.ApplicationStatus || 'Unknown');
          map[key] = (map[key] || 0) + (Number(r.Cnt) || 0);
        });
        setSummaryMap(map);
      } else if (json?.status === 'no_data_found') {
        setSummaryMap({});
      } else {
        throw new Error(json?.error || 'Unknown summary error');
      }
    } catch (e: any) {
      setSummaryMap({});
      setSummaryError(e?.message || 'Failed to load status summary');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const getCount = useCallback((aliases: string[]) => {
    return aliases.reduce((acc, a) => acc + (summaryMap[normalize(a)] || 0), 0);
  }, [summaryMap]);

  const tiles = useMemo(() => {
    return {
      active: getCount(['active', 'approved']),
      pending: getCount(['pending', 'pending review', 'review']),
      completed: getCount(['completed', 'signed', 'commission paid']),
      rejected: getCount(['rejected', 'deal aborted', 'aborted']),
    };
  }, [getCount]);

  const fetchClients = useCallback(async (term = searchTerm, status = statusFilter) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new URLSearchParams();
      formData.append('UserName', '');
      formData.append('ApplicationId', '');
      formData.append('TransType', 'Rental');
      formData.append('SearchKeyword', term);
      formData.append('ShowOnlyExpiringTrans', '');
      formData.append('ReturnRowCnt', '50');

      const isAll = status === 'all' || status === 'allstatus' || status === '';
      formData.append('ApplicationStatus', isAll ? '' : status);

      const response = await fetch(LIST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();

      if (result?.status === 'success') {
        setProperties(Array.isArray(result.data) ? result.data : []);
      } else if (result?.status === 'no_data_found') {
        setProperties([]);
      } else {
        throw new Error(result?.error || 'Unknown error');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch client list');
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, [user, searchTerm, statusFilter]);

  const handleTileClick = useCallback(
    (statusValue: string) => {
      setStatusFilter(statusValue);
      fetchClients(searchTerm, statusValue);
    },
    [fetchClients, searchTerm]
  );

  useEffect(() => {
    fetchSummary();
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchClients();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, statusFilter, fetchClients]);

  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'active':
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
      case 'draft':
      case 'pending review':
        return 'bg-yellow-100 text-yellow-800';
      case 'expired':
      case 'cancelled':
      case 'rejected':
      case 'deal aborted':
      case 'aborted':
        return 'bg-red-100 text-red-800';
      case 'completed':
      case 'signed':
      case 'commission paid':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const cleanValue = (value: any): string => {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s || s.toLowerCase() === 'nil') return '';
  return s;
};

  
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount || '0') : (amount || 0);
    return isNaN(num) ? 'N/A' : `RM ${num.toLocaleString()}`;
  };

  // 🔹 FLATTEN tenants & landlords into ONE list of rows
  type PartyRow = {
    // we internally track type & index, but UI columns are only the tenant-* ones you requested
    partyType: 'Tenant' | 'Landlord';
    partyNo: number;
    TenantTinNo: string;
    TenantSstNo: string;
    TenantIdType: string;
    TenantName: string;
    TenantId: string;
    TenantHpNo: string;
    TenantEmail: string;
    TenantMailingAdd: string;
    TenantCnt: string | number;
    TenantPostalCode: string;
    TenantGender: string;
    TenantUserName: string;
  };

  const partyRows = useMemo(() => {
    const rows: PartyRow[] = [];

    properties.forEach((property) => {
      const p: any = property;
      const tenantCnt = p.TenantCnt ?? '';

      // 🔹 Tenants 1..3
      [1, 2, 3].forEach((i) => {
        const name =
          p[`Tenant${i}Name`] ?? (i === 1 ? p.TenantName : '');
        const tinNo =
          p[`Tenant${i}TinNo`] ?? (i === 1 ? p.TenantTinNo : '');
        const sstNo =
          p[`Tenant${i}SstNo`] ?? (i === 1 ? p.TenantSstNo : '');
        const idType =
          p[`Tenant${i}IdType`] ?? (i === 1 ? p.TenantIdType : '');
        const idNo =
          p[`Tenant${i}Id`] ?? (i === 1 ? p.TenantId : '');
        const hpNo =
          p[`Tenant${i}HpNo`] ?? (i === 1 ? p.TenantHpNo : '');
        const email =
          p[`Tenant${i}Email`] ?? (i === 1 ? p.TenantEmail : '');
        const mailingAdd =
          p[`Tenant${i}MailingAdd`] ?? (i === 1 ? p.TenantMailingAdd : '');
        const postalCode =
          p[`Tenant${i}PostalCode`] ?? (i === 1 ? p.TenantPostalCode : '');
        const gender =
          p[`Tenant${i}Gender`] ?? (i === 1 ? p.TenantGender : '');
        const userName =
          p[`Tenant${i}UserName`] ?? (i === 1 ? p.TenantUserName : '');

        const hasAny =
          name || tinNo || sstNo || idType || idNo || hpNo ||
          email || mailingAdd || postalCode || gender || userName;

        if (hasAny) {
          rows.push({
            partyType: 'Tenant',
            partyNo: i,
            TenantTinNo: tinNo || '',
            TenantSstNo: sstNo || '',
            TenantIdType: idType || '',
            TenantName: name || '',
            TenantId: idNo || '',
            TenantHpNo: hpNo || '',
            TenantEmail: email || '',
            TenantMailingAdd: mailingAdd || '',
            TenantCnt: tenantCnt || '',
            TenantPostalCode: postalCode || '',
            TenantGender: gender || '',
            TenantUserName: userName || '',
          });
        }
      });

      // 🔹 Landlords 1..3 (mapped into the same columns)
      [1, 2, 3].forEach((i) => {
        const name =
          p[`Landlord${i}Name`] ?? (i === 1 ? p.LandlordName : '');
        const tinNo =
          p[`Landlord${i}TinNo`] ?? (i === 1 ? p.LandlordTinNo : '');
        const sstNo =
          p[`Landlord${i}SstNo`] ?? (i === 1 ? p.LandlordSstNo : '');
        const idType =
          p[`Landlord${i}IdType`] ?? '';
        const idNo =
          p[`Landlord${i}Id`] ?? '';
        const hpNo =
          p[`Landlord${i}HpNo`] ?? '';
        const email =
          p[`Landlord${i}Email`] ?? '';
        const mailingAdd =
          p[`Landlord${i}MailingAdd`] ?? '';
        const postalCode =
          p[`Landlord${i}PostalCode`] ?? '';
        const gender =
          p[`Landlord${i}Gender`] ?? '';
        const userName =
          p[`Landlord${i}UserName`] ?? '';

        const hasAny =
          name || tinNo || sstNo || idType || idNo || hpNo ||
          email || mailingAdd || postalCode || gender || userName;

        if (hasAny) {
          rows.push({
            partyType: 'Landlord',
            partyNo: i,
            TenantTinNo: tinNo || '',
            TenantSstNo: sstNo || '',
            TenantIdType: idType || '',
            TenantName: name || '',
            TenantId: idNo || '',
            TenantHpNo: hpNo || '',
            TenantEmail: email || '',
            TenantMailingAdd: mailingAdd || '',
            TenantCnt: tenantCnt || '',
            TenantPostalCode: postalCode || '',
            TenantGender: gender || '',
            TenantUserName: userName || '',
          });
        }
      });
    });

    return rows;
  }, [properties]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <UserCheck className="text-blue-600" size={32} />
            Client List Report
          </h1>
          
        </div>
      </div>


      {summaryError && (
        <div className="text-sm text-red-600">{summaryError}</div>
      )}

      {false &&
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by property address or reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter size={20} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="allstatus">All Status</option>
              <option value="active">Active</option>
              <option value="pending review">Pending Review</option>
              <option value="commission paid">Commission Paid</option>
              <option value="rejected">Rejected</option>
              <option value="deal aborted">Deal Aborted</option>
            </select>
          </div>
          <button
            onClick={() => { fetchClients(); fetchSummary(); }}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
      }
      

      {loading && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading client list...</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Error Loading Data</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => { fetchClients(); fetchSummary(); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* 🔹 ONE TABLE for ALL tenants & landlords */}
          <div className="bg-white rounded-xl shadow-lg p-6 overflow-x-auto">
            <table className="min-w-full text-xs md:text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  {/* Internally we know tenant/landlord by partyType, but UI columns follow your requested list */}
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Client Name</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Tin No</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Sst No</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">TenantIdType</th>
                  
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Id</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Mobile No</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Email</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Mailing Add</th>
                  
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Postal Code</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700"> Gender</th>
                  
                </tr>
              </thead>
              <tbody>
                {partyRows.length > 0 ? (
                  partyRows.map((row, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2">{row.TenantName || '-'}</td>
                      <td className="px-3 py-2">{row.TenantTinNo || '-'}</td>
                      <td className="px-3 py-2">{row.TenantSstNo || '-'}</td>
                      <td className="px-3 py-2">{row.TenantIdType || '-'}</td>                      
                      <td className="px-3 py-2">{row.TenantId || '-'}</td>
                      <td className="px-3 py-2">{row.TenantHpNo || '-'}</td>
                      <td className="px-3 py-2">{row.TenantEmail || '-'}</td>
                      <td className="px-3 py-2">{row.TenantMailingAdd || '-'}</td>
                      
                      <td className="px-3 py-2">{row.TenantPostalCode || '-'}</td>
                      <td className="px-3 py-2">{row.TenantGender || '-'}</td>
                      
                    </tr>
                  ))
                ) : (
                  <tr> 
                    <td
                      colSpan={12}
                      className="px-3 py-3 text-center text-gray-500"
                    >
                      No tenant / landlord information available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {properties.length === 0 && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <UserCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Clients Found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || (statusFilter !== 'all' && statusFilter !== 'allstatus')
                  ? 'No clients match your current filters.'
                  : 'No clients have been created yet.'}
              </p>
              {(searchTerm || (statusFilter !== 'all' && statusFilter !== 'allstatus')) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ClientList;
