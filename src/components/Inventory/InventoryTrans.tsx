import { API_ENDPOINTS, API_PATHS } from '../../config/apiConfig';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  History,
  Filter,
  Download,
  Calendar,
  Eye,
  CheckCircle,
  XCircle,
  ChevronDown,
} from 'lucide-react';
import NewPurchasePopup from "./NewPurchasePopup";

interface Transaction {
  id: number;
  date: string;
  itemName: string;
  transactionType: string;
  quantity: number;
  unit: string;
  location: string;
  performedBy: string;
  notes: string;
  unitPrice: string;
  total: string;
}

interface TopUpTransaction {
  RenTopUpRowId: number;
  UserName: string;
  UserDisplayName: string;
  TopUpDate: string;
  TopUpAmt: number;
  TopUpStatus: string;
  TopUpAppRejBy: string;
  AppRejByName: string;
  TopUpAppRejDate: string;
  AttName?: string;
  AttUrl?: string;
  AttachmentUrl?: string;
  UploadedImageUrl?: string;
  Remarks?: string;
  AppRejRemarks?: string;
}

interface InventoryItem {
  ItemId: number;
  ItemName: string;
  StockQty: number;
  MdBranch: string;
  UnitPrice?: string;
}

interface RenUser {
  UserName: string;
  DisplayName: string;
}

const INVENTORY_ITEMS_URL =
  API_ENDPOINTS.INT_INVENTORY_LEGACY_GET;

const INVENTORY_PURCHASE_INSERT_URL =
  API_ENDPOINTS.INVENTORY_TRANS_INSERT;

const INVENTORY_TRANS_GET_URL =
  API_ENDPOINTS.INT_INVENTORY_TRANS_GET;

const TOPUP_TRANS_GET_URL =
  API_ENDPOINTS.TOP_UP_TRANS_GET;

const TOPUP_REN_INSERT_URL =
  API_ENDPOINTS.TOP_UP_REN_INSERT;

const TOPUP_APPROVAL_SET_URL =
  API_ENDPOINTS.TOP_UP_TRANS_APPROVE_SET;

const ADMIN_USER_GET_URL =
  API_ENDPOINTS.INT_EMP_GET;

type ActiveTab = 'pettyCash' | 'topUp';

