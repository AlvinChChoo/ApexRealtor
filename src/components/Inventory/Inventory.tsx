import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useState, useEffect, useMemo } from 'react';
import { Package, Plus, Edit, Trash2, Search } from 'lucide-react';
import InventoryAdj from './InventoryAdj';

interface InventoryItem {
  id: number;
  name: string;
  itemCategory: string; // ✅ NEW (matches DB/API)
  price: string;
  quantity: number;
  unit: string;
  location: string;
  status: 'Y' | 'N' | string;
}



// 🔹 API endpoints
const INVENTORY_API_URL = API_ENDPOINTS.INT_INVENTORY_LEGACY_GET;
const INVENTORY_INSERT_API_URL = API_ENDPOINTS.INT_INVENTORY_INSERT;
const INVENTORY_SET_API_URL = API_ENDPOINTS.INT_INVENTORY_SET;

const statusToYN = (v: 'Active' | 'Non Active' | string) => (v === 'Non Active' ? 'N' : 'Y');

const normalizeStatus = (v: any): 'Active' | 'Non Active' | string => {
  const s = (v ?? '').toString().trim();
  if (!s) return 'Active';
  if (s.toUpperCase() === 'Y') return 'Active';
  if (s.toUpperCase() === 'N') return 'Non Active';
  if (s.toLowerCase() === 'active') return 'Active';
  if (s.toLowerCase() === 'non active' || s.toLowerCase() === 'inactive') return 'Non Active';
  return s;
};

const Inventory: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'adjustment'>('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const defaultInventory: InventoryItem[] = [
    { id: 1, name: 'Laptop - Dell XPS 15', category: 'Electronics', price: '0.00', quantity: 15, unit: 'pcs', location: 'Warehouse A', status: 'Active' },
    { id: 2, name: 'Office Chair - Ergonomic', category: 'Furniture', price: '0.00', quantity: 45, unit: 'pcs', location: 'Warehouse B', status: 'Active' },
    { id: 3, name: 'Printer - HP LaserJet', category: 'Electronics', price: '0.00', quantity: 8, unit: 'pcs', location: 'Warehouse A', status: 'Active' },
    { id: 4, name: 'Desk - Standing Desk', category: 'Furniture', price: '0.00', quantity: 20, unit: 'pcs', location: 'Warehouse B', status: 'Active' },
    { id: 5, name: 'Monitor - 27" 4K', category: 'Electronics', price: '0.00', quantity: 30, unit: 'pcs', location: 'Warehouse A', status: 'Active' },
    { id: 6, name: 'Keyboard - Mechanical', category: 'Electronics', price: '0.00', quantity: 50, unit: 'pcs', location: 'Warehouse C', status: 'Active' },
    { id: 7, name: 'Mouse - Wireless', category: 'Electronics', price: '0.00', quantity: 60, unit: 'pcs', location: 'Warehouse C', status: 'Active' },
    { id: 8, name: 'Filing Cabinet', category: 'Furniture', price: '0.00', quantity: 12, unit: 'pcs', location: 'Warehouse B', status: 'Active' },
    { id: 9, name: 'Whiteboard - Large', category: 'Office Supplies', price: '0.00', quantity: 10, unit: 'pcs', location: 'Warehouse A', status: 'Active' },
    { id: 10, name: 'Conference Table', category: 'Furniture', price: '0.00', quantity: 5, unit: 'pcs', location: 'Warehouse B', status: 'Active' },
  ];

  const [inventory, setInventory] = useState<InventoryItem[]>(defaultInventory);

  // 🔹 Add Item modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  // ✅ REMOVED: newItemLocation state (Add modal no longer has branch/location input)
  const [newItemStatus, setNewItemStatus] = useState<'Active' | 'Non Active'>('Active');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 🔹 Edit Item modal state (keep location input)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemCategory, setEditItemCategory] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [editItemQty, setEditItemQty] = useState('');
  const [editItemLocation, setEditItemLocation] = useState('');
  const [editItemStatus, setEditItemStatus] = useState<'Active' | 'Non Active'>('Active');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // 🔹 Load data from inventoryGet.php on page load
  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const res = await fetch(INVENTORY_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ ItemName: '', ItemId: '' }).toString(),
        });

        if (!res.ok) throw new Error(`HTTP error ${res.status}`);

        const json = await res.json();

        if (json.status === 'success' && Array.isArray(json.data)) {
          const mapped: InventoryItem[] = json.data.map((row: any, index: number) => {
            const status = normalizeStatus(row.Status ?? row.Active ?? 'Active');

            return {
              id: Number(row.ItemId ?? index + 1),
              name: row.ItemName ?? '',
              itemCategory: row.ItemCategory ?? row.Desc ?? row.Description ?? '',

              price: row.UnitPrice ?? '0.00',
              quantity: Number(row.StockQty ?? 0),
              unit: 'pcs',
              location: row.MdBranch ?? 'Main Warehouse',
              status,
            };
          });

          setInventory(mapped);
        }
      } catch (err) {
        console.error('Failed to load inventory:', err);
      }
    };

    fetchInventory();
  }, []);

  const filteredInventory = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return inventory.filter((item) => {
      const name = String(item.name || '').toLowerCase();
      const itemCategory = String(item.itemCategory || '').toLowerCase();
      const location = String(item.location || '').toLowerCase();

      const matchesSearch =
        !query ||
        name.includes(query) ||
        category.includes(query) ||
        location.includes(query);

      const isActive = item.status === 'Active' || item.status === 'Y';

      const matchesActive =
        activeFilter === 'all' ||
        (activeFilter === 'active' && isActive) ||
        (activeFilter === 'inactive' && !isActive);

      return matchesSearch && matchesActive;
    });
  }, [inventory, searchTerm, activeFilter]);

  // 🔹 Add Item modal handlers
  const openAddModal = () => {
    setNewItemName('');
    setNewItemCategory('');
    setNewItemPrice('');
    setNewItemQty('');
    setNewItemStatus('Active');
    setSaveError(null);
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    if (saving) return;
    setShowAddModal(false);
  };

  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newItemName.trim()) {
      setSaveError('Item Name is required');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const body = new URLSearchParams({
        // ✅ Hardcode branch since Add modal no longer keys it in
        MdBranch: 'Main Warehouse',
        ItemName: newItemName,
        UnitPrice: newItemPrice || '0.00',
        StockQty: newItemQty || '0',
        Description: newItemCategory || '',
        // ✅ FIXED: use newItemStatus (not editItemStatus)
        Status: statusToYN(newItemStatus),
        CreatedId: 'system',
      });

      const res = await fetch(INVENTORY_INSERT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);

      const json = await res.json();

      if (json.status === 'success' && json.data) {
        const row = json.data;

        const newItem: InventoryItem = {
          id: Number(row.ItemId ?? Date.now()),
          name: row.ItemName ?? newItemName,
          itemCategory: row.ItemCategory ?? row.Desc ?? row.Description ?? newItemCategory,

          price: row.UnitPrice ?? (newItemPrice || '0.00'),
          quantity: Number(row.StockQty ?? (newItemQty || 0)),
          unit: 'pcs',
          location: row.MdBranch ?? 'Main Warehouse',
          status: normalizeStatus(row.Status ?? row.Active ?? newItemStatus),
        };

        setInventory((prev) => [...prev, newItem]);
        setShowAddModal(false);
      } else {
        setSaveError(json.error || 'Failed to save item');
      }
    } catch (err: any) {
      console.error('Failed to save item:', err);
      setSaveError(err.message || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  // 🔹 Edit Item modal handlers
  const openEditModal = (item: InventoryItem) => {
    setEditItem(item);
    setEditItemName(item.name);
    setEditItemCategory(item.itemCategory);

    setEditItemPrice(item.price);
    setEditItemQty(String(item.quantity));
    setEditItemLocation(item.location);
    setEditItemStatus((normalizeStatus(item.status) as any) === 'Non Active' ? 'Non Active' : 'Active');
    setEditError(null);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    if (editSaving) return;
    setShowEditModal(false);
    setEditItem(null);
  };

  const handleEditItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editItem) {
      setEditError('No item selected');
      return;
    }

    if (!editItemName.trim()) {
      setEditError('Item Name is required');
      return;
    }

    setEditSaving(true);
    setEditError(null);

    try {
      const body = new URLSearchParams({
        ItemId: String(editItem.id),
        MdBranch: editItemLocation || 'Main Warehouse',
        ItemName: editItemName,
        UnitPrice: editItemPrice || '0.00',
        StockQty: editItemQty || '0',
        Description: editItemCategory || '',
        // NOTE: keep as your current behavior (if PHP expects Active/Non Active, leave it)
        // If PHP expects Y/N, change to: Status: statusToYN(editItemStatus)
        Status: editItemStatus,
        CreatedId: 'system',
      });

      const res = await fetch(INVENTORY_SET_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);

      const json = await res.json();

      if (json.status === 'success' && json.data) {
        const row = json.data;

        const updatedItem: InventoryItem = {
          id: Number(row.ItemId ?? editItem.id),
          name: row.ItemName ?? editItemName,
          itemCategory: row.ItemCategory ?? row.Desc ?? row.Description ?? editItemCategory,

          price: row.UnitPrice ?? (editItemPrice || '0.00'),
          quantity: Number(row.StockQty ?? (editItemQty || 0)),
          unit: 'pcs',
          //location: row.MdBranch ?? (editItemLocation || 'Main Warehouse'),
          status: normalizeStatus(row.Status ?? row.Active ?? editItemStatus),
        };

        setInventory((prev) => prev.map((it) => (it.id === updatedItem.id ? updatedItem : it)));

        alert('Inventory record updated successfully.');

        setShowEditModal(false);
        setEditItem(null);
      } else {
        setEditError(json.error || 'Failed to update item');
      }
    } catch (err: any) {
      console.error('Failed to update item:', err);
      setEditError(err.message || 'Failed to update item');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <Package className="text-blue-600" size={32} />
              Inventory Management
            </h1>
            <p className="text-gray-600 mt-1">Manage your property and office inventory</p>
          </div>
          {activeTab === 'inventory' && (
            <button
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              onClick={openAddModal}
            >
              <Plus size={20} />
              Add New Inventory
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-6 py-3 font-medium text-sm transition-colors relative ${
              activeTab === 'inventory'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Inventory
          </button>
          <button
            onClick={() => setActiveTab('adjustment')}
            className={`px-6 py-3 font-medium text-sm transition-colors relative ${
              activeTab === 'adjustment'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Inventory Adjustment
          </button>
        </div>
      </div>

      {activeTab === 'inventory' ? (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search inventory..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value as 'all' | 'active' | 'inactive')}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Show All</option>
                <option value="active">Active</option>
                <option value="inactive">Non Active</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  Item Category
</th>

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item Name
                </th>
                
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Active
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInventory.map((item) => {
                const isActive = item.status === 'Active' || item.status === 'Y';
                return (
                  <tr key={item.id} className="hover:bg-gray-50">


                    {/* ✅ NEW */}
<td className="px-6 py-4 whitespace-nowrap">
  <div className="text-sm text-gray-900">{item.itemCategory}</div>
</td>

                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.price}</div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {item.quantity} {item.unit}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {isActive ? 'Active' : 'Non Active'}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-blue-600 hover:text-blue-900"
                          onClick={() => openEditModal(item)}
                        >
                          <Edit size={18} />
                        </button>
                        <button type="button" className="text-red-600 hover:text-red-900">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredInventory.length === 0 && (
          <div className="text-center py-12 text-gray-500">No items found matching your search.</div>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Showing {filteredInventory.length} of {inventory.length} items
      </div>

      {/* 🔹 Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Add New Inventory Item</h2>

            <form onSubmit={handleAddItemSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category / Description</label>
                <input
                  type="text"
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="w-full border bordergray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min={0}
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* ✅ NEW: Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={newItemStatus}
                  onChange={(e) => setNewItemStatus(e.target.value as 'Active' | 'Non Active')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Active">Active</option>
                  <option value="Non Active">Non Active</option>
                </select>
              </div>

              {saveError && <div className="text-sm text-red-600">{saveError}</div>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔹 Edit Item Modal (unchanged, still has location input) */}
      {showEditModal && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Edit Inventory Item</h2>
            <form onSubmit={handleEditItemSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
                <input
                  type="text"
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category / Description</label>
                <input
                  type="text"
                  value={editItemCategory}
                  onChange={(e) => setEditItemCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={editItemPrice}
                  onChange={(e) => setEditItemPrice(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>



              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={editItemStatus}
                  onChange={(e) => setEditItemStatus(e.target.value as 'Active' | 'Non Active')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Active">Active</option>
                  <option value="Non Active">Non Active</option>
                </select>
              </div>

              {editError && <div className="text-sm text-red-600">{editError}</div>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
                  disabled={editSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={editSaving}
                >
                  {editSaving ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      ) : (
        <InventoryAdj />
      )}
    </div>
  );
};

export default Inventory;
