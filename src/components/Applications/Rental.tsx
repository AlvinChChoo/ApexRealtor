import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import {
  Plus,
  Search,
  Filter,
  Eye,
  Building,
  Calendar,
  MapPin,
  AlertCircle,
  User,
  Home,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RentalApplication } from '../../types';

import RentalDetails from './RentalDetails';
import AddRental from './AddRental';

const LIST_URL = API_ENDPOINTS.RENTAL_APPLICATION_SUMMARY_GET;
const SUMMARY_URL = API_ENDPOINTS.APPLICATION_STATUS_SUMMARY_GET;

type ViewMode = 'list' | 'details' | 'add';

type SummaryRow = { ApplicationStatus: string; Cnt: number };

const Rental: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  // default onload status
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
  const didFetchSummaryRef = useRef(false);

  const normalize = (s: string) => (s || '').toLowerCase().trim();

  const isAccountUser =
    String(localStorage.getItem('account') || '').trim().toUpperCase() === 'Y';

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const formData = new URLSearchParams();

      // ✅ VALIDATION
      if (!isAccountUser) {
        formData.append('UserName', localStorage.getItem('userName') || '');
      }
      // else: do NOT send UserName (show all)

      formData.append('ReturnRowCnt', '1000');
      formData.append('TransType', 'RENTAL,RMS');

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

  // Precompute tile values (aliases are case-insensitive)
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

  const fetchRentalProperties = useCallback(
    async (term = searchTerm, status = statusFilter) => {
      if (mode !== 'list') return;
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        const formData = new URLSearchParams();

        // ✅ VALIDATION
        if (!isAccountUser) {
          formData.append('UserName', localStorage.getItem('userName') || '');
        }
        // else: do NOT send UserName (show all)

        formData.append('ApplicationId', '');
        formData.append('TransType', 'Rental');
        formData.append('SearchKeyword', term);
        formData.append('ShowOnlyExpiringTrans', '');
        formData.append('ReturnRowCnt', '50');

        // Treat 'all' and 'allstatus' (and empty) as no-status-filter
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
        setError(err?.message || 'Failed to fetch rental applications');
        setProperties([]);
      } finally {
        setLoading(false);
      }
    },
    [mode, user, searchTerm, statusFilter, isAccountUser]
  );

  // ✅ NEW: manual search trigger (NO auto-search)
  const runSearch = useCallback(() => {
    fetchRentalProperties(searchTerm, statusFilter);
    fetchSummary();
  }, [fetchRentalProperties, fetchSummary, searchTerm, statusFilter]);

  // --- tiles clickable: update statusFilter + fetch immediately (like your S&P flow) ---
  const handleTileClick = useCallback(
    (statusValue: string) => {
      setStatusFilter(statusValue);
      fetchRentalProperties(searchTerm, statusValue);
    },
    [fetchRentalProperties, searchTerm]
  );

  // Initial load
  useEffect(() => {
    if (didFetchSummaryRef.current) return; // prevents StrictMode double-run
    didFetchSummaryRef.current = true;
    fetchSummary();
    fetchRentalProperties(); // keep your initial list load
  }, [fetchSummary, fetchRentalProperties]);

  const startAddNew = () => {
    setMode('add');
    setSelectedApplicationId(null);
  };

  const onBackFromChild = () => {
    setMode('list');
    setSelectedApplicationId(null);
    fetchRentalProperties();
    fetchSummary(); // keep tiles fresh after actions
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

  // Child views
  if (mode === 'details' && selectedApplicationId) {
    return <RentalDetails applicationId={selectedApplicationId} onBack={onBackFromChild} />;
  }
  if (mode === 'add') {
    return <AddRental onBack={onBackFromChild} />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Rental</h1>
        <button
          onClick={startAddNew}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          <span>New Rental Application</span>
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
          <p className="text-2xl font-bold text-green-600">{summaryLoading ? '…' : tiles.active}</p>
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
          onClick={() => handleTileClick('partial commission')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleTileClick('partial commission');
          }}
        >
          <p className="text-sm font-medium text-gray-600">Partial Commission paid</p>
          <p className="text-2xl font-bold text-yellow-600">
            {summaryLoading ? '…' : tiles.partialCommission}
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
          <p className="text-sm font-medium text-gray-600">Commission paid</p>
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
          <p className="text-2xl font-bold text-purple-600">{summaryLoading ? '…' : tiles.rejected}</p>
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
              <option value="allstatus">All Status</option>
              <option value="active">Active</option>
              <option value="pending review">Pending Review</option>
              <option value="partial commission">Partial Commission</option>
              <option value="pending commission">Pending Commission</option>
              <option value="commission paid">Commission Paid</option>
              <option value="rejected">Rejected</option>
              <option value="deal aborted">Deal Aborted</option>
            </select>
          </div>

          {/* ✅ NEW: Manual Search button */}
          <button
            onClick={runSearch}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Search className="w-5 h-5" />
            <span>Search</span>
          </button>

          <button
            onClick={() => {
              fetchRentalProperties();
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
          <p className="text-gray-600">Loading rental applications...</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Error Loading Data</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => {
              fetchRentalProperties();
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
                        {/* Row number */}
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

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-1">
                        <div className="flex items-center gap-1">
                          <Building size={14} />
                          <span>{property.PropertyType || 'N/A'}</span>
                        </div>

                        {/* ✅ TransType with icon + text */}
                        <div
                          className="flex items-center gap-1"
                          title={`Trans Type: ${String((property as any)?.TransType ?? 'N/A')}`}
                        >
                          {(() => {
                            const tt = String((property as any)?.TransType ?? '').trim().toLowerCase();
                            if (tt === 'rental' || tt === 'rms') return <Home size={14} className="text-gray-600" />;
                            if (tt === 'project') return <Briefcase size={14} className="text-gray-600" />;
                            if (tt === 'sales') return <Building size={14} className="text-gray-600" />;
                            return <Building size={14} className="text-gray-400" />;
                          })()}
                          <span>{String((property as any)?.TransType ?? 'N/A')}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <MapPin size={14} />
                          <span>{property.PropertyLocation || property.PropertyTown || 'N/A'}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          <span>{formatDate(property.AddDate)}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <User size={14} className="text-gray-500" />
                          <span>{property.DisplayName?.trim() ? property.DisplayName : 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600 mb-1">
                        {formatCurrency(property.AtlRentalAmt)}/mo
                      </p>

                      <p className="text-sm text-gray-500">Ref: {property.RefNo || property.ApplicationId}</p>

                      {(() => {
                        const pct = Number(property.FeesCollectionPctg) || 0;
                        const displayPct = pct.toFixed(2) + '%';
                        const isGood = pct >= 1.25;
                        const badgeClass = isGood ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';

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

                  {/* Action Buttons */}
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
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Rental Applications Found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || (statusFilter !== 'all' && statusFilter !== 'allstatus')
                  ? 'No applications match your current filters.'
                  : 'No rental applications have been created yet.'}
              </p>
              {(searchTerm || (statusFilter !== 'all' && statusFilter !== 'allstatus')) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('allstatus');
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

export default Rental;