import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useState, useMemo } from 'react';
import HotSpotBySubburb from './HotSpotBySubburb';
import {
  TrendingUp,
  Calendar,
  Users,
  Download,
  Search,
  Percent,
  MapPin,
  List,
} from 'lucide-react';

interface FeesCollectedByPctgRow {
  UserName: string;
  TransType: string;
  Nric_Name: string;
  Display_Name: string;
  FeesCollectionPctg: number;
  TotalCount: number;
}

type ReportTab = 'fees-collected' | 'hotspot-subburb' | 'hotspot-listing';

const FEES_COLLECTED_GET_URL =
  API_ENDPOINTS.FEES_COLLECTED_BY_PCTG_GET;

const PerformanceReport: React.FC = () => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = String(today.getMonth() + 1).padStart(2, '0');

  const [activeTab, setActiveTab] = useState<ReportTab>('fees-collected');

  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [minimumPctgCollection, setMinimumPctgCollection] =
    useState<string>('1');
  const [selectedType, setSelectedType] = useState<string>('Show All');
  
  const [reportData, setReportData] = useState<FeesCollectedByPctgRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const years = useMemo(
    () => Array.from({ length: 10 }, (_, i) => currentYear - i),
    [currentYear]
  );

  const months = useMemo(
    () => [
      { value: '01', label: 'January' },
      { value: '02', label: 'February' },
      { value: '03', label: 'March' },
      { value: '04', label: 'April' },
      { value: '05', label: 'May' },
      { value: '06', label: 'June' },
      { value: '07', label: 'July' },
      { value: '08', label: 'August' },
      { value: '09', label: 'September' },
      { value: '10', label: 'October' },
      { value: '11', label: 'November' },
      { value: '12', label: 'December' },
    ],
    []
  );

  const monthLabel =
    months.find((m) => m.value === selectedMonth)?.label || selectedMonth;

  const periodLabel = `${monthLabel} ${selectedYear}`;

  const filteredData = useMemo(() => {
  return reportData;
}, [reportData]);

  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, row) => ({
        totalCount: acc.totalCount + (row.TotalCount || 0),
        totalPctg: acc.totalPctg + (row.FeesCollectionPctg || 0),
      }),
      {
        totalCount: 0,
        totalPctg: 0,
      }
    );
  }, [filteredData]);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('Mth', String(parseInt(selectedMonth, 10)));
      formData.append('Year', selectedYear);
      formData.append('MinimumPctgCollection', minimumPctgCollection || '1');
      formData.append('Type', selectedType === 'Show All' ? '' : selectedType);

      const response = await fetch(FEES_COLLECTED_GET_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const result = await response.json();

      if (result.status !== 'success') {
        throw new Error(result.message || 'Failed to fetch report data.');
      }

      const rows: FeesCollectedByPctgRow[] = Array.isArray(result.data)
        ? result.data.map((item: any) => ({
            UserName: item.UserName ?? '',
            TransType: item.TransType ?? '',
            Nric_Name: item.NRIC_Name ?? item.Nric_Name ?? '',
            Display_Name: item.Display_Name ?? '',
            FeesCollectionPctg: Number(item.FeesCollectionPctg ?? 0),
            TotalCount: Number(item.TotalCount ?? 0),
          }))
        : [];

      setReportData(rows);
    } catch (err: any) {
      setReportData([]);
      setError(err?.message || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
  setReportData([]);
  setError(null);
  setMinimumPctgCollection('1');
  setSelectedType('Show All');
};

  const handleExport = () => {
    if (filteredData.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = [
      'UserName',
      'TransType',
      'Nric_Name',
      'Display_Name',
      'FeesCollectionPctg',
      'TotalCount',
    ];

    const rows = filteredData.map((row) => [
      row.UserName,
      row.TransType,
      row.Nric_Name,
      row.Display_Name,
      row.FeesCollectionPctg.toFixed(2),
      row.TotalCount.toString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `FeesCollectedByPctgReport_${selectedYear}_${selectedMonth}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const formatPctg = (num: number) => {
    return `${Number(num || 0).toFixed(2)}%`;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="text-blue-600" size={32} />
            <h1 className="text-3xl font-bold text-gray-800">
              Performance Report
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md mb-6 overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex flex-wrap">
              <button
                type="button"
                onClick={() => setActiveTab('fees-collected')}
                className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'fees-collected'
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                Fees Collected
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('hotspot-subburb')}
                className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'hotspot-subburb'
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                Hot Spot (By Subburb)
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('hotspot-listing')}
                className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'hotspot-listing'
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                Hot Spot (By Listing)
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'fees-collected' && (
          <>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar size={16} className="inline mr-1" />
                    Year
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar size={16} className="inline mr-1" />
                    Month
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {months.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Percent size={16} className="inline mr-1" />
                    Minimum % Collection
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={minimumPctgCollection}
                    onChange={(e) => setMinimumPctgCollection(e.target.value)}
                    placeholder="Enter minimum %"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type
                  </label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Show All">Show All</option>
                    <option value="Rental">Rental</option>
                    <option value="Sales">Sale</option>
                  </select>
                </div>

                

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    &nbsp;
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSearch}
                      disabled={loading}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
                    >
                      <Search size={16} />
                      Search
                    </button>

                    <button
                      onClick={handleRefresh}
                      type="button"
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-4 flex justify-end">
              <button
                onClick={handleExport}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Download size={16} />
                Export to CSV
              </button>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredData.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No records found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Display Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          NRIC Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Trans Type
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fees Collection %
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Count
                        </th>
                      </tr>
                    </thead>

                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredData.map((record, index) => (
                        <tr
                          key={`${record.UserName}-${record.TransType}-${record.FeesCollectionPctg}-${index}`}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium whitespace-nowrap">
                            {record.UserName || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                            {record.Display_Name || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                            {record.Nric_Name || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                            {record.TransType || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-900 whitespace-nowrap">
                            {formatPctg(record.FeesCollectionPctg)}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900 whitespace-nowrap">
                            {formatNumber(record.TotalCount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td
                          colSpan={4}
                          className="px-6 py-4 text-sm font-bold text-gray-800 text-right"
                        >
                          Totals
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-right text-green-700 whitespace-nowrap">
                          {formatPctg(totals.totalPctg)}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-right text-blue-700 whitespace-nowrap">
                          {formatNumber(totals.totalCount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {filteredData.length > 0 && (
              <div className="mt-4 text-sm text-gray-600">
                Showing {filteredData.length} record(s) for {periodLabel}
              </div>
            )}
          </>
        )}

        {activeTab === 'hotspot-subburb' && <HotSpotBySubburb />}

        {activeTab === 'hotspot-listing' && (
          <div className="bg-white rounded-lg shadow-md p-10 text-center">
            <List size={48} className="mx-auto mb-4 text-blue-500 opacity-70" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Hot Spot (By Listing)
            </h2>
            <p className="text-gray-500">
              This tab is ready. You can place your listing hotspot report here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceReport;