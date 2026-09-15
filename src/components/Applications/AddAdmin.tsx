import { API_ENDPOINTS } from '../../config/apiConfig';
// src/pages/staff/AddAdmin.tsx
import React, { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Save, Edit3, CheckCircle2, AlertTriangle } from "lucide-react";

const ENDPOINT_INSERT = API_ENDPOINTS.INT_ADMIN_INSERT;
const ENDPOINT_GET_DEPTS = API_ENDPOINTS.INT_DEPT_GET;

interface AddAdminProps {
  onBack: () => void;
}

type EmployeeNew = {
  UserName: string;
  Branch: string | null;
  Nric: string | null;
  NricName: string | null;
  DisplayName: string | null;
  Active: string | null; // "1" | "0"
  EmpType: string | null;
  Dept: string | null;
  RecruitDate: string | null;
  ResignDate: string | null;
  MobilePhone: string | null;
  HousePhone: string | null;
  Email: string | null;
  Address: string | null;
  City: string | null;
  State: string | null;
  PostCode: string | null;
  Country: string | null;

  BankName: string | null;
  BankInfoType: string | null; // "Individual" | "Business"
  BusinessNoNew: string | null;
  BusinessNoOld: string | null;
  BusinessTin: string | null;

  BankAcc: string | null;
  BdsAc: string | null;
  Remarks: string | null;
  RenNo: string | null;
};

type DeptItem = {
  Branch: string;
  Dept: string;
  LeaderId: string;
  Desc: string;
  UpdatedOn: string;
  UpdatedBy: string;
  TotalMembers: string;
};

type ApiSuccess<T> = { status: "success"; data: T };
type ApiNoData = { status: "no_data_found"; error?: string };
type ApiError = { status: "error"; error?: string; detail?: any };
type ApiResp<T> = ApiSuccess<T> | ApiNoData | ApiError;

const rowWrap = "mb-3 grid grid-cols-1 sm:grid-cols-3 sm:items-center gap-1 sm:gap-4";
const labelCls = "text-slate-500 sm:col-span-1 sm:text-right sm:pr-3";
const fieldWrapCls = "sm:col-span-2";
const controlCls =
  "w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400";

const EMP_TYPES = [
  { label: "Full Time", value: "Full Time" },
  { label: "License Holder", value: "License Holder" },
  { label: "Part Time", value: "Part Time" },
  { label: "Staff", value: "Staff" },
];

const BANK_INFO_TYPES = [
  { label: "Individual", value: "Individual" },
  { label: "Business", value: "Business" },
];

const COUNTRIES = [
  "Malaysia",
  "Singapore",
  "Thailand",
  "Indonesia",
  "Brunei",
  "Vietnam",
  "Philippines",
  "India",
  "China",
  "Australia",
  "New Zealand",
  "United Kingdom",
  "United States",
  "Canada",
].map((c) => ({ label: c, value: c }));

/* ---------- Reusable Inputs ---------- */
function Field({
  title,
  value,
  name,
  onChange,
  placeholder,
  type = "text",
}: {
  title: string;
  value: any;
  name: keyof EmployeeNew;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  type?: "text" | "date" | "email" | "tel" | "number";
}) {
  const isTextarea = /address|remarks/i.test(title);
  return (
    <div className={rowWrap}>
      <div className={labelCls}>{title}:</div>
      <div className={fieldWrapCls}>
        {isTextarea ? (
          <textarea
            name={name}
            className={controlCls}
            rows={2}
            value={value ?? ""}
            onChange={onChange}
            placeholder={placeholder}
          />
        ) : (
          <input
            type={type}
            name={name}
            className={controlCls}
            value={value ?? ""}
            onChange={onChange}
            placeholder={placeholder}
          />
        )}
      </div>
    </div>
  );
}

function SelectField({
  title,
  value,
  name,
  onChange,
  options,
  placeholder,
}: {
  title: string;
  value: any;
  name: keyof EmployeeNew;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}) {
  return (
    <div className={rowWrap}>
      <div className={labelCls}>{title}:</div>
      <div className={fieldWrapCls}>
        <select name={name} className={controlCls} value={value ?? ""} onChange={onChange}>
          <option value="">{placeholder ?? "Select..."}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ---------- Component ---------- */
const AddAdmin: React.FC<AddAdminProps> = ({ onBack }) => {
  const [form, setForm] = useState<EmployeeNew>({
    UserName: "",
    Branch: null,
    Nric: "",
    NricName: "",
    DisplayName: "",
    Active: "1",
    EmpType: "",
    Dept: "",
    RecruitDate: "",
    ResignDate: "",
    MobilePhone: "",
    HousePhone: "",
    Email: "",
    Address: "",
    City: "",
    State: "",
    PostCode: "",
    Country: "Malaysia",

    BankName: "",
    BankInfoType: "Individual",
    BusinessNoNew: "",
    BusinessNoOld: "",
    BusinessTin: "",

    BankAcc: "",
    BdsAc: "",
    Remarks: "",
    RenNo: "",
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; msg: string; type: "success" | "error" }>({
    open: false,
    msg: "",
    type: "success",
  });

  const snackbarTimer = useRef<number | null>(null);
  const navigateTimer = useRef<number | null>(null);

  const showSnackbar = useCallback((msg: string, type: "success" | "error", onDone?: () => void) => {
    setSnackbar({ open: true, msg, type });
    if (snackbarTimer.current) window.clearTimeout(snackbarTimer.current);
    snackbarTimer.current = window.setTimeout(() => {
      setSnackbar((s) => ({ ...s, open: false }));
      if (onDone) onDone();
    }, 1800);
  }, []);

  useEffect(() => {
    return () => {
      if (snackbarTimer.current) window.clearTimeout(snackbarTimer.current);
      if (navigateTimer.current) window.clearTimeout(navigateTimer.current);
    };
  }, []);

  // Upload IC / SSM
  const icInputRef = useRef<HTMLInputElement | null>(null);
  const ssmInputRef = useRef<HTMLInputElement | null>(null);
  const [icFile, setIcFile] = useState<File | null>(null);
  const [ssmFile, setSsmFile] = useState<File | null>(null);

  const onPickIc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setIcFile(f);
    if (f) showSnackbar(`IC selected: ${f.name}`, "success");
    e.target.value = "";
  };

  const onPickSsm = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setSsmFile(f);
    if (f) showSnackbar(`SSM selected: ${f.name}`, "success");
    e.target.value = "";
  };

  // Dept options
  const [deptOpts, setDeptOpts] = useState<{ label: string; value: string }[]>([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [deptErr, setDeptErr] = useState<string>("");

  const loadDepts = useCallback(async () => {
    setDeptLoading(true);
    setDeptErr("");
    try {
      const body = new URLSearchParams();
      body.set("Dept", "");
      body.set("SearchKeyword", "");

      const res = await fetch(ENDPOINT_GET_DEPTS, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: body.toString(),
      });

      const json: ApiResp<DeptItem[]> = await res.json();

      if (json.status === "success") {
        const options = json.data.map((d) => ({ label: d.Desc || d.Dept, value: d.Dept }));
        setDeptOpts(options);
      } else if (json.status === "no_data_found") {
        setDeptOpts([]);
        setDeptErr(json.error || "No team data found.");
      } else {
        setDeptOpts([]);
        setDeptErr(json.error || "Failed to load teams.");
      }
    } catch (e: any) {
      setDeptErr(e?.message || "Network error while loading teams.");
      setDeptOpts([]);
    } finally {
      setDeptLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDepts();
  }, [loadDepts]);

  type InputEl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const onInputChange = (e: ChangeEvent<InputEl>) => {
    const { name, value } = e.target as HTMLInputElement;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // ✅ Business mode flag
  const isBusiness = (form.BankInfoType ?? "Individual") === "Business";

  // ✅ When switch to Individual -> clear Business fields + remove SSM file
  useEffect(() => {
    if (!isBusiness) {
      setSsmFile(null);
      setForm((prev) => ({
        ...prev,
        BusinessNoNew: "",
        BusinessNoOld: "",
        BusinessTin: "",
      }));
    }
  }, [isBusiness]);

  // ✅ Live check for disabling CREATE button
  const requiredOk =
    !!form.UserName?.trim() &&
    !!form.DisplayName?.trim() &&
    !!icFile &&
    (!isBusiness ||
      (!!ssmFile && !!form.BusinessNoNew?.trim() && !!form.BusinessNoOld?.trim() && !!form.BusinessTin?.trim()));

  // ✅ Validate on click CREATE (show missing list)
  const validateBeforeCreate = () => {
    const missing: string[] = [];

    if (!form.UserName?.trim()) missing.push("User Name");
    if (!form.DisplayName?.trim()) missing.push("Display Name");

    // IC/NRIC compulsory for both
    if (!icFile) missing.push("Upload IC/NRIC");

    if (isBusiness) {
      if (!ssmFile) missing.push("Upload SSM");
      if (!form.BusinessNoNew?.trim()) missing.push("Business No (New)");
      if (!form.BusinessNoOld?.trim()) missing.push("Business No (Old)");
      if (!form.BusinessTin?.trim()) missing.push("Business TIN");
    }

    if (missing.length > 0) {
      showSnackbar(`Please fill in: ${missing.join(", ")}`, "error");
      return false;
    }
    return true;
  };

  const onCreate = async () => {    
    if (!validateBeforeCreate()) return;

    setSaving(true);
    setErr("");
    try {
      const fd = new FormData();

      // Backend expects User_Name; include it
      fd.append("User_Name", form.UserName ?? "");

      // Append all form fields
      Object.keys(form).forEach((k) => {        
        const key = k as keyof EmployeeNew;
        const v = form[key];
        fd.append(key.toString(), v == null ? "" : String(v));
      });
// ✅ MUST send these 4 fields to PHP
fd.set("BankInfoType", form.BankInfoType ?? "");
fd.set("BusinessNoNew", form.BusinessNoNew ?? "");
fd.set("BusinessNoOld", form.BusinessNoOld ?? "");
fd.set("BusinessTin", form.BusinessTin ?? "");

      // Ensure Active is "1" or "0"
      if (form.Active !== "1" && form.Active !== "0") {
        fd.set("Active", form.Active ? "1" : "0");
      }

      // Files
      if (icFile) fd.append("UploadIC", icFile);
      if (isBusiness && ssmFile) fd.append("UploadSSM", ssmFile);

      const res = await fetch(ENDPOINT_INSERT, {
        method: "POST",
        body: fd, // DON'T set Content-Type manually
      });

      const json = await res.json();

      if (json?.status === "success") {
        showSnackbar("Admin created successfully.", "success", () => onBack());
      } else {
        const msg = json?.error || "Insert failed.";
        setErr(msg);
        showSnackbar(msg, "error");
      }
    } catch (e: any) {
      const msg = e?.message || "Network error during insert.";
      setErr(msg);
      showSnackbar(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    const ok = window.confirm("Are you sure to cancel ?");
    if (ok) onBack();
  };

  const dateVal = (v: string | null | undefined) => (v && v.length >= 10 ? v.substring(0, 10) : "");

  return (
    <div className="p-6">
      {/* Sticky header */}
      <p></p>
      <p></p>
      <p></p>
      <div className="sticky top-0 z-30 mb-4 -mx-6 px-6 py-3 bg-amber-50/80 backdrop-blur border-b border-amber-200">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-900">
            <Edit3 size={16} />
            <span className="font-medium">Add New Admin</span>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-50"
            title="Back"
            disabled={saving}
          >
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </div>

      {deptLoading && (
        <div className="text-slate-600 flex items-center gap-2">
          <Loader2 className="animate-spin" size={16} /> Loading…
        </div>
      )}

      {(deptErr || err) && !deptLoading && (
        <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {deptErr || err}
        </div>
      )}

      <div className="rounded-lg border p-4 bg-amber-50/30 border-amber-200">
        <Field title="User Name" value={form.UserName} name="UserName" onChange={onInputChange} placeholder="Unique username / ID" />
        <Field title="Nric No" value={form.Nric} name="Nric" onChange={onInputChange} placeholder="e.g. 880101-01-1234" />
        <Field title="Display Name" value={form.DisplayName} name="DisplayName" onChange={onInputChange} />
        <Field title="IC Name" value={form.NricName} name="NricName" onChange={onInputChange} placeholder="e.g. CHAN AH SENG" />
        <Field title="Ren No" value={form.RenNo} name="RenNo" onChange={onInputChange} />

        <SelectField title="Team" value={form.Dept ?? ""} name="Dept" onChange={onInputChange as any} options={deptOpts} placeholder="Select Team" />

        <SelectField
          title="Employment Type"
          value={form.EmpType ?? ""}
          name="EmpType"
          onChange={onInputChange as any}
          options={EMP_TYPES}
          placeholder="Select Employment Type"
        />

        <SelectField
          title="Bank Info Type"
          value={form.BankInfoType ?? "Individual"}
          name="BankInfoType"
          onChange={onInputChange as any}
          options={BANK_INFO_TYPES}
          placeholder="Select Bank Info Type"
        />

        <Field title="Bank Name" value={form.BankName} name="BankName" onChange={onInputChange} />
        <Field title="Bank Account" value={form.BankAcc} name="BankAcc" onChange={onInputChange} />

        {/* ✅ Business fields shown ONLY when Business */}
        {isBusiness && (
          <>
            <Field title="Business No (New) *" value={form.BusinessNoNew} name="BusinessNoNew" onChange={onInputChange} />
            <Field title="Business No (Old) *" value={form.BusinessNoOld} name="BusinessNoOld" onChange={onInputChange} />
            <Field title="Business TIN *" value={form.BusinessTin} name="BusinessTin" onChange={onInputChange} />
          </>
        )}

        <Field title="Join Date" value={dateVal(form.RecruitDate)} name="RecruitDate" onChange={onInputChange} type="date" />
        <Field title="Resign Date" value={dateVal(form.ResignDate)} name="ResignDate" onChange={onInputChange} type="date" />

        <SelectField
          title="Status"
          value={form.Active ?? "1"}
          name="Active"
          onChange={onInputChange as any}
          options={[
            { label: "Active", value: "1" },
            { label: "Resigned", value: "0" },
          ]}
          placeholder="Select Status"
        />

        <Field title="Mobile No" value={form.MobilePhone} name="MobilePhone" onChange={onInputChange} />
        <Field title="Email" value={form.Email} name="Email" onChange={onInputChange} type="email" />
        <Field title="Address" value={form.Address} name="Address" onChange={onInputChange} />
        <Field title="City" value={form.City} name="City" onChange={onInputChange} />
        <Field title="State" value={form.State} name="State" onChange={onInputChange} />
        <Field title="Postcode" value={form.PostCode} name="PostCode" onChange={onInputChange} />

        <SelectField title="Country" value={form.Country ?? "Malaysia"} name="Country" onChange={onInputChange as any} options={COUNTRIES} placeholder="Select Country" />

        <Field title="House Phone" value={form.HousePhone} name="HousePhone" onChange={onInputChange} />
        <Field title="BDS Account" value={form.BdsAc} name="BdsAc" onChange={onInputChange} />
        <Field title="Remarks" value={form.Remarks} name="Remarks" onChange={onInputChange} />

        {/* Attachments */}
        <div className={rowWrap}>
          <div className={labelCls}>Attachments:</div>

          <div className={`${fieldWrapCls} flex flex-col gap-2`}>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => icInputRef.current?.click()}
                className="inline-flex items-center justify-center px-3 py-2 rounded-lg border hover:bg-slate-50 text-sm"
                disabled={saving}
              >
                Upload IC/NRIC *
              </button>

              {/* ✅ Upload SSM button only when Business */}
              {isBusiness && (
                <button
                  type="button"
                  onClick={() => ssmInputRef.current?.click()}
                  className="inline-flex items-center justify-center px-3 py-2 rounded-lg border hover:bg-slate-50 text-sm"
                  disabled={saving}
                >
                  Upload SSM *
                </button>
              )}
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <div>
                IC/NRIC:{" "}
                {icFile ? icFile.name : <span className="text-red-600">Required</span>}
              </div>

              {isBusiness && (
                <div>
                  SSM:{" "}
                  {ssmFile ? ssmFile.name : <span className="text-red-600">Required</span>}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={onCreate}
                className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-white bg-green-600 hover:bg-green-700 ${
                  saving ? "opacity-60 cursor-not-allowed" : ""
                }`}
                disabled={saving || !requiredOk}
                title="Create"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                {saving ? "Saving…" : "CREATE"}
              </button>

              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center justify-center px-3 py-2 rounded-lg border hover:bg-slate-50 text-sm"
                disabled={saving}
                title="Cancel"
              >
                Cancel
              </button>
            </div>

            {/* Hidden file inputs */}
            <input ref={icInputRef} type="file" className="hidden" accept="image/*,.pdf" onChange={onPickIc} />

            {isBusiness && (
              <input ref={ssmInputRef} type="file" className="hidden" accept="image/*,.pdf" onChange={onPickSsm} />
            )}
          </div>
        </div>
      </div>

      {/* Snackbar */}
      <div
        aria-live="polite"
        className={`fixed left-1/2 -translate-x-1/2 bottom-6 z-50 transition-all ${
          snackbar.open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
        }`}
      >
        <div
          className={`flex items-center gap-2 rounded-lg px-4 py-2 shadow-md ${
            snackbar.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {snackbar.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span className="text-sm font-medium">{snackbar.msg}</span>
        </div>
      </div>
    </div>
  );
};

export default AddAdmin;
