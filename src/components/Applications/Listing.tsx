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
  Home,
  Briefcase,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RentalApplication } from '../../types';

import RentalDetails from './RentalDetails';
import SalePurchaseDetails from './SalePurchaseDetails';
import AddRental from './AddRental';

const LIST_URL = API_ENDPOINTS.ALL_APPLICATION_SUMMARY_GET;
const SUMMARY_URL = API_ENDPOINTS.ALL_APPLICATION_STATUS_SUMMARY_GET;

type ViewMode = 'list' | 'details' | 'add';
type DetailsKind = 'rental' | 'sales';

type SummaryRow = { ApplicationStatus: string; Cnt: number };

const Listing: React.FC = () => {
  const { user } = useAuth();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [propertyAddress, setPropertyAddress] = useState('');
  const [location, setLocation] = useState('');
  const [submissionDateFrom, setSubmissionDateFrom] = useState('');
  const [submissionDateTo, setSubmissionDateTo] = useState('');
  const [payoutDateFrom, setPayoutDateFrom] = useState('');
  const [payoutDateTo, setPayoutDateTo] = useState('');
  const [lister, setLister] = useState('');
  const [closer, setCloser] = useState('');
  const [refNo, setRefNo] = useState('');
  const [transId, setTransId] = useState('');

  const [statusFilter, setStatusFilter] = useState('allstatus');
  const [typeFilter, setTypeFilter] = useState('');

  const [properties, setProperties] = useState<RentalApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<ViewMode>('list');
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [detailsKind, setDetailsKind] = useState<DetailsKind>('rental');

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

      if (!isAccountUser) {
        formData.append('UserName', localStorage.getItem('userName') || '');
      }

      formData.append('ReturnRowCnt', '1000');
      formData.append('TransType', 'RENTAL,RMS,SALES,PROJECT');

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

  const fetchRentalProperties = useCallback(
    async (status = statusFilter) => {
      if (mode !== 'list') return;
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        const formData = new URLSearchParams();

        if (!isAccountUser) {
          formData.append('UserName', localStorage.getItem('userName') || '');
        }

        formData.append('ApplicationId', '');
        formData.append('ShowOnlyExpiringTrans', '');
        formData.append('ReturnRowCnt', '50');

        const selectedType = String(typeFilter || '').trim();
        if (selectedType !== '') {
          formData.append('TransType', selectedType);
        }

        const isAll = status === 'all' || status === 'allstatus' || status === '';
        formData.append('ApplicationStatus', isAll ? '' : status);

        formData.append('PropertyAddress', propertyAddress.trim());
        formData.append('Location', location.trim());
        formData.append('SubmissionDateFrom_Temp', submissionDateFrom);
        formData.append('SubmissionDateTo_Temp', submissionDateTo);
        formData.append('PayoutDateFrom_Temp', payoutDateFrom);
        formData.append('PayoutDateTo_Temp', payoutDateTo);
        formData.append('TransId_Temp', transId.trim());
        formData.append('Lister', lister.trim());
        formData.append('Closer', closer.trim());
        formData.append('RefNo', refNo.trim());

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
    [
      mode,
      user,
      statusFilter,
      typeFilter,
      isAccountUser,
      propertyAddress,
      location,
      submissionDateFrom,
      submissionDateTo,
      payoutDateFrom,
      payoutDateTo,
      lister,
      closer,
      refNo,
      transId,
    ]
  );

  const runSearch = useCallback(() => {
    void fetchRentalProperties(statusFilter);
  }, [fetchRentalProperties, statusFilter]);

  const handleTileClick = useCallback(
    (statusValue: string) => {
      setStatusFilter(statusValue);
      void fetchRentalProperties(statusValue);
    },
    [fetchRentalProperties]
  );

  useEffect(() => {
    if (didFetchSummaryRef.current) return;
    didFetchSummaryRef.current = true;
    void fetchSummary();
  }, [fetchSummary]);

  const startAddNew = () => {
    setMode('add');
    setSelectedApplicationId(null);
  };

  const onBackFromChild = () => {
    setMode('list');
    setSelectedApplicationId(null);
    void fetchRentalProperties();
    void fetchSummary();
  };

  const detectDetailsKind = (row: any): DetailsKind => {
    const tt = String(row?.TransType ?? '').trim().toLowerCase();
    if (tt === 'rental' || tt === 'rms') return 'rental';
    if (tt === 'sales' || tt === 'project') return 'sales';
    return 'rental';
  };

  const openDetails = (row: any) => {
    const appId = String(row?.ApplicationId ?? '').trim();
    if (!appId) return;

    const kind = detectDetailsKind(row);
    setDetailsKind(kind);
    setSelectedApplicationId(appId);
    setMode('details');
  };

  const clearFilters = () => {
    setPropertyAddress('');
    setLocation('');
    setSubmissionDateFrom('');
    setSubmissionDateTo('');
    setPayoutDateFrom('');
    setPayoutDateTo('');
    setLister('');
    setCloser('');
    setRefNo('');
    setTransId('');
    setStatusFilter('allstatus');
    setTypeFilter('');
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

  const getScrollableParent = useCallback((element: HTMLElement | null): HTMLElement | null => {
    if (!element) return null;

    let parent = element.parentElement;

    while (parent) {
      const style = window.getComputedStyle(parent);
      const overflowY = style.overflowY;
      const isScrollable =
        (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
        parent.scrollHeight > parent.clientHeight;

      if (isScrollable) {
        return parent;
      }

      parent = parent.parentElement;
    }

    return null;
  }, []);

  const handleScrollToTop = useCallback(() => {
    const currentRoot = rootRef.current;

    if (currentRoot) {
      const scrollParent = getScrollableParent(currentRoot);

      if (scrollParent) {
        scrollParent.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      }
    }

    if (currentRoot) {
      currentRoot.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }

    document.documentElement.scrollTo({
      top: 0,
      behavior: 'smooth',
    });

    document.body.scrollTo({
      top: 0,
      behavior: 'smooth',
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, [getScrollableParent]);

  if (mode === 'details' && selectedApplicationId) {
    return detailsKind === 'sales' ? (
      <SalePurchaseDetails applicationId={selectedApplicationId} onBack={onBackFromChild} />
    ) : (
      <RentalDetails applicationId={selectedApplicationId} onBack={onBackFromChild} />
    );
  }

  if (mode === 'add') {
    return <AddRental onBack={onBackFromChild} />;
  }

  return (
    <div ref={rootRef} className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Listing</h1>
        <button
          onClick={startAddNew}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors"
          type="button"
        >
          <Plus size={20} />
          <span>New Listing Application</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer"
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
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer"
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
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer"
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
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer"
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
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer"
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
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer"
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
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer"
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

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property Address</label>
            <input
              type="text"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch();
              }}
              placeholder="Enter property address"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch();
              }}
              placeholder="Enter location"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ref No</label>
            <input
              type="text"
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch();
              }}
              placeholder="Enter reference no"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trans Id</label>
            <input
              type="text"
              value={transId}
              onChange={(e) => setTransId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch();
              }}
              placeholder="Enter trans id"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lister</label>
            <input
              type="text"
              value={lister}
              onChange={(e) => setLister(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch();
              }}
              placeholder="Enter lister"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Closer</label>
            <input
              type="text"
              value={closer}
              onChange={(e) => setCloser(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch();
              }}
              placeholder="Enter closer"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <div className="flex items-center space-x-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <div className="flex items-center space-x-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Show All</option>
                <option value="RENTAL">Rental</option>
                <option value="SALES">Sale</option>
                <option value="RMS">RMS</option>
                <option value="PROJECT">Project</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-5">
          <button
            onClick={runSearch}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            type="button"
          >
            <Search className="w-5 h-5" />
            <span>Search</span>
          </button>

          <button
            onClick={clearFilters}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            type="button"
          >
            Clear
          </button>

          <button
            onClick={() => {
              void fetchRentalProperties();
              void fetchSummary();
            }}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            type="button"
          >
            Refresh
          </button>
        </div>
      </div>

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
              void fetchRentalProperties();
              void fetchSummary();
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            type="button"
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

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-1">
                        <div className="flex items-center gap-1">
                          <Building size={14} />
                          <span>{property.PropertyType || 'N/A'}</span>
                        </div>

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
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600 mb-1">
                        {(() => {
                          const tt = String((property as any)?.TransType ?? '').trim().toLowerCase();
                          const isRental = tt === 'rental' || tt === 'rms';
                          return isRental
                            ? `${formatCurrency(property.AtlRentalAmt)}/mo`
                            : formatCurrency(property.AtlRentalAmt);
                        })()}
                      </p>

                      <p className="text-sm text-gray-500">Ref: {property.RefNo || property.ApplicationId}</p>
                    </div>
                  </div>

                  {(() => {
                    const listerDisplayName = String((property as any)?.ListerDisplayName ?? '').trim();
                    const closerDisplayName = String((property as any)?.CloserDisplayName ?? '').trim();
                    const tt = String((property as any)?.TransType ?? '').trim().toLowerCase();

                    const pct = Number((property as any)?.FeesCollectionPctg) || 0;
                    const pctCloser = Number((property as any)?.FeesCollectionPctgCloser) || 0;

                    const isRental = tt === 'rental' || tt === 'rms';

                    const displayPct = isRental
                      ? `${pct.toFixed(2)} mth(s)`
                      : `${pct.toFixed(2)} %`;

                    const displayPctCloser = isRental
                      ? `${pctCloser.toFixed(2)} mth(s)`
                      : `${pctCloser.toFixed(2)} %`;

                    const isGood = pct >= 1.25;

                    const badgeClass = isGood
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800';

                    const badgeClassCloser = 'bg-orange-200 text-orange-900';

                    return (
                      <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div className="text-sm text-gray-700 text-left flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
                          <div>
                            <span className="font-semibold">Lister :</span>{' '}
                            <span>{listerDisplayName || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="font-semibold">Closer :</span>{' '}
                            <span>{closerDisplayName || 'N/A'}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 self-start lg:self-auto">
                          <div
                            className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold shadow-sm ${badgeClass}`}
                          >
                            Collection (Lister) : {displayPct}
                          </div>

                          <div
                            className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold shadow-sm ${badgeClassCloser}`}
                          >
                            Collection (Closer) : {displayPctCloser}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex space-x-2 mt-4">
                    <button
                      onClick={() => openDetails(property)}
                      className="flex-1 bg-blue-50 text-blue-600 py-2 px-3 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center space-x-1"
                      type="button"
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
                {propertyAddress ||
                location ||
                submissionDateFrom ||
                submissionDateTo ||
                payoutDateFrom ||
                payoutDateTo ||
                lister ||
                closer ||
                refNo ||
                transId ||
                typeFilter ||
                (statusFilter !== 'all' && statusFilter !== 'allstatus')
                  ? 'No applications match your current filters.'
                  : 'No rental applications have been created yet.'}
              </p>

              {(propertyAddress ||
                location ||
                submissionDateFrom ||
                submissionDateTo ||
                payoutDateFrom ||
                payoutDateTo ||
                lister ||
                closer ||
                refNo ||
                transId ||
                typeFilter ||
                (statusFilter !== 'all' && statusFilter !== 'allstatus')) && (
                <button
                  onClick={clearFilters}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  type="button"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </>
      )}

      <button
        type="button"
        onClick={handleScrollToTop}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl"
        aria-label="Scroll to top"
        title="Scroll to top"
      >
        <ChevronUp size={24} />
      </button>
    </div>
  );
};

export default Listing;