import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, PenLine } from "lucide-react";
import { RentalApplication } from "../../types";
import { printInvoicePdf } from "../../utils/pdfGenerators/invoicePdf";
import { printReceiptPdf } from "../../utils/pdfGenerators/receiptPdf";
import { printInvoice1Pdf } from "../../utils/pdfGenerators/Invoice1Pdf";
import BuyerProformaInvoiceEditPopup from "./BuyerProformaInvoiceEditPopup";

import { currency } from "../../utils/paymentUtils";
import {
  INT_INVOICE_GET_URL,
  INT_INVOICE_DET_GET_URL,
} from "../../constants/paymentApiUrls";
import type {
  IntInvoiceBundle,
  IntInvoiceHeader,
  IntInvoiceDetRow,
  ApiResponseFlat,
} from "../../types/payment";

interface InvoiceListProps {
  paymentTransId: string;
  applicationId: string;
  application?: RentalApplication;
  refreshSeq: number;
  onInvoiceGenerated?: () => void;
}

const INVOICE_VOID_SET_URL =
  API_ENDPOINTS.INVOICE_VOID_SET;

const GENERATE_INVOICE_URL =
  API_ENDPOINTS.GENERATE_INVOICE;

const GENERATE_RECEIPT_URL =
  API_ENDPOINTS.GENERATE_RECEIPT;

