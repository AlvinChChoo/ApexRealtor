import React, { useState } from 'react';
import { BarChart3, TrendingUp, Download, Calendar, DollarSign, Users, Building } from 'lucide-react';

const Reports: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedReport, setSelectedReport] = useState('overview');

  const reportTypes = [
    { id: 'overview', name: 'Overview', icon: BarChart3 },
    { id: 'sales', name: 'Sales Performance', icon: DollarSign },
    { id: 'agents', name: 'Agent Performance', icon: Users },
    { id: 'properties', name: 'Property Analytics', icon: Building },
  ];

  const generateReport = () => {
    // Mock report generation
    console.log(`Generating ${selectedReport} report for ${selectedPeriod}`);
  };

  const OverviewReport = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600">$2.8M</p>
              <p className="text-sm text-green-600">+12% vs last month</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Properties Sold</p>
              <p className="text-2xl font-bold text-blue-600">47</p>
              <p className="text-sm text-blue-600">+8% vs last month</p>
            </div>
            <Building className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Agents</p>
              <p className="text-2xl font-bold text-purple-600">23</p>
              <p className="text-sm text-purple-600">All performing</p>
            </div>
            <Users className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg. Sale Price</p>
              <p className="text-2xl font-bold text-orange-600">$680K</p>
              <p className="text-sm text-orange-600">+5% vs last month</p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Charts Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Monthly Sales Trend</h3>
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Sales trend chart would be displayed here</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Property Type Distribution</h3>
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Property distribution chart would be displayed here</p>
          </div>
        </div>
      </div>

      {/* Top Performers */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Performing Agents</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[
                { name: 'Sarah Johnson', sales: 18, revenue: '$1.2M', commission: '$42K' },
                { name: 'Mike Davis', sales: 15, revenue: '$980K', commission: '$34K' },
                { name: 'Emily Chen', sales: 12, revenue: '$750K', commission: '$26K' },
                { name: 'John Smith', sales: 8, revenue: '$520K', commission: '$18K' },
              ].map((agent, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-white">{agent.name.charAt(0)}</span>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{agent.sales}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{agent.revenue}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{agent.commission}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
        <button
          onClick={generateReport}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors"
        >
          <Download size={20} />
          <span>Export Report</span>
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
            <select
              value={selectedReport}
              onChange={(e) => setSelectedReport(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {reportTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Time Period</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          
          <div className="flex-none">
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-600">
                {selectedPeriod === 'month' ? 'Jan 1 - Jan 31, 2024' : 
                 selectedPeriod === 'week' ? 'Jan 22 - Jan 28, 2024' :
                 selectedPeriod === 'quarter' ? 'Q1 2024' : '2024'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Report Content */}
      {selectedReport === 'overview' && <OverviewReport />}
      
      {selectedReport !== 'overview' && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="mb-4">
            {reportTypes.find(type => type.id === selectedReport)?.icon && 
              React.createElement(reportTypes.find(type => type.id === selectedReport)!.icon, {
                className: "w-16 h-16 text-gray-400 mx-auto"
              })
            }
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            {reportTypes.find(type => type.id === selectedReport)?.name} Report
          </h3>
          <p className="text-gray-500">
            This report view is coming soon. The system will provide detailed analytics for {selectedPeriod} period.
          </p>
        </div>
      )}
    </div>
  );
};

export default Reports;