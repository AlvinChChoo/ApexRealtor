import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useEffect, useMemo, useState } from "react";
import { X as XIcon } from "lucide-react";
import type { RentalApplication } from "../../types";
import { toNum, to2s } from "../../utils/paymentUtils";

/** your desc endpoint is same as your popup */
type PreviewParty = "TENANT" | "LANDLORD";

interface InvoicePreview {
  party: PreviewParty;
  invoiceDate: string;
  description: string;

  feesGross: number;
  sstAmt: number;
  feesPlusSst: number;

  adminGross: number;
  adminSstAmt: number;
  adminPlusSst: number;

  stampDuty: number;

  invoiceAmount: number;
  tenantToRenVal: number;
}

type InvoiceDescRow = {
  DescId: string;
  DescGroup: string;
  DescText: string;
};

// ✅ match your InvoiceList bundle type usage
type IntInvoiceDetRow = Record<string, any>;
type IntInvoiceHeader = Record<string, any>;
type IntInvoiceBundle = {
  header: IntInvoiceHeader;
  details: IntInvoiceDetRow[];
  application?: RentalApplication;
};

interface BuyerProformaInvoiceEditPopupProps {
  open: boolean;
  onClose: () => void;
  bundle: IntInvoiceBundle | null;
  isAccountUser: boolean;
  onSaved?: () => void;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const fmt2 = (n: number) => round2(n).toFixed(2);

// allow typing: keep digits, dot, minus
const cleanNumStr = (s: string) => String(s ?? "").replace(/[^0-9.\-]/g, "");
const safeToNum = (s: string) => toNum(cleanNumStr(s));

const pickLine = (details: any[], keywords: string[]) => {
  const kw = keywords.map((k) => k.toLowerCase());
  return details.find((r: any) => {
    const desc = String(r?.ItemDesc ?? r?.Description ?? "").toLowerCase();
    return kw.some((k) => desc.includes(k));
  });
};

const BuyerProformaInvoiceEditPopup: React.FC<
  BuyerProformaInvoiceEditPopupProps
> = ({ open, onClose, bundle, isAccountUser, onSaved }) => {
  const application = bundle?.application;

  const [invoicePreview, setInvoicePreview] = useState<InvoicePreview | null>(
    null
  );
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  // ✅ InvoiceDescGet.php endpoint (same as your popup)
  const INVOICE_DESC_GET_URL =
    (import.meta as any)?.env?.DEV
      ? API_ENDPOINTS.INVOICE_DESC_SALES_GET
      : API_ENDPOINTS.INVOICE_DESC_SALES_GET;

  // ✅ Save endpoint (renamed)
  const PROFORMA_INVOICE_UPDATE_URL =
    (import.meta as any)?.env?.DEV
      ? API_ENDPOINTS.PROFORMA_INVOICE_EDIT
      : API_ENDPOINTS.PROFORMA_INVOICE_EDIT;

  // ✅ NEW: reload invoice by InvoiceId
  const INT_INVOICE_GET_URL =
    (import.meta as any)?.env?.DEV
      ? API_ENDPOINTS.INT_INVOICE_GET
      : API_ENDPOINTS.INT_INVOICE_GET;

  const INT_INVOICE_DET_GET_URL =
    (import.meta as any)?.env?.DEV
      ? API_ENDPOINTS.INT_INVOICE_DET_GET
      : API_ENDPOINTS.INT_INVOICE_DET_GET;

  const [descRows, setDescRows] = useState<InvoiceDescRow[]>([]);
  const [descLoading, setDescLoading] = useState(false);
  const [selectedDescId, setSelectedDescId] = useState<string>("");

  // ✅ editable description state (textarea will bind to this)
  const [descriptionText, setDescriptionText] = useState<string>("");

  // ✅ To / Address fields
  const [billTo, setBillTo] = useState<string>("");
  const [billAddress, setBillAddress] = useState<string>("");

  // ✅ NEW: reloaded invoice header + details
  const [invHeader, setInvHeader] = useState<any>(null);
  const [invDetails, setInvDetails] = useState<any[]>([]);
  const [invReloading, setInvReloading] = useState(false);

  // ✅ NEW: editable amounts (string states for typing)
  const [feesGrossStr, setFeesGrossStr] = useState("0.00");
  const [feesSstStr, setFeesSstStr] = useState("0.00");
  const [adminGrossStr, setAdminGrossStr] = useState("0.00");
  const [adminSstStr, setAdminSstStr] = useState("0.00");
  const [stampDutyStr, setStampDutyStr] = useState("0.00");

  const [feesSstManual, setFeesSstManual] = useState(false);
  const [adminSstManual, setAdminSstManual] = useState(false);

  // --- invoiceId from bundle (parent screen)
  const invFromParent: any = bundle?.header || {};
  const invoiceId = String(
    invFromParent?.InvoiceId ?? invFromParent?.InvoiceID ?? invFromParent?.invoiceId ?? ""
  ).trim();

  // displayed invoice no (prefer reloaded header)
  const proformaNo = String(
    invHeader?.InvoiceNo ??
      invFromParent?.InvoiceNo ??
      invFromParent?.Invoice_No ??
      invFromParent?.invoiceNo ??
      ""
  ).trim();

  const invoiceTypeRaw = String(
    invHeader?.InvoiceType ??
      invFromParent?.InvoiceType ??
      invFromParent?.Invoice_Type ??
      invFromParent?.invoiceType ??
      ""
  ).trim();

  const party: PreviewParty = invoiceTypeRaw
    .toUpperCase()
    .includes("LANDLORD")
    ? "LANDLORD"
    : "TENANT";

  // ✅ helper: append PropertyAddress to the end of description text
  const appendAddress = (text: string) => {
    const addr = String((application as any)?.PropertyAddress ?? "").trim();
    if (!addr) return text;

    if (text.toLowerCase().includes(addr.toLowerCase())) return text;

    const base = text.trim();
    const sep = base.endsWith(":") ? " " : ": ";
    return `${base}${sep}${addr}`;
  };

  // ✅ SALES: description group
  const filteredOptions = useMemo(() => {
    const allowed = new Set(["SALES_BUYER", "SALES_SELLER"]);
    return descRows.filter((r) =>
      allowed.has(String(r.DescGroup || "").toUpperCase())
    );
  }, [descRows]);

  const selectedDescText = useMemo(() => {
    const row = filteredOptions.find(
      (x) => String(x.DescId) === String(selectedDescId)
    );
    return row?.DescText ?? "";
  }, [filteredOptions, selectedDescId]);

  const getDescTextById = (id: string) => {
    const row = filteredOptions.find((x) => String(x.DescId) === String(id));
    return row?.DescText ?? "";
  };

  // ✅ 1) Reload invoice header + details by InvoiceId when popup opens
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const loadInvoice = async () => {
      if (!invoiceId) {
        setInvHeader(null);
        setInvDetails([]);
        return;
      }

      try {
        setInvReloading(true);

        // ---- header
        const fd1 = new FormData();
        fd1.set("InvoiceId", String(invoiceId));

        const resp1 = await fetch(INT_INVOICE_GET_URL, { method: "POST", body: fd1 });
        const raw1 = await resp1.text();
        let json1: any = null;
        try {
          json1 = JSON.parse(raw1);
        } catch {}

        if (cancelled) return;

        if (!resp1.ok || !json1 || json1.status !== "success" || !Array.isArray(json1.data) || !json1.data[0]) {
          throw new Error(
            (json1 && (json1.error || json1.data || json1.message)) ||
              `IntInvoiceGet failed: ${raw1}`
          );
        }

        const headerRow = json1.data[0] || null;
        setInvHeader(headerRow);

        // ---- details
        const fd2 = new FormData();
        fd2.set("InvoiceId", String(invoiceId));

        const resp2 = await fetch(INT_INVOICE_DET_GET_URL, { method: "POST", body: fd2 });
        const raw2 = await resp2.text();
        let json2: any = null;
        try {
          json2 = JSON.parse(raw2);
        } catch {}

        if (cancelled) return;

        if (!resp2.ok || !json2 || json2.status !== "success" || !Array.isArray(json2.data)) {
          throw new Error(
            (json2 && (json2.error || json2.data || json2.message)) ||
              `IntInvoiceDetGet failed: ${raw2}`
          );
        }

        setInvDetails(json2.data);
      } catch (e: any) {
        console.error("Reload invoice failed:", e);
        if (!cancelled) {
          setInvHeader(null);
          setInvDetails([]);
          alert(e?.message || "Failed to reload invoice.");
        }
      } finally {
        if (!cancelled) setInvReloading(false);
      }
    };

    loadInvoice();

    return () => {
      cancelled = true;
    };
  }, [open, invoiceId, INT_INVOICE_GET_URL, INT_INVOICE_DET_GET_URL]);

  // ✅ 2) Default To/Address when popup opens (prefer reloaded header)
  useEffect(() => {
    if (!open) return;

    const app: any = application || {};

    const invoiceToRaw = String(invHeader?.InvoiceTo ?? "").trim();
    const invoiceAddRaw = String(invHeader?.InvoiceAddress ?? "").trim();

    if (invoiceToRaw) setBillTo(invoiceToRaw);
    else {
      if (party === "LANDLORD") setBillTo(String(app?.Landlord1Name ?? "").trim());
      else setBillTo(String(app?.Tenant1Name ?? "").trim());
    }

    if (invoiceAddRaw) setBillAddress(invoiceAddRaw);
    else {
      if (party === "LANDLORD") setBillAddress(String(app?.Landlord1MailingAdd ?? "").trim());
      else setBillAddress(String(app?.Tenant1MailingAdd ?? "").trim());
    }
  }, [open, party, application, invHeader]);

  // ✅ Load InvoiceDescSalesGet when popup opens
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const load = async () => {
      try {
        setDescLoading(true);

        const fd = new FormData();
        const resp = await fetch(INVOICE_DESC_GET_URL, { method: "POST", body: fd });

        const raw = await resp.text();
        let json: any = null;
        try {
          json = JSON.parse(raw);
        } catch {}

        if (cancelled) return;

        if (!resp.ok || !json || json.status !== "success" || !Array.isArray(json.data)) {
          setDescRows([]);
          setSelectedDescId("");
          return;
        }

        const rows: InvoiceDescRow[] = json.data.map((r: any) => ({
          DescId: String(r?.DescId ?? ""),
          DescGroup: String(r?.DescGroup ?? ""),
          DescText: String(r?.DescText ?? ""),
        }));

        setDescRows(rows);

        const first = rows.find((x) => {
          const g = String(x.DescGroup || "").toUpperCase();
          return g === "SALES_BUYER" || g === "SALES_SELLER";
        });
        setSelectedDescId(first ? String(first.DescId) : "");
      } catch {
        if (!cancelled) {
          setDescRows([]);
          setSelectedDescId("");
        }
      } finally {
        if (!cancelled) setDescLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [open, INVOICE_DESC_GET_URL]);

  // ✅ 3) init description text when open (prefer reloaded header)
  useEffect(() => {
    if (!open) return;

    const invoiceDescRaw = String(invHeader?.InvoiceDesc ?? "").trim();

    if (invoiceDescRaw) {
      setDescriptionText(appendAddress(invoiceDescRaw));
      return;
    }

    const fallback = `Proforma Invoice for InvoiceId ${invoiceId || "-"}`;
    const nextText = (selectedDescText || "").trim() || fallback;
    setDescriptionText(appendAddress(nextText));
  }, [open, selectedDescText, invoiceId, application, invHeader]);

  // ✅ 4) init amount boxes from reloaded details/header (so it matches table)
  useEffect(() => {
    if (!open) return;

    setFeesSstManual(false);
    setAdminSstManual(false);

    const svc = pickLine(invDetails, ["service fees", "service fee"]);
    const adm = pickLine(invDetails, ["administrative fees", "administrative fee", "admin fees", "admin fee"]);
    const stp = pickLine(invDetails, ["stamping fees", "stamping fee", "stamp duty", "stamp"]);

    const feesGross =
      safeToNum(svc?.ItemGross) ||
      safeToNum(invHeader?.InvoiceFees) ||
      0;

    const feesSst =
      safeToNum(svc?.ItemSst) ||
      safeToNum(invHeader?.InvoiceSst) ||
      0;

    const adminGross =
      safeToNum(adm?.ItemGross) ||
      safeToNum(invHeader?.InvoiceAdminCharges) ||
      0;

    const adminSst =
      safeToNum(adm?.ItemSst) ||
      safeToNum(invHeader?.InvoiceAdminSst) ||
      0;

    const stampDuty =
      safeToNum(stp?.ItemGross) ||
      safeToNum(invHeader?.InvoiceStampDuty) ||
      0;

    setFeesGrossStr(fmt2(feesGross));
    setFeesSstStr(fmt2(feesSst));
    setAdminGrossStr(fmt2(adminGross));
    setAdminSstStr(fmt2(adminSst));
    setStampDutyStr(fmt2(stampDuty));
  }, [open, invHeader, invDetails]);

  // ✅ 5) SST auto-calc (8%) unless user manually edits SST field
  useEffect(() => {
    if (!open) return;
    if (feesSstManual) return;

    const gross = safeToNum(feesGrossStr);
    const auto = round2(gross * 0.08);
    setFeesSstStr(fmt2(auto));
  }, [open, feesGrossStr, feesSstManual]);

  useEffect(() => {
    if (!open) return;
    if (adminSstManual) return;

    const gross = safeToNum(adminGrossStr);
    const auto = round2(gross * 0.08);
    setAdminSstStr(fmt2(auto));
  }, [open, adminGrossStr, adminSstManual]);

  // ✅ preview build (same layout fields)
  useEffect(() => {
    if (!open) return;

    // header InvoiceDate from IntInvoiceGet is dd-MMM-yyyy (use it as-is)
    const invoiceDate =
      String(invHeader?.InvoiceDate ?? "").trim() ||
      String(invFromParent?.InvoiceDate ?? invFromParent?.Invoice_Date ?? invFromParent?.invoiceDate ?? "").trim() ||
      "";

    const feesGross = safeToNum(feesGrossStr);
    const sstAmt = safeToNum(feesSstStr);
    const adminGross = safeToNum(adminGrossStr);
    const adminSstAmt = safeToNum(adminSstStr);
    const stampDuty = safeToNum(stampDutyStr);

    const feesPlusSst = feesGross + sstAmt;
    const adminPlusSst = adminGross + adminSstAmt;
    const invoiceAmount = feesPlusSst + adminPlusSst + stampDuty;

    setInvoicePreview({
      party,
      invoiceDate,
      description: descriptionText,

      feesGross,
      sstAmt,
      feesPlusSst,

      adminGross,
      adminSstAmt,
      adminPlusSst,

      stampDuty,

      invoiceAmount,
      tenantToRenVal: 0,
    });
  }, [
    open,
    party,
    invHeader,
    invFromParent,
    descriptionText,
    feesGrossStr,
    feesSstStr,
    adminGrossStr,
    adminSstStr,
    stampDutyStr,
  ]);

  const handleClose = () => {
    if (generatingInvoice) return;
    setInvoicePreview(null);
    setBillTo("");
    setBillAddress("");
    onClose();
  };

  // ✅ Save invoice edit
  const saveInvoiceNow = async () => {
    try {
      if (!invoiceId) {
        alert("Missing InvoiceId. Cannot save.");
        return;
      }

      const feesGross = safeToNum(feesGrossStr);
      const feesSst = safeToNum(feesSstStr);
      const adminGross = safeToNum(adminGrossStr);
      const adminSst = safeToNum(adminSstStr);
      const stampDuty = safeToNum(stampDutyStr);
      const total = feesGross + feesSst + adminGross + adminSst + stampDuty;

      const fd = new FormData();
      fd.set("InvoiceId", String(invoiceId));

      // description + to/address
      fd.set("InvoiceTo", (billTo || "").trim());
      fd.set("InvoiceAdd", (billAddress || "").trim());       // old key
      fd.set("InvoiceAddress", (billAddress || "").trim());   // new key
      fd.set("Description", (descriptionText || "").trim());  // old key
      fd.set("InvoiceDesc", (descriptionText || "").trim());  // new key

      // date (keep as what header gives)
      fd.set("InvoiceDate", String(invoicePreview?.invoiceDate || "").trim());

      // amounts (send both aliases to be safe)
      fd.set("InvoiceFees", fmt2(feesGross));
      fd.set("InvoiceAmtGross", fmt2(feesGross));

      fd.set("InvoiceSst", fmt2(feesSst));
      fd.set("InvoiceAmtGrossSst", fmt2(feesSst));

      fd.set("InvoiceAdminCharges", fmt2(adminGross));
      fd.set("AdminCharges", fmt2(adminGross));

      fd.set("InvoiceAdminSst", fmt2(adminSst));
      fd.set("AdminChargesSst", fmt2(adminSst));

      fd.set("InvoiceStampDuty", fmt2(stampDuty));
      fd.set("StampDuty", fmt2(stampDuty));

      fd.set("InvoiceTotal", fmt2(total));

      const resp = await fetch(PROFORMA_INVOICE_UPDATE_URL, {
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
          (json && (json.data || json.error || json.message)) ||
          `Save failed. Server response: ${raw}`;
        throw new Error(msg);
      }

      alert(json.data || "Proforma invoice saved successfully.");
      onSaved?.();
    } catch (e: any) {
      console.error("Save invoice failed:", e);
      alert(e?.message || "Failed to save invoice.");
    }
  };

  const confirmGenerateInvoice = async () => {
    if (!invoicePreview) return;
    try {
      setGeneratingInvoice(true);
      await saveInvoiceNow();
      handleClose();
    } finally {
      setGeneratingInvoice(false);
    }
  };

  if (!open || !invoicePreview) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-100">
          <div className="font-semibold">Invoices</div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded hover:bg-gray-200"
            disabled={generatingInvoice}
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-2 font-semibold text-gray-700">
              Proforma Invoice No:.
            </div>
            <div className="md:col-span-4">
              <input
                className="w-full border rounded px-3 py-2 bg-gray-100"
                readOnly
                value={proformaNo || "(Auto Generate)"}
              />
            </div>

            <div className="md:col-span-2 font-semibold text-gray-700 text-right md:text-left">
              Date:
            </div>
            <div className="md:col-span-4">
              <input
                className="w-full border rounded px-3 py-2 bg-gray-100"
                readOnly
                value={invoicePreview.invoiceDate}
              />
            </div>
          </div>

          {/* ✅ NEW ROW 1: To */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-2 font-semibold text-gray-700">To :</div>
            <div className="md:col-span-10">
              <input
                className="w-full border rounded px-3 py-2 bg-white"
                value={billTo}
                onChange={(e) => setBillTo(e.target.value)}
                placeholder=""
                disabled={!isAccountUser || generatingInvoice || invReloading}
              />
            </div>
          </div>

          {/* ✅ NEW ROW 2: Address */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-2 font-semibold text-gray-700">
              Address :
            </div>
            <div className="md:col-span-10">
              <input
                className="w-full border rounded px-3 py-2 bg-white"
                value={billAddress}
                onChange={(e) => setBillAddress(e.target.value)}
                placeholder=""
                disabled={!isAccountUser || generatingInvoice || invReloading}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-2 font-semibold text-gray-700">
              Description :
            </div>

            <div className="md:col-span-10 space-y-2">
              <select
                className="w-full border rounded px-3 py-2 bg-white"
                value={selectedDescId}
                disabled={descLoading || filteredOptions.length === 0 || generatingInvoice || invReloading}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedDescId(id);

                  const fallback = `Proforma Invoice for InvoiceId ${invoiceId || "-"}`;
                  const base = getDescTextById(id).trim() || fallback;
                  setDescriptionText(appendAddress(base));
                }}
              >
                {descLoading ? (
                  <option value="">Loading descriptions...</option>
                ) : filteredOptions.length === 0 ? (
                  <option value="">No description options</option>
                ) : (
                  <>
                    <option value="">-- Select Description --</option>
                    {filteredOptions.map((r) => (
                      <option key={String(r.DescId)} value={String(r.DescId)}>
                        {r.DescText}
                      </option>
                    ))}
                  </>
                )}
              </select>

              <textarea
                className="w-full border rounded px-3 py-2 bg-white h-24"
                value={descriptionText}
                onChange={(e) => setDescriptionText(e.target.value)}
                disabled={!isAccountUser || generatingInvoice || invReloading}
              />
            </div>
          </div>

          {/* ===== Fees ===== */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-2 font-semibold text-gray-700">
              Fees (RM):
            </div>
            <div className="md:col-span-3">
              <input
                className="w-full border rounded px-3 py-2 bg-gray-100 text-right"
                value={feesGrossStr}
                onChange={(e) => setFeesGrossStr(cleanNumStr(e.target.value))}
                onBlur={(e) => setFeesGrossStr(fmt2(safeToNum(e.target.value)))}
                disabled={!isAccountUser || generatingInvoice || invReloading}
              />
            </div>

            <div className="md:col-span-2 font-semibold text-gray-700 text-center">
              +8% SST:
            </div>
            <div className="md:col-span-2">
              <input
                className="w-full border rounded px-3 py-2 bg-gray-100 text-right"
                value={feesSstStr}
                onChange={(e) => {
                  setFeesSstManual(true);
                  setFeesSstStr(cleanNumStr(e.target.value));
                }}
                onBlur={(e) => setFeesSstStr(fmt2(safeToNum(e.target.value)))}
                disabled={!isAccountUser || generatingInvoice || invReloading}
              />
            </div>

            <div className="md:col-span-1 font-semibold text-gray-700 text-center">
              =
            </div>
            <div className="md:col-span-2">
              <input
                className="w-full border rounded px-3 py-2 bg-gray-100 text-right font-semibold"
                readOnly
                value={to2s(invoicePreview.feesPlusSst)}
              />
            </div>
          </div>

          {/* ===== Admin Fees ===== */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-2 font-semibold text-gray-700">
              Admin Fees (RM):
            </div>
            <div className="md:col-span-3">
              <input
                className="w-full border rounded px-3 py-2 bg-gray-100 text-right"
                value={adminGrossStr}
                onChange={(e) => setAdminGrossStr(cleanNumStr(e.target.value))}
                onBlur={(e) => setAdminGrossStr(fmt2(safeToNum(e.target.value)))}
                disabled={!isAccountUser || generatingInvoice || invReloading}
              />
            </div>

            <div className="md:col-span-2 font-semibold text-gray-700 text-center">
              +8% SST:
            </div>
            <div className="md:col-span-2">
              <input
                className="w-full border rounded px-3 py-2 bg-gray-100 text-right"
                value={adminSstStr}
                onChange={(e) => {
                  setAdminSstManual(true);
                  setAdminSstStr(cleanNumStr(e.target.value));
                }}
                onBlur={(e) => setAdminSstStr(fmt2(safeToNum(e.target.value)))}
                disabled={!isAccountUser || generatingInvoice || invReloading}
              />
            </div>

            <div className="md:col-span-1 font-semibold text-gray-700 text-center">
              =
            </div>
            <div className="md:col-span-2">
              <input
                className="w-full border rounded px-3 py-2 bg-gray-100 text-right font-semibold"
                readOnly
                value={to2s(invoicePreview.adminPlusSst)}
              />
            </div>
          </div>

          {/* Stamp Duty */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-6" />
            <div className="md:col-span-3 font-semibold text-gray-700 text-right">
              Stamp Duty (RM) =
            </div>
            <div className="md:col-span-3">
              <input
                className="w-full border rounded px-3 py-2 bg-gray-100 text-right"
                value={stampDutyStr}
                onChange={(e) => setStampDutyStr(cleanNumStr(e.target.value))}
                onBlur={(e) => setStampDutyStr(fmt2(safeToNum(e.target.value)))}
                disabled={!isAccountUser || generatingInvoice || invReloading}
              />
            </div>
          </div>

          {/* Invoice Amount */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-7" />
            <div className="md:col-span-2 font-semibold text-gray-700 text-right">
              Total (RM) =
            </div>
            <div className="md:col-span-3">
              <input
                className="w-full border rounded px-3 py-2 bg-gray-100 text-right font-semibold"
                readOnly
                value={to2s(invoicePreview.invoiceAmount)}
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={generatingInvoice}
              className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={confirmGenerateInvoice}
              disabled={generatingInvoice || !isAccountUser || invReloading}
              className={`px-4 py-2 rounded text-white ${
                generatingInvoice
                  ? "bg-blue-600/60 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {generatingInvoice ? "Generating..." : "Update Proforma Invoice"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuyerProformaInvoiceEditPopup;
