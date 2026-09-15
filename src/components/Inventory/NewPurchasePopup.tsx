import { API_ENDPOINTS } from '../../config/apiConfig';
// src/components/Inventory/NewPurchasePopup.tsx
import React, { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";

interface RenOption {
  userName: string;
  displayName: string;
  pettyCashAmt?: string;
}

interface InventoryItem {
  ItemId: number;
  ItemName: string;
  StockQty: number;
  MdBranch: string;
  UnitPrice?: string;
  ItemCategory?: string;
}

interface Props {
  show: boolean;
  onClose: () => void;

  items: InventoryItem[];
  filteredItems: InventoryItem[];
  itemSearch: string;
  selectedItem: InventoryItem | null;

  setItemSearch: (v: string) => void;
  setSelectedItem: (i: InventoryItem | null) => void;

  loginUserId: string;
  loginDisplayName: string;

  purchaseRen: string;
  setPurchaseRen: (v: string) => void;

  purchaseQty: string;
  purchasePrice: string;
  purchaseRemarks: string;

  setPurchaseQty: (v: string) => void;
  setPurchasePrice: (v: string) => void;
  setPurchaseRemarks: (v: string) => void;

  computedTotal: string;
  balanceAfterPurchase: string;

  savingPurchase: boolean;
  saveErrorPurchase: string | null;

  handleSavePurchase: (e: React.FormEvent) => void;
}

const EMP_GET_URL = API_ENDPOINTS.INT_EMP_GET;
const INVENTORY_GET_URL =
  API_ENDPOINTS.INT_INVENTORY_GET;

const NewPurchasePopup: React.FC<Props> = ({
  show,
  onClose,
  items,
  filteredItems,
  selectedItem,
  setSelectedItem,
  itemSearch,
  setItemSearch,
  loginUserId,
  loginDisplayName,
  purchaseRen,
  setPurchaseRen,
  purchaseQty,
  setPurchaseQty,
  purchasePrice,
  setPurchasePrice,
  purchaseRemarks,
  setPurchaseRemarks,
  computedTotal,
  balanceAfterPurchase,
  savingPurchase,
  saveErrorPurchase,
  handleSavePurchase,
}) => {
  const [renList, setRenList] = useState<RenOption[]>([]);
  const [renLoading, setRenLoading] = useState(false);
  const [localErrorPurchase, setLocalErrorPurchase] = useState<string | null>(
    null
  );

  // NEW: Popup's own opening balance (no longer from parent)
  const [localOpeningBalance, setLocalOpeningBalance] = useState("0.00");

  // ✅ NEW: Local inventory cache from IntInventoryGet.php (keeps your UI & props intact)
  const [localItems, setLocalItems] = useState<InventoryItem[]>([]);
  const [localFilteredItems, setLocalFilteredItems] = useState<InventoryItem[]>(
    []
  );

  // ✅ Keep your existing behavior: use props list for display if provided, else fallback local
  const effectiveItems =
    Array.isArray(items) && items.length > 0 ? items : localItems;

  const effectiveFilteredItems =
    Array.isArray(filteredItems) && filteredItems.length > 0
      ? filteredItems
      : localFilteredItems;

  // ✅ CATEGORY FILTER (dropdown)
  const [categoryFilter, setCategoryFilter] = useState("");

  // ✅ Build a lookup map from localItems (this is the only place we KNOW ItemCategory exists)
  const categoryById = useMemo(() => {
    const m = new Map<number, string>();
    (localItems || []).forEach((it) => {
      m.set(Number(it.ItemId), String(it.ItemCategory ?? "").trim());
    });
    return m;
  }, [localItems]);

  // ✅ Distinct categories MUST come from localItems (IntInventoryGet.php)
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    (localItems || []).forEach((it) => {
      const c = String(it.ItemCategory ?? "").trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [localItems]);

  // ✅ Filter the DISPLAYED list (effectiveFilteredItems) using:
  // 1) item.ItemCategory (if exists)
  // 2) otherwise, fallback from localItems via categoryById (same ItemId)
  const categoryFilteredItems = useMemo(() => {
    if (!categoryFilter) return effectiveFilteredItems;

    return (effectiveFilteredItems || []).filter((it) => {
      const fromRow = String((it as any)?.ItemCategory ?? "").trim();
      const fromLocal = String(categoryById.get(Number(it.ItemId)) ?? "").trim();
      const cat = fromRow || fromLocal;
      return cat === categoryFilter;
    });
  }, [effectiveFilteredItems, categoryFilter, categoryById]);

  useEffect(() => {
    if (show) {
      loadRenList();
      setLocalOpeningBalance("0.00"); // reset on open
      setLocalErrorPurchase(null); // clear error on open

      // ✅ load inventory list on open (full list)
      fetchInventory("", "");
      setCategoryFilter(""); // reset category filter on open
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // ✅ When search changes, call IntInventoryGet.php using ItemName (debounced)
  useEffect(() => {
    if (!show) return;

    const t = setTimeout(() => {
      fetchInventory(itemSearch ?? "", "");
    }, 300);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemSearch, show]);

  const fetchInventory = async (ItemName: string, ItemId: string) => {
    try {
      const res = await fetch(INVENTORY_GET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          ItemName: (ItemName ?? "").trim(),
          ItemId: (ItemId ?? "").trim(),
        }).toString(),
      });

      const json = await res.json();

      if (json?.status === "success" && Array.isArray(json.data)) {
        const rows: InventoryItem[] = json.data.map((r: any) => ({
          ItemId: Number(r.ItemId ?? 0),
          MdBranch: String(r.MdBranch ?? ""),
          ItemName: String(r.ItemName ?? ""),
          UnitPrice: String(r.UnitPrice ?? "0.00"),
          StockQty: Number(r.StockQty ?? 0),
          ItemCategory: String(r.ItemCategory ?? "").trim(),
        }));

        setLocalItems(rows);
        setLocalFilteredItems(rows);
      } else {
        setLocalItems([]);
        setLocalFilteredItems([]);
      }
    } catch (err) {
      console.error("Inventory load failed:", err);
      setLocalItems([]);
      setLocalFilteredItems([]);
    }
  };

  const loadRenList = async () => {
    setRenLoading(true);
    try {
      const res = await fetch(EMP_GET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          ShowActive: "1",
        }).toString(),
      });

      const json = await res.json();

      if (json.status === "success" && Array.isArray(json.data)) {
        const renData = json.data
          .map((row: any) => ({
            userName: String(row.User_Name ?? row.UserName ?? "").trim(),
            displayName: String(row.DisplayName ?? "").trim(),
            pettyCashAmt: String(row.PettyCashAmt ?? "0"),
          }))
          .sort((a: RenOption, b: RenOption) =>
            a.displayName.localeCompare(b.displayName)
          );

        setRenList(renData);
      }
    } catch (err) {
      console.error("REN load failed:", err);
    } finally {
      setRenLoading(false);
    }
  };

  const handleRenChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLocalErrorPurchase(null);

    const selectedUserName = e.target.value;
    setPurchaseRen(selectedUserName);

    const selectedRen = renList.find((ren) => ren.userName === selectedUserName);

    if (selectedRen) {
      const petty = Number(selectedRen.pettyCashAmt || 0).toFixed(2);
      setLocalOpeningBalance(petty);
    } else {
      setLocalOpeningBalance("0.00");
    }
  };

  if (!show) return null;

  const handleSubmitPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErrorPurchase(null);

    if (!purchaseRen) {
      setLocalErrorPurchase("Please select REN first.");
      return;
    }
    if (!selectedItem) {
      setLocalErrorPurchase("Please select an item first.");
      return;
    }

    const opening = Number(localOpeningBalance || 0);
    const total = Number(computedTotal || 0);
    const closing = opening - total;

    if (!Number.isFinite(total) || total <= 0) {
      setLocalErrorPurchase("Total purchase must be greater than 0.");
      return;
    }

    if (closing < 0) {
      const msg =
        `Insufficient balance!\n\n` +
        `Opening: RM ${opening.toFixed(2)}\n` +
        `Total Purchase: RM ${total.toFixed(2)}\n` +
        `Closing: RM ${closing.toFixed(2)}\n\n` +
        `Cannot save purchase when closing balance is negative.`;

      alert(msg);
      setLocalErrorPurchase(msg);
      return;
    }

    handleSavePurchase(e);
  };

  const closingBalance = (
    Number(localOpeningBalance) - Number(computedTotal)
  ).toFixed(2);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-semibold mb-4">New Purchase</h2>

        {/* LOGIN USER */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm font-medium text-gray-700">Logged in as:</div>
          <div className="text-lg font-semibold">
            {loginDisplayName} ({loginUserId})
          </div>
        </div>

        {/* REN DROPDOWN */}
        <div className="mb-4">
          <label className="font-medium text-sm mb-1 block">
            REN (Performed By) – {renList.length} options loaded
          </label>

          {renLoading ? (
            <div className="text-sm text-gray-500 p-2 border rounded-lg bg-yellow-50">
              Loading REN list…
            </div>
          ) : renList.length === 0 ? (
            <div className="text-sm text-red-500 p-2 border rounded-lg bg-red-50">
              No REN found.
            </div>
          ) : (
            <select
              className="border p-2 rounded-lg w-full"
              value={purchaseRen}
              onChange={handleRenChange}
            >
              <option value="">-- Select REN --</option>
              {renList.map((ren) => (
                <option key={ren.userName} value={ren.userName}>
                  {ren.displayName} ({ren.userName})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* OPENING BALANCE */}
        {purchaseRen && (
          <div className="p-3 bg-gray-50 border rounded-lg mb-4">
            <div className="flex justify-between">
              <span>Opening Balance:</span>
              <strong>RM {localOpeningBalance}</strong>
            </div>

            <div className="flex justify-between text-blue-700">
              <span>Total Purchase:</span>
              <strong>RM {computedTotal}</strong>
            </div>

            <div className="flex justify-between border-t pt-1 text-red-600">
              <span>Closing Balance:</span>
              <strong>RM {closingBalance}</strong>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          {/* ITEM LIST */}
          <div>
            <label className="block mb-1 text-sm font-medium">Select Item</label>

            {/* CATEGORY DROPDOWN */}
            <div className="mb-2">
              <select
                className="border p-2 rounded-lg w-full"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">-- All Categories --</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative mb-2">
              <Search
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="pl-8 w-full border p-2 rounded-lg"
                placeholder="Search by name or ID"
              />
            </div>

            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {categoryFilteredItems.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  {itemSearch ? "No items found" : "Loading items…"}
                </div>
              ) : (
                categoryFilteredItems.map((i) => (
                  <button
                    key={i.ItemId}
                    type="button"
                    onClick={() => setSelectedItem(i)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                      selectedItem?.ItemId === i.ItemId ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="font-medium">{i.ItemName}</div>
                    <div className="text-xs text-gray-500">
                      {i.ItemId} · {i.MdBranch} · Stock: {i.StockQty}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* PURCHASE FORM */}
          <form onSubmit={handleSubmitPurchase} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Selected Item</label>
              <div className="p-2 border bg-gray-50 rounded-lg text-sm">
                {selectedItem
                  ? `${selectedItem.ItemName} (ID: ${selectedItem.ItemId})`
                  : "None"}
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">Quantity</label>
              <input
                type="number"
                className="w-full border p-2 rounded-lg"
                value={purchaseQty}
                onChange={(e) => setPurchaseQty(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm block mb-1">Unit Price</label>
              <input
                type="number"
                step="0.01"
                className="w-full border p-2 rounded-lg"
                value={purchasePrice}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm">Total</label>
              <div className="p-3 border rounded-lg bg-green-50 font-bold text-xl flex justify-between">
                <span>RM</span>
                <span>{computedTotal}</span>
              </div>
            </div>

            <div>
              <label className="text-sm block mb-1">Remarks</label>
              <textarea
                rows={3}
                className="border rounded-lg p-2 w-full"
                value={purchaseRemarks}
                onChange={(e) => setPurchaseRemarks(e.target.value)}
              ></textarea>
            </div>

            {localErrorPurchase && (
              <div className="text-red-600 text-sm">{localErrorPurchase}</div>
            )}

            {saveErrorPurchase && (
              <div className="text-red-600 text-sm">{saveErrorPurchase}</div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 border rounded-lg"
                onClick={onClose}
                disabled={savingPurchase}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                disabled={
                  savingPurchase ||
                  !purchaseRen ||
                  !selectedItem ||
                  Number(localOpeningBalance || 0) - Number(computedTotal || 0) <
                    0
                }
              >
                {savingPurchase ? "Saving…" : "Save Purchase"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NewPurchasePopup;
