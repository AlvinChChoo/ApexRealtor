import { API_ENDPOINTS } from '../../config/apiConfig';
// src/components/Payments/PaymentSession.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus as PlusIcon,
  RefreshCcw as RefreshIcon,
  ChevronDown,
  ChevronUp,
  Paperclip,
  CheckSquare,
  Trash2,
  CheckCircle2,
  XCircle,
  Upload as UploadIcon,
  X as XIcon,
  Printer,
} from "lucide-react";
import type { RentalApplication } from "../../types";

import PaymentHistory, { type StatusFilter, type UploadRow } from "./PaymentHistory";
import TenantProformaInvoicePopup from "./TenantProformaInvoicePopup";
import BuyerProformaInvoicePopup from "./BuyerProformaInvoicePopup";
import TenantEdInvoicePopup from "./TenantEdInvoicePopup";

import InvoiceList from "./InvoiceList";
import { printClaimForm } from "../../utils/pdfGenerators/claimFormPdf";
import {
  sanitizeDecimal,
  toNum,
  to2,
  to2s,
  currency,
  pickA,
  hasAnyDet,
  toDMY,
  parseAmtLoose,
} from "../../utils/paymentUtils";
import {
  REQUEST_COMM_SET_URL,
  COMM_EXPLOSION_URL,
  APPLICATION_REQUEST_PROFORMA_SET_URL,
  PAYMENT_TRANS_DET_URL,
  PAYMENT_TRANS_SET_URL,
  PAYMENT_SLIP_STATUS_SET_URL,
} from "../../constants/paymentApiUrls";
import type {
  PaymentSessionProps,
  ApiRow,
  ApiResponseFlat,
  UploadsResponse,
  PaymentHeader,
  PaymentDetailRow,
  PaymentBundle,
  PaymentDetSummary,
  PaymentDetApiResponse,
  Party,
  LocalFileItem,
} from "../../types/payment";

