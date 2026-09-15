import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  title?: string;

  /** ✅ REQUIRED: RowId for PaymentSlipRemarksSet.php */
  rowId: number | string;

  /** Optional: override endpoint URL (default: PaymentSlipRemarksSet.php) */
  endpointUrl?: string;

  /** ✅ From parent */
  paymentDate?: string;

  /** ✅ From parent */
  paymentAmount?: string;

  /** ✅ From parent: remarks text (your parent is passing this) */
  remarks?: string;

  /** Backward compatible (older usage) */
  initialValue?: string;

  placeholder?: string;

  /** Optional: external saving flag (if parent controls it) */
  saving?: boolean;

  onClose: () => void;

  /**
   * Optional: callback after successful save
   * (kept to avoid changing your existing usage)
   */
  onSave?: (nextValue: string) => void | Promise<void>;
};

/**
 * <input type="date" /> only accepts value in YYYY-MM-DD.
 * Normalizes common formats into YYYY-MM-DD.
 */
const toDateInputValue = (v?: string) => {
  const s = String(v ?? "").trim();
  if (!s) return "";

  // 1) YYYY-MM-DD or YYYY-MM-DD HH:mm:ss
  const m1 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m1) {
    const y = m1[1];
    const mo = m1[2].padStart(2, "0");
    const d = m1[3].padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }

  // 2) DD/MM/YYYY
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m2) {
    const d = m2[1].padStart(2, "0");
    const mo = m2[2].padStart(2, "0");
    const y = m2[3];
    return `${y}-${mo}-${d}`;
  }

  // 3) Try native parse (last resort)
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) {
    const y = String(dt.getFullYear());
    const mo = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }

  return "";
};

/** ✅ Keep only digits + 1 dot (decimal). Allows empty string. */
const sanitizeDecimalInput = (raw: string) => {
  const s = String(raw ?? "");

  // remove invalid chars
  const cleaned = s.replace(/[^0-9.]/g, "");

  // allow only first dot
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;

  return `${parts[0]}.${parts.slice(1).join("")}`;
};

/** ✅ Validate decimal string ("" allowed) */
const isValidDecimal = (s: string) => {
  const v = String(s ?? "").trim();
  if (v === "") return true;
  return /^\d+(\.\d+)?$/.test(v);
};

const PaymentAppRejRemEditPopup: React.FC<Props> = ({
  open,
  title = "Edit Remarks",
  rowId,
  endpointUrl = API_ENDPOINTS.PAYMENT_SLIP_REMARKS_SET,
  paymentDate = "",
  paymentAmount = "",
  remarks,
  initialValue = "",
  placeholder = "Type remarks here...",
  saving = false,
  onClose,
  onSave,
}) => {
  // ✅ Prefer parent "remarks" prop, fallback to initialValue
  const initialRemarks = (remarks ?? initialValue ?? "").toString();

  const initialPaymentDate = useMemo(
    () => toDateInputValue((paymentDate ?? "").toString()),
    [paymentDate]
  );

  const initialPaymentAmt = useMemo(
    () => (paymentAmount ?? "").toString(),
    [paymentAmount]
  );

  const [val, setVal] = useState(initialRemarks);

  // ✅ NEW: editable fields
  const [payDate, setPayDate] = useState(initialPaymentDate);
  const [payAmt, setPayAmt] = useState(initialPaymentAmt);

  const [err, setErr] = useState<string | null>(null);
  const [internalSaving, setInternalSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const effectiveSaving = saving || internalSaving;

  // keep latest initial value when opening
  useEffect(() => {
    if (open) {
      setVal(initialRemarks);
      setPayDate(initialPaymentDate);
      setPayAmt(initialPaymentAmt);
      setErr(null);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialRemarks, initialPaymentDate, initialPaymentAmt]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // Ctrl/Cmd + Enter to save
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        void handleSave();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, val, payDate, payAmt, rowId, endpointUrl, effectiveSaving]);

  const unchanged = useMemo(() => {
    return (
      (val ?? "") === (initialRemarks ?? "") &&
      (payDate ?? "") === (initialPaymentDate ?? "") &&
      (payAmt ?? "") === (initialPaymentAmt ?? "")
    );
  }, [val, payDate, payAmt, initialRemarks, initialPaymentDate, initialPaymentAmt]);

  const postRemarks = async (nextRemarks: string, nextPaymentDate: string, nextPaymentAmt: string) => {
    const form = new FormData();
    form.append("RowId", String(rowId ?? ""));
    form.append("AppRejRem", nextRemarks ?? "");

    // ✅ NEW: send these to same endpoint
    form.append("PaymentDate", String(nextPaymentDate ?? ""));
    form.append("PaymentAmt", String(nextPaymentAmt ?? ""));
    // (optional compatibility, in case backend expects a different key)
    form.append("PaymentAmount", String(nextPaymentAmt ?? ""));

    const resp = await fetch(endpointUrl, {
      method: "POST",
      body: form,
    });

    let json: any = null;
    try {
      json = await resp.json();
    } catch {
      // ignore parse error (handled below)
    }

    if (!resp.ok) {
      throw new Error(json?.error ? JSON.stringify(json.error) : `HTTP ${resp.status}`);
    }

    if (!json || (json.status !== "success" && json.status !== "SUCCESS")) {
      throw new Error(json?.data || json?.error || "Failed to save.");
    }

    return json;
  };

  const handleSave = async () => {
    if (effectiveSaving) return;

    const amtStr = (payAmt ?? "").toString().trim();
    if (!isValidDecimal(amtStr)) {
      setErr("Payment Amount must be a valid decimal number (e.g. 123.45).");
      return;
    }

    try {
      setErr(null);
      setInternalSaving(true);

      await postRemarks(val ?? "", payDate ?? "", amtStr);

      // ✅ NEW: alert on success
      alert("Saved successfully.");

      if (onSave) await onSave(val ?? "");
    } catch (e: any) {
      setErr(e?.message || "Failed to save.");
    } finally {
      setInternalSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        // click outside closes
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="font-semibold text-gray-800">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100"
            aria-label="Close"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          {/* ✅ Payment Date + Amount inputs (NOW EDITABLE) */}
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Payment Date</label>
              <input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-700 outline-none focus:border-gray-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Payment Amount</label>
              <input
                type="text"
                inputMode="decimal"
                value={payAmt}
                onChange={(e) => {
                  const next = sanitizeDecimalInput(e.target.value);
                  setPayAmt(next);
                }}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-700 outline-none focus:border-gray-500"
              />
            </div>
          </div>

          <label className="mb-2 block text-sm font-medium text-gray-700">Remarks</label>
          <textarea
            ref={textareaRef}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={placeholder}
            rows={8}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-gray-500"
          />

          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <div>
              Tip: <span className="font-medium">Ctrl/Cmd + Enter</span> to save,{" "}
              <span className="font-medium">Esc</span> to close
            </div>
            <div>{(val ?? "").length} chars</div>
          </div>

          {err ? (
            <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            disabled={effectiveSaving}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => void handleSave()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
            disabled={effectiveSaving || unchanged}
            title={unchanged ? "No changes" : "Save"}
          >
            {effectiveSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PaymentAppRejRemEditPopup;
