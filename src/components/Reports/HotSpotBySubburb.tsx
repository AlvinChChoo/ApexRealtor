import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useMemo, useState } from 'react';
import { MapPin, Search, RefreshCw, BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from 'recharts';

interface HotSpotBySubburbRow {
  PropertyLocation: string;
  TransType: string;
  TotalCount: number;
}

interface HotSpotBySubburbResponse {
  status?: string;
  message?: string;
  data?: HotSpotBySubburbRow[];
}

interface ChartRow {
  PropertyLocation: string;
  Rent: number;
  SaleProject: number;
  Total: number;
}

const HOT_SPOT_BY_SUBBURB_GET_URL =
  API_ENDPOINTS.HOT_SPOT_BY_SUBBURB_GET;

const HotSpotBySubburb: React.FC = () => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = String(today.getMonth() + 1);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [rows, setRows] = useState<HotSpotBySubburbRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const monthOptions = useMemo(
    () => [
      { value: '1', label: 'January' },
      { value: '2', label: 'February' },
      { value: '3', label: 'March' },
      { value: '4', label: 'April' },
      { value: '5', label: 'May' },
      { value: '6', label: 'June' },
      { value: '7', label: 'July' },
      { value: '8', label: 'August' },
      { value: '9', label: 'September' },
      { value: '10', label: 'October' },
      { value: '11', label: 'November' },
      { value: '12', label: 'December' },
    ],
    []
  );

  const yearOptions = useMemo(() => {
    const years: string[] = [];
    for (let year = currentYear + 1; year >= currentYear - 10; year--) {
      years.push(String(year));
    }
    return years;
  }, [currentYear]);

  const selectedMonthLabel = useMemo(() => {
    return (
      monthOptions.find((m) => m.value === selectedMonth)?.label?.toUpperCase() || ''
    );
  }, [monthOptions, selectedMonth]);

  const chartData = useMemo<ChartRow[]>(() => {
    const grouped: Record<string, ChartRow> = {};

    rows.forEach((row) => {
      const location = (row.PropertyLocation || '').trim() || '-';
      const transType = (row.TransType || '').trim().toLowerCase();
      const totalCount = Number(row.TotalCount || 0);

      if (!grouped[location]) {
        grouped[location] = {
          PropertyLocation: location,
          Rent: 0,
          SaleProject: 0,
          Total: 0,
        };
      }

      if (transType === 'rental' || transType === 'rent') {
        grouped[location].Rent += totalCount;
      } else if (
        transType === 'sales' ||
        transType === 'sale' ||
        transType === 'sale/project' ||
        transType === 'project'
      ) {
        grouped[location].SaleProject += totalCount;
      }

      grouped[location].Total =
        grouped[location].Rent + grouped[location].SaleProject;
    });

    return Object.values(grouped).sort((a, b) =>
      a.PropertyLocation.localeCompare(b.PropertyLocation)
    );
  }, [rows]);

  const totalUnits = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.Total, 0);
  }, [chartData]);

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    setRows([]);

    try {
      const formData = new FormData();
      formData.append('Mth', selectedMonth);
      formData.append('Year', selectedYear);

      const response = await fetch(HOT_SPOT_BY_SUBBURB_GET_URL, {
        method: 'POST',
        body: formData,
      });

      const result: HotSpotBySubburbResponse = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || 'Failed to load data.');
      }

      if ((result.status || '').toLowerCase() !== 'success') {
        throw new Error(result?.message || 'Failed to retrieve data.');
      }

      setRows(Array.isArray(result.data) ? result.data : []);
      setMessage(result?.message || 'Data retrieved successfully.');
    } catch (err: any) {
      setError(err?.message || 'Unable to retrieve data.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedMonth(currentMonth);
    setSelectedYear(String(currentYear));
    setRows([]);
    setError('');
    setMessage('');
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const rent = payload.find((p: any) => p.dataKey === 'Rent')?.value || 0;
    const saleProject =
      payload.find((p: any) => p.dataKey === 'SaleProject')?.value || 0;

    return (
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg">
        <div className="text-sm font-bold text-gray-800 mb-2">{label}</div>
        <div className="text-sm text-blue-700">Rent: {rent}</div>
        <div className="text-sm text-gray-700">Sale/Project: {saleProject}</div>
        <div className="mt-2 border-t pt-2 text-sm font-semibold text-gray-900">
          Total: {Number(rent) + Number(saleProject)}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-full bg-blue-50">
          <MapPin size={26} className="text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Hot Spot By Subburb</h2>
          <p className="text-sm text-gray-500">
            Search payout hot spot data by month and year
          </p>
        </div>
      </div>

      {/* Search Panel */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 md:col-span-2">
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-white font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Search size={18} />
              )}
              {loading ? 'Searching...' : 'Search'}
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-200 px-5 py-2.5 text-gray-800 font-semibold hover:bg-gray-300 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw size={18} />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {!error && message && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">
          {message}
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 md:p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={22} className="text-gray-700" />
                <h3 className="text-3xl md:text-5xl font-extrabold text-gray-800 leading-tight">
                  Hot Spot (Sale/Rent)
                </h3>
              </div>
              <div className="text-xl md:text-3xl font-bold text-gray-700 tracking-wide">
                {selectedMonthLabel} {selectedYear}{' '}
                <span className="text-gray-500 font-semibold">
                  ({totalUnits} Units)
                </span>
              </div>
            </div>
          </div>

          <div className="w-full h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 30, right: 20, left: 0, bottom: 20 }}
                barCategoryGap="20%"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="PropertyLocation"
                  tick={{ fontSize: 13, fill: '#4b5563' }}
                  interval={0}
                  angle={0}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 13, fill: '#4b5563' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  dataKey="Rent"
                  name="Rent"
                  fill="#0B57A3"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                >
                  <LabelList
                    dataKey="Rent"
                    position="top"
                    style={{ fill: '#0B57A3', fontSize: 14, fontWeight: 700 }}
                  />
                </Bar>
                <Bar
                  dataKey="SaleProject"
                  name="Sale/Project"
                  fill="#6B6B6B"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                >
                  <LabelList
                    dataKey="SaleProject"
                    position="top"
                    style={{ fill: '#6B6B6B', fontSize: 14, fontWeight: 700 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">
                No.
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">
                Property Location
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">
                Trans Type
              </th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">
                Total Count
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row, index) => (
                <tr
                  key={`${row.PropertyLocation}-${row.TransType}-${index}`}
                  className="border-t border-gray-200 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 text-gray-700">{index + 1}</td>
                  <td className="px-4 py-3 text-gray-800">
                    {row.PropertyLocation || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-800">{row.TransType || '-'}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {Number(row.TotalCount || 0).toLocaleString()}
                  </td>
                </tr>
              ))
            ) : ( 
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                  {loading
                    ? 'Loading data...'
                    : 'No data found. Please select Month and Year, then click Search.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HotSpotBySubburb;