/** ============ Card ============ */
const PaymentCard: React.FC<{
  bundle: PaymentBundle;
  expanded: boolean;
  toggle: () => void;
  uploads: UploadRow[];
  detSummary?: PaymentDetSummary | null;
  onUpdated?: () => void;
  application?: RentalApplication;
  refreshSeq: number;
}> = ({
  bundle,
  expanded,
  toggle,
  uploads,
  detSummary,
  onUpdated,
  application,
  refreshSeq,
}) => {
  const h = bundle.header;

  const tenantAdminSstAmt = toNum(
    (application as any)?.TenantAdminFeesSstAmt ?? h.TenantAdminFeesSstAmt ?? 0
  );

  const tenantAdminSstFlag = toNum(
    (application as any)?.TenantAdminFeesSst ?? h.TenantAdminChargesSst ?? 0
  );

  // --- TransType-based labels (Rental vs Sales) ---
  const transTypeRaw = (application as any)?.TransType;
  const transType =
    typeof transTypeRaw === "string" ? transTypeRaw.toUpperCase() : "RENTAL";
  const isSales = transType === "SALES";

  // Visible labels
  const tenantLabel = isSales ? "Buyer" : "Tenant";
  const landlordLabel = isSales ? "Seller" : "Landlord";

  const tenantLabelUpper = tenantLabel.toUpperCase();
  const landlordLabelUpper = landlordLabel.toUpperCase();

  // account user
  const canApprove = localStorage.getItem("account") == "Y";

  // Shared base style for all bottom-row buttons
  const actionBtnBase =
    "inline-flex items-center justify-center gap-2 px-3 py-2 rounded text-sm h-10";

  // --- Local state ---
  const [savingHeader, setSavingHeader] = useState(false);
  const [showPaymentFromLandlord, setShowPaymentFromLandlord] = useState(true);

  // Approval modal state
  const [showApproval, setShowApproval] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState<UploadRow | null>(null);
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [submittingApproval, setSubmittingApproval] = useState(false);

  // Editable money inputs
  const [tenantToRen, setTenantToRen] = useState<string>(to2s(h.TenantToRen));
  const [landlordToRen, setLandlordToRen] = useState<string>(to2s(h.LandlordToRen));
  const [refundToTenant, setRefundToTenant] = useState<string>(to2s(h.RefundToTenant));
  const [refundToLandlord, setRefundToLandlord] = useState<string>(to2s(h.RefundToLandlord));

  // Collapse states
  const [openTenantHistory, setOpenTenantHistory] = useState(true);
  const [openLandlordHistory, setOpenLandlordHistory] = useState(true);
  const [openTenantBilling, setOpenTenantBilling] = useState(true);
  const [openBreakdown, setOpenBreakdown] = useState(true);

  // ED Invoice popup state
  const [edPopupOpen, setEdPopupOpen] = useState(false);

  // sync when header changes from server refresh
  useEffect(() => {
    setRefundToTenant(to2s(h.RefundToTenant));
    setRefundToLandlord(to2s(h.RefundToLandlord));
    setTenantToRen(to2s(h.TenantToRen));
    setLandlordToRen(to2s(h.LandlordToRen));
  }, [h.RefundToTenant, h.RefundToLandlord, h.TenantToRen, h.LandlordToRen]);

  // --- Request Proforma Invoice (Tenant / Landlord) ---
  const requestProforma = async (party: "TENANT" | "LANDLORD") => {
    try {
      const fd = new FormData();

      fd.set("ApplicationId", String(h.ApplicationId || ""));
      fd.set("InvoiceType", party === "TENANT" ? "Tenant" : "Landlord");
      fd.set(
        "ApplicationStatus",
        party === "TENANT"
          ? "Pending Proforma Invoice(Tenant)"
          : "Pending Proforma Invoice(Landlord)"
      );
      fd.set("StatusCommand", "");
      fd.set("RequestStatus", "");
      fd.set(
        "PaymentTransJson",
        JSON.stringify({
          ui: "PaymentSession.REQUEST_PROFORMA",
          ApplicationId: h.ApplicationId,
          PaymentTransId: h.PaymentTransId,
          InvoiceType: party,
        })
      );

      const resp = await fetch(APPLICATION_REQUEST_PROFORMA_SET_URL, {
        method: "POST",
        body: fd,
      });

      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        throw new Error(`HTTP ${resp.status} ${resp.statusText}${t ? ` — ${t}` : ""}`);
      }

      const json = await resp.json().catch(() => ({}));

      if (json?.status !== "success") {
        throw new Error(json?.error || "Proforma request failed on server.");
      }

      const displayLabel = party === "TENANT" ? tenantLabel : landlordLabel;
      alert(`${displayLabel} Proforma Invoice requested successfully.`);
      onUpdated?.();
    } catch (e: any) {
      console.error("Proforma request failed:", e);
      alert(e?.message || "Failed to request Proforma Invoice.");
    }
  };

  // --- Pending uploads ---
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [localFiles, setLocalFiles] = useState<LocalFileItem[]>([]);
  const pendingTotal = localFiles.reduce((s, it) => s + toNum(it.amount), 0);
  const hasPending = localFiles.length > 0;

  const handlePickFiles = () => fileInputRef.current?.click();

  const onFilesPicked: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const list = e.target.files;
    if (!list || !list.length) return;

    const defParty: Party =
      h.ClaimParty === "Tenant" || h.ClaimParty === "Landlord"
        ? (h.ClaimParty as Party)
        : "Tenant";

    const newItems: LocalFileItem[] = Array.from(list).map((f) => ({
      id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2)}`,
      file: f,
      amount: "",
      date: "",
      party: defParty,
    }));

    setLocalFiles((prev) => [...prev, ...newItems]);
    e.currentTarget.value = "";
  };

  const removeLocalFile = (id: string) =>
    setLocalFiles((prev) => prev.filter((x) => x.id !== id));

  const updateLocalField = (id: string, patch: Partial<LocalFileItem>) =>
    setLocalFiles((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const cancelAllPending = () => setLocalFiles([]);

  // --- Save header only ---
  const saveHeader = async () => {
    try {
      setSavingHeader(true);

      const fd = new FormData();
      fd.set("PaymentTransId", String(h.PaymentTransId || ""));
      fd.set("ApplicationId", String(h.ApplicationId || ""));
      fd.set("RefundToTenant", to2(toNum(refundToTenant)));
      fd.set("RefundToLandlord", to2(toNum(refundToLandlord)));
      fd.set("TenantToRen", to2(toNum(tenantToRen)));
      fd.set("LandlordToRen", to2(toNum(landlordToRen)));

      const resp = await fetch(PAYMENT_TRANS_SET_URL, {
        method: "POST",
        body: fd,
      });

      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        throw new Error(`HTTP ${resp.status} ${resp.statusText}${t ? ` — ${t}` : ""}`);
      }

      const json = await resp.json().catch(() => ({}));

      if (json?.status !== "success") {
        throw new Error(json?.error || json?.message || "Save payment details failed.");
      }

      alert("Payment details updated");
      onUpdated?.();
    } catch (e: any) {
      console.error("Save payment details failed:", e);
      alert(e?.message || "Failed to save payment details.");
    } finally {
      setSavingHeader(false);
    }
  };

  // ===== Commission actions =====
  const handleRequestListerCommission = async () => {
    await handleRequestCommission("lister");
  };

  const handleRequestCloserCommission = async () => {
    await handleRequestCommission("closer");
  };

  const handleRequestCommission = async (type: "lister" | "closer") => {
    try {
      const appId = (application as any)?.ApplicationId ?? h.ApplicationId ?? "";

      if (!appId) {
        alert("Missing ApplicationId. Cannot submit commission request.");
        return;
      }

      const fd = new FormData();
      fd.set("ApplicationId", String(appId));
      fd.set("RequestStatus", "Pending Approval");
      fd.set("Type", type);

      fd.set(
        "RequestJson",
        JSON.stringify({
          ui: "PaymentSession.REQUEST_COMMISSION",
          ApplicationId: appId,
          PaymentTransId: h.PaymentTransId,
          Type: type,
        })
      );

      const resp = await fetch(REQUEST_COMM_SET_URL, {
        method: "POST",
        body: fd,
      });

      const raw = await resp.text();
      let json: any = null;
      try {
        json = JSON.parse(raw);
      } catch {}

      if (!resp.ok || !json || json.status !== "success") {
        const msg =
          (json && (json.data || json.error)) ||
          `Commission request failed. Server response: ${raw}`;
        throw new Error(msg);
      }

      alert(
        type === "lister"
          ? "Lister commission request submitted for approval."
          : "Closer commission request submitted for approval."
      );

      onUpdated?.();
    } catch (e: any) {
      console.error("Commission request failed:", e);
      alert(e?.message || "Failed to submit commission request.");
    }
  };

  const handleApproveListerCommission = async () => {
    try {
      const applicationId =
        (application as any)?.ApplicationId ?? h.ApplicationId ?? "";

      if (!applicationId) {
        alert("Missing ApplicationId");
        return;
      }

      const fd = new FormData();
      fd.append("ApplicationId", String(applicationId));
      fd.append("CommParty", "Lister");

      const resp = await fetch(COMM_EXPLOSION_URL, { method: "POST", body: fd });

      const raw = await resp.text();
      let json: any = null;
      try {
        json = JSON.parse(raw);
      } catch {}

      if (!resp.ok || !json) {
        throw new Error(`Approve failed: ${raw || "invalid server response"}`);
      }

      if (json.status === "success") {
        alert("Lister commission approved successfully.");
        onUpdated?.();
        return;
      }

      throw new Error(json.error || json.status || "Unknown error");
    } catch (e: any) {
      alert(`Approve failed: ${e?.message || "Unknown error"}`);
    }
  };

  const handleApproveCloserCommission = async () => {
    try {
      const applicationId =
        (application as any)?.ApplicationId ?? h.ApplicationId ?? "";

      if (!applicationId) {
        alert("Missing ApplicationId");
        return;
      }

      const fd = new FormData();
      fd.append("ApplicationId", String(applicationId));
      fd.append("CommParty", "Closer");

      const resp = await fetch(COMM_EXPLOSION_URL, { method: "POST", body: fd });

      const raw = await resp.text();
      let json: any = null;
      try {
        json = JSON.parse(raw);
      } catch {}

      if (!resp.ok || !json) {
        throw new Error(`Approve failed: ${raw || "invalid server response"}`);
      }

      if (json.status === "success") {
        alert("Closer commission approved successfully.");
        onUpdated?.();
        return;
      }

      throw new Error(json.error || json.status || "Unknown error");
    } catch (e: any) {
      alert(`Approve failed: ${e?.message || "Unknown error"}`);
    }
  };

  // --- Upload all ---
  const [uploading, setUploading] = useState(false);

  const uploadAll = async () => {
    if (localFiles.length === 0) return;

    const problems: string[] = [];
    for (const it of localFiles) {
      const missing: string[] = [];
      if (!it.date) missing.push("date");
      if (!(toNum(it.amount) > 0)) missing.push("amount");
      if (missing.length) problems.push(`${it.file.name}: missing ${missing.join(" & ")}`);
    }
    if (problems.length) {
      alert(
        "Please complete details for all files before upload:\n\n" +
          problems.map((p, i) => `${i + 1}. ${p}`).join("\n")
      );
      return;
    }

    try {
      setUploading(true);

      const fd = new FormData();
      fd.set("PaymentTransId", String(h.PaymentTransId));
      localFiles.forEach(({ file, amount, date, party }) => {
        fd.append("attachments[]", file, file.name);
        fd.append("totalAmt[]", to2(toNum(amount)));
        fd.append("paymentDate[]", toDMY(date));
        fd.append("ClaimParty[]", party);
      });
      fd.set(
        "PaymentTransJson",
        JSON.stringify({
          ui: "PaymentSession.UPLOAD_ALL",
          count: localFiles.length,
          total: to2(pendingTotal),
        })
      );

      const resp = await fetch(PAYMENT_TRANS_SET_URL, { method: "POST", body: fd });
      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        throw new Error(`HTTP ${resp.status} ${resp.statusText}${t ? ` — ${t}` : ""}`);
      }
      const json = await resp.json().catch(() => ({}));
      if (json?.status !== "success") throw new Error(json?.error || "Upload failed at server.");

      alert(`Uploaded ${localFiles.length} slip(s).`);
      setLocalFiles([]);
      onUpdated?.();
    } catch (e: any) {
      console.error("Upload failed:", e);
      alert(e?.message || "Failed to upload.");
    } finally {
      setUploading(false);
    }
  };

  // --- Approval modal helpers ---
  const openApproval = (row: UploadRow) => {
    setApprovalTarget(row);
    setApprovalRemarks("");
    setShowApproval(true);
  };

  const closeApproval = () => {
    if (submittingApproval) return;
    setShowApproval(false);
    setApprovalTarget(null);
    setApprovalRemarks("");
  };

  const handleApproval = async (action: "approve" | "reject") => {
    if (!approvalTarget) return;
    const isReject = action === "reject";

    if (String(approvalRemarks).trim() === "") {
      alert(`Please enter remarks to ${isReject ? "reject" : "approve"}.`);
      return;
    }

    const readJsonSafely = async (resp: Response) => {
      const text = await resp.text();
      try {
        return JSON.parse(text);
      } catch {
        return { status: "failed", error: text || "Unknown server response" };
      }
    };

    try {
      setSubmittingApproval(true);
      const fd = new FormData();
      fd.set("RowId", String(approvalTarget.RowId));
      fd.set("PaymentStatus", isReject ? "REJECTED" : "APPROVED");
      fd.set("AppRejBy", localStorage.getItem("UserName") || "system");
      fd.set("PaymentTransId", String(h.PaymentTransId));
      fd.set("AppRejRem", approvalRemarks.trim());

      const resp = await fetch(PAYMENT_SLIP_STATUS_SET_URL, { method: "POST", body: fd });
      const json = await readJsonSafely(resp);

      if (!resp.ok || json?.status !== "success") {
        let details = "Server update failed.";
        const err = json?.error;
        if (typeof err === "string") details = err;
        else if (Array.isArray(err)) details = err[0]?.message || JSON.stringify(err);
        else if (err && typeof err === "object") details = err.message || JSON.stringify(err);
        throw new Error(details);
      }

      alert(`${isReject ? "Rejected" : "Approved"} • RowId=${String(approvalTarget.RowId)}`);
      closeApproval();
      onUpdated?.();
    } catch (e: any) {
      console.error("Approval submit failed:", e);
      alert(e?.message || "Failed to submit approval.");
    } finally {
      setSubmittingApproval(false);
    }
  };

  // totals
  const tenantTotal =
    toNum(h.TenantServiceFeesTotal) +
    toNum(h.TenantAdminChargesTotal) +
    toNum(h.TenantStampDuty);

  const landlordTotal =
    toNum(h.LandlordProfFeesTotal) +
    toNum(h.LandlordAdminChargesTotal) +
    toNum(h.LandlordStampDuty) +
    toNum(h.LandlordMisc);

  const detTotal =
    (detSummary?.EarnestDeposit ?? 0) +
    (detSummary?.SecurityDeposit ?? 0) +
    (detSummary?.UtilityDeposit ?? 0) +
    (detSummary?.AccessCardDeposit ?? 0) +
    (detSummary?.IndahWater ?? 0) +
    (detSummary?.OtherDeposit ?? 0);

  /** =========================
   *  Status filter (per table)
   *  ========================= */
  const [tenantFilter, setTenantFilter] = useState<StatusFilter>("PENDING");
  const [landlordFilter, setLandlordFilter] = useState<StatusFilter>("PENDING");

  const normStatus = (s?: string | null) =>
    (s ?? "")
      .toString()
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase()
      .replace(/\s*\(\s*/g, "(")
      .replace(/\s*\)\s*/g, ")")
      .replace("REJETED", "REJECTED");

  // commission status
  const reqListerStatusNorm = normStatus((application as any)?.ReqCommListerStatus as any);
  const rawCloserStatus =
    (application as any)?.ReqCommCloserStatus ?? (application as any)?.ReqCommLCloserStatus;
  const reqCloserStatusNorm = normStatus(rawCloserStatus as any);

  const canRequestListerCommission =
    !canApprove && (reqListerStatusNorm === "" || reqListerStatusNorm === "REJECTED");
  const canRequestCloserCommission =
    !canApprove && (reqCloserStatusNorm === "" || reqCloserStatusNorm === "REJECTED");

  const canApproveListerCommission = canApprove;
  const canApproveCloserCommission = canApprove;

  const applyFilter = (rows: UploadRow[], filter: StatusFilter) =>
    rows.filter((r) => {
      const s = normStatus(r.PaymentStatus);
      if (filter === "ALL") return true;
      if (filter === "PENDING") return s !== "APPROVED" && s !== "REJECTED";
      if (filter === "APPROVED") return s === "APPROVED";
      if (filter === "REJECTED") return s === "REJECTED";
      return true;
    });

  const sumAmt = (rows: UploadRow[]) => rows.reduce((s, r) => s + parseAmtLoose(r.PaymentAmt), 0);

  const relatedUploads = (Array.isArray(uploads) ? uploads : []).filter(
    (u) => String(u.PaymentTransId) === String(h.PaymentTransId)
  );

  const approvedTenantUploads = relatedUploads.filter(
    (u) =>
      (u.ClaimParty || "").toLowerCase() === "tenant" &&
      normStatus(u.PaymentStatus) === "APPROVED"
  );

  const approvedLandlordUploads = relatedUploads.filter(
    (u) =>
      (u.ClaimParty || "").toLowerCase() === "landlord" &&
      normStatus(u.PaymentStatus) === "APPROVED"
  );

  const totalApprovedTenantPayment = sumAmt(approvedTenantUploads);
  const totalApprovedLandlordPayment = sumAmt(approvedLandlordUploads);

  const recalcRefundToLandlord = useCallback(
    (tenantRefundValue?: string | number) => {
      const refundTenant = toNum(
        tenantRefundValue !== undefined ? tenantRefundValue : refundToTenant
      );

      const tenantBilling =
        toNum(h.TenantServiceFeesTotal) +
        toNum(h.TenantAdminChargesTotal) +
        toNum(h.TenantStampDuty);

      const landlordBilling =
        toNum(h.LandlordProfFeesTotal) +
        toNum(h.LandlordAdminChargesTotal) +
        toNum(h.LandlordStampDuty) +
        toNum(h.LandlordMisc);

      const refundToRen = toNum((h as any).AtrOtherDepositAmt ?? 0);

const landlordRefund =
  totalApprovedLandlordPayment +
  totalApprovedTenantPayment -
  tenantBilling -
  landlordBilling -
  refundTenant -
  refundToRen;
      //setRefundToLandlord(to2s(Math.max(0, landlordRefund)));
      setRefundToLandlord(to2s(landlordRefund));
    },
    [
      refundToTenant,
      h.TenantServiceFeesTotal,
      h.TenantAdminChargesTotal,
      h.TenantStampDuty,
      h.LandlordProfFeesTotal,
      h.LandlordAdminChargesTotal,
      h.LandlordStampDuty,
      h.LandlordMisc,
      totalApprovedTenantPayment,
      totalApprovedLandlordPayment,
    ]
  );

  useEffect(() => {
    recalcRefundToLandlord();
  }, [
    totalApprovedTenantPayment,
    totalApprovedLandlordPayment,
    refundToTenant,
    recalcRefundToLandlord,
  ]);

  /** ============ Proforma visibility + enable/disable logic ============ */
  const tenantProformaStatusNorm = normStatus(
    (application as any)?.RequestTenantProformaInvoiceStatus as any
  );
  const landlordProformaStatusNorm = normStatus(
    (application as any)?.RequestLandlordProformaInvoiceStatus as any
  );

  const isAccountUser =
    String(localStorage.getItem("account") || "").trim().toUpperCase() === "Y";

  // totals-based enable
  const tenantBillingTotal =
    toNum(h.TenantServiceFeesTotal) +
    toNum(h.TenantAdminChargesTotal) +
    toNum(h.TenantStampDuty);

  const landlordBillingTotal =
    toNum(h.LandlordProfFeesTotal) +
    toNum(h.LandlordAdminChargesTotal) +
    toNum(h.LandlordStampDuty) +
    toNum(h.LandlordMisc);

  const hasTenantBillingTotal = tenantBillingTotal > 0;
  const hasLandlordBillingTotal = landlordBillingTotal > 0;

  // request proforma
  const canRequestTenantProforma =
    !canApprove && (tenantProformaStatusNorm === "" || tenantProformaStatusNorm === "REJECTED");
  const canRequestLandlordProforma =
    !canApprove &&
    (landlordProformaStatusNorm === "" || landlordProformaStatusNorm === "REJECTED");

  const canRequestTenantProformaEnabled =
    canRequestTenantProforma && hasTenantBillingTotal;
  const canRequestLandlordProformaEnabled =
    canRequestLandlordProforma && hasLandlordBillingTotal;

  // generate proforma
  const canGenerateTenantProforma = isAccountUser;
  const canGenerateLandlordProforma = isAccountUser;

  const canGenerateTenantProformaEnabled =
    canGenerateTenantProforma && hasTenantBillingTotal;
  const canGenerateLandlordProformaEnabled =
    canGenerateLandlordProforma && hasLandlordBillingTotal;

  // request commission
  const canRequestListerCommissionEnabled =
    canRequestListerCommission && hasLandlordBillingTotal;
  const canRequestCloserCommissionEnabled =
    canRequestCloserCommission && parseAmtLoose(h.TenantServiceFees) > 0;

  // generate commission mirrors proforma generate enable
  const canGenerateListerCommission = canApproveListerCommission;
  const canGenerateCloserCommission = canApproveCloserCommission;

  const canGenerateListerCommissionEnabled =
    canGenerateListerCommission && canGenerateLandlordProformaEnabled;
  const canGenerateCloserCommissionEnabled =
    canGenerateCloserCommission && canGenerateTenantProformaEnabled;

  // popup state
  const [proformaPopupOpen, setProformaPopupOpen] = useState(false);
  const [proformaPopupParty, setProformaPopupParty] = useState<"TENANT" | "LANDLORD">("TENANT");

  const openProformaPopup = (party: "TENANT" | "LANDLORD") => {
    setProformaPopupParty(party);
    setProformaPopupOpen(true);
  };

  const closeProformaPopup = () => {
    setProformaPopupOpen(false);
  };

  const disabledBtn = "opacity-60 cursor-not-allowed";

  return (
    <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 hover:bg-gray-200"
      >
        <div className="text-left">
          <div className="text-sm text-gray-500">
            PaymentTransId: {h.PaymentTransId} • RefNo: {h.PaymentTransRefNo || "—"}
          </div>

          <div className="font-semibold">
            Total Received: {currency(h.TotalReceived)}{" "}
            {false && (
              <span className="text-xs text-gray-500">
                ({tenantLabel}: {currency(tenantTotal)} • {landlordLabel}: {currency(landlordTotal)})
              </span>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-6">
          {/* ===== Attachments / Pending uploads ===== */}
          <div>
            <div className="font-semibold mb-2 flex items-center gap-2">
              <Paperclip className="w-4 h-4" /> Attachments
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf"
              className="hidden"
              onChange={onFilesPicked}
            />
            <button
              type="button"
              onClick={handlePickFiles}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Add payment slips
            </button>

            {hasPending && (
              <div className="mt-4 border rounded-lg">
                <div className="p-3 space-y-2">
                  {localFiles.map((it) => {
                    const filename = it.file.name;
                    const sizeKb = (it.file.size / 1024).toFixed(1);
                    return (
                      <div key={it.id} className="border rounded p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{filename}</div>
                            <div className="text-xs text-gray-500">
                              {sizeKb} KB • {it.file.type || "file"}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeLocalFile(it.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-red-700 border border-red-200 rounded hover:bg-red-50"
                            title="Remove pending"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>

                        <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-3">
                          <div className="md:col-span-4">
                            <label className="text-xs text-gray-600">Payment Date</label>
                            <input
                              type="date"
                              value={it.date}
                              onChange={(e) => updateLocalField(it.id, { date: e.target.value })}
                              className="w-full border rounded px-2 py-1"
                            />
                          </div>
                          <div className="md:col-span-4">
                            <label className="text-xs text-gray-600">Amount (RM)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9]*[.]?[0-9]*"
                              value={it.amount}
                              onChange={(e) =>
                                updateLocalField(it.id, { amount: sanitizeDecimal(e.target.value) })
                              }
                              className="w-full border rounded px-2 py-1 text-right"
                            />
                          </div>
                          <div className="md:col-span-4">
                            <label className="text-xs text-gray-600"> Payment From </label>
                            <select
                              value={it.party}
                              onChange={(e) =>
                                updateLocalField(it.id, { party: e.target.value as Party })
                              }
                              className="w-full border rounded px-2 py-1"
                            >
                              <option value="Tenant">{tenantLabel}</option>
                              <option value="Landlord">{landlordLabel}</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t px-3 py-2 bg-gray-50 flex items-center justify-between rounded-b-lg">
                  <div className="text-sm text-gray-700">
                    <span className="font-semibold">{localFiles.length}</span> file(s) •{" "}
                    <span className="font-semibold">Sum:</span> {currency(to2(pendingTotal))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cancelAllPending}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
                      disabled={uploading || localFiles.length === 0}
                      title="Cancel all pending"
                    >
                      <XIcon className="w-4 h-4" />
                      Cancel all
                    </button>
                    <button
                      type="button"
                      onClick={uploadAll}
                      disabled={uploading || localFiles.length === 0}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded text-white ${
                        uploading || localFiles.length === 0
                          ? "bg-blue-600/60 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700"
                      }`}
                      title="Upload all"
                    >
                      <UploadIcon className={`w-4 h-4 ${uploading ? "animate-pulse" : ""}`} />
                      {uploading ? "Uploading…" : `Submit - ${localFiles.length} slip(s)`}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!hasPending &&
              (() => {
                const safeUploads = Array.isArray(uploads) ? uploads : [];
                const related = safeUploads.filter(
                  (u) => String(u.PaymentTransId) === String(h.PaymentTransId)
                );
                if (related.length === 0) {
                  return <div className="text-sm text-gray-500 mt-4">— none —</div>;
                }

                const tenantUploads = related.filter(
                  (u) => (u.ClaimParty || "").toLowerCase() === "tenant"
                );
                const landlordUploads = related.filter(
                  (u) => (u.ClaimParty || "").toLowerCase() === "landlord"
                );

                const tenantFiltered = applyFilter(tenantUploads, tenantFilter);
                const landlordFiltered = applyFilter(landlordUploads, landlordFilter);

                const tenantTotalAmt = sumAmt(tenantFiltered);
                const landlordTotalAmt = sumAmt(landlordFiltered);
                const combinedTotalAmt = tenantTotalAmt + landlordTotalAmt;

                return (
                  <>
                    <PaymentHistory
                      title={`${tenantLabelUpper} PAYMENT HISTORY`}
                      rows={tenantUploads}
                      currentFilter={tenantFilter}
                      onChangeFilter={setTenantFilter}
                      canApprove={canApprove}
                      onApprovalClick={openApproval}
                      collapsed={!openTenantHistory}
                      onToggleCollapse={() => setOpenTenantHistory((v) => !v)}
                    />

                    <PaymentHistory
                      title={`${landlordLabelUpper} PAYMENT HISTORY`}
                      rows={landlordUploads}
                      currentFilter={landlordFilter}
                      onChangeFilter={setLandlordFilter}
                      canApprove={canApprove}
                      onApprovalClick={openApproval}
                      collapsed={!openLandlordHistory}
                      onToggleCollapse={() => setOpenLandlordHistory((v) => !v)}
                    />

                    <div className="mt-4 border rounded px-3 py-2 bg-gray-100 flex items-center justify-between">
                      <span className="font-semibold">{`${tenantLabelUpper} + ${landlordLabelUpper}`}</span>
                      <span className="font-bold">{currency(combinedTotalAmt.toFixed(2))}</span>
                    </div>
                  </>
                );
              })()}
          </div>

          {!hasPending && (
            <div className="space-y-4">
              {/* ===== Tenant/Buyer billing ===== */}
              <div className="border rounded-lg shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpenTenantBilling((v) => !v)}
                  className="w-full bg-gray-100 px-4 py-2 font-semibold text-gray-700 rounded-t-lg flex items-center justify-between"
                >
                  <span>{tenantLabelUpper} BILLING DETAILS</span>
                  {openTenantBilling ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </button>

                {openTenantBilling && (
                  <div className="p-4 space-y-3 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      <label className="md:col-span-1">Service Fees</label>
                      <div className="md:col-span-1">{currency(h.TenantServiceFees)}</div>
                      <div className="md:col-span-1 flex items-center gap-2">
                        {toNum(h.TenantServiceFeesSst) > 0 && (
                          <CheckSquare className="w-4 h-4 text-green-600" />
                        )}
                        <span>SST (8%): {currency(h.TenantServiceFeesSst)}</span>
                      </div>
                      <div className="md:col-span-1 text-right font-medium">
                        {currency(h.TenantServiceFeesTotal)}
                      </div>
                    </div>

                    {!isSales && (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                        <label className="md:col-span-1">Admin Charges</label>
                        <div className="md:col-span-1">{currency(h.TenantAdminCharges)}</div>
                        <div className="md:col-span-1 flex items-center gap-2">
                          {(tenantAdminSstFlag > 0 || tenantAdminSstAmt > 0) && (
                            <CheckSquare className="w-4 h-4 text-green-600" />
                          )}
                          
                          <span>SST (8%): {currency(h.TenantAdminChargesSst)}</span>
                        </div>
                        <div className="md:col-span-1 text-right font-medium">
                          {currency(h.TenantAdminChargesTotal)}
                        </div>
                      </div>
                    )}

                    {!isSales && (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                        <label className="md:col-span-1">Stamp Duty</label>
                        <div className="md:col-span-1">{currency(h.TenantStampDuty)}</div>
                        <div className="md:col-span-1" />
                        <div className="md:col-span-1 text-right font-medium">
                          {currency(h.TenantStampDuty)}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center font-semibold pt-2">
                      <label className="md:col-span-1">TOTAL</label>
                      <div className="md:col-span-1" />
                      <div className="md:col-span-1" />
                      <div className="md:col-span-1 text-right">
                        {currency(
                          toNum(h.TenantServiceFeesTotal) +
                            toNum(h.TenantAdminChargesTotal) +
                            toNum(h.TenantStampDuty)
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ===== Landlord/Seller breakdown ===== */}
              <div className="border rounded-lg shadow-sm mt-4">
                <button
                  type="button"
                  onClick={() => setOpenBreakdown((v) => !v)}
                  className="w-full bg-gray-100 px-4 py-2 font-semibold text-gray-700 rounded-t-lg flex items-center justify-between"
                >
                  <span>PAYMENT BREAKDOWN FOR {landlordLabelUpper}</span>
                  {openBreakdown ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </button>

                {openBreakdown && (
                  <div className="p-4 space-y-3 text-sm">
                    {[
                      [
                        isSales ? "Earnest Deposit" : "Earnest Deposit / Advance Rental",
                        detSummary?.EarnestDeposit ?? 0,
                      ],
                      ["Security Deposit", detSummary?.SecurityDeposit ?? 0],
                      ["Utility Deposit", detSummary?.UtilityDeposit ?? 0],
                      ["Access Card", detSummary?.AccessCardDeposit ?? 0],
                      ["Indah Water", detSummary?.IndahWater ?? 0],
                      ["Reimburse to REN", detSummary?.OtherDeposit ?? 0],
                    ].map(([label, value]) => {
                      if (isSales && label !== "Earnest Deposit") return null;

                      return (
                        <div key={label as string} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <span>{label as string}</span>
                          <input
                            type="text"
                            className="border rounded px-3 py-2 bg-gray-100 text-right"
                            readOnly
                            value={currency(Number(value))}
                          />
                        </div>
                      );
                    })}

                    {!isSales && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-semibold pt-2">
                        <span>Total</span>
                        <input
                          type="text"
                          className="border rounded px-3 py-2 bg-gray-100 text-right font-semibold"
                          readOnly
                          value={currency(detTotal)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ===== Landlord/Seller billing ===== */}
              <div className="border rounded-lg shadow-sm">
                <button
                  type="button"
                  onClick={() => setShowPaymentFromLandlord((v) => !v)}
                  className="w-full bg-gray-100 px-4 py-2 font-semibold text-gray-700 rounded-t-lg flex items-center justify-between"
                >
                  <span>PAYMENT FROM {landlordLabelUpper}</span>
                  {showPaymentFromLandlord ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </button>

                {showPaymentFromLandlord && (
                  <div className="p-4 space-y-3 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      <label className="md:col-span-1">Professional Fees</label>
                      <div className="md:col-span-1">{currency(h.LandlordProfFees)}</div>
                      <div className="md:col-span-1 flex items-center gap-2">
                        {toNum(h.LandlordProfFeesSst) > 0 && (
                          <CheckSquare className="w-4 h-4 text-green-600" />
                        )}
                        <span>SST (8%): {currency(h.LandlordProfFeesSst)}</span>
                      </div>
                      <div className="md:col-span-1 text-right font-medium">
                        {currency(h.LandlordProfFeesTotal)}
                      </div>
                    </div>

                    {!isSales && (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                        <label className="md:col-span-1">Admin Charges</label>
                        <div className="md:col-span-1">{currency(h.LandlordAdminCharges)}</div>
                        <div className="md:col-span-1 flex items-center gap-2">
                          {toNum(h.LandlordAdminChargesSst) > 0 && (
                            <CheckSquare className="w-4 h-4 text-green-600" />
                          )}
                          <span>SST (8%): {currency(h.LandlordAdminChargesSst)}</span>
                        </div>
                        <div className="md:col-span-1 text-right font-medium">
                          {currency(h.LandlordAdminChargesTotal)}
                        </div>
                      </div>
                    )}

                    {!isSales && (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                        <label className="md:col-span-1">Stamp Duty</label>
                        <div className="md:col-span-1" />
                        <div className="md:col-span-1" />
                        <div className="md:col-span-1 text-right">
                          {currency(h.LandlordStampDuty)}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      <label className="md:col-span-1">Misc</label>
                      <div className="md:col-span-1" />
                      <div className="md:col-span-1" />
                      <div className="md:col-span-1 text-right">{currency(h.LandlordMisc)}</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center font-semibold pt-2">
                      <label className="md:col-span-1">TOTAL</label>
                      <div className="md:col-span-1" />
                      <div className="md:col-span-1" />
                      <div className="md:col-span-1 text-right">
                        {currency(
                          toNum(h.LandlordProfFeesTotal) +
                            toNum(h.LandlordAdminChargesTotal) +
                            toNum(h.LandlordStampDuty) +
                            toNum(h.LandlordMisc)
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ===== Refund ===== */}
<div className="border rounded-lg shadow-sm">
  <div className="w-full bg-gray-100 px-4 py-2 font-semibold text-gray-700 rounded-t-lg">
    REFUND
  </div>

  <div className="p-4 space-y-3 text-sm">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
      <label className="md:col-span-1">Refund to REN</label>
      <div className="md:col-span-2" />
      <div className="md:col-span-1">
        <input
          type="text"
          value={to2s((h as any).AtrOtherDepositAmt ?? 0)}
          disabled
          readOnly
          className="w-full border rounded px-3 py-2 text-right bg-gray-100 text-gray-700 cursor-not-allowed"
          title="Refund to REN"
        />
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
  <label className="md:col-span-1">Refund to {tenantLabel}</label>
  <div className="md:col-span-2" />
  <div className="md:col-span-1">
    <input
      type="text"
      inputMode="decimal"
      pattern="[0-9]*[.]?[0-9]*"
      value={refundToTenant}
      onChange={(e) => {
        const val = sanitizeDecimal(e.target.value);
        setRefundToTenant(val);
        recalcRefundToLandlord(val);
      }}
      placeholder="0.00"
      className="w-full border rounded px-3 py-2 text-right"
      title={`Refund to ${tenantLabel}`}
    />
  </div>
</div>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
  <label className="md:col-span-1">Refund to {landlordLabel}</label>
  <div className="md:col-span-2" />
  <div className="md:col-span-1">
    <input
      type="text"
      inputMode="decimal"
      pattern="[0-9]*[.]?[0-9]*"
      value={refundToLandlord}
      disabled
      readOnly
      placeholder="0.00"
      className="w-full border rounded px-3 py-2 text-right bg-gray-100 text-gray-700 cursor-not-allowed"
      title={`Refund to ${landlordLabel}`}
    />
  </div>
</div>
  </div>
</div>

              {Number(application?.IntroCommAmt || 0) > 0 && (
                <div className="border rounded-lg shadow-sm">
                  <div className="bg-gray-100 px-4 py-2 font-semibold text-gray-700 rounded-t-lg">
                    Payment to Introducer • Bank Details
                  </div>

                  <div className="p-4 space-y-3 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      <label className="md:col-span-1">Payment to Introducer (RM)</label>
                      <div className="md:col-span-2" />
                      <div className="md:col-span-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9]*[.]?[0-9]*"
                          value={application.IntroCommAmt}
                          placeholder="0.00"
                          className="w-full border rounded px-3 py-2 text-right"
                          title="Payment to Introducer (RM)"
                          readOnly
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      <label className="md:col-span-1 text-gray-600">Bank</label>
                      <div className="md:col-span-3">
                        <input
                          type="text"
                          className="w-full border rounded px-3 py-2 bg-gray-100"
                          readOnly
                          value={(application as any)?.IntroBanker ?? "—"}
                          title="Bank"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      <label className="md:col-span-1 text-gray-600">Bank Account No</label>
                      <div className="md:col-span-3">
                        <input
                          type="text"
                          className="w-full border rounded px-3 py-2 bg-gray-100"
                          readOnly
                          value={(application as any)?.IntroBankAccNo ?? "—"}
                          title="Introducer Bank Account No"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      <label className="md:col-span-1 text-gray-600">Account Holder Name</label>
                      <div className="md:col-span-3">
                        <input
                          type="text"
                          className="w-full border rounded px-3 py-2 bg-gray-100"
                          readOnly
                          value={(application as any)?.IntroBankHolder ?? "—"}
                          title="Introducer Account Holder Name"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!hasPending && (
            <InvoiceList
              paymentTransId={h.PaymentTransId}
              applicationId={h.ApplicationId}
              application={application}
              refreshSeq={refreshSeq}
              onInvoiceGenerated={onUpdated}
            />
          )}

          {!hasPending && (
            <div className="pt-4 space-y-2">
              {/* Row 1 */}
              <div className="flex flex-wrap gap-2 items-stretch">
                <div className="flex flex-wrap gap-2 items-stretch">
                  {canGenerateLandlordProforma && (
                    <button
                      type="button"
                      onClick={() => openProformaPopup("LANDLORD")}
                      disabled={!canGenerateLandlordProformaEnabled}
                      className={`${actionBtnBase} border border-green-500 bg-green-100 text-green-800 hover:bg-green-200 ${
                        !canGenerateLandlordProformaEnabled ? disabledBtn : ""
                      }`}
                    >
                      Generate Lister Proforma Invoice
                    </button>
                  )}

                  {canGenerateTenantProforma && (
                    <button
                      type="button"
                      onClick={() => openProformaPopup("TENANT")}
                      disabled={!canGenerateTenantProformaEnabled}
                      className={`${actionBtnBase} border border-green-600 bg-green-600 text-white hover:bg-green-700 ${
                        !canGenerateTenantProformaEnabled ? disabledBtn : ""
                      }`}
                    >
                      Generate Closer Proforma Invoice
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setEdPopupOpen(true)}
                    className={`${actionBtnBase} border border-purple-500 bg-purple-100 text-purple-800 hover:bg-purple-200`}
                  >
                    Generate ED Invoice
                  </button>
                </div>
              </div>

              {/* Row 2 */}
              {!canApprove && (
                <div className="flex flex-wrap gap-2 items-stretch">
                  {canRequestTenantProforma && (
                    <button
                      type="button"
                      onClick={() => requestProforma("TENANT")}
                      disabled={!canRequestTenantProformaEnabled}
                      className={`${actionBtnBase} border border-green-600 bg-green-600 text-white hover:bg-green-700 ${
                        !canRequestTenantProformaEnabled ? disabledBtn : ""
                      }`}
                    >
                      Request {tenantLabel} Proforma Invoice
                    </button>
                  )}

                  {canRequestLandlordProforma && (
                    <button
                      type="button"
                      onClick={() => requestProforma("LANDLORD")}
                      disabled={!canRequestLandlordProformaEnabled}
                      className={`${actionBtnBase} border border-green-500 bg-green-100 text-green-800 hover:bg-green-200 ${
                        !canRequestLandlordProformaEnabled ? disabledBtn : ""
                      }`}
                    >
                      Request {landlordLabel} Proforma Invoice
                    </button>
                  )}
                </div>
              )}

              {/* Row 3 */}
              <div className="flex flex-wrap gap-2 items-stretch">
                {canRequestListerCommission && (
                  <button
                    type="button"
                    onClick={handleRequestListerCommission}
                    disabled={!canRequestListerCommissionEnabled}
                    className={`${actionBtnBase} border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 ${
                      !canRequestListerCommissionEnabled ? disabledBtn : ""
                    }`}
                  >
                    Request Lister Commission
                  </button>
                )}

                {canRequestCloserCommission && (
                  <button
                    type="button"
                    onClick={handleRequestCloserCommission}
                    disabled={!canRequestCloserCommissionEnabled}
                    className={`${actionBtnBase} border border-blue-500 bg-blue-100 text-blue-800 hover:bg-blue-200 ${
                      !canRequestCloserCommissionEnabled ? disabledBtn : ""
                    }`}
                  >
                    Request Closer Commission
                  </button>
                )}
              </div>

              {/* Row 4 */}
              <div className="flex flex-wrap gap-2 items-stretch">
                {canGenerateListerCommission && (
                  <button
                    type="button"
                    onClick={handleApproveListerCommission}
                    disabled={!canGenerateListerCommissionEnabled}
                    className={`${actionBtnBase} bg-blue-600 text-white hover:bg-blue-700 ${
                      !canGenerateListerCommissionEnabled ? disabledBtn : ""
                    }`}
                  >
                    Generate Lister Commission
                  </button>
                )}

                {canGenerateCloserCommission && (
                  <button
                    type="button"
                    onClick={handleApproveCloserCommission}
                    disabled={!canGenerateCloserCommissionEnabled}
                    className={`${actionBtnBase} bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200 ${
                      !canGenerateCloserCommissionEnabled ? disabledBtn : ""
                    }`}
                  >
                    Generate Closer Commission
                  </button>
                )}
              </div>

              {/* Row 5 */}
              <div className="flex flex-wrap gap-2 items-stretch">
                <button
                  type="button"
                  onClick={saveHeader}
                  disabled={savingHeader}
                  className={`${actionBtnBase} px-4 ${
                    savingHeader
                      ? "bg-black/60 text-white cursor-not-allowed"
                      : "bg-black hover:bg-gray-900 text-white"
                  }`}
                  title="Update incoming payment details.."
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {savingHeader ? "Updating..." : "Update incoming payment details"}
                </button>
              </div>
            </div>
          )}

          {/* Proforma Invoice Popup */}
          {isSales ? (
            <BuyerProformaInvoicePopup
              isOpen={proformaPopupOpen}
              onClose={closeProformaPopup}
              party={proformaPopupParty}
              paymentTransId={h.PaymentTransId}
              applicationId={(application as any)?.ApplicationId ?? ""}
              application={application}
              tenantServiceFees={h.TenantServiceFees}
              tenantAdminChargesTotal={h.TenantAdminChargesTotal}
              landlordAdminChargesTotal={h.LandlordAdminChargesTotal}
              tenantStampDuty={h.TenantStampDuty}
              landlordStampDuty={h.LandlordStampDuty}
              tenantToRen={tenantToRen}
              landlordToRen={landlordToRen}
              tenantLabel={tenantLabel}
              landlordLabel={landlordLabel}
              onSuccess={() => {
                closeProformaPopup();
                onUpdated?.();
              }}
            />
          ) : (
            <TenantProformaInvoicePopup
              isOpen={proformaPopupOpen}
              onClose={closeProformaPopup}
              party={proformaPopupParty}
              paymentTransId={h.PaymentTransId}
              applicationId={(application as any)?.ApplicationId ?? ""}
              application={application}
              tenantServiceFees={h.TenantServiceFees}
              tenantAdminChargesTotal={h.TenantAdminChargesTotal}
              landlordAdminChargesTotal={h.LandlordAdminChargesTotal}
              tenantStampDuty={h.TenantStampDuty}
              landlordStampDuty={h.LandlordStampDuty}
              tenantToRen={tenantToRen}
              landlordToRen={landlordToRen}
              tenantLabel={tenantLabel}
              landlordLabel={landlordLabel}
              onSuccess={() => {
                closeProformaPopup();
                onUpdated?.();
              }}
            />
          )}

          {/* ED Invoice Popup */}
          {edPopupOpen && (
            <TenantEdInvoicePopup
              isOpen={edPopupOpen}
              onClose={() => setEdPopupOpen(false)}
              party="TENANT"
              paymentTransId={h.PaymentTransId}
              applicationId={(application as any)?.ApplicationId ?? h.ApplicationId ?? ""}
              application={application}
              tenantServiceFees={h.TenantServiceFees}
              tenantAdminChargesTotal={h.TenantAdminChargesTotal}
              landlordAdminChargesTotal={h.LandlordAdminChargesTotal}
              tenantStampDuty={h.TenantStampDuty}
              landlordStampDuty={h.LandlordStampDuty}
              tenantToRen={tenantToRen}
              landlordToRen={landlordToRen}
              tenantLabel={tenantLabel}
              landlordLabel={landlordLabel}
              onSuccess={() => {
                setEdPopupOpen(false);
                onUpdated?.();
              }}
            />
          )}

          {/* Approval Modal */}
          {showApproval && approvalTarget && (
            <div
              className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
              role="dialog"
              aria-modal="true"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeApproval();
              }}
            >
              <div className="w-full max-w-lg bg-white rounded-lg shadow-lg">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div className="font-semibold">Approve / Reject Payment Slip</div>
                  <button
                    type="button"
                    onClick={closeApproval}
                    className="p-1 rounded hover:bg-gray-100"
                  >
                    <XIcon className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 space-y-3 text-sm">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-gray-600">File</div>
                    <div className="col-span-2 break-all">
                      {approvalTarget.ActualFileName ||
                        approvalTarget.AttName?.split("?")[0]?.split("/").pop() ||
                        "file"}
                    </div>

                    <div className="text-gray-600">Amount</div>
                    <div className="col-span-2 font-semibold">
                      {String(approvalTarget.PaymentAmt ?? "RM 0.00")}
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-600 mb-1">Remarks</label>
                    <textarea
                      value={approvalRemarks}
                      onChange={(e) => setApprovalRemarks(e.target.value)}
                      placeholder="Optional for Approve. Required for Reject."
                      className="w-full border rounded px-3 py-2 h-24"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={closeApproval}
                      disabled={submittingApproval}
                      className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApproval("reject")}
                      disabled={submittingApproval}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
                    >
                      <XCircle className="w-4 h-4" />
                      {submittingApproval ? "Rejecting..." : "Reject"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApproval("approve")}
                      disabled={submittingApproval}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-white bg-green-600 hover:bg-green-700 disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {submittingApproval ? "Approving..." : "Approve"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** ============ Main Component ============ */
const PaymentSession: React.FC<PaymentSessionProps> = ({
  application,
  paymentsUrl = API_ENDPOINTS.PAYMENT_GET,
  uploadsUrl = API_ENDPOINTS.UPLOADED_FILE_GET,
  paymentTransId,
  onNewPayment,
}) => {
  const [payments, setPayments] = useState<PaymentBundle[]>([]);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Map of PaymentTransId -> PaymentDetSummary */
  const [detByPid, setDetByPid] = useState<Record<string, PaymentDetSummary | null>>({});

  /** Force children to refresh invoice data */
  const [refreshSeq, setRefreshSeq] = useState(0);

  const isAccountUser =
    String(localStorage.getItem("account") || "").trim().toUpperCase() === "Y";

  const resolvedAppId = useMemo(() => {
    const fromProp =
      application?.ApplicationId !== undefined && application?.ApplicationId !== null
        ? String(application.ApplicationId)
        : "";
    if (fromProp) return fromProp;

    let fromUrl = "";
    try {
      fromUrl = new URLSearchParams(window.location.search).get("ApplicationId") || "";
    } catch {}
    if (fromUrl) return fromUrl;

    const fromLS = localStorage.getItem("ApplicationId") || "";
    return fromLS || "";
  }, [application?.ApplicationId]);

  const load = useCallback(
    async (_reason: string) => {
      setLoading(true);
      setError(null);

      try {
        const paymentsBody = new URLSearchParams();
        paymentsBody.set("ApplicationId", resolvedAppId ?? "");
        if (
          paymentTransId !== undefined &&
          paymentTransId !== null &&
          String(paymentTransId).trim() !== ""
        ) {
          paymentsBody.set("PaymentTransId", String(paymentTransId));
        }

        const uploadsBody = new URLSearchParams();
        uploadsBody.set("ApplicationId", resolvedAppId ?? "");

        const [paymentsResp, uploadsResp] = await Promise.all([
          fetch(paymentsUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: paymentsBody.toString(),
          }),
          fetch(uploadsUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: uploadsBody.toString(),
          }),
        ]);

        if (!paymentsResp.ok) throw new Error(`Payments HTTP ${paymentsResp.status}`);
        if (!uploadsResp.ok) throw new Error(`Uploads HTTP ${uploadsResp.status}`);

        const [paymentsJson, uploadsJson]: [ApiResponseFlat, UploadsResponse] = await Promise.all([
          paymentsResp.json(),
          uploadsResp.json(),
        ]);

        let bundles: PaymentBundle[] = [];
        if (
          paymentsJson.status === "success" &&
          Array.isArray(paymentsJson.data) &&
          paymentsJson.data.length > 0
        ) {
          const groups = new Map<string, ApiRow[]>();
          for (const row of paymentsJson.data) {
            const pid = String(row.PaymentTransId ?? "");
            if (!groups.has(pid)) groups.set(pid, []);
            groups.get(pid)!.push(row);
          }

          for (const [pid, rows] of groups) {
            const first = rows[0];
            const header: PaymentHeader = {
              PaymentTransId: String(first.PaymentTransId ?? pid),
              ApplicationId: resolvedAppId || String(first.ApplicationId ?? ""),
              PaymentTransRefNo: first.PaymentTransRefNo ?? null,
              PaymentTransType: first.PaymentTransType ?? null,
              PaymentTransStatus: first.PaymentTransStatus ?? null,
              AddByUserName: first.AddByUserName ?? null,
              AddDate: first.AddDate ?? null,
              Rem: first.Rem ?? null,
              ItemListId: first.ItemListId ?? null,

              TenantServiceFees: first.TenantServiceFees ?? null,
              TenantServiceFeesSst: first.TenantServiceFeesSst ?? null,
              TenantServiceFeesTotal: first.TenantServiceFeesTotal ?? null,
              TenantAdminCharges: first.TenantAdminCharges ?? null,
              TenantAdminFeesSstAmt: (first as any).TenantAdminFeesSstAmt ?? null,
              TenantAdminChargesSst: first.TenantAdminChargesSst ?? null,
              TenantAdminChargesTotal: first.TenantAdminChargesTotal ?? null,
              TenantStampDuty: first.TenantStampDuty ?? null,
              TenantToRen: first.TenantToRen ?? null,

              LandlordProfFees: first.LandlordProfFees ?? null,
              LandlordProfFeesSst: first.LandlordProfFeesSst ?? null,
              LandlordProfFeesTotal: first.LandlordProfFeesTotal ?? null,
              LandlordAdminCharges: first.LandlordAdminCharges ?? null,
              LandlordAdminChargesSst: first.LandlordAdminChargesSst ?? null,
              LandlordAdminChargesTotal: first.LandlordAdminChargesTotal ?? null,
              LandlordStampDuty: first.LandlordStampDuty ?? null,
              LandlordMisc: first.LandlordMisc ?? null,
              LandlordToRen: first.LandlordToRen ?? null,
              TotalReceived: first.TotalReceived ?? null,
              RefundToTenant: first.RefundToTenant ?? null,
              RefundToLandlord: first.RefundToLandlord ?? null,
              ClaimParty: first.ClaimParty ?? null,
              AtrOtherDepositAmt: (first as any).AtrOtherDepositAmt ?? null,
            };

            const details: PaymentDetailRow[] = rows
              .filter((r) => hasAnyDet(r))
              .map((r, idx) => ({
                RowId: String(pickA(r, ["Det_RowId", "DetRowId"], idx + 1)),
                PaymentTransId: String(
                  pickA(r, ["Det_PaymentTransId", "DetPaymentTransId"], header.PaymentTransId)
                ),
                PaymentDesc: pickA(r, ["Det_PaymentDesc", "DetPaymentDesc"]),
                PaymentAmt: pickA(r, ["Det_PaymentAmt", "DetPaymentAmt"]),
                FromRowId: pickA(r, ["Det_FromRowId", "DetFromRowId"]),
                PaymentCode: pickA(r, ["Det_PaymentCode", "DetPaymentCode"]),
                AccessCardDeposit: pickA(r, ["Det_AccessCardDeposit", "DetAccessCardDeposit"]),
                EarnestDeposit: pickA(r, ["Det_EarnestDeposit", "DetEarnestDeposit"]),
                IndahWater: pickA(r, ["Det_IndahWater", "DetIndahWater"]),
                OtherDeposit: pickA(r, ["Det_OtherDeposit", "DetOtherDeposit"]),
                SecurityDeposit: pickA(r, ["Det_SecurityDeposit", "DetSecurityDeposit"]),
                UtilityDeposit: pickA(r, ["Det_UtilityDeposit", "DetUtilityDeposit"]),
              }));

            bundles.push({ header, details });
          }

          bundles.sort((a, b) => Number(a.header.PaymentTransId) - Number(b.header.PaymentTransId));
          setPayments(bundles);

          const nextExpanded: Record<string, boolean> = {};
          for (const b of bundles) nextExpanded[b.header.PaymentTransId] = true;
          setExpanded(nextExpanded);
        } else {
          setPayments([]);
          setExpanded({});
        }

        if (uploadsJson.status === "success" && Array.isArray(uploadsJson.data)) {
          setUploads(uploadsJson.data);
        } else {
          setUploads([]);
        }

        const pids = Array.from(new Set(bundles.map((b) => b.header.PaymentTransId)));
        const detResults = await Promise.all(
          pids.map(async (pid) => {
            try {
              const body = new URLSearchParams();
              body.set("PaymentTransId", pid);

              const resp = await fetch(PAYMENT_TRANS_DET_URL, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString(),
              });

              if (!resp.ok) return { pid, summary: null as PaymentDetSummary | null };
              const json: PaymentDetApiResponse = await resp.json();

              const summary: PaymentDetSummary = {
                EarnestDeposit: 0,
                SecurityDeposit: 0,
                UtilityDeposit: 0,
                AccessCardDeposit: 0,
                IndahWater: 0,
                OtherDeposit: 0,
              };

              if (json?.status === "success" && Array.isArray(json.data)) {
                for (const row of json.data) {
                  summary.EarnestDeposit += toNum(row?.EarnestDeposit);
                  summary.SecurityDeposit += toNum(row?.SecurityDeposit);
                  summary.UtilityDeposit += toNum(row?.UtilityDeposit);
                  summary.AccessCardDeposit += toNum(row?.AccessCardDeposit);
                  summary.IndahWater += toNum(row?.IndahWater);
                  summary.OtherDeposit += toNum(row?.OtherDeposit);
                }
              }

              return { pid, summary };
            } catch {
              return { pid, summary: null as PaymentDetSummary | null };
            }
          })
        );

        const map: Record<string, PaymentDetSummary | null> = {};
        for (const r of detResults) map[r.pid] = r.summary;
        setDetByPid(map);
      } catch (e: any) {
        setError(e?.message ?? "Failed to fetch data");
        setPayments([]);
        setUploads([]);
        setExpanded({});
        setDetByPid({});
      } finally {
        setLoading(false);
      }
    },
    [resolvedAppId, paymentTransId, paymentsUrl, uploadsUrl]
  );

  useEffect(() => {
    if (resolvedAppId) load("appId_ready");
  }, [resolvedAppId, load]);

  const refresh = () => {
    setRefreshSeq((prev) => prev + 1);
    load("manual_refresh");
  };

  const toggleCard = (pid: string) => setExpanded((prev) => ({ ...prev, [pid]: !prev[pid] }));

  const hasPayments = payments.length > 0;
  const showNewButton = !loading && !error && !hasPayments && Boolean(resolvedAppId);

  return (
    <>
      <div className={`flex items-center mb-3 ${showNewButton ? "justify-between" : "justify-end"}`}>
        {showNewButton && (
          <button
            onClick={() => onNewPayment?.(String((application as any).ApplicationId || resolvedAppId))}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
            type="button"
          >
            <PlusIcon className="w-4 h-4" />
            CLICK HERE TO START UPLOADING PAYMENT SLIP
          </button>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded border transition-colors ${
              loading
                ? "text-gray-400 border-gray-200 cursor-not-allowed"
                : "text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
            type="button"
            title="Refresh"
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          {!showNewButton && isAccountUser && (
            <button
              onClick={() => printClaimForm(application)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              type="button"
              title="Print Claim Form"
            >
              <Printer className="w-4 h-4" />
              <span>Print Claim Form</span>
            </button>
          )}
        </div>
      </div>

      {loading && <div className="py-8 text-center text-gray-600">Loading...</div>}
      {error && !loading && <div className="text-red-600">{error}</div>}
      {!loading && !error && payments.length === 0 && (
        <div className="text-gray-600">No payments found</div>
      )}

      <div className="space-y-4">
        {payments.map((bundle) => (
          <PaymentCard
            key={bundle.header.PaymentTransId}
            bundle={bundle}
            expanded={!!expanded[bundle.header.PaymentTransId]}
            toggle={() => toggleCard(bundle.header.PaymentTransId)}
            uploads={uploads}
            detSummary={detByPid[bundle.header.PaymentTransId]}
            onUpdated={refresh}
            application={application}
            refreshSeq={refreshSeq}
          />
        ))}
      </div>
    </>
  );
};

export default PaymentSession;