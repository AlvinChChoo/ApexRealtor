import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardList, Search, Plus, Edit } from 'lucide-react';

interface AdjustmentRecord {
  id: number;
  adjustmentDate: string;
  itemName: string;
  adjustmentType: string; // "Stock In" / "Stock Out"
  quantity: number;
  reason: string;
  adjustedBy: string;
  status: string;
}

interface InventoryItem {
  ItemId: number;
  ItemName: string;
  StockQty: number;
  MdBranch: string;
}

// 🔹 PHP endpoints
const INVENTORY_ADJ_GET_URL =
  API_ENDPOINTS.INVENTORY_ADJUSTMENT_GET;

const INVENTORY_ADJ_INSERT_URL =
  API_ENDPOINTS.INVENTORY_ADJUSTMENT_INSERT;

const INVENTORY_GET_URL =
  API_ENDPOINTS.INT_INVENTORY_LEGACY_GET;

const InventoryAdj: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const sampleAdjustments: AdjustmentRecord[] = [
    {
      id: 1,
      adjustmentDate: '2024-11-28',
      itemName: 'Laptop - Dell XPS 15',
      adjustmentType: 'Stock In',
      quantity: 5,
      reason: 'Stock replenishment',
      adjustedBy: 'Admin',
      status: 'Completed'
    },
  ];

  // 🔹 Adjustment list
  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>(sampleAdjustments);

  // 🔹 New Adjustment modal state
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjQty, setAdjQty] = useState('');      // string input → integer
  const [rem, setRem] = useState('');
  const [savingAdj, setSavingAdj] = useState(false);
  const [saveErrorAdj, setSaveErrorAdj] = useState<string | null>(null);

  // 🔹 Reusable fetch for adjustments (for initial load + refresh)
  const fetchAdjustments = async () => {
    try {
      const res = await fetch(INVENTORY_ADJ_GET_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          ItemId: '',
          ItemName: '',
        }).toString(),
      });

      if (!res.ok) {
        console.error('Failed to fetch adjustments. HTTP', res.status);
        return;
      }

      const json = await res.json();

      if (json.status === 'success' && Array.isArray(json.data)) {
        const mapped: AdjustmentRecord[] = json.data.map((row: any, index: number) => {
          const rawQty = Number(row.AdjQty ?? 0);
          const adjType = rawQty >= 0 ? 'Stock In' : 'Stock Out';

          return {
            id: Number(row.InvntoryAdjustmentId ?? index + 1),
            adjustmentDate: row.AddDate ?? '',
            itemName: row.ItemName ?? `Item ${row.ItemId ?? ''}`,
            adjustmentType: adjType,
            quantity: Math.abs(rawQty),
            reason: row.Rem ?? '',
            adjustedBy: row.AddBy ?? '',
            status: 'Completed',
          };
        });

        setAdjustments(mapped);
      } else {
        console.warn('No adjustments returned or status not success:', json);
      }
    } catch (err) {
      console.error('Error loading adjustments:', err);
    }
  };

  // 🔹 Load adjustments on mount
  useEffect(() => {
    fetchAdjustments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔹 Open New Adjustment modal
  const openAdjModal = async () => {
    setShowAdjModal(true);
    setSaveErrorAdj(null);
    setAdjQty('');
    setRem('');
    setItemSearch('');
    setSelectedItem(null);

    // Load inventory list only once (or refresh if you want)
    if (items.length === 0) {
      try {
        const res = await fetch(INVENTORY_GET_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            ItemId: '',
            ItemName: '',
          }).toString(),
        });

        if (!res.ok) {
          console.error('Failed to fetch inventory items. HTTP', res.status);
          return;
        }

        const json = await res.json();
        if (json.status === 'success' && Array.isArray(json.data)) {
          const mapped: InventoryItem[] = json.data.map((row: any) => ({
            ItemId: Number(row.ItemId),
            ItemName: row.ItemName ?? '',
            StockQty: Number(row.StockQty ?? 0),
            MdBranch: row.MdBranch ?? '',
          }));
          setItems(mapped);
        } else {
          console.warn('No inventory items returned or status not success:', json);
        }
      } catch (err) {
        console.error('Error loading inventory items:', err);
      }
    }
  };

  const closeAdjModal = () => {
    if (savingAdj) return;
    setShowAdjModal(false);
  };

  // 🔹 Save adjustment → calls InventoryAdjustmentInsert.php
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedItem) {
      setSaveErrorAdj('Please select an item.');
      return;
    }

    const qty = parseInt(adjQty, 10);
    if (isNaN(qty) || qty === 0) {
      setSaveErrorAdj('Adjustment quantity must be a non-zero integer.');
      return;
    }

    setSavingAdj(true);
    setSaveErrorAdj(null);

    try {
      const body = new URLSearchParams({
        ItemId: String(selectedItem.ItemId),
        AdjQty: String(qty),
        Rem: rem || '',
        AddBy: localStorage.getItem('userName') || '',
        //AddBy: '10007', // TODO: replace with logged-in user id
      });

      const res = await fetch(INVENTORY_ADJ_INSERT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const json = await res.json();

      if (json.status === 'success' && json.data) {
        const row = json.data;

        const rawQty = Number(row.AdjQty ?? qty);
        const adjType = rawQty >= 0 ? 'Stock In' : 'Stock Out';

        const newRecord: AdjustmentRecord = {
          id: Number(row.InvntoryAdjustmentId ?? Date.now()),
          adjustmentDate: row.AddDate ?? new Date().toISOString(),
          itemName: row.ItemName ?? selectedItem.ItemName,
          adjustmentType: adjType,
          quantity: Math.abs(rawQty),
          reason: row.Rem ?? rem,
          adjustedBy: row.AddBy ?? '10007',
          status: 'Completed',
        };

        // Add to current list (immediate UI feedback)
        setAdjustments(prev => [newRecord, ...prev]);

        // 🔹 Refresh from server to sync with DB (and effectively "refresh page")
        await fetchAdjustments();

        // 🔹 Popup alert for user
        alert('Inventory adjustment saved successfully.');

        setShowAdjModal(false);
        setSelectedItem(null);
        setAdjQty('');
        setRem('');
      } else {
        setSaveErrorAdj(json.error || 'Failed to save adjustment.');
      }
    } catch (err: any) {
      console.error('Failed to save adjustment:', err);
      setSaveErrorAdj(err.message || 'Failed to save adjustment.');
    } finally {
      setSavingAdj(false);
    }
  };

  // 🔹 Manual refresh button handler
  const handleRefreshClick = () => {
    fetchAdjustments();
  };

  const filteredAdjustments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return adjustments;

    return adjustments.filter(adj => {
      const name = String(adj.itemName || '').toLowerCase();
      const reason = String(adj.reason || '').toLowerCase();
      const adjustedBy = String(adj.adjustedBy || '').toLowerCase();
      return name.includes(query) || reason.includes(query) || adjustedBy.includes(query);
    });
  }, [adjustments, searchTerm]);

  const filteredItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    if (!query) return items;

    return items.filter(item => {
      const name = String(item.ItemName || '').toLowerCase();
      const itemId = String(item.ItemId || '');
      return name.includes(query) || itemId.includes(query);
    });
  }, [items, itemSearch]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <ClipboardList className="text-blue-600" size={32} />
              Inventory Adjustment
            </h1>
            <p className="text-gray-600 mt-1">Manage inventory adjustments and corrections</p>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            onClick={openAdjModal}
          >
            <Plus size={20} />
            New Adjustment
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search adjustments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 🔹 REFRESH button (refreshes data) */}
            <button
              type="button"
              onClick={handleRefreshClick}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 text-sm"
            >
              REFRESH
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Adjusted By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAdjustments.map((adj) => (
                <tr key={adj.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {adj.adjustmentDate
                        ? new Date(adj.adjustmentDate).toLocaleDateString()
                        : ''}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{adj.itemName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      adj.adjustmentType === 'Stock In'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {adj.adjustmentType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {adj.adjustmentType === 'Stock In' ? '+' : '-'}{adj.quantity}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{adj.reason}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{adj.adjustedBy}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      adj.status === 'Completed'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {adj.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      type="button"
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAdjustments.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No adjustments found matching your search.
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Showing {filteredAdjustments.length} of {adjustments.length} adjustments
      </div>

      {/* 🔹 New Adjustment Modal (Option B: searchable item list) */}
      {showAdjModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl p-6">
            <h2 className="text-xl font-semibold mb-4">New Inventory Adjustment</h2>

            <div className="grid grid-cols-2 gap-6">
              {/* Left: Item search & select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Item
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Search by name or ItemId..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  {filteredItems.map((item) => (
                    <button
                      key={item.ItemId}
                      type="button"
                      onClick={() => setSelectedItem(item)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                        selectedItem?.ItemId === item.ItemId ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="font-medium">{item.ItemName}</div>
                      <div className="text-xs text-gray-500">
                        ItemId: {item.ItemId} · Branch: {item.MdBranch} · Stock: {item.StockQty}
                      </div>
                    </button>
                  ))}
                  {filteredItems.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No items found.
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Adjustment details */}
              <form onSubmit={handleSaveAdjustment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Selected Item
                  </label>
                  <div className="px-3 py-2 border rounded-lg bg-gray-50 text-sm text-gray-800 min-h-[42px] flex items-center">
                    {selectedItem
                      ? `${selectedItem.ItemName} (ItemId: ${selectedItem.ItemId})`
                      : 'No item selected'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adjustment Quantity (use + for Stock In, - for Stock Out)
                  </label>
                  <input
                    type="number"
                    value={adjQty}
                    onChange={(e) => setAdjQty(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 10 or -5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason
                  </label>
                  <textarea
                    value={rem}
                    onChange={(e) => setRem(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="e.g. Stock count adjustment, damaged, lost..."
                  />
                </div>

                {saveErrorAdj && (
                  <div className="text-sm text-red-600">{saveErrorAdj}</div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeAdjModal}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
                    disabled={savingAdj}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                    disabled={savingAdj}
                  >
                    {savingAdj ? 'Saving...' : 'Save Adjustment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default InventoryAdj;
