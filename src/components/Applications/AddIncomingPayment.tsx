import { API_ENDPOINTS } from '../../config/apiConfig';
// src/components/Applications/AddIncomingPayment.tsx
import React, { useRef, useState, useMemo, useEffect } from "react";
import { ArrowLeft, Trash2, Eye } from "lucide-react";
import type { RentalApplication } from "../../types";

/** =========================
 *  Props
 *  ========================= */
interface AddIncomingPaymentProps {
  applicationId: string;
  onBack: () => void;

  /** Pass full application so we can read values (optional) */
  application?: RentalApplication;

  /** Notify parent to refresh after successful save (optional) */
  onSaved?: () => void;

  /** Optional overrides */
  saveUrl?: string;
  addByUserName?: string;
  uploadedFileGetUrl?: string;
}

/** =========================
 *  Constants & Helpers
 *  ========================= */
const SAVE_URL_DEFAULT =
  API_ENDPOINTS.PAYMENT_TRANS_INSERT;
const UPLOADED_FILE_GET_DEFAULT =
  API_ENDPOINTS.UPLOADED_FILE_GET;

const sstRate = 0.08;

const to2 = (n: number) => (Number.isFinite(n) ? n : 0).toFixed(2);

const num = (v: any) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

const formatMYR = (v: any) =>
  `RM ${num(v).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// HTML date (yyyy-mm-dd) -> dd/mm/yyyy for PHP
const toDMY = (yyyyMmDd?: string) => {
  if (!yyyyMmDd) return "";
  const [y, m, d] = yyyyMmDd.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
};

const fileNameFromUrl = (u?: string) => {
  if (!u) return "-";
  try {
    const p = u.split("?")[0];
    const seg = p.split("/").filter(Boolean);
    return seg[seg.length - 1] || u;
  } catch {
    return u;
  }
};

/** =========================
 *  Local Types
 *  ========================= */

type FileItem = {
  file: File;
  amount: string;   // raw input
  date: string;     // yyyy-mm-dd
  party: "Tenant" | "Landlord";  // NEW
};


type ExistingFile = {
  RowId: number;
  AttName: string;
  ActualFileName?: string;
  PaymentAmt: string;
  PaymentDate: string;
  PaymentTransId: number;
  ClaimParty?: string;
  AddDate?: string | null;
};

/** =========================
 *  Component
 *  ========================= */
const AddIncomingPayment: React.FC<AddIncomingPaymentProps> = ({
  applicationId,
  onBack,
  application,
  onSaved,
  saveUrl = SAVE_URL_DEFAULT,
  addByUserName,
  uploadedFileGetUrl = UPLOADED_FILE_GET_DEFAULT,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Who is paying (maps to ClaimParty)
  const [paymentFrom, setPaymentFrom] = useState<"Tenant" | "Landlord">("Tenant");
  const [remarks, setRemarks] = useState("");

  /** ===== Tenant Billing ===== */
  const [tenantServiceFees, setTenantServiceFees] = useState("0.00");
  const [tenantServiceFeesSstOn, setTenantServiceFeesSstOn] = useState(true);
  const tenantServiceSst = useMemo(
    () => (tenantServiceFeesSstOn ? num(tenantServiceFees) * sstRate : 0),
    [tenantServiceFees, tenantServiceFeesSstOn]
  );
  const tenantServiceTotal = useMemo(
    () => num(tenantServiceFees) + tenantServiceSst,
    [tenantServiceFees, tenantServiceSst]
  );

  const [tenantAdminCharges, setTenantAdminCharges] = useState("0.00");
  const [tenantAdminSstOn, setTenantAdminSstOn] = useState(true);
  const tenantAdminSst = useMemo(
    () => (tenantAdminSstOn ? num(tenantAdminCharges) * sstRate : 0),
    [tenantAdminCharges, tenantAdminSstOn]
  );
  const tenantAdminTotal = useMemo(
    () => num(tenantAdminCharges) + tenantAdminSst,
    [tenantAdminCharges, tenantAdminSst]
  );

  const [tenantStampDuty, setTenantStampDuty] = useState("0.00");
  const [tenantToRen, setTenantToRen] = useState("0.00");

  const tenantGrandTotal = useMemo(
    () =>
      tenantServiceTotal +
      tenantAdminTotal +
      num(tenantStampDuty) +
      num(tenantToRen),
    [tenantServiceTotal, tenantAdminTotal, tenantStampDuty, tenantToRen]
  );

  /** ===== Landlord Fees (not deposits) ===== */
  const [landlordProfFees, setLandlordProfFees] = useState("0.00");
  const [landlordProfSstOn, setLandlordProfSstOn] = useState(true);
  const landlordProfSst = useMemo(
    () => (landlordProfSstOn ? num(landlordProfFees) * sstRate : 0),
    [landlordProfFees, landlordProfSstOn]
  );
  const landlordProfTotal = useMemo(
    () => num(landlordProfFees) + landlordProfSst,
    [landlordProfFees, landlordProfSst]
  );

  const [landlordAdminCharges, setLandlordAdminCharges] = useState("0.00");
  const [landlordAdminSstOn, setLandlordAdminSstOn] = useState(true);
  const landlordAdminSst = useMemo(
    () => (landlordAdminSstOn ? num(landlordAdminCharges) * sstRate : 0),
    [landlordAdminCharges, landlordAdminSstOn]
  );
  const landlordAdminTotal = useMemo(
    () => num(landlordAdminCharges) + landlordAdminSst,
    [landlordAdminCharges, landlordAdminSst]
  );

  const [landlordStampDuty, setLandlordStampDuty] = useState("0.00");
  const [landlordMisc, setLandlordMisc] = useState("0.00");

  const landlordGrandTotal = useMemo(
    () =>
      landlordProfTotal +
      landlordAdminTotal +
      num(landlordStampDuty) +
      num(landlordMisc),
    [landlordProfTotal, landlordAdminTotal, landlordStampDuty, landlordMisc]
  );

  /** ===== Attachments (client-side to upload) ===== */
  const [files, setFiles] = useState<FileItem[]>([]);
  const addFiles = (list: FileList | null) => {
  if (!list || !list.length) return;
  const arr = Array.from(list).map<FileItem>((f) => ({
    file: f,
    amount: "0.00",
    date: "",            // yyyy-mm-dd
    party: paymentFrom,  // NEW: default to current "Payment From" selector
  }));
  setFiles((prev) => [...prev, ...arr]);
};

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const paymentSlipsTotal = useMemo(
    () => files.reduce((sum, it) => sum + num(it.amount), 0),
    [files]
  );

  /** ===== Server-side existing uploads ===== */
  const [existingFiles, setExistingFiles] = useState<ExistingFile[]>([]);
  const [existingLoading, setExistingLoading] = useState(false);
  const [existingError, setExistingError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExistingFiles = async () => {
      try {
        setExistingLoading(true);
        setExistingError(null);

        const fd = new FormData();
        fd.set("ApplicationId", applicationId);

        const resp = await fetch(uploadedFileGetUrl, {
          method: "POST",
          body: fd,
        });

        if (!resp.ok) {
          const t = await resp.text().catch(() => "");
          throw new Error(`HTTP ${resp.status} ${resp.statusText}${t ? ` — ${t}` : ""}`);
        }
        const json = await resp.json();
        if (json?.status !== "success") {
          throw new Error(json?.error || "Unable to load uploaded files.");
        }
        const arr: ExistingFile[] = Array.isArray(json?.data) ? json.data : [];
        setExistingFiles(arr);
      } catch (e: any) {
        console.error("UploadedFileGet failed:", e);
        setExistingError(e?.message || "Failed to load uploaded files.");
      } finally {
        setExistingLoading(false);
      }
    };

    fetchExistingFiles();
  }, [applicationId, uploadedFileGetUrl]);
 
useEffect(() => {
  // wait until existing slips done loading
  if (existingLoading) return;

  // if application is passed in, wait until prefill ran for this applicationId
  if (application && prefilledKey.current !== applicationId) return;

  // only auto-save once
  if (autoSavedRef.current) return;

  // don't trigger if already saving
  if (saving) return;

  autoSavedRef.current = true;
  submitPayment();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [existingLoading, application, applicationId]);

  
  const existingSlipsTotal = useMemo(
    () => existingFiles.reduce((sum, f) => sum + num(f.PaymentAmt ?? 0), 0),
    [existingFiles]
  );

  /** ===== Totals ===== */
  const totalReceived = useMemo(
    () => tenantGrandTotal + landlordGrandTotal,
    [tenantGrandTotal, landlordGrandTotal]
  );

  /** ===== Prefill (optional) from application for fees/remarks/party ===== */
  const prefilledKey = useRef<string | null>(null);
  useEffect(() => {
    if (!application) return;
    if (prefilledKey.current === applicationId) return;

    const a: any = application;
    const getN = (key: string, fallback = "0.00") =>
      a?.[key] != null && a[key] !== "" ? String(a[key]) : fallback;
    const getB = (key: string, def = true) => {
      const v = a?.[key];
      if (v === "0" || v === 0 || v === false || v === "false") return false;
      if (v === "1" || v === 1 || v === true || v === "true") return true;
      return def;
    };

    setTenantServiceFees(getN("TenantServiceFees", tenantServiceFees));
    setTenantServiceFeesSstOn(getB("TenantServiceFeesSstOn", tenantServiceFeesSstOn));
    setTenantAdminCharges(getN("TenantAdminCharges", tenantAdminCharges));
    setTenantAdminSstOn(getB("TenantAdminSstOn", tenantAdminSstOn));
    setTenantStampDuty(getN("TenantStampDuty", tenantStampDuty));
    setTenantToRen(getN("TenantToRen", tenantToRen));

    setLandlordProfFees(getN("LandlordProfFees", landlordProfFees));
    setLandlordProfSstOn(getB("LandlordProfSstOn", landlordProfSstOn));
    setLandlordAdminCharges(getN("LandlordAdminCharges", landlordAdminCharges));
    setLandlordAdminSstOn(getB("LandlordAdminSstOn", landlordAdminSstOn));
    setLandlordStampDuty(getN("LandlordStampDuty", landlordStampDuty));
    setLandlordMisc(getN("LandlordMisc", landlordMisc));

    const party = String(a?.ClaimParty || a?.PaymentFrom || "Tenant");
    setPaymentFrom(party === "Landlord" ? "Landlord" : "Tenant");
    if (a?.PaymentRemarks || a?.Remarks) {
      setRemarks(String(a.PaymentRemarks || a.Remarks));
    }

    prefilledKey.current = applicationId;
    // We intentionally do not list the state setters in deps to avoid re-prefill loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, application]);

  /** ===== Landlord deposit total (read-only from application) ===== */
  const landlordDepositTotal = useMemo(() => {
    // Note: excludes Monthly Rental Amount, sums only deposit/breakdown fields.
    return (
      num(application?.AtlEdFullAmt) +
      num(application?.AtrAdvRentalAmt) +
      num(application?.AtrSecurityDepositAmt) +
      num(application?.AtrUtilityDepositAmt) +
      num(application?.AtrAccessCard) +
      num(application?.AtrIndahWater) +
      num(application?.AtrOtherDepositAmt)
    );
  }, [application]);

  /** ===== Handlers ===== */
  const handlePickFiles = () => fileInputRef.current?.click();

  const [saving, setSaving] = useState(false);

// ✅ prevent auto-save multiple times
const autoSavedRef = useRef(false);

// ✅ move your current submit logic into a function we can call automatically
const submitPayment = async () => {
  try {
    setSaving(true);

    const fd = new FormData();
    fd.set("ClaimParty", paymentFrom);
    fd.set("ApplicationId", applicationId);
    fd.set("PaymentTransType", "INCOMING");
    fd.set("AddByUserName", addByUserName || localStorage.getItem("UserName") || "");
    fd.set("Remarks", remarks);

    // Totals
    fd.set("TotalReceived", to2(totalReceived));
    fd.set("TenantGrandTotal", to2(tenantGrandTotal));
    fd.set("LandlordGrandTotal", to2(landlordGrandTotal));
    fd.set("PaymentSlipsTotal", to2(paymentSlipsTotal));

    // Tenant
    fd.set("TenantServiceFees", to2(num(tenantServiceFees)));
    fd.set("TenantServiceFeesSst", to2(tenantServiceSst));
    fd.set("TenantServiceFeesTotal", to2(tenantServiceTotal));

    fd.set("TenantAdminCharges", to2(num(tenantAdminCharges)));
    fd.set("TenantAdminChargesSst", to2(tenantAdminSst));
    fd.set("TenantAdminChargesTotal", to2(tenantAdminTotal));

    fd.set("TenantStampDuty", to2(num(tenantStampDuty)));
    fd.set("TenantToRen", to2(num(tenantToRen)));

    // Landlord fees
    fd.set("LandlordProfFees", to2(num(landlordProfFees)));
    fd.set("LandlordProfFeesSst", to2(landlordProfSst));
    fd.set("LandlordProfFeesTotal", to2(landlordProfTotal));

    fd.set("LandlordAdminCharges", to2(num(landlordAdminCharges)));
    fd.set("LandlordAdminChargesSst", to2(landlordAdminSst));
    fd.set("LandlordAdminChargesTotal", to2(landlordAdminTotal));

    fd.set("LandlordStampDuty", to2(num(landlordStampDuty)));
    fd.set("LandlordMisc", to2(num(landlordMisc)));

    // Attachments + aligned metadata
    if (files.length > 0) {
      fd.set("HasAttachments", "1");
      fd.set("AttachmentCount", String(files.length));
    }
    files.forEach(({ file, amount, date, party }) => {
      fd.append("attachments[]", file, file.name);
      fd.append("totalAmt[]", to2(num(amount)));
      fd.append("paymentDate[]", toDMY(date));
      fd.append("ClaimParty[]", party);
    });

    fd.set(
      "PaymentTransJson",
      JSON.stringify({
        refunds: { refundToTenant: 0, refundToLandlord: 0 },
        landlordDepositTotal,
        paymentSlipsTotal,
      })
    );

    const resp = await fetch(saveUrl, { method: "POST", body: fd });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`HTTP ${resp.status} ${resp.statusText}${t ? ` — ${t}` : ""}`);
    }
    const json = await resp.json().catch(() => ({}));
    if (json?.status === "success") {
      alert(`Saved! PaymentTransId=${json.PaymentTransId} • Files uploaded=${json.files_uploaded}`);
      await onSaved?.();
      onBack();
    } else {
      throw new Error(json?.error || json?.data || json?.message || "Save failed at server.");
    }
  } catch (err: any) {
    console.error("Save incoming payment failed:", err);
    alert(err?.message || "Failed to save payment.");
  } finally {
    setSaving(false);
  }
};

// ✅ form still uses handleSubmit (same as before)
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  await submitPayment();
};


  /** =========================
   *  RENDER
   *  ========================= */
  return (
    <div className="p-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        type="button"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Payments
      </button>

      <h2 className="text-xl font-semibold mb-6 text-center">INCOMING PAYMENT DETAILS</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Payment Slips (to upload now) */}
        <div className="border rounded-lg p-4 shadow-sm bg-white">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            {files.length ? "ADD MORE PAYMENT SLIPS" : "CLICK HERE TO SELECT PAYMENT SLIP"}
          </button>

          {files.length > 0 && (
            <div className="mt-4 space-y-3">
              {files.map((item, i) => (
                <div
  key={`${item.file.name}-${i}`}
  className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center border rounded p-3"
>
  {/* File name */}
  <div className="md:col-span-4 truncate">
    <div className="text-sm font-medium">{item.file.name}</div>
    <div className="text-xs text-gray-500">
      {(item.file.size / 1024).toFixed(1)} KB • {item.file.type || "file"}
    </div>
  </div>

  {/* Payment Date */}
  <div className="md:col-span-3">
    <label className="text-xs text-gray-600">Payment Date</label>
    <input
      type="date"
      value={item.date}
      onChange={(e) =>
        setFiles((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, date: e.target.value } : it))
        )
      }
      className="w-full border rounded px-2 py-1"
    />
  </div>

  {/* Amount (RM) */}
  <div className="md:col-span-2">
    <label className="text-xs text-gray-600">Amount (RM)</label>
    <input
      type="number"
      step="0.01"
      value={item.amount}
      onChange={(e) =>
        setFiles((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, amount: e.target.value } : it))
        )
      }
      className="w-full border rounded px-2 py-1"
    />
  </div>

  {/* Party (NEW) */}
  <div className="md:col-span-1">
    <label className="text-xs text-gray-600">Party</label>
    <select
      value={item.party}
      onChange={(e) =>
        setFiles((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, party: e.target.value as "Tenant" | "Landlord" } : it
          )
        )
      }
      className="w-full border rounded px-2 py-1"
    >
      <option value="Tenant">Tenant</option>
      <option value="Landlord">Landlord</option>
    </select>
  </div> 

  {/* Actions */}
  <div className="md:col-span-2 flex justify-end">
    <button
  type="button"
  onClick={() => removeFile(i)}   // <-- fix here
  className="inline-flex items-center gap-1 px-3 py-2 text-red-600 border border-red-200 rounded hover:bg-red-50"
>
  <Trash2 className="w-4 h-4" />
  Remove
</button>
  </div>
</div>

              ))}

              {/* Client-side slips total */}
              <div className="flex justify-end pt-2">
                <div className="w-full md:w-1/3">
                  <div className="flex items-center justify-between border rounded px-3 py-2 bg-gray-50">
                    <span className="font-semibold">Payment Slips Total (RM)</span>
                    <span className="font-bold">{to2(paymentSlipsTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )} 

          {/* Existing uploads */}
          <div className="mt-6 border-t pt-4">
            <div className="font-semibold mb-2">Existing Uploaded Slips</div>

            {existingLoading && <div className="text-sm text-gray-500">Loading…</div>}
            {existingError && <div className="text-sm text-red-600">{existingError}</div>}

            {!existingLoading && !existingError && existingFiles.length === 0 && (
              <div className="text-sm text-gray-500">No existing uploads.</div>
            )}

            {!existingLoading && !existingError && existingFiles.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 text-left border">File</th>
                        <th className="p-2 text-left border">Bank In Date</th>
                        <th className="p-2 text-right border">Amount (RM)</th>
                        <th className="p-2 text-center border">View</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existingFiles.map((f) => {
                        const label =
                          (f.ActualFileName && f.ActualFileName.trim() !== ""
                            ? f.ActualFileName
                            : fileNameFromUrl(f.AttName)) || "-";
                        return (
                          <tr key={f.RowId} className="odd:bg-white even:bg-gray-50">
                            <td className="p-2 border break-all">{label}</td>
                            <td className="p-2 border">{f.PaymentDate || "-"}</td>
                            <td className="p-2 border text-right">{f.PaymentAmt ?? "-"}</td>
                            <td className="p-2 border text-center">
                              <a
                                href={f.AttName}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-blue-600 underline hover:no-underline"
                                title="View uploaded file"
                              >
                                <Eye className="w-4 h-4" />
                                <span className="hidden sm:inline">View</span>
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="p-2 border font-semibold text-right" colSpan={2}>
                          Total (Existing Slips)
                        </td>
                        <td className="p-2 border text-right font-bold">RM {to2(existingSlipsTotal)}</td>
                        <td className="p-2 border" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* TENANT BILLING DETAILS — read-only from `application` */}
<div className="border rounded-lg shadow-sm">
  <div className="bg-gray-100 px-4 py-2 font-semibold text-gray-700 rounded-t-lg">
    TENANT BILLING DETAILS
  </div>

  <div className="p-4 space-y-3 text-sm">
    {/* Header (desktop only) */}
    <div className="hidden md:grid md:grid-cols-5 gap-4 text-gray-600 font-medium">
      <div className="col-span-2">Item</div>
      <div className="text-right">Amount</div>
      <div className="text-right">SST (8%)</div>
      <div className="text-right">Total</div>
    </div>

    {/* Service Fees */}
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
      <span className="md:col-span-2">Service Fees</span>
      <span className="text-right tabular-nums">
        {formatMYR(application?.TalServiceFeesAmt)}
      </span>
      <span className="text-right tabular-nums">
        {formatMYR(application?.TalProfessionalFeesSstAmt)}
      </span>
      <span className="text-right font-medium tabular-nums">
        {formatMYR(application?.TalServiceFeesTotalAmt)}
      </span>
    </div>

    {/* Admin Fees */}
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
      <span className="md:col-span-2">Admin Fees</span>
      <span className="text-right tabular-nums">
        {formatMYR(application?.TenantAdminFeesAmt)}
      </span>
      <span className="text-right tabular-nums">
        {formatMYR(application?.TenantAdminFeesSst)}
      </span>
      <span className="text-right font-medium tabular-nums">
        {formatMYR(application?.TenantAdminFeesTotal)}
      </span>
    </div>

    {/* Stamping */}
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
      <span className="md:col-span-2">Stamping</span>
      <span className="text-right tabular-nums">
        {formatMYR(application?.TenantStampingFees)}
      </span>
      <span className="text-right tabular-nums">—</span>
      <span className="text-right font-medium tabular-nums">
        {formatMYR(application?.TenantStampingFees)}
      </span>
    </div>

    {/* TOTAL */}
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center font-semibold pt-2">
      <span className="md:col-span-2">TOTAL</span>
      <span />
      <span />
      <span className="text-right font-bold tabular-nums">
        {formatMYR(
          num(application?.TalServiceFeesTotalAmt) +
            num(application?.TenantAdminFeesTotal) +
            num(application?.TenantStampingFees)
        )}
      </span>
    </div>
  </div>
</div>


        {/* PAYMENT BREAKDOWN FOR LANDLORD (READ-ONLY FROM application) */}
<div className="border rounded-lg shadow-sm">
  <div className="bg-gray-100 px-4 py-2 font-semibold text-gray-700 rounded-t-lg">
    PAYMENT BREAKDOWN FOR LANDLORD
  </div>

  <div className="p-4 space-y-3">
    {[
      ["Monthly Rental Amount", application?.AtlRentalAmt],
      ["Earnest Deposit / Advance Rental", application?.AtlEdFullAmt],
      ["Advance Rental (Full Amt.)", application?.AtrAdvRentalAmt],
      ["Security Deposit", application?.AtrSecurityDepositAmt],
      ["Utility Deposit", application?.AtrUtilityDepositAmt],
      ["Access Card Deposit", application?.AtrAccessCard],
      ["Indah Water", application?.AtrIndahWater],
      ["Other Deposit", application?.AtrOtherDepositAmt],
    ].map(([label, val]) => (
      <div
        key={label as string}
        className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center"
      >
        <span className="text-sm">{label as string}</span>
        <span className="text-right font-medium tabular-nums">
          {formatMYR(val)}
        </span>
      </div>
    ))}

    {/* Total (Deposits only) */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center font-semibold pt-2">
      <span>Total </span>
      <span className="text-right font-semibold tabular-nums">
        {formatMYR(landlordDepositTotal)}
      </span>
    </div>
  </div>
</div>


        {/* PAYMENT FROM LANDLORD (fees) */}
        

        {/* PAYMENT FROM LANDLORD (fees) — read-only from `application` */}
<div className="border rounded-lg shadow-sm">
  <div className="bg-gray-100 px-4 py-2 font-semibold text-gray-700 rounded-t-lg">
    PAYMENT FROM LANDLORD
  </div>

  <div className="p-4 space-y-3 text-sm">
    {/* Header (desktop only) */}
    <div className="hidden md:grid md:grid-cols-5 gap-4 text-gray-600 font-medium">
      <div className="col-span-2">Item</div>
      <div className="text-right">Amount</div>
      <div className="text-right">SST (8%)</div>
      <div className="text-right">Total</div>
    </div>

    {/* Professional Fees */}
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
      <span className="md:col-span-2">Professional Fees</span>
      <span className="text-right tabular-nums">{formatMYR(application?.AtlProFees)}</span>
      <span className="text-right tabular-nums">{formatMYR(application?.AtlProFeesSstAmt)}</span>
      <span className="text-right font-medium tabular-nums">
        {formatMYR(application?.AtlProFeesTotalAmt)}
      </span>
    </div>

    {/* Admin Fees */}
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
      <span className="md:col-span-2">Admin Fees</span>
      <span className="text-right tabular-nums">{formatMYR(application?.LandlordAdminFeesAmt)}</span>
      <span className="text-right tabular-nums">{formatMYR(application?.LandlordAdminFeesSst)}</span>
      <span className="text-right font-medium tabular-nums">
        {formatMYR(application?.LandlordAdminFeesTotal)}
      </span>
    </div>

    {/* Stamping */}
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
      <span className="md:col-span-2">Stamping</span>
      <span className="text-right tabular-nums">{formatMYR(application?.LandlordStampingFees)}</span>
      <span className="text-right tabular-nums">—</span>
      <span className="text-right font-medium tabular-nums">
        {formatMYR(application?.LandlordStampingFees)}
      </span>
    </div>

    {/* GRAND TOTAL (ProFees Total + Admin Total + Stamping) */}
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center font-semibold pt-2">
      <span className="md:col-span-2">TOTAL</span>
      <span className="text-right"> </span>
      <span className="text-right"> </span>
      <span className="text-right font-bold tabular-nums">
        {formatMYR(
          num(application?.AtlProFeesTotalAmt) +
            num(application?.LandlordAdminFeesTotal) +
            num(application?.LandlordStampingFees)
        )}
      </span>
    </div>
  </div>
</div>
 

        {/* Refunds (keep as inputs if you want to send in JSON) */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <label>Refund to Tenant</label>
            <input
              type="number"
              step="0.01"
              className="border rounded px-3 py-2 bg-red-100"
              // not stored separately in state above (you can add state if needed)
              value={"0.00"}
              readOnly
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <label>Refund to Landlord</label>
            <input
              type="number"
              step="0.01"
              className="border rounded px-3 py-2 bg-red-100"
              value={"0.00"}
              readOnly
            />
          </div>
        </div>

        

        {/* Actions */}
        <div className="flex flex-wrap gap-3 justify-center">          
          <button
            type="submit"
            disabled={saving}
            className={`px-4 py-2 text-white rounded ${
              saving ? "bg-green-600/60 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {saving ? "Saving…" : "SAVE AS NEW PAYMENT"}
          </button>
          <button type="button" onClick={onBack} className="px-4 py-2 bg-red-500 text-white rounded">
            CLOSE
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddIncomingPayment;