const InvoiceList: React.FC<InvoiceListProps> = ({
  paymentTransId,
  applicationId,
  application,
  refreshSeq,
  onInvoiceGenerated,
}) => {
  const [intInvoices, setIntInvoices] = useState<IntInvoiceBundle[]>([]);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const [isInvoiceOpen, setIsInvoiceOpen] = useState(true);

  const isAccountUser =
    String(localStorage.getItem("account") || "").trim().toUpperCase() === "Y";

  const [editOpen, setEditOpen] = useState(false);
  const [editBundle, setEditBundle] = useState<IntInvoiceBundle | null>(null);

  const [localRefreshSeq, setLocalRefreshSeq] = useState(0);

  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [voidTargetBundle, setVoidTargetBundle] =
    useState<IntInvoiceBundle | null>(null);

  const openEdit = (bundle: IntInvoiceBundle) => {
    setEditBundle(bundle);
    setEditOpen(true);
  };

  const openVoidConfirm = (bundle: IntInvoiceBundle) => {
    setVoidTargetBundle(bundle);
    setVoidConfirmOpen(true);
  };

  const closeVoidConfirm = () => {
    if (voiding) return;
    setVoidConfirmOpen(false);
    setVoidTargetBundle(null);
  };

  useEffect(() => {
    let cancelled = false;

    const loadInvoice = async () => {
      setLoadingInvoice(true);
      setInvoiceError(null);
      setIntInvoices([]);

      try {
        const headerBody = new URLSearchParams();
        headerBody.set("PaymentTransId", String(paymentTransId || ""));
        headerBody.set("ApplicationId", String(applicationId || ""));

        const headerResp = await fetch(INT_INVOICE_GET_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: headerBody.toString(),
        });

        if (!headerResp.ok) {
          throw new Error(`Invoice HTTP ${headerResp.status}`);
        }

        const headerJson: ApiResponseFlat = await headerResp.json();

        if (
          headerJson.status !== "success" ||
          !Array.isArray(headerJson.data) ||
          headerJson.data.length === 0
        ) {
          if (!cancelled) setIntInvoices([]);
          return;
        }

        const rows = headerJson.data as IntInvoiceHeader[];

        const bundles: IntInvoiceBundle[] = await Promise.all(
          rows.map(async (headerRowAny) => {
            const headerRow = headerRowAny as IntInvoiceHeader;

            const invoiceIdRaw =
              headerRow.InvoiceId ??
              (headerRow as any).InvoiceID ??
              (headerRow as any).invoiceId ??
              "";

            let details: IntInvoiceDetRow[] = [];

            if (invoiceIdRaw) {
              try {
                const detBody = new URLSearchParams();
                detBody.set("InvoiceId", String(invoiceIdRaw));

                const detResp = await fetch(INT_INVOICE_DET_GET_URL, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                  },
                  body: detBody.toString(),
                });

                if (detResp.ok) {
                  const detJson: ApiResponseFlat = await detResp.json();

                  if (
                    detJson.status === "success" &&
                    Array.isArray(detJson.data) &&
                    detJson.data.length > 0
                  ) {
                    details = detJson.data.map((r: any) => ({
                      InvoiceDetId: String(r?.InvoiceDetId ?? ""),
                      InvoiceId: String(r?.InvoiceId ?? invoiceIdRaw),
                      ItemDesc: r?.ItemDesc,
                      ItemGross: r?.ItemGross,
                      ItemSst: r?.ItemSst,
                      ItemNet: r?.ItemNet,
                      ...r,
                    }));
                  }
                }
              } catch {
                // keep details empty
              }
            }

            return { header: headerRow, details, application };
          })
        );

        if (!cancelled) {
          setIntInvoices(bundles);
        }
      } catch (e: any) {
        if (!cancelled) {
          setInvoiceError(e?.message || "Failed to load invoice.");
          setIntInvoices([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingInvoice(false);
        }
      }
    };

    loadInvoice();

    return () => {
      cancelled = true;
    };
  }, [paymentTransId, applicationId, refreshSeq, localRefreshSeq, application]);

  const handleGenerateInvoice1 = async (bundle: IntInvoiceBundle) => {
    const inv = bundle.header;

    const invoiceId =
      inv.InvoiceId ?? (inv as any).InvoiceID ?? (inv as any).invoiceId ?? "";

    if (!invoiceId) {
      alert("Missing InvoiceId. Cannot generate invoice.");
      return;
    }

    try {
      const body = new URLSearchParams();
      body.set("InvoiceId", String(invoiceId));

      const resp = await fetch(GENERATE_INVOICE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      const raw = await resp.text();
      let json: any = null;

      try {
        json = JSON.parse(raw);
      } catch {
        // invalid JSON
      }

      if (!resp.ok || !json) {
        throw new Error("Generate Invoice failed: " + (raw || "Server error"));
      }

      if (json.status !== "success") {
        const msg =
          json.error || json.message || "Failed to generate invoice number.";
        alert("Generate Invoice failed: " + msg);
        return;
      }

      const newNo = String(json.InvoiceNo1 || "").trim();
      if (newNo) {
        alert("Invoice generated successfully: " + newNo);
      } else {
        alert("Invoice generated successfully.");
      }

      await printInvoice1Pdf(bundle);

      onInvoiceGenerated?.();
      setLocalRefreshSeq((x) => x + 1);
    } catch (err: any) {
      console.error("GenerateInvoice1 error:", err);
      alert(err?.message || "Generate Invoice failed.");
    }
  };

  const handleGenerateReceipt = async (bundle: IntInvoiceBundle) => {
    const inv = bundle.header;

    const invoiceId =
      inv.InvoiceId ?? (inv as any).InvoiceID ?? (inv as any).invoiceId ?? "";

    if (!invoiceId) {
      alert("Missing InvoiceId. Cannot generate receipt.");
      return;
    }

    try {
      const body = new URLSearchParams();
      body.set("InvoiceId", String(invoiceId));

      const resp = await fetch(GENERATE_RECEIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      const raw = await resp.text();
      let json: any = null;

      try {
        json = JSON.parse(raw);
      } catch {
        // invalid JSON
      }

      if (!resp.ok || !json) {
        throw new Error("Generate Receipt failed: " + (raw || "Server error"));
      }

      if (json.status !== "success") {
        const msg =
          json.error || json.message || "Failed to generate receipt number.";
        alert("Generate Receipt failed: " + msg);
        return;
      }

      const newNo = String(json.ReceiptNo || "").trim();
      if (newNo) {
        alert("Receipt generated successfully: " + newNo);
      } else {
        alert("Receipt generated successfully.");
      }

      onInvoiceGenerated?.();
      setLocalRefreshSeq((x) => x + 1);
    } catch (err: any) {
      console.error("GenerateReceipt error:", err);
      alert(err?.message || "Generate Receipt failed.");
    }
  };

  const handleVoidInvoice = async () => {
    if (!voidTargetBundle) return;

    const inv = voidTargetBundle.header;
    const invoiceId =
      inv.InvoiceId ?? (inv as any).InvoiceID ?? (inv as any).invoiceId ?? "";

    if (!invoiceId) {
      alert("Missing InvoiceId. Cannot void invoice.");
      return;
    }

    try {
      setVoiding(true);

      const body = new URLSearchParams();
      body.set("InvoiceId", String(invoiceId));

      const resp = await fetch(INVOICE_VOID_SET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      const raw = await resp.text();
      let json: any = null;

      try {
        json = JSON.parse(raw);
      } catch {
        // invalid JSON
      }

      if (!resp.ok || !json) {
        throw new Error("Void Invoice failed: " + (raw || "Server error"));
      }

      if (json.status !== "success") {
        const msg = json.message || json.error || "Failed to void invoice.";
        alert("Void Invoice failed: " + msg);
        return;
      }

      alert(json.message || "Invoice has been voided successfully.");

      setVoidConfirmOpen(false);
      setVoidTargetBundle(null);

      onInvoiceGenerated?.();
      setLocalRefreshSeq((x) => x + 1);
    } catch (err: any) {
      console.error("handleVoidInvoice error:", err);
      alert(err?.message || "Void Invoice failed.");
    } finally {
      setVoiding(false);
    }
  };

  return (
    <div className="mt-4">
      <div className="border rounded-lg shadow-sm">
        <button
          type="button"
          onClick={() => setIsInvoiceOpen((v) => !v)}
          className="w-full bg-gray-100 px-4 py-2 font-semibold text-gray-700 rounded-t-lg flex items-center justify-between"
        >
          <span>Proforma Invoice / Invoice / Receipt</span>
          {isInvoiceOpen ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>

        {isInvoiceOpen && (
          <div className="p-4 text-sm space-y-3">
            {loadingInvoice && (
              <div className="text-gray-500">Loading invoice information…</div>
            )}

            {invoiceError && !loadingInvoice && (
              <div className="text-red-600">{invoiceError}</div>
            )}

            {!loadingInvoice && !invoiceError && intInvoices.length === 0 && (
              <div className="text-gray-500">No invoice found.</div>
            )}

            {intInvoices.length > 0 && (
              <div className="space-y-4">
                {intInvoices.map((bundle, idx) => {
                  const inv = bundle.header;
                  const details = bundle.details;

                  const invoiceId =
                    inv.InvoiceId ?? (inv as any).InvoiceID ?? "—";
                  const proformaNo = (inv as any).InvoiceNo ?? "—";

                  const invoiceDate =
                    inv.InvoiceDate ?? (inv as any).Invoice_Date ?? "—";

                  const invoiceNo1 = String((inv as any).InvoiceNo1 ?? "").trim();
                  const receiptNo = String((inv as any).ReceiptNo ?? "").trim();
                  const transStatus = String((inv as any).TransStatus ?? "").trim();
                  const invoiceType = String((inv as any).InvoiceType ?? "").trim();
                
                  const isVoid = transStatus.toUpperCase() === "VOID";

                  const canVoidInvoice =
                    isAccountUser && invoiceNo1 !== "" && !isVoid;

                  return (
                    <div
                      key={`${invoiceId}-${idx}`}
                      className="border rounded-lg shadow-sm"
                    >
                      <div className="px-3 py-2 bg-gray-50 border-b rounded-t-lg flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              Proforma Invoice No:
                            </span>
                            <span>
                              {proformaNo}
                              {invoiceType ? ` (${invoiceType})` : ""}
                            </span>

                            {isAccountUser && !isVoid && (
                              <button
                                type="button"
                                onClick={() => openEdit(bundle)}
                                className="ml-1 inline-flex items-center justify-center rounded p-1 hover:bg-gray-200"
                                title="Edit Proforma Invoice"
                                aria-label="Edit Proforma Invoice"
                              >
                                <PenLine className="w-4 h-4 text-gray-700" />
                              </button>
                            )}
                          </div>



                          {invoiceNo1 && (
  <div className="text-xs text-gray-600 mt-1">
    <span className="font-semibold">Invoice No :</span>{" "}
    {invoiceNo1}
  </div>
)}

                          {/*
                          {invoiceNo1 && (
                            <div className="text-xs text-gray-600 mt-1">
                              <span className="font-semibold">Invoice No :</span>{" "}
                              {invoiceNo1} {invoiceType ? ` (${invoiceType})` : ""}
                            </div>
                          )}
                          */}
                          

                          {receiptNo && (
                            <div className="text-xs text-gray-600 mt-0.5">
                              <span className="font-semibold">Receipt No:</span>{" "}
                              {receiptNo}
                            </div>
                          )}

                          {transStatus && (
                            <div className="text-xs text-gray-600 mt-0.5">
                              <span className="font-semibold">Status:</span>{" "}
                              {transStatus}
                            </div>
                          )}
                        </div>

                        <div className="text-xs text-gray-500">
                          Date: {invoiceDate}
                        </div>
                      </div>

                      <div className="p-3 space-y-3">
                        {!isVoid && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => printInvoicePdf(bundle)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
                            >
                              Print Proforma Invoice
                            </button>

                            {invoiceNo1 === "" ? (
                              isAccountUser ? (
                                <button
                                  type="button"
                                  onClick={() => handleGenerateInvoice1(bundle)}
                                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                                >
                                  Generate Invoice
                                </button>
                              ) : null
                            ) : (
                              <button
                                type="button"
                                onClick={() => printInvoice1Pdf(bundle)}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
                              >
                                Print Invoice..
                              </button>
                            )}

                            {receiptNo === "" ? (
                              isAccountUser ? (
                                <button
                                  type="button"
                                  onClick={() => handleGenerateReceipt(bundle)}
                                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                                >
                                  Generate Receipt
                                </button>
                              ) : null
                            ) : (
                              <button
                                type="button"
                                onClick={() => printReceiptPdf(bundle)}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
                              >
                                Print Receipt
                              </button>
                            )}

                            {canVoidInvoice && (
                              <button
                                type="button"
                                onClick={() => openVoidConfirm(bundle)}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 text-sm"
                              >
                                Void Invoice
                              </button>
                            )}
                          </div>
                        )}

                        {details.length > 0 && (
                          <div className="mt-3">
                            <div className="font-semibold mb-1">
                              Invoice Items
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full border text-xs md:text-sm">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="p-2 border text-left">
                                      Description
                                    </th>
                                    <th className="p-2 border text-right">
                                      Gross
                                    </th>
                                    <th className="p-2 border text-right">
                                      SST
                                    </th>
                                    <th className="p-2 border text-right">
                                      Net
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {details.map((row) => (
                                    <tr key={row.InvoiceDetId}>
                                      <td className="p-2 border break-all">
                                        {row.ItemDesc ?? "—"}
                                      </td>
                                      <td className="p-2 border text-right">
                                        {currency(row.ItemGross)}
                                      </td>
                                      <td className="p-2 border text-right">
                                        {currency(row.ItemSst)}
                                      </td>
                                      <td className="p-2 border text-right">
                                        {currency(row.ItemNet)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <BuyerProformaInvoiceEditPopup
        open={editOpen}
        bundle={editBundle}
        isAccountUser={isAccountUser}
        onClose={() => {
          setEditOpen(false);
          setEditBundle(null);
        }}
        onSaved={() => {
          setEditOpen(false);
          setEditBundle(null);
          setLocalRefreshSeq((x) => x + 1);
          onInvoiceGenerated?.();
        }}
      />

      {voidConfirmOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border">
            <div className="px-5 py-4 border-b">
              <h2 className="text-base font-semibold text-gray-800">
                Confirm Void Invoice
              </h2>
            </div>

            <div className="px-5 py-4 text-sm text-gray-700">
              Are you sure to void this invoice ?
            </div>

            <div className="px-5 py-4 border-t flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeVoidConfirm}
                disabled={voiding}
                className="px-4 py-2 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleVoidInvoice}
                disabled={voiding}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                {voiding ? "Voiding..." : "Yes, void this invoice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceList;