import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useEffect, useMemo, useState } from "react";
import { X, Eye, Download, Calendar, FileText } from "lucide-react";

interface ApiRow {
  ApplicationId: string;
  DocMLogId: string;
  DocMUid: string;
  AddDate: string;
  AddBy: string | null;
  RefNo: string | null;
  RefNo1: string | null;
  DocContent1: string | null;
  DocContent2: string | null;
  DocContent3: string | null;
  DocContent4: string | null;
  DocContent5: string | null;
  T1Sign: string | null;
  T2Sign: string | null;
  T3Sign: string | null;
  T4Sign: string | null;
  L1Sign: string | null;
  L2Sign: string | null;
  L3Sign: string | null;
  L4Sign: string | null;
  AttName: string | null;

  L1Name: string | null;
  L2Name: string | null;
  L3Name: string | null;
  L4Name: string | null;
  T1Name: string | null;
  T2Name: string | null;
  T3Name: string | null;
  T4Name: string | null;
}

interface ApiResponse {
  status: "success" | "no_data_found" | "failed";
  data?: ApiRow[];
  error?: any;
}

interface FormHistorySessionProps {
  isOpen: boolean;
  onClose: () => void;
  onESigning: (item: ApiRow) => void;
  docMUid: string;
  docDesc: string;
  applicationId: string | number;
  docMLogId?: string | number;
  apiUrl?: string;
}

interface SignerOption {
  label: string;
  value: string;
  type: string;
}

