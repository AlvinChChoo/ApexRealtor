import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Briefcase } from 'lucide-react';
import {
  Plus,
  Search,
  Filter,
  Eye,
  Building,
  Calendar,
  User,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RentalApplication } from '../../types';

import SalePurchaseDetails from './SalePurchaseDetails';
import AddSalePurchase from './AddSalePurchase'; // ⬅️ use AddSalePurchase

const LIST_URL = API_ENDPOINTS.RENTAL_APPLICATION_SUMMARY_GET;
const SUMMARY_URL = API_ENDPOINTS.APPLICATION_STATUS_SUMMARY_GET;

type ViewMode = 'list' | 'details' | 'add';
type SummaryRow = { ApplicationStatus: string; Cnt: number };

const SalePurchase: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const [properties, setProperties] = useState<RentalApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<ViewMode>('list');
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);

  // ===== Status Summary state =====
  const [summaryMap, setSummaryMap] = useState<Record<string, number>>({});
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const normalize = (s: string) => (s || '').toLowerCase().trim();

  // ✅ SAME VALIDATION AS YOUR RENTAL PAGE:
  // If role=account (localStorage "account" === "Y"), DO NOT send UserName.
  // If not account, only send UserName when it's non-empty (trimmed).
  const isAccountUser =
    String(localStorage.getItem('account') || '').trim().toUpperCase() === 'Y';

  /**
   * ✅ Make dropdown SAME as tiles status
   * value = what you send to API (ApplicationStatus)
   */
  const STATUS_OPTIONS = useMemo(
    () => [
      { value: 'all', label: 'All Status' },
      { value: 'active', label: 'Active' },
      { value: 'pending review', label: 'Review' },
      { value: 'pending commission', label: 'Pending Commission' },
      { value: 'partial commission', label: 'Partial Commission' },
      { value: 'commission paid', label: 'Commission Paid' },
      { value: 'rejected', label: 'Rejected' },
      { value: 'deal aborted', label: 'Aborted' },
    ],
    []
  );

  const statusValueSet = useMemo(() => new Set(STATUS_OPTIONS.map((x) => x.value)), [STATUS_OPTIONS]);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const formData = new URLSearchParams();

      // ✅ VALIDATION
      const userName = String(localStorage.getItem('userName') || '').trim();
      if (!isAccountUser && userName) {
        formData.append('UserName', userName);
      }

      formData.append('ReturnRowCnt', '50');
      formData.append('TransType', 'Sales,Project');

      const resp = await fetch(SUMMARY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();

      if (json?.status === 'success' && Array.isArray(json.data)) {
        const map: Record<string, number> = {};
        (json.data as SummaryRow[]).forEach((r) => {
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
  }, [isAccountUser]);

  const getCount = useCallback(
    (aliases: string[]) => {
      return aliases.reduce((acc, a) => acc + (summaryMap[normalize(a)] || 0), 0);
    },
    [summaryMap]
  );

  const tiles = useMemo(() => {
    return {
      active: getCount(['active']),
      review: getCount(['pending review', 'review']),
      pendingCommission: getCount(['pending commission']),
      partialCommission: getCount(['partial commission', 'partial commission paid']),
      commissionPaid: getCount(['commission paid', 'paid commission']),
      rejected: getCount(['rejected']),
      aborted: getCount(['deal aborted', 'aborted']),
    };
  }, [getCount]);

  const fetchSalePurchaseList = useCallback(
    async (term = searchTerm, status = statusFilter) => {
      if (mode !== 'list') return;
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        const formData = new URLSearchParams();

        // ✅ VALIDATION
        const userName = String(localStorage.getItem('userName') || '').trim();
        if (!isAccountUser && userName) {
          formData.append('UserName', userName);
        }

        formData.append('ApplicationId', '');
        formData.append('TransType', 'SALES'); // backend expects
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
        setError(err?.message || 'Failed to fetch applications');
        setProperties([]);
      } finally {
        setLoading(false);
      }
    },
    [mode, user, searchTerm, statusFilter, isAccountUser]
  );

  // ✅ Manual Search trigger (NO auto-search)
  const runSearch = useCallback(() => {
    fetchSalePurchaseList(searchTerm, statusFilter);
    fetchSummary();
  }, [fetchSalePurchaseList, fetchSummary, searchTerm, statusFilter]);

  // ✅ Tile click: update dropdown + fetch immediately
  const handleTileClick = useCallback(
    (statusValue: string) => {
      // keep dropdown synced (only if it exists in options)
      if (statusValueSet.has(statusValue)) {
        setStatusFilter(statusValue);
      } else {
        // fallback - still set it so dropdown won't be blank (but normally won't happen now)
        setStatusFilter(statusValue);
      }

      // tile click filters immediately (even in manual-search mode)
      fetchSalePurchaseList(searchTerm, statusValue);
    },
    [fetchSalePurchaseList, searchTerm, statusValueSet]
  );

  // Initial load
  useEffect(() => {
    fetchSummary();
    fetchSalePurchaseList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startAddNew = () => {
    setMode('add');
    setSelectedApplicationId(null);
  };

  const onBackFromChild = () => {
    setMode('list');
    setSelectedApplicationId(null);
    fetchSalePurchaseList();
    fetchSummary();
  };

  const openDetails = (appId: string) => {
    setSelectedApplicationId(appId);
    setMode('details');
  };

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

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount || '0') : amount || 0;
    return isNaN(num) ? 'N/A' : `RM ${num.toLocaleString()}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr === '1900-01-01') return 'N/A';
    return dateStr;
  };

  // Child views — details
  if (mode === 'details' && selectedApplicationId) {
    return <SalePurchaseDetails applicationId={selectedApplicationId} onBack={onBackFromChild} />;
  }

  // Child view — add
  if (mode === 'add') {
    return (
      <AddSalePurchase
        onBack={onBackFromChild}
        onCreated={(newId) => {
          setSelectedApplicationId(newId);
          setMode('details');
        }}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Sale & Purchase Management</h1>
        <button
          onClick={startAddNew}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          <span>New Sale &amp; Purchase</span>
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div
          className="bg-white rounded-xl shadow-lg p-6"
          role="button"
          tabIndex={0}
          onClick={() => handleTileClick('active')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleTileClick('active');
          }}
        >
          <p className="text-sm font-medium text-gray-600">Active</p>
          <p className="text-2xl font-bold text-blue-600">{summaryLoading ? '…' : tiles.active}</p>
        </div>

        <div
          className="bg-white rounded-xl shadow-lg p-6"
          role="button"
          tabIndex={0}
          onClick={() => handleTileClick('pending review')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleTileClick('pending review');
          }}
        >
          <p className="text-sm font-medium text-gray-600">Review</p>
          <p className="text-2xl font-bold text-gray-900">{summaryLoading ? '…' : tiles.review}</p>
        </div>

        <div
          className="bg-white rounded-xl shadow-lg p-6"
          role="button"
          tabIndex={0}
          onClick={() => handleTileClick('pending commission')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleTileClick('pending commission');
          }}
        >
          <p className="text-sm font-medium text-gray-600">Pending Commission</p>
          <p className="text-2xl font-bold text-green-600">
            {summaryLoading ? '…' : tiles.pendingCommission}
          </p>
        </div>

        <div
          className="bg-white rounded-xl shadow-lg p-6"
          role="button"
          tabIndex={0}
          onClick={() => handleTileClick('commission paid')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleTileClick('commission paid');
          }}
        >
          <p className="text-sm font-medium text-gray-600">Commission Paid</p>
          <p className="text-2xl font-bold text-yellow-600">
            {summaryLoading ? '…' : tiles.commissionPaid}
          </p>
        </div>

        <div
          className="bg-white rounded-xl shadow-lg p-6"
          role="button"
          tabIndex={0}
          onClick={() => handleTileClick('rejected')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleTileClick('rejected');
          }}
        >
          <p className="text-sm font-medium text-gray-600">Rejected</p>
          <p className="text-2xl font-bold text-purple-600">
            {summaryLoading ? '…' : tiles.rejected}
          </p>
        </div>

        <div
          className="bg-white rounded-xl shadow-lg p-6"
          role="button"
          tabIndex={0}
          onClick={() => handleTileClick('deal aborted')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleTileClick('deal aborted');
          }}
        >
          <p className="text-sm font-medium text-gray-600">Aborted</p>
          <p className="text-2xl font-bold text-red-600">{summaryLoading ? '…' : tiles.aborted}</p>
        </div>
      </div>

      {summaryError && <div className="text-sm text-red-600">{summaryError}</div>}

      {/* Filters */}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runSearch();
                }}
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
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Manual Search */}
          <button
            onClick={runSearch}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Search className="w-5 h-5" />
            <span>Search</span>
          </button>

          <button
            onClick={() => {
              fetchSalePurchaseList();
              fetchSummary();
            }}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading sale &amp; purchase applications...</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Error Loading Data</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => {
              fetchSalePurchaseList();
              fetchSummary();
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="space-y-4">
            {properties.map((property, idx) => (
              <div
                key={property.ApplicationId}
                className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-semibold">
                          {idx + 1}
                        </span>

                        <h3 className="text-lg font-semibold text-gray-900">
                          {property.PropertyAddress || 'Property Address Not Available'}
                        </h3>

                        <span
                          className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(
                            property.ApplicationStatus || ''
                          )}`}
                        >
                          {property.ApplicationStatus || 'Unknown'}
                        </span>
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                        <div className="flex items-center space-x-1">
                          <Building size={14} />
                          <span>{property.PropertyType || 'N/A'}</span>
                        </div>

                        <div className="flex items-center space-x-1">
                          {(() => {
                            const tt = String((property as any)?.TransType ?? '').trim().toLowerCase();
                            if (tt === 'project') return <Briefcase size={14} className="text-gray-600" />;
                            if (tt === 'sales') return <Building size={14} className="text-gray-600" />;
                            return <Building size={14} className="text-gray-400" />;
                          })()}
                          <span>{String((property as any)?.TransType ?? 'N/A')}</span>
                        </div>

                        <div className="flex items-center space-x-1">
                          <MapPin size={14} />
                          <span>{property.PropertyLocation || property.PropertyTown || 'N/A'}</span>
                        </div>

                        <div className="flex items-center space-x-1">
                          <Calendar size={14} />
                          <span>Added: {formatDate(property.AddDate)}</span>
                        </div>

                        <div className="flex items-center space-x-1">
                          <User size={14} className="text-gray-500" />
                          <span>{property.DisplayName?.trim() ? property.DisplayName : 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600 mb-1">
                        {formatCurrency(property.AtlRentalAmt)}
                      </p>
                      <p className="text-sm text-gray-500">Ref: {property.RefNo || property.ApplicationId}</p>

                      {(() => {
                        const pct = Number(property.FeesCollectionPctg) || 0;
                        const displayPct = (pct * 100).toFixed(2) + '%';
                        const badgeClass =
                          pct >= 1.5 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';

                        return (
                          <div
                            className={`mt-2 inline-block px-3 py-1 rounded-lg text-xs font-semibold shadow-sm ${badgeClass}`}
                          >
                            Collection % : {displayPct}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => openDetails(String(property.ApplicationId))}
                      className="flex-1 bg-blue-50 text-blue-600 py-2 px-3 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center space-x-1"
                    >
                      <Eye size={16} />
                      <span>View Details</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {properties.length === 0 && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                No Sale &amp; Purchase Applications Found
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || statusFilter !== 'all'
                  ? 'No applications match your current filters.'
                  : 'No sale & purchase applications have been created yet.'}
              </p>

              {(searchTerm || statusFilter !== 'all') && (
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

export default SalePurchase;