const InventoryTrans: React.FC = () => {
  const loginUserId = localStorage.getItem('userName') || '';
  const loginDisplayName = localStorage.getItem('displayName') || '';
  const loginRen = (loginDisplayName || loginUserId || '').trim();

  const isAccountUser =
    String(localStorage.getItem("account") || "").trim().toUpperCase() === "Y";

  const [activeTab, setActiveTab] = useState<ActiveTab>('pettyCash');
  const [dateFilter, setDateFilter] = useState('');

  const [renList, setRenList] = useState<RenUser[]>([]);
  const [selectedRen, setSelectedRen] = useState<string>('all');
  const [renDropdownOpen, setRenDropdownOpen] = useState(false);
  const [renSearchText, setRenSearchText] = useState('');
  const renDropdownRef = useRef<HTMLDivElement | null>(null);
  const renSearchInputRef = useRef<HTMLInputElement | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState<boolean>(true);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);

  const [topUpTransactions, setTopUpTransactions] = useState<TopUpTransaction[]>([]);
  const [loadingTopUpTransactions, setLoadingTopUpTransactions] = useState<boolean>(true);
  const [topUpTransactionsError, setTopUpTransactionsError] = useState<string | null>(null);

  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [topUpRen, setTopUpRen] = useState('');
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpRemarks, setTopUpRemarks] = useState('');
  const [topUpFile, setTopUpFile] = useState<File | null>(null);
  const [topUpSubmitting, setTopUpSubmitting] = useState(false);

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseRemarks, setPurchaseRemarks] = useState('');
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [saveErrorPurchase, setSaveErrorPurchase] = useState<string | null>(null);

  const [openingBalance, setOpeningBalance] = useState<number | null>(null);
  const [purchaseRen, setPurchaseRen] = useState(loginDisplayName || '');

  const [selectedTopUp, setSelectedTopUp] = useState<TopUpTransaction | null>(null);
  const [isViewTopUpOpen, setIsViewTopUpOpen] = useState(false);

  const [approvalTarget, setApprovalTarget] = useState<TopUpTransaction | null>(null);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);

  const computedTotal = (() => {
    const qtyNum = parseFloat(purchaseQty || '0');
    const unitNum = parseFloat(purchasePrice || '0');
    if (isNaN(qtyNum) || isNaN(unitNum)) return '0.00';
    return (qtyNum * unitNum).toFixed(2);
  })();

  const openingBalanceNum = openingBalance ?? 0;
  const computedTotalNum = parseFloat(computedTotal);
  const balanceAfterPurchase = !isNaN(computedTotalNum)
    ? (openingBalanceNum - computedTotalNum).toFixed(2)
    : openingBalanceNum.toFixed(2);

  const normalizeDate = (value: any): string => {
    if (!value) return '';
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
    return String(value);
  };

  const normalizeDateTime = (value: any): string => {
    if (!value) return '';
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 19).replace('T', ' ');
    }
    return String(value);
  };

  const formatMoney = (value: any): string => {
    const num = Number(value ?? 0);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-MY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatTopUpDate = (value: any): string => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);

    return `${day}-${month}-${year}`;
  };

  const formatShortDate = (value: any): string => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);

  return `${day}-${month}-${year}`;
};
  
  const formatTopUpDateTime = (value: any): string => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    const hour = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');

    return `${day}-${month}-${year} ${hour}:${min}`;
  };

  const getAttachmentUrl = (t: TopUpTransaction | null): string => {
    if (!t) return '';
    return (
      t.AttUrl ||
      t.AttachmentUrl ||
      t.UploadedImageUrl ||
      (t.AttName ? `${API_PATHS.DOC_FILES}/${t.AttName}` : '')
    );
  };

  const isImageFile = (urlOrFileName: string): boolean => {
    const lower = (urlOrFileName || '').toLowerCase();
    return (
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.gif') ||
      lower.endsWith('.webp') ||
      lower.includes('image')
    );
  };

  const canApproveRow = (status: string): boolean => {
    const s = String(status || '').trim().toUpperCase();
    return s !== 'APPROVED' && s !== 'REJECTED';
  };

  const getStatusBadgeClass = (status: string): string => {
    const s = String(status || '').trim().toUpperCase();

    if (s === 'APPROVED') {
      return 'bg-green-100 text-green-700';
    }
    if (s === 'REJECTED') {
      return 'bg-red-100 text-red-700';
    }
    return 'bg-yellow-100 text-yellow-700';
  };

  const fetchRenList = async () => {
    try {
      const params = new URLSearchParams();
      params.append('ShowActive', '1');

      const response = await fetch(ADMIN_USER_GET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();

      if (
        (String(json.status).toLowerCase() === 'success' ||
          String(json.status).toLowerCase() === 'no_data_found') &&
        Array.isArray(json.data)
      ) {
        const mapped: RenUser[] = json.data
          .map((row: any) => ({
            UserName: String(row.UserName ?? '').trim(),
            DisplayName: String(row.DisplayName ?? row.UserName ?? '').trim(),
          }))
          .filter((r: RenUser) => r.UserName !== '' || r.DisplayName !== '')
          .sort((a: RenUser, b: RenUser) =>
            (a.DisplayName || a.UserName).localeCompare(
              (b.DisplayName || b.UserName),
              undefined,
              { sensitivity: 'base' }
            )
          );

        setRenList(mapped);
      } else {
        setRenList([]);
      }
    } catch (err) {
      console.error('Failed to load REN list', err);
      setRenList([]);
    }
  };

  const filteredRenList = useMemo(() => {
    const keyword = renSearchText.trim().toLowerCase();

    if (!keyword) return renList;

    return renList.filter((r) => {
      const display = (r.DisplayName || '').toLowerCase();
      const userName = (r.UserName || '').toLowerCase();
      return display.includes(keyword) || userName.includes(keyword);
    });
  }, [renList, renSearchText]);

  const selectedRenLabel =
    selectedRen === 'all' ? '-- All REN --' : selectedRen;

  // ---------------------------------------------------------
  // LOAD PETTY CASH TRANSACTIONS
  // ---------------------------------------------------------
  const fetchTransactions = async () => {
    try {
      setLoadingTransactions(true);
      setTransactionsError(null);

      const response = await fetch(INVENTORY_TRANS_GET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: '',
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json();

      if (json.status !== 'success' || !Array.isArray(json.data)) {
        throw new Error(json.message || 'Invalid response from server');
      }

      const mapped: Transaction[] = json.data.map((row: any, index: number) => {
        return {
          id: Number(row.InventoryTransactionId) || index + 1,
          date: normalizeDate(row.CreatedAt),
          itemName: row.ItemName || '',
          transactionType: row.TransactionType || 'Unknown',
          quantity: Number(row.Qty ?? 0),
          unit: row.Unit || 'pcs',
          location: row.Location || '',
          performedBy: String(row.Ren ?? row.REN ?? row.UserName ?? row.DisplayName ?? '').trim(),
          notes: row.Remark || row.Notes || '',
          unitPrice: formatMoney(row.UnitPrice),
          total: formatMoney(row.TotalPrice),
        };
      });

      setTransactions(mapped);
    } catch (err: any) {
      setTransactionsError(err.message || 'Failed to load transactions');
    } finally {
      setLoadingTransactions(false);
    }
  };

  // ---------------------------------------------------------
  // LOAD TOP UP TRANSACTIONS
  // ---------------------------------------------------------
  const fetchTopUpTransactions = async () => {
    try {
      setLoadingTopUpTransactions(true);
      setTopUpTransactionsError(null);

      const bodyParams = new URLSearchParams();

      if (!isAccountUser) {
        bodyParams.append('UserName', loginUserId);
      }

      const response = await fetch(TOPUP_TRANS_GET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString(),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json();

      if (json.status !== 'success' || !Array.isArray(json.data)) {
        throw new Error(json.message || 'Invalid response from server');
      }

      const mapped: TopUpTransaction[] = json.data.map((row: any) => ({
        RenTopUpRowId: Number(row.RenTopUpRowId ?? 0),
        UserName: String(row.UserName ?? ''),
        UserDisplayName: String(row.UserDisplayName ?? row.DisplayName ?? row.UserName ?? ''),
        TopUpDate: normalizeDateTime(row.TopUpDate),
        TopUpAmt: Number(row.TopUpAmt ?? 0),
        TopUpStatus: String(row.TopUpStatus ?? ''),
        TopUpAppRejBy: String(row.TopUpAppRejBy ?? ''),
        AppRejByName: String(row.AppRejByName ?? ''),
        TopUpAppRejDate: normalizeDateTime(row.TopUpAppRejDate),
        AttName: String(row.AttName ?? ''),
        AttUrl: String(row.AttUrl ?? ''),
        AttachmentUrl: String(row.AttachmentUrl ?? ''),
        UploadedImageUrl: String(row.UploadedImageUrl ?? ''),
        Remarks: String(row.Remarks ?? row.TopUpRemarks ?? ''),
        AppRejRemarks: String(row.AppRejRemarks ?? row.AppRejRem ?? ''),
      }));

      setTopUpTransactions(mapped);
    } catch (err: any) {
      setTopUpTransactionsError(err.message || 'Failed to load top up transactions');
    } finally {
      setLoadingTopUpTransactions(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchTopUpTransactions();

    if (isAccountUser) {
      fetchRenList();
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        renDropdownRef.current &&
        !renDropdownRef.current.contains(event.target as Node)
      ) {
        setRenDropdownOpen(false);
        setRenSearchText('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (renDropdownOpen) {
      setTimeout(() => {
        renSearchInputRef.current?.focus();
      }, 0);
    }
  }, [renDropdownOpen]);

  const filteredTransactions = transactions.filter((transaction) => {
    let renMatch = true;

    if (!isAccountUser) {
      renMatch = !loginRen || transaction.performedBy === loginRen;
    } else if (selectedRen !== 'all') {
      renMatch = transaction.performedBy === selectedRen;
    }

    const dateMatch = !dateFilter || transaction.date === dateFilter;
    return renMatch && dateMatch;
  });

  const filteredTopUpTransactions = topUpTransactions.filter((transaction) => {
    let renMatch = true;

    if (!isAccountUser) {
      renMatch =
        (transaction.UserDisplayName || transaction.UserName || '').trim() === loginRen;
    } else if (selectedRen !== 'all') {
      renMatch =
        (transaction.UserDisplayName || transaction.UserName || '').trim() === selectedRen;
    }

    const txDate = transaction.TopUpDate ? transaction.TopUpDate.slice(0, 10) : '';
    const dateMatch = !dateFilter || txDate === dateFilter;
    return renMatch && dateMatch;
  });

  const getQuantityColor = (quantity: number) => {
    if (quantity > 0) return 'text-green-600';
    if (quantity < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  // ---------------------------------------------------------
  // TOP UP FUNCTIONS
  // ---------------------------------------------------------
  const openTopUp = () => {
    setTopUpRen(loginDisplayName || '');
    setTopUpAmount('');
    setTopUpRemarks('');
    setTopUpFile(null);
    setIsTopUpOpen(true);
  };

  const closeTopUp = () => {
    if (!topUpSubmitting) {
      setIsTopUpOpen(false);
    }
  };

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedRen = String(localStorage.getItem('userName') || '').trim();
    const amt = Number(topUpAmount);

    if (!trimmedRen) {
      alert('UserName not found in localStorage.');
      return;
    }

    if (!topUpAmount || isNaN(amt) || amt <= 0) {
      alert('Please enter a valid top up amount.');
      return;
    }

    setTopUpSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('UserName', trimmedRen);
      formData.append('TopUpAmt', amt.toFixed(2));
      formData.append('Remarks', topUpRemarks);

      if (topUpFile) {
        formData.append('attachments[]', topUpFile);
      }

      const res = await fetch(TOPUP_REN_INSERT_URL, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();

      if (json.status === 'success') {
        alert('Top up submitted successfully.');
        setIsTopUpOpen(false);
        setTopUpAmount('');
        setTopUpRemarks('');
        setTopUpFile(null);
        await fetchTopUpTransactions();
      } else {
        alert(json.message || 'Top up failed.');
      }
    } catch (err: any) {
      alert(err.message || 'Top up failed');
    } finally {
      setTopUpSubmitting(false);
    }
  };

  // ---------------------------------------------------------
  // VIEW TOP UP
  // ---------------------------------------------------------
  const handleViewTopUp = (row: TopUpTransaction) => {
    setSelectedTopUp(row);
    setIsViewTopUpOpen(true);
  };

  const closeViewTopUp = () => {
    setIsViewTopUpOpen(false);
    setSelectedTopUp(null);
  };

  // ---------------------------------------------------------
  // APPROVE / REJECT TOP UP
  // ---------------------------------------------------------
  const handleOpenApproval = (row: TopUpTransaction) => {
    setApprovalTarget(row);
    setApprovalAction('APPROVED');
    setApprovalRemarks('');
    setIsApprovalOpen(true);
  };

  const closeApprovalPopup = () => {
    if (approvalSubmitting) return;
    setIsApprovalOpen(false);
    setApprovalTarget(null);
    setApprovalAction('APPROVED');
    setApprovalRemarks('');
  };

  const handleSubmitApproval = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!approvalTarget) {
      alert('No transaction selected.');
      return;
    }

    const approverUserName = String(localStorage.getItem('userName') || '').trim();

    if (!approverUserName) {
      alert('Approver username not found in localStorage.');
      return;
    }

    if (approvalAction === 'REJECTED' && !approvalRemarks.trim()) {
      alert('Please key in remarks for rejected transaction.');
      return;
    }

    setApprovalSubmitting(true);

    try {
      const params = new URLSearchParams();
      params.append('RenTopUpRowId', String(approvalTarget.RenTopUpRowId));
      params.append('TopUpStatus', approvalAction);
      params.append('AppRejRemarks', approvalRemarks.trim());
      params.append('TopUpAppRejBy', approverUserName);

      const response = await fetch(TOPUP_APPROVAL_SET_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();

      if (String(json.status).toLowerCase() === 'success') {
        alert(
          approvalAction === 'APPROVED'
            ? 'Transaction approved successfully.'
            : 'Transaction rejected successfully.'
        );

        setIsApprovalOpen(false);
        setApprovalTarget(null);
        setApprovalAction('APPROVED');
        setApprovalRemarks('');

        await fetchTopUpTransactions();
      } else {
        alert(json.message || 'Failed to update transaction.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update transaction.');
    } finally {
      setApprovalSubmitting(false);
    }
  };

  // ---------------------------------------------------------
  // PURCHASE POPUP FUNCTIONS
  // ---------------------------------------------------------
  const openPurchaseModal = async () => {
    setShowPurchaseModal(true);
    setSelectedItem(null);
    setPurchaseQty('');
    setPurchasePrice('');
    setPurchaseRemarks('');
    setItemSearch('');
    setPurchaseRen(loginDisplayName || '');
    setSaveErrorPurchase(null);

    if (items.length === 0) {
      try {
        const res = await fetch(INVENTORY_ITEMS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ ItemId: '', ItemName: '' }).toString(),
        });

        const json = await res.json();
        if (json.status === 'success') {
          setItems(
            json.data.map((row: any) => ({
              ItemId: Number(row.ItemId),
              ItemName: row.ItemName ?? '',
              StockQty: Number(row.StockQty ?? 0),
              MdBranch: row.MdBranch ?? '',
              UnitPrice: row.UnitPrice ?? '0.00',
            }))
          );
        }
      } catch {
        // ignore
      }
    }
  };

  const closePurchaseModal = () => {
    if (!savingPurchase) setShowPurchaseModal(false);
  };

  useEffect(() => {
    if (selectedItem) setPurchasePrice(selectedItem.UnitPrice ?? '');
  }, [selectedItem]);

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedItem) return setSaveErrorPurchase('Please select an item.');

    const qty = Number(purchaseQty);
    const price = Number(purchasePrice);

    if (qty <= 0) return setSaveErrorPurchase('Invalid quantity.');
    if (price <= 0) return setSaveErrorPurchase('Invalid price.');

    const total = qty * price;
    setSavingPurchase(true);

    try {
      const formData = new FormData();
      formData.append('ItemId', String(selectedItem.ItemId));
      formData.append('ItemName', selectedItem.ItemName);
      formData.append('Qty', String(qty));
      formData.append('UnitPrice', price.toFixed(2));
      formData.append('TotalPrice', total.toFixed(2));
      formData.append('Remarks', purchaseRemarks);
      formData.append('UserName', purchaseRen);

      const res = await fetch(INVENTORY_PURCHASE_INSERT_URL, {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (json.status === 'success') {
        setTransactions((prev) => [
          {
            id: Date.now(),
            date: new Date().toISOString().slice(0, 10),
            itemName: selectedItem.ItemName,
            transactionType: 'Stock In',
            quantity: qty,
            unit: 'pcs',
            location: selectedItem.MdBranch ?? '',
            performedBy: purchaseRen,
            notes: purchaseRemarks,
            unitPrice: price.toFixed(2),
            total: total.toFixed(2),
          },
          ...prev,
        ]);

        alert('Purchase saved.');
        closePurchaseModal();
        fetchTransactions();
      } else {
        setSaveErrorPurchase(json.message || 'Save failed.');
      }
    } catch (err: any) {
      setSaveErrorPurchase(err.message || 'Save failed.');
    } finally {
      setSavingPurchase(false);
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.ItemName.toLowerCase().includes(itemSearch.toLowerCase()) ||
      String(item.ItemId).includes(itemSearch)
  );

  const currentLoading =
    activeTab === 'pettyCash' ? loadingTransactions : loadingTopUpTransactions;

  const currentError =
    activeTab === 'pettyCash' ? transactionsError : topUpTransactionsError;

  const selectedAttachmentUrl = getAttachmentUrl(selectedTopUp);
  const showImagePreview =
    !!selectedAttachmentUrl &&
    isImageFile(selectedAttachmentUrl || selectedTopUp?.AttName || '');

  return (
    <div className="p-6 text-xs">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <History className="text-blue-600" size={32} />
              Petty Cash
            </h1>
            <p className="text-gray-600 mt-1">Track all petty cash movements</p>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg">
              <Download size={20} />
              Export Report
            </button>

            <button
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg"
              onClick={openTopUp}
            >
              TOP UP
            </button>

            {isAccountUser && (
              <button
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg"
                onClick={openPurchaseModal}
              >
                New Purchase
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="inline-flex bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setActiveTab('pettyCash')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === 'pettyCash'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Petty Cash Transaction
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('topUp')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === 'topUp'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Top Up Transaction
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative" ref={renDropdownRef}>
              <Filter className="absolute left-3 top-3 text-gray-400" size={20} />

              {isAccountUser ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setRenDropdownOpen((prev) => !prev);
                      if (renDropdownOpen) {
                        setRenSearchText('');
                      }
                    }}
                    className="w-full pl-10 pr-10 py-2 border rounded-lg bg-white text-left flex items-center justify-between"
                  >
                    <span className="truncate">{selectedRenLabel}</span>
                    <ChevronDown size={18} className="text-gray-500" />
                  </button>

                  {renDropdownOpen && (
                    <div className="absolute z-20 mt-2 w-full rounded-lg border bg-white shadow-lg">
                      <div className="p-2 border-b">
                        <input
                          ref={renSearchInputRef}
                          type="text"
                          value={renSearchText}
                          onChange={(e) => setRenSearchText(e.target.value)}
                          placeholder="Filter REN..."
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>

                      <div className="max-h-64 overflow-y-auto py-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRen('all');
                            setRenDropdownOpen(false);
                            setRenSearchText('');
                          }}
                          className={`w-full px-3 py-2 text-left hover:bg-gray-100 ${
                            selectedRen === 'all' ? 'bg-blue-50 text-blue-700' : ''
                          }`}
                        >
                          -- All REN --
                        </button>

                        {filteredRenList.map((r, index) => {
                          const value = (r.DisplayName || r.UserName || '').trim();
                          if (!value) return null;

                          return (
                            <button
                              key={`${r.UserName}-${index}`}
                              type="button"
                              onClick={() => {
                                setSelectedRen(value);
                                setRenDropdownOpen(false);
                                setRenSearchText('');
                              }}
                              className={`w-full px-3 py-2 text-left hover:bg-gray-100 ${
                                selectedRen === value ? 'bg-blue-50 text-blue-700' : ''
                              }`}
                            >
                              {value}
                            </button>
                          );
                        })}

                        {filteredRenList.length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-500">
                            No REN found
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <input
                  type="text"
                  value={loginRen}
                  disabled
                  className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50"
                />
              )}
            </div>

            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>

            {(dateFilter || (isAccountUser && selectedRen !== 'all')) && (
              <button
                onClick={() => {
                  setDateFilter('');
                  if (isAccountUser) {
                    setSelectedRen('all');
                    setRenSearchText('');
                    setRenDropdownOpen(false);
                  }
                }}
                className="px-4 py-2 border rounded-lg text-gray-700"
              >
                Clear Filters
              </button>
            )}
          </div>

          {currentLoading && <p className="mt-3 text-sm">Loading...</p>}
          {currentError && <p className="mt-3 text-sm text-red-600">{currentError}</p>}
        </div>

        {activeTab === 'pettyCash' && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs uppercase">Item</th>
                    <th className="px-6 py-3 text-left text-xs uppercase">Unit Price</th>
                    <th className="px-6 py-3 text-left text-xs uppercase">Total</th>
                    <th className="px-6 py-3 text-left text-xs uppercase">Qty</th>
                    <th className="px-6 py-3 text-left text-xs uppercase">Performed By</th>
                    <th className="px-6 py-3 text-left text-xs uppercase">Notes</th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y">
                  {filteredTransactions.map((t) => (
                    <tr key={t.id}>                      
                      <td className="px-6 py-4">{formatShortDate(t.date)}</td>
                      <td className="px-6 py-4">{t.itemName}</td>
                      <td className="px-6 py-4">{t.unitPrice}</td>
                      <td className="px-6 py-4">{t.total}</td>
                      <td className="px-6 py-4">
                        <span className={`font-semibold ${getQuantityColor(t.quantity)}`}>
                          {t.quantity > 0 ? "+" : ""}{t.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4">{t.performedBy}</td>
                      <td className="px-6 py-4">{t.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!loadingTransactions && filteredTransactions.length === 0 && (
              <p className="text-center py-12 text-gray-500">No transactions found.</p>
            )}

            <div className="mt-4 px-6 pb-4 text-sm">
              Showing {filteredTransactions.length} of {transactions.length} transactions
            </div>
          </>
        )}

        {activeTab === 'topUp' && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs uppercase">Top Up Date</th>
                    <th className="px-6 py-3 text-left text-xs uppercase">REN</th>
                    <th className="px-6 py-3 text-left text-xs uppercase">Top Up Amount</th>
                    <th className="px-6 py-3 text-left text-xs uppercase">Top Up Status</th>
                    <th className="px-6 py-3 text-left text-xs uppercase">Approved / Rejected By</th>
                    <th className="px-6 py-3 text-left text-xs uppercase">Approved / Rejected Date</th>
                    <th className="px-6 py-3 text-center text-xs uppercase">Action</th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y">
                  {filteredTopUpTransactions.map((t) => (
                    <tr key={t.RenTopUpRowId}>
                      <td className="px-6 py-4">{formatTopUpDate(t.TopUpDate)}</td>
                      <td className="px-6 py-4">{t.UserDisplayName}</td>
                      <td className="px-6 py-4">{formatMoney(t.TopUpAmt)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(t.TopUpStatus)}`}>
                          {t.TopUpStatus || 'PENDING'}
                        </span>
                      </td>
                      <td className="px-6 py-4">{t.AppRejByName || '-'}</td>
                      <td className="px-6 py-4">{formatTopUpDate(t.TopUpAppRejDate) || '-'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewTopUp(t)}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                            title="View"
                          >
                            <Eye size={18} />
                          </button>

                          {isAccountUser && canApproveRow(t.TopUpStatus) && (
                            <button
                              type="button"
                              onClick={() => handleOpenApproval(t)}
                              className="inline-flex items-center justify-center rounded-lg p-2 text-green-600 hover:bg-green-50"
                              title="Approve / Reject"
                            >
                              <CheckCircle size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!loadingTopUpTransactions && filteredTopUpTransactions.length === 0 && (
              <p className="text-center py-12 text-gray-500">No top up transactions found.</p>
            )}

            <div className="mt-4 px-6 pb-4 text-sm">
              Showing {filteredTopUpTransactions.length} of {topUpTransactions.length} top up transactions
            </div>
          </>
        )}
      </div>

      {isTopUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Top Up REN</h2>

            <form onSubmit={handleTopUpSubmit} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">REN Name</label>
                <div className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-800">
                  {loginDisplayName || '-'}
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Remarks</label>
                <textarea
                  value={topUpRemarks}
                  onChange={(e) => setTopUpRemarks(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Upload Slip</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setTopUpFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeTopUp}
                  disabled={topUpSubmitting}
                  className="px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={topUpSubmitting}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg"
                >
                  {topUpSubmitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isViewTopUpOpen && selectedTopUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-semibold">Top Up Transaction Details</h2>
              <button
                type="button"
                onClick={closeViewTopUp}
                className="px-3 py-1 border rounded-lg"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm text-gray-500 mb-1">Top Up Date</label>
                <div className="border rounded-lg px-3 py-2 bg-gray-50">
                  {formatTopUpDateTime(selectedTopUp.TopUpDate) || '-'}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-1">REN</label>
                <div className="border rounded-lg px-3 py-2 bg-gray-50">
                  {selectedTopUp.UserDisplayName || selectedTopUp.UserName || '-'}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-1">Top Up Amount</label>
                <div className="border rounded-lg px-3 py-2 bg-gray-50">
                  {formatMoney(selectedTopUp.TopUpAmt)}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-1">Status</label>
                <div className="border rounded-lg px-3 py-2 bg-gray-50">
                  {selectedTopUp.TopUpStatus || 'PENDING'}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-1">Approved / Rejected By</label>
                <div className="border rounded-lg px-3 py-2 bg-gray-50">
                  {selectedTopUp.AppRejByName || '-'}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-1">Approved / Rejected Date</label>
                <div className="border rounded-lg px-3 py-2 bg-gray-50">
                  {formatTopUpDateTime(selectedTopUp.TopUpAppRejDate) || '-'}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-500 mb-1">Top Up Remarks</label>
              <div className="border rounded-lg px-3 py-2 bg-gray-50 min-h-[44px] whitespace-pre-wrap">
                {selectedTopUp.Remarks || '-'}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm text-gray-500 mb-1">Reject Remarks</label>
              <div className="border rounded-lg px-3 py-2 bg-gray-50 min-h-[44px] whitespace-pre-wrap">
                {selectedTopUp.AppRejRemarks || '-'}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-500 mb-2">Uploaded File</label>

              {!selectedAttachmentUrl && !selectedTopUp.AttName && (
                <div className="border rounded-lg px-3 py-8 bg-gray-50 text-center text-gray-500">
                  No uploaded file
                </div>
              )}

              {(selectedAttachmentUrl || selectedTopUp.AttName) && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  {showImagePreview && selectedAttachmentUrl ? (
                    <img
                      src={selectedAttachmentUrl}
                      alt={selectedTopUp.AttName || 'Uploaded file'}
                      className="max-h-[420px] w-auto mx-auto rounded border"
                    />
                  ) : (
                    <div className="text-sm text-gray-700">
                      <div className="mb-2">{selectedTopUp.AttName || 'Attachment available'}</div>
                      {selectedAttachmentUrl && (
                        <a
                          href={selectedAttachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg"
                        >
                          Open Attachment
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isApprovalOpen && approvalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-semibold">Approve / Reject Top Up</h2>
              <button
                type="button"
                onClick={closeApprovalPopup}
                disabled={approvalSubmitting}
                className="px-3 py-1 border rounded-lg"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmitApproval} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">REN</label>
                <div className="w-full border rounded-lg px-3 py-2 bg-gray-50">
                  {approvalTarget.UserDisplayName || approvalTarget.UserName || '-'}
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1">Top Up Amount</label>
                <div className="w-full border rounded-lg px-3 py-2 bg-gray-50">
                  {formatMoney(approvalTarget.TopUpAmt)}
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2">Action</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setApprovalAction('APPROVED')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border ${
                      approvalAction === 'APPROVED'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    <CheckCircle size={18} />
                    Approve
                  </button>

                  <button
                    type="button"
                    onClick={() => setApprovalAction('REJECTED')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border ${
                      approvalAction === 'REJECTED'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    <XCircle size={18} />
                    Reject
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1">
                  Remarks {approvalAction === 'REJECTED' ? '*' : ''}
                </label>
                <textarea
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={4}
                  placeholder={
                    approvalAction === 'REJECTED'
                      ? 'Please key in rejection remarks'
                      : 'Optional remarks'
                  }
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeApprovalPopup}
                  disabled={approvalSubmitting}
                  className="px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approvalSubmitting}
                  className={`px-4 py-2 text-white rounded-lg ${
                    approvalAction === 'APPROVED' ? 'bg-green-600' : 'bg-red-600'
                  }`}
                >
                  {approvalSubmitting
                    ? 'Saving...'
                    : approvalAction === 'APPROVED'
                    ? 'Confirm Approve'
                    : 'Confirm Reject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <NewPurchasePopup
        show={showPurchaseModal}
        onClose={closePurchaseModal}
        items={items}
        filteredItems={filteredItems}
        selectedItem={selectedItem}
        itemSearch={itemSearch}
        setItemSearch={setItemSearch}
        setSelectedItem={setSelectedItem}
        loginUserId={loginUserId}
        loginDisplayName={loginDisplayName}
        purchaseRen={purchaseRen}
        setPurchaseRen={setPurchaseRen}
        purchaseQty={purchaseQty}
        purchasePrice={purchasePrice}
        purchaseRemarks={purchaseRemarks}
        setPurchaseQty={setPurchaseQty}
        setPurchasePrice={setPurchasePrice}
        setPurchaseRemarks={setPurchaseRemarks}
        computedTotal={computedTotal}
        openingBalance={openingBalance}
        openingBalanceNum={openingBalanceNum}
        balanceAfterPurchase={balanceAfterPurchase}
        saveErrorPurchase={saveErrorPurchase}
        savingPurchase={savingPurchase}
        handleSavePurchase={handleSavePurchase}
      />
    </div>
  );
};

export default InventoryTrans;