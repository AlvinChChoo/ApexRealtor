import { API_ENDPOINTS, API_DEV_ENDPOINTS } from '../../config/apiConfig';
import React, { useState, useEffect, useMemo } from "react";
import { X as XIcon } from "lucide-react";
import type { RentalApplication } from "../../types";
import { toNum, to2, to2s } from "../../utils/paymentUtils";
import { PROFORMA_INVOICE_GENERATE_URL } from "../../constants/paymentApiUrls";

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

interface TenantProformaInvoicePopupProps {
  isOpen: boolean;
  onClose: () => void;
  party: PreviewParty;
  paymentTransId: string | number;
  applicationId: string | number;
  application?: RentalApplication;

  tenantServiceFees: string | number;
  tenantAdminChargesTotal: string | number;
  landlordAdminChargesTotal: string | number;
  tenantStampDuty: string | number;
  landlordStampDuty: string | number;
  tenantToRen: string | number;
  landlordToRen: string | number;
  tenantLabel: string;
  landlordLabel: string;
  onSuccess?: () => void;
}

type InvoiceDescRow = {
  DescId: string;
  DescGroup: string;
  DescText: string;
};

const TenantProformaInvoicePopup: React.FC<TenantProformaInvoicePopupProps> = ({
  isOpen,
  onClose,
  party,
  paymentTransId,
  applicationId,
  application,
  tenantServiceFees,
  tenantAdminChargesTotal,
  landlordAdminChargesTotal,
  tenantStampDuty,
  landlordStampDuty,
  tenantToRen,
  landlordToRen,
  tenantLabel,
  landlordLabel,
  onSuccess,
}) => {
  const [invoicePreview, setInvoicePreview] = useState<InvoicePreview | null>(null);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  const INVOICE_DESC_GET_URL =
    (import.meta as any)?.env?.DEV
      ? API_DEV_ENDPOINTS.INVOICE_DESC_GET
      : API_ENDPOINTS.INVOICE_DESC_GET;

  const [descRows, setDescRows] = useState<InvoiceDescRow[]>([]);
  const [descLoading, setDescLoading] = useState(false);
  const [selectedDescId, setSelectedDescId] = useState<string>("");

  const [descriptionText, setDescriptionText] = useState<string>("");

  // ✅ NEW: To / Address fields
  const [billTo, setBillTo] = useState<string>("");
  const [billAddress, setBillAddress] = useState<string>("");

  // ✅ Default "To" + "Address" based on PreviewParty when popup opens
  useEffect(() => {
    if (!isOpen) return;

    const app: any = application || {};

    /*
    if (party === "LANDLORD") {
      setBillTo(String(app?.Landlord1Name ?? "").trim());
      setBillAddress(String(app?.Landlord1MailingAdd ?? "").trim());
    } else {
      setBillTo(String(app?.Tenant1Name ?? "").trim());
      setBillAddress(String(app?.Tenant1MailingAdd ?? "").trim());
    }
  */

    if (party === "LANDLORD") {
  const landlordName = String(app?.Landlord1Name ?? "").trim();
  const landlordId = String(app?.Landlord1Id ?? "").trim();

  setBillTo(
    landlordName
      ? `${landlordName}${landlordId ? ` (${landlordId})` : ""}`
      : ""
  );
  setBillAddress(String(app?.Landlord1MailingAdd ?? "").trim());
} else {
  const tenantName = String(app?.Tenant1Name ?? "").trim();
  const tenantId = String(app?.Tenant1Id ?? "").trim();

  setBillTo(
    tenantName
      ? `${tenantName}${tenantId ? ` (${tenantId})` : ""}`
      : ""
  );
  setBillAddress(String(app?.Tenant1MailingAdd ?? "").trim());
}

    
  }, [isOpen, party, application]);

  const wantedGroup = useMemo(() => {
    return party === "TENANT" ? "RENTAL_TENANT" : "RENTAL_LANDLORD";
  }, [party]);

  const filteredOptions = useMemo(() => {
    return descRows.filter(
      (r) => String(r.DescGroup || "").toUpperCase() === wantedGroup
    );
  }, [descRows, wantedGroup]);

  const selectedDescText = useMemo(() => {
    const row = filteredOptions.find(
      (x) => String(x.DescId) === String(selectedDescId)
    );
    return row?.DescText ?? "";
  }, [filteredOptions, selectedDescId]);

  const appendAddress = (text: string) => {
  const app: any = application || {};

  const addrFull = [
    app?.PropertyAddress,
    app?.PropertyPostalCode,
    app?.PropertyState,
  ]
    .filter(Boolean)
    .join(", ");

  if (!addrFull) return text;

  let base = (text || "").trim();

  // avoid double add
  if (base.toLowerCase().includes(addrFull.toLowerCase())) return base;

  // force 2 lines after "at :"
  if (base.toLowerCase().includes("at :")) {
    return base.replace(/at\s*:\s*/i, "at :\n") + addrFull;
  }

  // fallback
  if (base.endsWith(":")) {
    return `${base}\n${addrFull}`;
  }

  return `${base}:\n${addrFull}`;
};

  const getDescTextById = (id: string) => {
    const row = filteredOptions.find((x) => String(x.DescId) === String(id));
    return row?.DescText ?? "";
  };

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const load = async () => {
      try {
        setDescLoading(true);

        const fd = new FormData();

        const resp = await fetch(INVOICE_DESC_GET_URL, {
          method: "POST",
          body: fd,
        });

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

        const first = rows.find(
          (x) => String(x.DescGroup || "").toUpperCase() === wantedGroup
        );
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
  }, [isOpen, INVOICE_DESC_GET_URL, wantedGroup]);

  useEffect(() => {
    if (!isOpen) return;

    const fallback =
      (party === "TENANT" ? tenantLabel : landlordLabel) +
      ` Proforma Invoice for PaymentTransId ${paymentTransId}`;

    const nextText = (selectedDescText || "").trim() || fallback;
    setDescriptionText(appendAddress(nextText));
  }, [
    isOpen,
    selectedDescText,
    party,
    tenantLabel,
    landlordLabel,
    paymentTransId,
    application,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    const isTenant = party === "TENANT";

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const invoiceDate = `${yyyy}-${mm}-${dd}`;

    const feesGross = isTenant
      ? toNum(tenantServiceFees)
      : toNum((application as any)?.AtlProFees);

    const sstAmt = isTenant
      ? toNum((application as any)?.TalProfessionalFeesSstAmt)
      : toNum((application as any)?.AtlProFeesSstAmt);

    const feesPlusSst = feesGross + sstAmt;

    const adminGross = isTenant
      ? toNum((application as any)?.TenantAdminFeesAmt)
      : toNum((application as any)?.LandlordAdminFeesAmt);

    const adminSstAmt = isTenant
      ? toNum((application as any)?.TenantAdminFeesSst)
      : toNum((application as any)?.LandlordAdminFeesSst);

    const adminPlusSst = adminGross + adminSstAmt;

    const stampDuty = isTenant ? toNum(tenantStampDuty) : toNum(landlordStampDuty);
    const tenantToRenVal = isTenant ? toNum(tenantToRen) : toNum(landlordToRen);

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
      tenantToRenVal,
    });
  }, [
    isOpen,
    party,
    tenantServiceFees,
    tenantAdminChargesTotal,
    landlordAdminChargesTotal,
    tenantStampDuty,
    landlordStampDuty,
    tenantToRen,
    landlordToRen,
    descriptionText,
    application,
  ]);

  const handleClose = () => {
    if (generatingInvoice) return;
    setInvoicePreview(null);
    setBillTo("");
    setBillAddress("");
    onClose();
  };

  const generateInvoiceNow = async (invoiceParty: PreviewParty) => {
    try {
      const isTenant = invoiceParty === "TENANT";

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const invoiceDate = `${yyyy}-${mm}-${dd}`;
      const applicationClaimId = Number(paymentTransId || 0);

      const adminGross = isTenant
        ? toNum((application as any)?.TenantAdminFeesAmt)
        : toNum((application as any)?.LandlordAdminFeesAmt);

      const adminSstAmt = isTenant
        ? toNum((application as any)?.TenantAdminFeesSstAmt)
        : toNum((application as any)?.LandlordAdminFeesSst);

      const stampDuty = isTenant ? toNum(tenantStampDuty) : toNum(landlordStampDuty);
      const tenantToRenVal = isTenant ? toNum(tenantToRen) : toNum(landlordToRen);

      const fd = new FormData();

      fd.set("ApplicationId", String(applicationId ?? ""));
      fd.set("InvoiceDate", invoiceDate);
      fd.set("ApplicationClaimId", String(applicationClaimId));

      const feesGross = isTenant
        ? toNum(tenantServiceFees)
        : toNum((application as any)?.AtlProFees);

      const feesSstAmt = isTenant
        ? toNum((application as any)?.TalProfessionalFeesSstAmt)
        : toNum((application as any)?.AtlProFeesSstAmt);

      fd.set("InvoiceAmtGross", to2(feesGross));
      fd.set("InvoiceAmtGrossSst", to2(feesSstAmt));
      fd.set("AdminCharges", to2(adminGross));
      //fd.set("AdminChargesSst", to2(adminSstAmt));
      fd.set("AdminChargesSst", to2(invoicePreview.adminSstAmt));
      
      //asdf
      
      fd.set("StampDuty", to2(stampDuty));
      fd.set("Description", (descriptionText || "").trim());
      fd.set("DocType", "PROFORMA");
      fd.set("FromInvoiceId", "0");
      fd.set("InvoiceAdd", (billAddress || "").trim());
      fd.set("InvoiceTo", (billTo || "").trim());
      fd.set("InvoiceType", isTenant ? "Tenant" : "Landlord");
      fd.set("TenantToRen", to2(tenantToRenVal));

      const resp = await fetch(PROFORMA_INVOICE_GENERATE_URL, {
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
          `Invoice generation failed. Server response: ${raw}`;
        throw new Error(msg);
      }

      alert(
        json.data || `${isTenant ? tenantLabel : landlordLabel} invoice generated successfully.`
      );
      onSuccess?.();
    } catch (e: any) {
      console.error("Invoice generation failed:", e);
      alert(e?.message || "Failed to generate invoice.");
    }
  };

  const confirmGenerateInvoice = async () => {
    if (!invoicePreview) return;
    try {
      setGeneratingInvoice(true);
      await generateInvoiceNow(invoicePreview.party);
      handleClose();
    } finally {
      setGeneratingInvoice(false);
    }
  };

  if (!isOpen || !invoicePreview) return null;

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
            <div className="md:col-span-2 font-semibold text-gray-700">Proforma Invoice No:</div>
            <div className="md:col-span-4">
              <input
                className="w-full border rounded px-3 py-2 bg-gray-100"
                readOnly
                value={"(Auto Generate)"}
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
              />
            </div>
          </div>

          {/* ✅ NEW ROW 2: Address */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-2 font-semibold text-gray-700">Address :</div>
            <div className="md:col-span-10">
              <input
                className="w-full border rounded px-3 py-2 bg-white"
                value={billAddress}
                onChange={(e) => setBillAddress(e.target.value)}
                placeholder=""
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-2 font-semibold text-gray-700">Description :</div>

            <div className="md:col-span-10 space-y-2">
              <select
                className="w-full border rounded px-3 py-2 bg-white"
                value={selectedDescId}
                disabled={descLoading || filteredOptions.length === 0}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedDescId(id);

                  const fallback =
                    (party === "TENANT" ? tenantLabel : landlordLabel) +
                    ` Proforma Invoice for PaymentTransId ${paymentTransId}`;

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
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-2 font-semibold text-gray-700">Fees (RM):</div>
            <div className="md:col-span-3">
              <input
                className="w-full border rounded px-3 py-2 bg-gray-100 text-right"
                readOnly
                value={to2s(invoicePreview.feesGross)}
              />
            </div>

            <div className="md:col-span-2 font-semibold text-gray-700 text-center">
              +8% SST:
            </div>
            <div className="md:col-span-2">
              <input
                className="w-full border rounded px-3 py-2 bg-gray-100 text-right"
                readOnly
                value={to2s(invoicePreview.sstAmt)}
              />
            </div>

            <div className="md:col-span-1 font-semibold text-gray-700 text-center">=</div>
            <div className="md:col-span-2">
              <input
                className="w-full border rounded px-3 py-2 bg-gray-100 text-right font-semibold"
                readOnly
                value={to2s(invoicePreview.feesPlusSst)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-2 font-semibold text-gray-700">Admin Fees (RM):</div>
            <div className="md:col-span-3">
              <input
                className="w-full border rounded px-3 py-2 bg-gray-100 text-right"
                readOnly
                value={to2s(invoicePreview.adminGross)}
              />
            </div>

            <div className="md:col-span-2 font-semibold text-gray-700 text-center">
              +8% SST:
            </div>
            <div className="md:col-span-2">
              <input
                className="w-full border rounded px-3 py-2 bg-gray-100 text-right"
                readOnly
                value={to2s(invoicePreview.adminSstAmt)}
                //value={to2s(invoicePreview.adminChargesSst)}
                //asdf
              />
            </div>

            <div className="md:col-span-1 font-semibold text-gray-700 text-center">=</div>
            <div className="md:col-span-2">
              <input
                className="w-full border rounded px-3 py-2 bg-gray-100 text-right font-semibold"
                readOnly
                value={to2s(invoicePreview.adminPlusSst)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-6" />
            <div className="md:col-span-3 font-semibold text-gray-700 text-right">
              Stamp Duty (RM) =
            </div>
            <div className="md:col-span-3">
              <input
                className="w-full border rounded px-3 py-2 bg-gray-100 text-right"
                readOnly
                value={to2s(invoicePreview.stampDuty)}
              />
            </div>
          </div>

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
              disabled={generatingInvoice}
              className={`px-4 py-2 rounded text-white ${
                generatingInvoice
                  ? "bg-blue-600/60 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {generatingInvoice ? "Generating..." : "Generate Proforma Invoice.."}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantProformaInvoicePopup;