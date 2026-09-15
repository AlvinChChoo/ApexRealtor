import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCcw, FileText, ExternalLink, Search, Trash2 } from "lucide-react";

type RentalUploadedDocSessionProps = {
  application: {
    ApplicationId: string | number;
    RefNo?: string | number;
    TransType?: string | number;
    [k: string]: any;
  };
  uploadedApiUrl?: string;
  claimApiUrl?: string;
  claimUploadUrl?: string;
  claimDeleteUrl?: string;
  claimDocTypeApiUrl?: string;
  onCountChange?: (n: number) => void;
};

type UploadRow = {
  RowId: number | string;
  AttName: string;
  AddDate: string | null;
  ActualFileName: string | null;
  PaymentTransId: number | string;
  PaymentAmt: string | null;
  PaymentDate: string | null;
  ClaimParty: string | null;
};

type ClaimRow = {
  RefNo?: string | number;
  DocType?: string | null;
  DocName?: string | null;
  AttName?: string | null;
  AddDate?: string | null;
  Attached?: string | null;
  ClaimDocId?: string | number | null;
  RowId?: string | number | null;
  IntDocUploadId?: string | number | null;
  UploadId?: string | number | null;
  [k: string]: any;
};

type UploadsApiResponse =
  | { status: "success"; data: UploadRow[] }
  | { status: "no_data_found"; data?: []; error?: any }
  | { status: "failed"; error: any };

type ClaimsApiResponse =
  | { status: "success"; data: ClaimRow[] }
  | { status: "no_data_found"; data?: []; error?: any }
  | { status: "failed"; error: any };

type ClaimDocTypeRow = {
  ClaimDocId?: any;
  ClaimDocName?: any;
  ClaimDocCode?: any;
};

type ClaimDocTypeApiResponse =
  | {
      status: "success";
      data: ClaimDocTypeRow[];
    }
  | {
      status: "no_data_found";
      error?: any;
    }
  | {
      status: "fail";
      error?: any;
    };

const currency = (val?: string | number | null) => {
  if (val === null || val === undefined || val === "") return "RM 0.00";

  const num =
    typeof val === "string" ? parseFloat(val.replace(/,/g, "")) : Number(val);

  return Number.isFinite(num)
    ? `RM ${num.toLocaleString("en-MY", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : `RM ${String(val)}`;
};

const displayName = (row: UploadRow) => {
  if (row.ActualFileName && row.ActualFileName.trim() !== "") {
    return row.ActualFileName;
  }

  try {
    const url = new URL(row.AttName);
    const last = url.pathname.split("/").filter(Boolean).pop();
    return last || "Open File";
  } catch {
    const parts = (row.AttName || "").split(/[\\/]/);
    return parts.pop() || "Open File";
  }
};

const getClaimDeleteId = (row: ClaimRow): string => {
  return String(
    row.IntDocUploadId ??
      row.UploadId ??
      row.RowId ??
      row.ClaimDocId ??
      ""
  ).trim();
};

/* =========================
   Tenant / Landlord file list
========================= */
const FILE_GRID_DESKTOP =
  "hidden md:grid md:grid-cols-[40px_minmax(0,1fr)_120px_120px_90px] items-center gap-3";

const FILE_MOBILE_CARD = "md:hidden flex items-start gap-3 py-3";

const FileList: React.FC<{
  title: string;
  items: UploadRow[];
  emptyHint?: string;
}> = ({ title, items, emptyHint = "No files" }) => (
  <div className="bg-white rounded-xl shadow-lg p-4 overflow-hidden">
    <div className="flex items-center justify-between mb-3 gap-3">
      <h3 className="text-base font-semibold text-gray-800">{title}</h3>
      <div className="text-xs text-gray-500 whitespace-nowrap">
        {items.length} file(s)
      </div>
    </div>

    <div
      className={`${FILE_GRID_DESKTOP} py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200`}
    >
      <div aria-hidden />
      <div className="min-w-0">File Name</div>
      <div className="whitespace-nowrap">Date</div>
      <div className="whitespace-nowrap text-right">Amount</div>
      <div aria-hidden />
    </div>

    <div className="divide-y divide-gray-200">
      {items.length === 0 && (
        <div className="py-6 text-sm text-gray-500 text-center">{emptyHint}</div>
      )}

      {items.map((u) => (
        <div key={String(u.RowId)}>
          <div className={`${FILE_GRID_DESKTOP} py-3 text-sm`}>
            <div className="w-10 h-10 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <FileText size={16} />
            </div>

            <div className="min-w-0">
              <div className="font-medium text-gray-900 truncate">
                {displayName(u)}
              </div>
            </div>

            <div className="text-gray-600 whitespace-nowrap">
              {u.PaymentDate ? u.PaymentDate : "-"}
            </div>

            <div className="font-semibold text-gray-900 whitespace-nowrap text-right">
              {currency(u.PaymentAmt)}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() =>
                  u.AttName &&
                  window.open(u.AttName, "_blank", "noopener,noreferrer")
                }
                className="inline-flex items-center gap-1 px-2 py-1 rounded border text-blue-600 border-blue-200 hover:bg-blue-50 transition-colors shrink-0"
                title="View"
              >
                <ExternalLink size={14} />
                <span>View</span>
              </button>
            </div>
          </div>

          <div className={FILE_MOBILE_CARD}>
            <div className="w-10 h-10 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <FileText size={16} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="font-medium text-gray-900 break-words">
                {displayName(u)}
              </div>

              <div className="mt-1 text-xs text-gray-500">
                Date: {u.PaymentDate ? u.PaymentDate : "-"}
              </div>

              <div className="mt-1 text-sm font-semibold text-gray-900">
                {currency(u.PaymentAmt)}
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() =>
                    u.AttName &&
                    window.open(u.AttName, "_blank", "noopener,noreferrer")
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded border text-blue-600 border-blue-200 hover:bg-blue-50 transition-colors"
                  title="View"
                >
                  <ExternalLink size={14} />
                  <span>View</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* =========================
   Internal uploads list
========================= */
const CLAIM_GRID_DESKTOP =
  "hidden md:grid md:grid-cols-[40px_minmax(0,1fr)_110px_minmax(0,160px)_160px] items-center gap-3";

const CLAIM_MOBILE_CARD = "md:hidden flex items-start gap-3 py-3";

type ClaimListProps = {
  title: string;
  items: ClaimRow[];
  emptyHint?: string;
  onDeleteClick: (row: ClaimRow) => void;
  deletingId?: string;
};

const ClaimList: React.FC<ClaimListProps> = ({
  title,
  items,
  emptyHint = "No items",
  onDeleteClick,
  deletingId = "",
}) => (
  <div className="bg-white rounded-xl shadow-lg p-4 overflow-hidden">
    <div className="flex items-center justify-between mb-3 gap-3">
      <h3 className="text-base font-semibold text-gray-800">{title}</h3>
      <div className="text-xs text-gray-500 whitespace-nowrap">
        {items.length} item(s)
      </div>
    </div>

    <div
      className={`${CLAIM_GRID_DESKTOP} py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200`}
    >
      <div aria-hidden />
      <div className="min-w-0">File</div>
      <div className="whitespace-nowrap">Date</div>
      <div className="min-w-0">Type</div>
      <div aria-hidden />
    </div>

    <div className="divide-y divide-gray-200">
      {items.length === 0 && (
        <div className="py-6 text-sm text-gray-500 text-center">{emptyHint}</div>
      )}

      {items.map((c, idx) => {
        const deleteId = getClaimDeleteId(c);
        const isDeleting = deletingId !== "" && deletingId === deleteId;

        return (
          <div
            key={`${
              c.IntDocUploadId ??
              c.UploadId ??
              c.RowId ??
              c.ClaimDocId ??
              c.AttName ??
              idx
            }`}
          >
            <div className={`${CLAIM_GRID_DESKTOP} py-3 text-sm`}>
              <div className="w-10 h-10 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <FileText size={16} />
              </div>

              <div className="min-w-0">
                <div className="font-medium text-gray-900 break-words line-clamp-2">
                  {c.DocName || "-"}
                </div>
              </div>

              <div className="text-gray-600 whitespace-nowrap">
                {c.AddDate ? c.AddDate : "-"}
              </div>

              <div className="min-w-0 text-gray-600 break-words line-clamp-2">
                {c.DocType || "-"}
              </div>

              <div className="flex justify-end gap-2 flex-wrap">
                {c.AttName && (
                  <button
                    type="button"
                    onClick={() =>
                      window.open(c.AttName!, "_blank", "noopener,noreferrer")
                    }
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border text-indigo-600 border-indigo-200 hover:bg-indigo-50 transition-colors shrink-0"
                    title="View"
                  >
                    <ExternalLink size={14} />
                    <span>View</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onDeleteClick(c)}
                  disabled={isDeleting}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded border transition-colors shrink-0 ${
                    isDeleting
                      ? "text-red-300 border-red-100 cursor-not-allowed"
                      : "text-red-600 border-red-200 hover:bg-red-50"
                  }`}
                  title="Delete"
                >
                  <Trash2 size={14} />
                  <span>{isDeleting ? "Deleting..." : "Delete"}</span>
                </button>
              </div>
            </div>

            <div className={CLAIM_MOBILE_CARD}>
              <div className="w-10 h-10 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <FileText size={16} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 break-words">
                  {c.DocName || "-"}
                </div>

                <div className="mt-1 text-xs text-gray-500">
                  {c.AddDate ? c.AddDate : "-"}
                </div>

                <div className="mt-1 text-sm text-gray-600 break-words">
                  {c.DocType || "-"}
                </div>

                <div className="mt-3 flex gap-2 flex-wrap">
                  {c.AttName && (
                    <button
                      type="button"
                      onClick={() =>
                        window.open(c.AttName!, "_blank", "noopener,noreferrer")
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded border text-indigo-600 border-indigo-200 hover:bg-indigo-50 transition-colors"
                      title="View"
                    >
                      <ExternalLink size={14} />
                      <span>View</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onDeleteClick(c)}
                    disabled={isDeleting}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded border transition-colors ${
                      isDeleting
                        ? "text-red-300 border-red-100 cursor-not-allowed"
                        : "text-red-600 border-red-200 hover:bg-red-50"
                    }`}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                    <span>{isDeleting ? "Deleting..." : "Delete"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const RentalUploadedDocSession: React.FC<RentalUploadedDocSessionProps> = ({
  application,
  uploadedApiUrl = API_ENDPOINTS.UPLOADED_FILE_GET,
  claimApiUrl = API_ENDPOINTS.INT_DOC_UPLOAD_GET,
  claimUploadUrl = API_ENDPOINTS.INT_DOC_UPLOAD_SET,
  claimDeleteUrl = API_ENDPOINTS.INT_DOC_UPLOAD_DELETE,
  claimDocTypeApiUrl = API_ENDPOINTS.CLAIM_DOC_TYPE,
  onCountChange,
}) => {
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorUploads, setErrorUploads] = useState<string | null>(null);
  const [errorClaims, setErrorClaims] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [docTypesRaw, setDocTypesRaw] = useState<ClaimDocTypeRow[]>([]);
  const [docTypeError, setDocTypeError] = useState<string | null>(null);

  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [pickedFileName, setPickedFileName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<ClaimDocTypeRow | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ClaimRow | null>(null);
  const [deletingId, setDeletingId] = useState<string>("");

  const refresh = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    const controller = new AbortController();

    const loadDocTypes = async () => {
      try {
        setDocTypeError(null);

        const form = new URLSearchParams();
        const transType = String(application?.TransType ?? "")
          .trim()
          .toLowerCase();

        const docType =
          transType === "rental" || transType === "rms"
            ? "Rental / RMS"
            : transType === "sales" || transType === "project"
            ? "Sale & Purchase / Project"
            : "Rental / RMS";

        form.set("DocType", docType); 

        const resp = await fetch(claimDocTypeApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: form.toString(),
          signal: controller.signal,
        });

        if (!resp.ok) throw new Error(`Doc types HTTP ${resp.status}`);

        const json: ClaimDocTypeApiResponse = await resp.json();

        if (json.status === "success" && Array.isArray(json.data)) {
          setDocTypesRaw(json.data);
        } else if (json.status === "no_data_found") {
          setDocTypesRaw([]);
          setDocTypeError("No doc types found.");
        } else {
          throw new Error((json as any).error || "Failed to load doc types");
        }
      } catch (e: any) {
        if (String(e?.name) !== "AbortError") {
          setDocTypesRaw([]);
          setDocTypeError(e?.message || "Failed to load doc types");
        }
      }
    };

    loadDocTypes();
    return () => controller.abort();
  }, [claimDocTypeApiUrl, application?.TransType]);

  useEffect(() => {
    if (!application?.ApplicationId) return;

    const controller = new AbortController();
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const isAbort = (e: any) =>
      e?.name === "AbortError" ||
      String(e?.message || "").toLowerCase().includes("aborted");

    const fetchUploads = async () => {
      try {
        const form = new URLSearchParams();
        form.set("ApplicationId", String(application.ApplicationId));
        form.set("_t", stamp);

        const url = `${uploadedApiUrl}${uploadedApiUrl.includes("?") ? "&" : "?"}t=${stamp}`;
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: form.toString(),
          signal: controller.signal,
        });

        if (!resp.ok) throw new Error(`Uploads HTTP ${resp.status}`);

        const json: UploadsApiResponse = await resp.json();

        if (json.status === "success") {
          setUploads(json.data || []);
        } else if (json.status === "no_data_found") {
          setUploads([]);
        } else {
          throw new Error((json as any).error || "Failed to load uploads");
        }
      } catch (e: any) {
        if (!isAbort(e)) {
          setErrorUploads(e?.message ?? "Failed to load uploads");
          setUploads([]);
        }
      }
    };

    const fetchClaims = async () => {
      try {
        const refNo = application.RefNo ?? application.refNo ?? "";

        if (!refNo) {
          setErrorClaims("Missing RefNo for internal doc uploads.");
          setClaims([]);
          onCountChange?.(0);
          return;
        }

        const form = new URLSearchParams();
        form.set("RefNo", String(refNo));
        form.set("_t", stamp);

        const urlPost = `${claimApiUrl}${claimApiUrl.includes("?") ? "&" : "?"}t=${stamp}`;
        const resp = await fetch(urlPost, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: form.toString(),
          signal: controller.signal,
        });

        if (!resp.ok) throw new Error(`Internal uploads HTTP ${resp.status}`);

        const json: ClaimsApiResponse = await resp.json();

        if (json.status === "success") {
          const rows = (json.data || []).map((r) => ({
            ...r,
            ClaimDocId: r.ClaimDocId ?? null,
            Attached: r.AttName ? "Y" : "N",
          }));

          setClaims(rows);
          onCountChange?.(rows.length);
        } else if (json.status === "no_data_found") {
          setClaims([]);
          onCountChange?.(0);
        } else {
          throw new Error((json as any).error || "Failed to load internal uploads");
        }
      } catch (e: any) {
        if (!isAbort(e)) {
          setErrorClaims(e?.message ?? "Failed to load internal uploads");
          setClaims([]);
          onCountChange?.(0);
        }
      }
    };

    const run = async () => {
      setLoading(true);
      setErrorUploads(null);
      setErrorClaims(null);
      await Promise.all([fetchUploads(), fetchClaims()]);
      setLoading(false);
    };

    run();
    return () => controller.abort();
  }, [
    application?.ApplicationId,
    application?.RefNo,
    uploadedApiUrl,
    claimApiUrl,
    reloadKey,
    onCountChange,
  ]);

  const { tenantFiles, landlordFiles } = useMemo(() => {
    const toKey = (v: any) => String(v ?? "").trim().toLowerCase();

    return {
      tenantFiles: uploads.filter((r) => toKey(r.ClaimParty) === "tenant"),
      landlordFiles: uploads.filter((r) => toKey(r.ClaimParty) === "landlord"),
    };
  }, [uploads]);

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const onFilePicked: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files && e.target.files[0];
    setPickedFile(f || null);
    setPickedFileName(f ? f.name : "");
  };

  const handleUpload = async () => {
    const refNo = application.RefNo ?? application.refNo ?? "";
    const transType = String(application?.TransType ?? "").trim().toLowerCase();

    if (!refNo) {
      alert("Missing RefNo. Unable to upload.");
      return;
    }

    if (!selectedDocType?.ClaimDocCode) {
      alert("Please select a Document Type.");
      return;
    }

    if (!pickedFile) {
      alert("Please choose a file.");
      return;
    }

    if (!claimUploadUrl) {
      alert("Missing claimUploadUrl prop. Set the endpoint to IntDocUploadSet.php.");
      return;
    }

    try {
      setUploading(true);

      const resolvedDocType =
        transType === "rental" || transType === "rms"
          ? "Rental / RMS"
          : transType === "sales" || transType === "project"
          ? "Sale & Purchase / Project"
          : "Rental / RMS";

      const fd = new FormData();
      fd.append("RefNo", String(refNo));
      fd.append("DocType", String(selectedDocType?.ClaimDocCode ?? ""));      
      fd.append("ClaimDocCode", String(selectedDocType?.ClaimDocCode ?? ""));
      
      fd.append("count", "1");
      fd.append("imgFile", pickedFile, pickedFile.name);

      const resp = await fetch(claimUploadUrl, {
        method: "POST",
        body: fd,
      });

      const text = await resp.text();

      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      if (!resp.ok || (json && json.status && json.status !== "success")) {
        const errorMsg =
          json?.error ||
          json?.message ||
          json?.data ||
          text ||
          `Upload failed (${resp.status})`;

        throw new Error(errorMsg);
      }

      setPickedFile(null);
      setPickedFileName("");
      setSelectedDocType(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      refresh();
      alert(json?.message || json?.data || "File uploaded successfully ✅");
    } catch (e: any) {
      alert(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const openDeleteConfirm = (row: ClaimRow) => {
    setDeleteTarget(row);
  };

  const closeDeleteConfirm = () => {
    if (deletingId) return;
    setDeleteTarget(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    const claimDocId = String(deleteTarget?.ClaimDocId ?? "").trim();
    const docName = String(deleteTarget?.DocName ?? "").trim();
    const refNo = String(application?.RefNo ?? application?.refNo ?? "").trim();

    if (!claimDocId) {
      alert("ClaimDocId not found.");
      return;
    }

    if (!docName) {
      alert("DocName not found.");
      return;
    }

    if (!refNo) {
      alert("RefNo not found.");
      return;
    }

    try {
      setDeletingId(claimDocId);

      const form = new URLSearchParams();
      form.set("ClaimDocId", claimDocId);
      form.set("DocName", docName);
      form.set("RefNo", refNo);

      const resp = await fetch(claimDeleteUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: form.toString(),
      });

      const text = await resp.text();

      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      if (!resp.ok || !json || json.status !== "success") {
        throw new Error(
          json?.message ||
            json?.error ||
            text ||
            `Delete failed (${resp.status})`
        );
      }

      setDeleteTarget(null);
      refresh();
      alert(json.message || "Attachment deleted successfully.");
    } catch (e: any) {
      alert(e?.message || "Failed to delete attachment.");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900">Uploaded Documents</h2>

        <button
          onClick={refresh}
          disabled={loading}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded border transition-colors shrink-0 ${
            loading
              ? "text-gray-400 border-gray-200 cursor-not-allowed"
              : "text-gray-700 border-gray-300 hover:bg-gray-50"
          }`}
          title="Refresh"
          type="button"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-4 overflow-hidden">
        <h3 className="text-base font-semibold text-gray-800 mb-3">
          Internal Uploads — Add New
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document Type
            </label>

            <select
              className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={selectedDocType?.ClaimDocCode ? String(selectedDocType?.ClaimDocCode) : ""}
              onChange={(e) => {
                const picked = docTypesRaw.find(
                  (row) => String(row.ClaimDocCode ?? "") === e.target.value
                );
                setSelectedDocType(picked || null);
              }}
              disabled={loading || uploading}
            >
              <option value="">-- Select --</option>
              {docTypesRaw.map((row, i) => (
                <option key={i} value={String(row.ClaimDocCode ?? "")}>
                  {row.ClaimDocName}
                </option>
              ))}
            </select>

            {docTypeError && (
              <div className="mt-1 text-xs text-red-600">{docTypeError}</div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              File Name
            </label>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={pickedFileName}
                placeholder="No file chosen"
                readOnly
                className="flex-1 min-w-0 rounded-lg border border-gray-300 p-2 text-sm bg-gray-50"
              />

              <button
                type="button"
                onClick={handleChooseFile}
                disabled={loading || uploading}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 shrink-0"
                title="Choose file"
              >
                <Search size={16} />
                Choose
              </button>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".png,.jpg,.jpeg,.gif,.pdf,.webp"
                onChange={onFilePicked}
              />
            </div>
          </div>

          <div className="flex md:items-end">
            <button
              type="button"
              onClick={handleUpload}
              disabled={loading || uploading || !selectedDocType?.ClaimDocCode || !pickedFile}
              className={`w-full md:w-auto px-4 py-2 rounded-lg text-white transition-colors ${
                loading || uploading || !selectedDocType?.ClaimDocCode || !pickedFile
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="py-10 text-center text-gray-600">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
          Loading documents...
        </div>
      )}

      {!loading && (errorUploads || errorClaims) && (
        <div className="space-y-2">
          {errorUploads && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">
              Uploads error: {errorUploads}
            </div>
          )}

          {errorClaims && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded">
              Internal uploads error: {errorClaims}
            </div>
          )}
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 gap-6">
          <ClaimList
            title="Internal Uploads"
            items={claims}
            emptyHint="No internal files"
            onDeleteClick={openDeleteConfirm}
            deletingId={deletingId}
          />

          <FileList
            title="From Tenant"
            items={tenantFiles}
            emptyHint="No tenant files"
          />

          <FileList
            title="From Landlord"
            items={landlordFiles}
            emptyHint="No landlord files"
          />
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="px-6 pt-6 pb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Delete Attachment
              </h3>
            </div>

            <div className="px-6 pb-4 text-sm text-gray-700 whitespace-pre-line">
              {"You will not be able to restore deleted attachment.\nAre you sure you want to delete ?"}
            </div>

            <div className="px-6 pb-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                disabled={!!deletingId}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={!!deletingId}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId ? "Deleting..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RentalUploadedDocSession;