const FormHistorySession: React.FC<FormHistorySessionProps> = ({
  isOpen,
  onClose,
  onESigning,
  docMUid,
  docDesc,
  applicationId,
  docMLogId,
  apiUrl = API_ENDPOINTS.INT_DOC_M_LOG_GET,
}) => {
  const [rows, setRows] = useState<ApiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSigners, setSelectedSigners] = useState<Record<string, string>>({});

  const totalVersions = useMemo(() => rows.length, [rows]);

  useEffect(() => {
    if (!isOpen) return;
    if (!docMUid || !applicationId) return;

    const controller = new AbortController();

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);

      try {
        const form = new URLSearchParams();
        form.set("DocMUid", String(docMUid));
        form.set("ApplicationId", String(applicationId));

        if (
          docMLogId !== undefined &&
          docMLogId !== null &&
          String(docMLogId).trim() !== ""
        ) {
          form.set("DocMLogId", String(docMLogId));
        }

        const resp = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
          signal: controller.signal,
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }

        const json: ApiResponse = await resp.json();

        if (json.status === "success" && Array.isArray(json.data)) {
          setRows(json.data);
          setSelectedSigners({});
        } else if (json.status === "no_data_found") {
          setRows([]);
          setSelectedSigners({});
        } else {
          throw new Error(
            typeof json.error === "string" ? json.error : "Server returned an error"
          );
        }
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setError(e?.message ?? "Failed to fetch form history");
        setRows([]);
        setSelectedSigners({});
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();

    return () => controller.abort();
  }, [isOpen, apiUrl, docMUid, applicationId, docMLogId]);

  const safeUrl = (u?: string | null) => {
    if (!u) return undefined;
    const trimmed = String(u).trim();
    if (!trimmed || trimmed === "-") return undefined;
    return trimmed;
  };

  const buildFileName = (url: string, item: ApiRow, contentType?: string | null) => {
    const urlPath = url.split("?")[0];
    const urlName = urlPath.substring(urlPath.lastIndexOf("/") + 1) || "";
    const hasExt = /\.[a-z0-9]+$/i.test(urlName);

    const base = `Form_${item.DocMUid}_${item.DocMLogId}`;

    if (hasExt) return urlName;

    const map: Record<string, string> = {
      "application/pdf": ".pdf",
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
      "image/webp": ".webp",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
      "application/msword": ".doc",
      "application/zip": ".zip",
      "text/plain": ".txt",
    };

    const ext = contentType ? map[contentType.toLowerCase()] || "" : "";
    return `${base}${ext}`;
  };

  const getRowKey = (item: ApiRow) => `${item.DocMUid}_${item.DocMLogId}`;

  const isNonEmptyValue = (value?: string | null) => {
    if (value === null || value === undefined) return false;
    const trimmed = String(value).trim();
    return trimmed !== "" && trimmed !== "-";
  };

  const getSignerOptions = (item: ApiRow): SignerOption[] => {
    const candidates: Array<{ type: string; value: string | null }> = [
      { type: "L1", value: item.L1Name },
      { type: "L2", value: item.L2Name },
      { type: "L3", value: item.L3Name },
      { type: "L4", value: item.L4Name },
      { type: "T1", value: item.T1Name },
      { type: "T2", value: item.T2Name },
      { type: "T3", value: item.T3Name },
      { type: "T4", value: item.T4Name },
    ];

    return candidates
      .filter((candidate) => isNonEmptyValue(candidate.value))
      .map((candidate) => ({
        label: String(candidate.value).trim(),
        value: String(candidate.value).trim(),
        type: candidate.type,
      }));
  };

  const handleSignerChange = (rowKey: string, selectedValue: string) => {
    setSelectedSigners((prev) => ({
      ...prev,
      [rowKey]: selectedValue,
    }));
  };

  const handleView = (item: ApiRow) => {
    const url = safeUrl(item.AttName);
    if (!url) {
      alert("No file available to view for this entry.");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDownload = async (item: ApiRow) => {
    const url = safeUrl(item.AttName);
    if (!url) {
      alert("No file available to download for this entry.");
      return;
    }

    try {
      const resp = await fetch(url, {
        method: "GET",
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const blob = await resp.blob();
      const contentType = resp.headers.get("Content-Type");
      const filename = buildFileName(url, item, contentType);

      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      console.error("Direct fetch download failed:", err);

      try {
        const fallbackUrl = safeUrl(item.AttName);
        if (!fallbackUrl) {
          throw new Error("No file URL available");
        }

        const a = document.createElement("a");
        a.href = fallbackUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.download = "";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (fallbackErr: any) {
        console.error("Fallback download failed:", fallbackErr);
        alert(
          `Failed to download file: ${err?.message || fallbackErr?.message || "Unknown error"}`
        );
      }
    }
  };

  const handleESigning_1 = (item: ApiRow) => {
    const fileUrl = safeUrl(item.AttName);

    if (!fileUrl) {
      alert("No file available for e-signing.");
      return;
    }

    const rowKey = getRowKey(item);
    const signerOptions = getSignerOptions(item);

    if (signerOptions.length === 0) {
      alert("No signer name is available for this entry.");
      return;
    }

    const selectedSignerValue = selectedSigners[rowKey];

    if (!selectedSignerValue) {
      alert("Please select a signer name first.");
      return;
    }

    const selectedSigner = signerOptions.find(
      (option) => option.value === selectedSignerValue
    );

    if (!selectedSigner) {
      alert("Invalid signer selection. Please select again.");
      return;
    }

    onESigning(item);

    const esignUrl =
      `${window.location.origin}/esigning?` +
      `docMLogId=${encodeURIComponent(item.DocMLogId)}` +
      `&applicationId=${encodeURIComponent(item.ApplicationId)}` +
      `&docMUid=${encodeURIComponent(item.DocMUid)}` +
      `&fileName=${encodeURIComponent(fileUrl)}` +
      `&Name=${encodeURIComponent(selectedSigner.value)}` +
      `&NameType=${encodeURIComponent(selectedSigner.type)}`;

    window.open(esignUrl, "_blank");
  };

  const handleESigning = async (item: ApiRow) => {
    const fileUrl = safeUrl(item.AttName);

    if (!fileUrl) {
      alert("No file available for e-signing.");
      return;
    }

    const rowKey = getRowKey(item);
    const signerOptions = getSignerOptions(item);

    if (signerOptions.length === 0) {
      alert("No signer name is available for this entry.");
      return;
    }

    const selectedSignerValue = selectedSigners[rowKey];

    if (!selectedSignerValue) {
      alert("Please select a signer name first.");
      return;
    }

    const selectedSigner = signerOptions.find(
      (option) => option.value === selectedSignerValue
    );

    if (!selectedSigner) {
      alert("Invalid signer selection. Please select again.");
      return;
    }

    const esignUrl =
      `${window.location.origin}/esigning?` +
      `docMLogId=${encodeURIComponent(item.DocMLogId)}` +
      `&applicationId=${encodeURIComponent(item.ApplicationId)}` +
      `&docMUid=${encodeURIComponent(item.DocMUid)}` +
      `&fileName=${encodeURIComponent(fileUrl)}` +
      `&Name=${encodeURIComponent(selectedSigner.value)}` +
      `&NameType=${encodeURIComponent(selectedSigner.type)}`;

    try {
      await navigator.clipboard.writeText(esignUrl);
      alert("E-Sign link copied to clipboard. You may paste it into WhatsApp.");
    } catch (err) {
      console.error("Clipboard copy failed:", err);

      const textArea = document.createElement("textarea");
      textArea.value = esignUrl;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand("copy");
        alert("E-Sign link copied to clipboard. You may paste it into WhatsApp.");
      } catch (fallbackErr) {
        console.error("Fallback copy failed:", fallbackErr);
        alert("Unable to copy the E-Sign link automatically.");
      } finally {
        document.body.removeChild(textArea);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-blue-600 px-6 py-4 text-white">
            <div className="flex items-center space-x-3">
              <FileText className="h-6 w-6" />
              <div>
                <h2 className="text-xl font-semibold">Form History</h2>
                <p className="text-sm text-blue-100">{docDesc}</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-full p-1 text-white transition-colors hover:bg-blue-700 hover:text-gray-200"
              aria-label="Close"
              type="button"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="max-h-[calc(90vh-120px)] overflow-y-auto p-6">
            <div className="mb-6 rounded-lg bg-gray-50 p-4">
              <div className="flex flex-col gap-3 text-sm md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-gray-600">Document UID:</span>
                  <span className="ml-2 break-all text-gray-900">{docMUid}</span>
                </div>

                <div className="text-left md:ml-6 md:text-right shrink-0">
                  <span className="font-medium text-gray-600">Total Versions:</span>
                  <span className="ml-2 text-gray-900">{totalVersions}</span>
                </div>
              </div>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="mr-3 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
                <span className="text-gray-600">Loading form history...</span>
              </div>
            )}

            {error && !loading && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                <div className="font-medium">Error loading form history</div>
                <div className="break-all text-sm">{error}</div>
              </div>
            )}

            {!loading && !error && rows.length > 0 && (
              <div className="space-y-4">
                {rows.map((item) => {
                  const rowKey = getRowKey(item);
                  const signerOptions = getSignerOptions(item);

                  return (
                    <div
                      key={rowKey}
                      className="rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md"
                    >
                      <div className="space-y-3">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                          <h4 className="font-medium text-gray-900">
                            Log # : {item.RefNo1 ?? "-"}
                          </h4>

                          <div className="flex items-center space-x-1 text-sm text-gray-600">
                            <Calendar className="h-4 w-4" />
                            <span>Generated On : {item.AddDate ?? "-"}</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:flex-wrap">
                          <div className="flex items-center gap-2 min-w-0 xl:flex-1">
                            <label className="shrink-0 text-sm font-medium text-gray-700">
                              Select Signer
                            </label>

                            <span className="shrink-0 text-sm font-medium text-gray-700">:</span>

                            <select
                              value={selectedSigners[rowKey] ?? ""}
                              onChange={(e) => handleSignerChange(rowKey, e.target.value)}
                              className="min-w-[220px] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">
                                {signerOptions.length > 0
                                  ? "-- Select Signer --"
                                  : "-- No Signer Available --"}
                              </option>

                              {signerOptions.map((option) => (
                                <option
                                  key={`${rowKey}_${option.type}_${option.value}`}
                                  value={option.value}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleESigning(item)}
                              className="flex items-center space-x-1 rounded bg-purple-50 px-3 py-2 text-purple-600 transition-colors hover:bg-purple-100"
                            >
                              <FileText className="h-4 w-4" />
                              <span>E-Signing</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleView(item)}
                              className="flex items-center space-x-1 rounded bg-blue-50 px-3 py-2 text-blue-600 transition-colors hover:bg-blue-100"
                            >
                              <Eye className="h-4 w-4" />
                              <span>View</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownload(item)}
                              className="flex items-center space-x-1 rounded bg-green-50 px-3 py-2 text-green-600 transition-colors hover:bg-green-100"
                            >
                              <Download className="h-4 w-4" />
                              <span>Download</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && !error && rows.length === 0 && (
              <div className="py-12 text-center">
                <FileText className="mx-auto mb-4 h-16 w-16 text-gray-400" />
                <h3 className="mb-2 text-lg font-medium text-gray-700">No History Found</h3>
                <p className="text-gray-500">No version history available for this form.</p>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 bg-gray-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormHistorySession;