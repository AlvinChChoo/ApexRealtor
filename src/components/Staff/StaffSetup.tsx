import React, { useState } from 'react';
import { Plus, Search, Edit, Trash2, User, Percent } from 'lucide-react';
import { Staff } from '../../types';

const StaffSetup: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'staff' | 'percentages'>('staff');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const staffMembers: Staff[] = [
    {
      id: '1',
      name: 'Sarah Johnson',
      email: 'sarah.johnson@interealtor.com',
      role: 'Senior Agent',
      renPercentage: 3.5,
      isActive: true,
      joinDate: '2023-01-15'
    },
    {
      id: '2',
      name: 'Mike Davis',
      email: 'mike.davis@interealtor.com',
      role: 'Agent',
      renPercentage: 2.8,
      isActive: true,
      joinDate: '2023-03-20'
    },
    {
      id: '3',
      name: 'Emily Chen',
      email: 'emily.chen@interealtor.com',
      role: 'Junior Agent',
      renPercentage: 2.2,
      isActive: true,
      joinDate: '2023-06-10'
    },
    {
      id: '4',
      name: 'John Smith',
      email: 'john.smith@interealtor.com',
      role: 'Manager',
      renPercentage: 4.0,
      isActive: false,
      joinDate: '2022-08-05'
    }
  ];

  const filteredStaff = staffMembers.filter(staff =>
    staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const StaffTable = () => (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Join Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredStaff.map((staff) => (
              <tr key={staff.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-white">{staff.name.charAt(0)}</span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{staff.name}</div>
                      <div className="text-sm text-gray-500">{staff.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{staff.role}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                    staff.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {staff.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(staff.joinDate).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button className="text-blue-600 hover:text-blue-900">
                      <Edit size={16} />
                    </button>
                    <button className="text-red-600 hover:text-red-900">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const PercentageCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredStaff.map((staff) => (
        <div key={staff.id} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-lg font-bold text-white">{staff.name.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{staff.name}</h3>
                  <p className="text-sm text-gray-500">{staff.role}</p>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                staff.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {staff.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">REN Percentage</span>
                <Percent className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-blue-600">{staff.renPercentage}%</span>
                <button className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-100 transition-colors">
                  <Edit size={14} />
                </button>
              </div>
            </div>
            
            <div className="mt-4 text-sm text-gray-500">
              <p>Joined: {new Date(staff.joinDate).toLocaleDateString()}</p>
              <p>Email: {staff.email}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Staff Setup</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          <span>Add Staff</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-lg">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('staff')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'staff'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <User size={16} />
                <span>Staff Accounts</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('percentages')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'percentages'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Percent size={16} />
                <span>REN Percentages</span>
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search staff members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {activeTab === 'staff' ? <StaffTable /> : <PercentageCards />}
        </div>
      </div>

      {filteredStaff.length === 0 && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <p className="text-gray-500 text-lg">No staff members found matching your search.</p>
        </div>
      )}
    </div>
  );
};

export default StaffSetup;