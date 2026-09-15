import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

interface ESigningPageProps {
  docMLogId?: string;
  applicationId?: string;
  docMUid?: string;
  fileName?: string;
}

type ApiResponse = {
  status?: string;
  message?: string;
  data?: string;
  FileName?: string;
  UpdatedColumn?: string;
  [key: string]: unknown;
};

type IntFormInsertRow = {
  RefNo?: string;
  RefNo1?: string;
  DocMLogId?: string | number;
  [key: string]: unknown;
};

type IntFormInsertResponse = {
  status?: string;
  message?: string;
  data?: IntFormInsertRow[] | string;
  [key: string]: unknown;
};

const ESIGNING_SET_URL = API_ENDPOINTS.E_SIGNING_SET;
const INT_FORM_INSERT_URL = API_ENDPOINTS.INT_FORM_INSERT;

const AFTER_SIGN_DOC_M_UID = "149E7E30-A22D-487F-927C-B067D3C31260";
const AFTER_SIGN_DOC_CONTENT1 = "Exclusive Authorisation To Sell (EATS)";

const MIN_SIGNATURE_POINTS = 8;

const ESigningPage: React.FC<ESigningPageProps> = (props) => {
  const [showSignModal, setShowSignModal] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const pointCountRef = useRef(0);

  const params = new URLSearchParams(window.location.search);

  const applicationId = params.get("applicationId") || props.applicationId || "";
  const docMLogId = params.get("docMLogId") || props.docMLogId || "";
  const docMUid = params.get("docMUid") || props.docMUid || "";
  const fileName = params.get("fileName") || props.fileName || "";

  const signerName = params.get("Name") || "";
  const nameType = (params.get("NameType") || "").toUpperCase();

  const pdfUrl = useMemo(() => fileName || "", [fileName]);

  const setupCanvas = () => {
    const canvas = canvasRef.current;
    const wrapper = canvasWrapperRef.current;
    if (!canvas || !wrapper) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = wrapper.getBoundingClientRect();

    const displayWidth = Math.max(Math.floor(rect.width), 300);
    const displayHeight = 320;

    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    canvas.width = Math.floor(displayWidth * ratio);
    canvas.height = Math.floor(displayHeight * ratio);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#111827";
  };

  useEffect(() => {
    if (!showSignModal) return;

    const timer = window.setTimeout(() => {
      setupCanvas();
      pointCountRef.current = 0;
      setHasDrawn(false);
      setIsDrawing(false);
    }, 50);

    const handleResize = () => {
      setupCanvas();
      pointCountRef.current = 0;
      setHasDrawn(false);
      setIsDrawing(false);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [showSignModal]);

  useEffect(() => {
    if (!showSignModal) return;

    const preventTouchMove = (e: TouchEvent) => {
      if (isDrawing) {
        e.preventDefault();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("touchmove", preventTouchMove, { passive: false });

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("touchmove", preventTouchMove);
    };
  }, [showSignModal, isDrawing]);

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const getTouchPos = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0] || e.changedTouches[0];

    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  };

  const beginStroke = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const continueStroke = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawing) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.stroke();

    pointCountRef.current += 1;
    if (pointCountRef.current >= MIN_SIGNATURE_POINTS) {
      setHasDrawn(true);
    }
  };

  const endStroke = () => {
    setIsDrawing(false);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getMousePos(e);
    beginStroke(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const { x, y } = getMousePos(e);
    continueStroke(x, y);
  };

  const stopDrawing = () => {
    endStroke();
  };

  const startDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { x, y } = getTouchPos(e);
    beginStroke(x, y);
  };

  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getTouchPos(e);
    continueStroke(x, y);
  };

  const stopDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    endStroke();
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const displayWidth = parseFloat(canvas.style.width || "0") || canvas.clientWidth;
    const displayHeight = parseFloat(canvas.style.height || "0") || canvas.clientHeight;

    ctx.clearRect(0, 0, displayWidth, displayHeight);
    pointCountRef.current = 0;
    setHasDrawn(false);
    setIsDrawing(false);
  };

  const canvasToBlob = async (canvas: HTMLCanvasElement): Promise<Blob> => {
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to convert signature to image."));
          return;
        }
        resolve(blob);
      }, "image/png");
    });
  };

  const callIntFormInsert = async () => {
    if (!applicationId) {
      throw new Error("ApplicationId not found.");
    }

    const body = new URLSearchParams();
    body.append("ApplicationId", applicationId);
    body.append("DocMUid", AFTER_SIGN_DOC_M_UID);
    body.append("DocContent1", AFTER_SIGN_DOC_CONTENT1);

    const response = await fetch(INT_FORM_INSERT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const rawText = await response.text();

    let result: IntFormInsertResponse = {};
    try {
      result = JSON.parse(rawText);
    } catch {
      throw new Error(rawText || "IntFormInsert.php returned invalid response.");
    }

    if (!response.ok) {
      throw new Error(
        String(result.message || result.data || "IntFormInsert.php failed.")
      );
    }

    if ((result.status || "").toLowerCase() !== "success") {
      throw new Error(
        String(result.message || result.data || "IntFormInsert.php failed.")
      );
    }

    return result;
  };

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      alert("Signature box not found.");
      return;
    }

    if (!docMLogId) {
      alert("DocMLogId not found in URL.");
      return;
    }

    if (!applicationId) {
      alert("ApplicationId not found in URL.");
      return;
    }

    if (!nameType) {
      alert("NameType not found in URL.");
      return;
    }

    if (!hasDrawn || pointCountRef.current < MIN_SIGNATURE_POINTS) {
      alert("Please provide a proper signature before saving.");
      return;
    }

    try {
      setIsSaving(true);

      const blob = await canvasToBlob(canvas);
      const uploadFileName = `${docMLogId}_${nameType}.png`;

      const formData = new FormData();
      formData.append("DocMLogId", docMLogId);
      formData.append("ApplicationId", applicationId);
      formData.append("DocMUid", docMUid);
      formData.append("Name", signerName);
      formData.append("NameType", nameType);
      formData.append("FileName", uploadFileName);
      formData.append("file", blob, uploadFileName);

      const response = await fetch(ESIGNING_SET_URL, {
        method: "POST",
        body: formData,
      });

      const rawText = await response.text();

      let result: ApiResponse = {};
      try {
        result = JSON.parse(rawText);
      } catch {
        throw new Error(rawText || "Server returned invalid response.");
      }

      if (!response.ok) {
        throw new Error(String(result.data || result.message || "Upload failed."));
      }

      if ((result.status || "").toLowerCase() !== "success") {
        throw new Error(String(result.data || result.message || "Upload failed."));
      }

      await callIntFormInsert();

      alert(
        `Signed successfully${
          result.FileName ? `: ${String(result.FileName)}` : ""
        }`
      );

      setShowSignModal(false);
      clearSignature();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save signature.";
      alert(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-6xl rounded-xl bg-white p-4 shadow-lg md:p-6">
        <h1 className="mb-2 text-2xl font-bold text-gray-800">E-Signing</h1>

        <div className="mb-4 space-y-1 text-sm text-gray-600">
          <p>DocMLogId: {docMLogId || "-"}</p>
          <p>ApplicationId: {applicationId || "-"}</p>
          <p>DocMUid: {docMUid || "-"}</p>
          <p>Name: {signerName || "-"}</p>
          <p>NameType: {nameType || "-"}</p>
        </div>

        <div className="overflow-hidden rounded-lg border bg-gray-50">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              title="PDF Viewer"
              className="h-[75vh] w-full"
            />
          ) : (
            <div className="flex h-[75vh] items-center justify-center text-gray-500">
              No PDF file found.
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setShowSignModal(true)}
            className="rounded-lg bg-purple-600 px-6 py-3 text-white hover:bg-purple-700"
          >
            E-Sign
          </button>
        </div>
      </div>

      {showSignModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-3xl font-semibold text-gray-800">
                Sign Document
              </h2>

              <button
                type="button"
                onClick={() => {
                  if (!isSaving) {
                    setShowSignModal(false);
                  }
                }}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                disabled={isSaving}
              >
                <X className="h-7 w-7" />
              </button>
            </div>

            <div className="px-6 py-8">
              <p className="mb-2 text-center text-2xl text-gray-700">
                Please draw your signature below:
              </p>

              <p className="mb-6 text-center text-base text-gray-500">
                {signerName || "-"} {nameType ? `(${nameType})` : ""}
              </p>

              <div ref={canvasWrapperRef} className="mx-auto max-w-3xl">
                <canvas
                  ref={canvasRef}
                  className="w-full cursor-crosshair rounded-lg border border-gray-300 bg-white touch-none"
                  style={{ height: 320, touchAction: "none" }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawingTouch}
                  onTouchMove={drawTouch}
                  onTouchEnd={stopDrawingTouch}
                  onTouchCancel={stopDrawingTouch}
                />
              </div>

              <div className="mt-3 text-center text-sm text-gray-500">
                Draw a proper signature. Tiny dots will not be accepted.
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={clearSignature}
                  className="min-w-[180px] rounded-lg border border-gray-300 bg-gray-100 px-6 py-3 text-xl font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                  disabled={isSaving}
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={saveSignature}
                  className="min-w-[250px] rounded-lg bg-purple-600 px-6 py-3 text-xl font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Signature"}
                </button>
              </div>
            </div>

            <div className="border-t px-6 py-5 text-center">
              <button
                type="button"
                onClick={() => {
                  if (!isSaving) {
                    setShowSignModal(false);
                  }
                }}
                className="text-2xl text-blue-700 underline hover:text-blue-800 disabled:opacity-50"
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ESigningPage;