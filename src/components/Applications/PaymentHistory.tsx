import { API_ENDPOINTS_DEV_AWARE } from '../../config/apiConfig';
import React, { useState } from "react";
import {
  Eye,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  PenLine,
  Trash2,
} from "lucide-react";
import PaymentAppRejRemEditPopup from "./PaymentAppRejRemEditPopup";

export type StatusFilter = "PENDING" | "ALL" | "APPROVED" | "REJECTED";

export interface UploadRow {
  RowId: number | string;
  AttName: string;
  AddDate: string | null;
  ActualFileName: string | null;
  PaymentTransId: number | string;
  PaymentAmt: string | null;
  PaymentDate: string | null;
  ClaimParty: string | null;
  PaymentStatus?: string | null;
  AppRejDate?: string | null;

  // ✅ NEW: remarks (can be long)
  AppRejRem?: string | null;
}

interface PaymentHistoryProps {
    onAfterDelete?: () => void; // ✅ NEW: parent refresh list

  title: string;
  rows: UploadRow[];
  currentFilter: StatusFilter;
  onChangeFilter: (filter: StatusFilter) => void;
  canApprove: boolean;
  onApprovalClick: (row: UploadRow) => void;

  /** ✅ NEW (optional): collapse control */
  collapsed?: boolean; // true = hidden
  onToggleCollapse?: () => void; // triggered ONLY by arrow button
}

const parseAmtLoose = (v: any) =>
  parseFloat(String(v ?? "0").replace(/[^0-9.\-]/g, "")) || 0;

const normStatus = (s?: string | null) =>
  (s ?? "")
    .toString()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .replace("REJETED", "REJECTED");

const currency = (val?: string | number | null) => {
  if (val === null || val === undefined || val === "") return "RM 0.00";
  const num = typeof val === "string" ? parseFloat(val.replace(/,/g, "")) : Number(val);
  if (!isFinite(num)) return `RM ${String(val)}`;
  return `RM ${num.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const applyFilter = (rows: UploadRow[], filter: StatusFilter) =>
  rows.filter((r) => {
    const s = normStatus(r.PaymentStatus);

    // ✅ SHOW ALL: no filtering
    if (filter === "ALL") return true;

    if (filter === "PENDING") return s !== "APPROVED" && s !== "REJECTED";
    if (filter === "APPROVED") return s === "APPROVED";
    if (filter === "REJECTED") return s === "REJECTED";

    return true;
  });

const sumAmt = (rows: UploadRow[]) => rows.reduce((s, r) => s + parseAmtLoose(r.PaymentAmt), 0);

// ✅ match your project pattern (DEV proxy vs PROD real server)

// ✅ DELETE endpoint
const PAYMENT_SLIP_DELETE_URL = API_ENDPOINTS_DEV_AWARE.PAYMENT_SLIP_DELETE;

const PaymentHistory: React.FC<PaymentHistoryProps> = ({
  title,
  rows,
  currentFilter,
  onChangeFilter,
  canApprove,
  onApprovalClick,
  collapsed = false,
  onToggleCollapse,
  onAfterDelete, // ✅ NEW
}) => {

  // ✅ NEW: popup state (no UI changes until user clicks pen)
  const [remPopupOpen, setRemPopupOpen] = useState(false);
  const [remPopupRowId, setRemPopupRowId] = useState<string>("");
  const [remPopupText, setRemPopupText] = useState<string>("");
  const [remPopupPaymentDate, setRemPopupPaymentDate] = useState<string>("");
  const [remPopupPaymentAmt, setRemPopupPaymentAmt] = useState<string>("");

  // ✅ NEW: local override so the table updates immediately after Save
  const [remLocal, setRemLocal] = useState<Record<string, string>>({});

  // ✅ NEW: permission flag from localStorage
  const canEditRemark = (localStorage.getItem("account") || "").toUpperCase() === "Y";

  // ✅ NEW: local hide after delete so UI updates immediately (no reload needed)
  const [deletedRowIds, setDeletedRowIds] = useState<Record<string, true>>({});

  // ✅ NEW: delete confirmation popup state
  const [delOpen, setDelOpen] = useState(false);
  const [delRow, setDelRow] = useState<UploadRow | null>(null);
  const [delLoading, setDelLoading] = useState(false);

  const safeRowsAll = Array.isArray(rows) ? rows : [];
  const safeRows = safeRowsAll.filter((r) => !(String(r.RowId) in deletedRowIds));

  const safeFilter: StatusFilter = currentFilter || "PENDING";

  const filtered = applyFilter(safeRows, safeFilter);
  const totalAmt = sumAmt(filtered);

  // ✅ NEW: delete handler
  const doDelete = async (row: UploadRow) => {
    try {
      setDelLoading(true);

      const rowId = row?.RowId;

if (rowId === null || rowId === undefined || String(rowId).trim() === "") {
  alert("Delete failed: Missing RowId.");
  return;
}

const body = new URLSearchParams({
  RowId: String(rowId), // ✅ correct: delete 1 slip only
});


      const res = await fetch(PAYMENT_SLIP_DELETE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        // ok: maybe php returns plain text
      }

      if (!res.ok) {
        alert(`Delete failed (${res.status}).\n\n${text}`);
        return;
      }

      // ✅ try best-effort success detection
      const ok =
        (json && (json.success === true || json.Success === true || json.ok === true)) ||
        (json && typeof json.status === "string" && json.status.toLowerCase() === "success") ||
        /success|deleted|ok/i.test(text);

      if (!ok) {
        // still show message from backend if provided
        const msg =
          (json && (json.message || json.Message || json.error || json.Error)) ||
          text ||
          "Unknown response.";
        alert(`Delete failed.\n\n${msg}`);
        return;
      }

      // ✅ remove row from UI immediately
      setDeletedRowIds((prev) => ({ ...prev, [String(row.RowId)]: true }));
      alert("Payment slip deleted.");
      onAfterDelete?.(); // ✅ refresh parent list

      //window.location.reload();

      
    } catch (e: any) {
      alert(`Delete failed.\n\n${e?.message || String(e)}`);
    } finally {
      setDelLoading(false);
    }
  };

  return (
    <div className="border rounded-lg shadow-sm mt-4">
      <div className="bg-gray-100 px-4 py-2 flex items-center justify-between rounded-t-lg">
        <div className="font-semibold text-gray-700">{title}</div>

        {/* RIGHT SIDE: filters + arrow (arrow toggles ONLY) */}
        <div className="flex items-center gap-2">
          {/* ✅ Hide status buttons when collapsed */}
          {!collapsed &&
            (["ALL", "PENDING", "APPROVED", "REJECTED"] as StatusFilter[]).map((opt) => {
              const active = currentFilter === opt;
              const label =
                opt === "PENDING"
                  ? "Pending Approval"
                  : opt === "ALL"
                  ? "Show All"
                  : opt.charAt(0) + opt.slice(1).toLowerCase();

              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChangeFilter(opt)}
                  className={
                    active
                      ? "px-2.5 py-1.5 rounded text-white bg-gray-800"
                      : "px-2.5 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }
                  title={opt === "ALL" ? "Show Approved and Rejected" : `Show ${label}`}
                >
                  {label}
                </button>
              );
            })}

          {/* ✅ Arrow always visible */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse?.();
            }}
            className="p-1.5 rounded hover:bg-gray-200"
            title={collapsed ? "Expand" : "Collapse"}
            aria-label={collapsed ? "Expand payment history" : "Collapse payment history"}
          >
            {collapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ✅ when collapsed, hide everything below header */}
      {collapsed ? null : filtered.length === 0 ? (
        <div className="p-4 text-sm text-gray-500">— none —</div>
      ) : (
        <div className="p-4 overflow-x-auto">
          <table className="w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left border">File</th>
                <th className="p-2 text-left border">Payment Date</th>
                <th className="p-2 text-right border">Amount (RM)</th>
                <th className="p-2 text-left border">Status</th>
                <th className="p-2 text-left border">App/Rej Date</th>
                <th className="p-2 text-center border">View</th>
                <th className="p-2 text-center border"></th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((u) => {
                const fileLabel =
                  u.ActualFileName && u.ActualFileName.trim() !== ""
                    ? u.ActualFileName
                    : u.AttName?.split("?")[0]?.split("/").pop() || "file";

                const viewHref =
                  typeof u.AttName === "string" && u.AttName.trim() !== ""
                    ? u.AttName
                    : undefined;

                const amt = parseAmtLoose(u.PaymentAmt);
                const s = normStatus(u.PaymentStatus);
                const isActioned = s === "APPROVED" || s === "REJECTED";

                // ✅ use local override first (no backend changes here)
                const rid = String(u.RowId);
                const remSrc = rid in remLocal ? remLocal[rid] : (u.AppRejRem ?? "");
                const rem = (remSrc ?? "").toString().trim();

                // ✅ conditions for showing the pen:
                // A: current filter is NOT "PENDING"
                // B: payment status is NOT "PENDING APPROVAL"
                const statusNotPendingApproval = s !== "PENDING APPROVAL";
                const showPen =
                  canEditRemark && currentFilter !== "PENDING" && statusNotPendingApproval;

                // ✅ delete permission (keep simple: same as account=Y)
                const canDeleteSlip = canEditRemark;

                return (
                  <React.Fragment key={String(u.RowId)}>
                    <tr className="odd:bg-white even:bg-gray-50">
                      <td className="p-2 border break-all">{fileLabel}</td>
                      <td className="p-2 border">{u.PaymentDate || "—"}</td>
                      <td className="p-2 border text-right">{currency(amt.toFixed(2))}</td>
                      <td className="p-2 border">{s || "—"}</td>
                      <td className="p-2 border">{u.AppRejDate || "—"}</td>

                      {/* View icon */}
                      <td className="p-2 border text-center">
                        {viewHref ? (
                          <a
                            href={viewHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center p-1 rounded hover:bg-blue-50"
                            title="View uploaded file"
                            aria-label={`View ${fileLabel}`}
                          >
                            <Eye className="w-4 h-4 text-blue-600" />
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Action icons: Approve + Delete */}
                      <td className="p-2 border text-center">
                        <div className="inline-flex items-center justify-center gap-1">
                          {/* Approve/Reject icon (existing behaviour) */}
                          {isActioned ? (
                            <span className="text-gray-400">—</span>
                          ) : canApprove ? (
                            <button
                              type="button"
                              onClick={() => onApprovalClick(u)}
                              className="inline-flex items-center justify-center p-1 rounded hover:bg-green-50"
                              title="Approve / Reject this payment slip"
                              aria-label={`Approve ${fileLabel}`}
                            >
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            </button>
                          ) : (
                            <span className="text-gray-300" title="No permission">
                              —
                            </span>
                          )}

                          {/* ✅ NEW: Delete icon */}
                          {canDeleteSlip ? (
                            <button
                              type="button"
                              onClick={() => {
                                setDelRow(u);
                                setDelOpen(true);
                              }}
                              className="inline-flex items-center justify-center p-1 rounded hover:bg-red-50"
                              title="Delete this payment slip"
                              aria-label={`Delete ${fileLabel}`}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>

                    <tr className="odd:bg-white even:bg-gray-50">
                      <td className="p-2 border text-gray-700" colSpan={7}>
                        <div className="whitespace-pre-wrap break-words">
                          <span className="font-semibold inline-flex items-center gap-2">
                            Remarks:
                            {/* ✅ Pen icon AFTER "Remarks:" and ONLY when both conditions match */}
                            {showPen ? (
                              <button
                                type="button"
                                className="inline-flex items-center justify-center p-1 rounded hover:bg-gray-200"
                                title="Edit remarks"
                                aria-label="Edit remarks"
                                onClick={() => {
                                  setRemPopupRowId(String(u.RowId));
                                  setRemPopupText((remSrc ?? "").toString());
                                  setRemPopupPaymentDate(
                                    ((u.PaymentDate ?? "").toString().trim()).slice(0, 10)
                                  );
                                  setRemPopupPaymentAmt((u.PaymentAmt ?? "").toString());
                                  setRemPopupOpen(true);
                                }}
                              >
                                <PenLine className="w-4 h-4 text-gray-700" />
                              </button>
                            ) : null}
                          </span>

                          <span className="ml-2">
                            {rem ? rem : <span className="text-gray-400">—</span>}
                          </span>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>

            <tfoot>
              <tr>
                <td className="p-3 border font-semibold text-right" colSpan={2}>
                  Total
                </td>
                <td className="p-2 border text-right font-bold">
                  {currency(totalAmt.toFixed(2))}
                </td>
                <td className="p-2 border" />
                <td className="p-2 border" />
                <td className="p-2 border" />
                <td className="p-2 border" />
                <td className="p-2 border" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ✅ NEW: popup render (does not change existing table UI) */}
      <PaymentAppRejRemEditPopup
        open={remPopupOpen}
        rowId={remPopupRowId}
        remarks={remPopupText}
        paymentDate={remPopupPaymentDate}
        paymentAmount={remPopupPaymentAmt}
        onClose={() => {
          setRemPopupOpen(false);
        }}
        onSave={(nextRemarks) => {
          setRemLocal((prev) => ({
            ...prev,
            [String(remPopupRowId)]: String(nextRemarks ?? ""),
          }));
          setRemPopupOpen(false);
        }}
      />

      {/* ✅ NEW: Delete confirmation modal (Yes / No) */}
      {delOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            if (delLoading) return;
            setDelOpen(false);
            setDelRow(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white shadow-lg border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b font-semibold text-gray-800">
              Confirm Delete
            </div>

            <div className="px-4 py-4 text-sm text-gray-700">
              Are you sure to delete this payment slip?
            </div>

            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={delLoading}
                onClick={() => {
                  setDelOpen(false);
                  setDelRow(null);
                }}
                className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                No
              </button>

              <button
                type="button"
                disabled={delLoading || !delRow}
                onClick={async () => {
                  if (!delRow) return;
                  await doDelete(delRow);
                  setDelOpen(false);
                  setDelRow(null);
                }}
                className="px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                {delLoading ? "Deleting..." : "Yes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PaymentHistory;
