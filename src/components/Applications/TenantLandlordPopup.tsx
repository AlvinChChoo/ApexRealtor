import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Mail, Phone, UserCheck } from "lucide-react";

type Side = "Landlord" | "Tenant";
type Index = 1 | 2 | 3 | 4;

export type PersonData = {
  name: string;
  email: string;
  hpNo: string;
  id: string;
  mailingAdd: string;
  postalCode: string;

  tinNo: string;
  sstNo: string;
  ssm: string;
  gender: string;
  dob: string;
  purposeOfTrading: string;
  occupation: string;
  personInCharge: string;
  natureOfBusiness: string;

  nationality: string;

  nameType: string;
  idType: string;
  countryCode: string;
  countryName: string;

  banker: string;
  bankAcNo: string;
  bankHolderName: string;
};

const ENDPOINT =
  API_ENDPOINTS.TENANT_LANDLORD_UPDATE_POPUP;

const label = "text-xs font-medium tracking-wide text-gray-500";
const gridRow = "grid grid-cols-1 sm:grid-cols-2 gap-3";





function getOwnerUserName() {
  try {
    return (localStorage.getItem("userName") || "").trim();
    //const userName = (localStorage.getItem('userName') || '').trim(); // ✅ string, no 
  } catch {
    return "";
  }
}

function validateRequired6(d: PersonData) {
  const missing: string[] = [];

  const name = (d.name || "").trim();
  const email = (d.email || "").trim();
  const hpNo = (d.hpNo || "").trim();
  const id = (d.id || "").trim();
  const mailingAdd = (d.mailingAdd || "").trim();
  const postalCode = (d.postalCode || "").trim().slice(0, 10);

  if (!name) missing.push("Name");

  // Email is optional
  if (email) {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!ok) missing.push("Email (invalid)");
  }

  if (!hpNo) missing.push("Phone Number");
  if (!id) missing.push("NRIC / Passport Number");
  if (!mailingAdd) missing.push("Mailing Address");
  if (!postalCode) missing.push("Postal Code");

  return { ok: missing.length === 0, missing, normalizedPostalCode: postalCode };
}

function isPersonDirty(a: PersonData, b: PersonData) {
  const keys = Object.keys(a) as (keyof PersonData)[];
  for (const k of keys) {
    if (String(a[k] ?? "") !== String(b[k] ?? "")) return true;
  }
  return false;
}

function emptyPerson(): PersonData {
  return {
    name: "",
    email: "",
    hpNo: "",
    id: "",
    mailingAdd: "",
    postalCode: "",

    tinNo: "",
    sstNo: "",
    ssm: "",
    gender: "",
    dob: "",
    purposeOfTrading: "",
    occupation: "",
    personInCharge: "",
    natureOfBusiness: "",

    nationality: "",

    nameType: "",
    idType: "",
    countryCode: "",
    countryName: "",

    banker: "",
    bankAcNo: "",
    bankHolderName: "",
  };
}

type Props = {
  open?: boolean; // ✅ was: open: boolean
  side: Side;
  idx: Index;
  applicationId: string | number;
  allData: Record<Side, Record<Index, PersonData>>;
  countries: { CountryCode: string; CountryName: string }[];
  canEdit: boolean;
  onClose: () => void;
  onSaved?: (side: Side, idx: Index, updated: PersonData) => void | Promise<void>;
};


const TenantLandlordPopup: React.FC<Props> = ({
  open = true, // ✅ default true so it won’t blank
  side,
  idx,
  applicationId,
  allData,
  countries,
  canEdit,
  onClose,
  onSaved,
}) => {

  const base = useMemo<PersonData>(() => {
    return allData?.[side]?.[idx] ?? emptyPerson();
  }, [allData, side, idx]);

  const [draft, setDraft] = useState<PersonData>(base);
  const [saving, setSaving] = useState(false);

  // snapshot of original when opened
  const baseRef = useRef<PersonData>(base);

  // when opening / switching card, reset draft + base snapshot
  useEffect(() => {
    if (!open) return;
    baseRef.current = base;
    setDraft(base);
  }, [open, base]);

  // ESC to close (only if no save in progress)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  useEffect(() => {
  if (!open) return;

  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  return () => {
    document.body.style.overflow = prevOverflow;
  };
}, [open]);

  
  if (!open) return null;

  const dirty = isPersonDirty(draft, baseRef.current);

  const setField = (k: keyof PersonData, v: string) =>
    setDraft((d) => ({ ...d, [k]: v }));

  /** ✅ Build ONLY ONE-card payload */
  const buildOneCardForm = () => {
    const pre = `${side}${idx}`; // Tenant1 / Landlord2 etc.

    const form = new URLSearchParams();
    form.set("ApplicationId", String(applicationId));
    form.set("Side", side);
    form.set("Idx", String(idx));
    
    if (localStorage.getItem("account") === "N") {
      form.set("OwnerUserName", getOwnerUserName());
    }

    form.set(`${pre}NameType`, draft.nameType);
    
    form.set(`${pre}Name`, draft.name);
    form.set(`${pre}Id`, draft.id);
    form.set(`${pre}IdType`, draft.idType);
    form.set(`${pre}SstNo`, draft.sstNo);
    form.set(`${pre}Ssm`, draft.ssm);
    form.set(`${pre}TinNo`, draft.tinNo);
    form.set(`${pre}HpNo`, draft.hpNo);
    form.set(`${pre}Email`, draft.email);
    form.set(`${pre}PurposeOfTrading`, draft.purposeOfTrading);
    form.set(`${pre}Occupation`, draft.occupation);
    form.set(`${pre}PersonInCharge`, draft.personInCharge);
    form.set(`${pre}NatureOfBusiness`, draft.natureOfBusiness);
    form.set(`${pre}MailingAdd`, draft.mailingAdd);
    form.set(`${pre}PostalCode`, draft.postalCode);
    form.set(`${pre}CountryCode`, draft.countryCode);
    form.set(`${pre}CountryName`, draft.countryName);
    form.set(`${pre}Gender`, draft.gender);
    form.set(`${pre}Dob`, draft.dob);
    form.set(`${pre}Nationality`, draft.nationality);
    form.set(`${pre}Banker`, draft.banker);
    form.set(`${pre}BankAcNo`, draft.bankAcNo);
    form.set(`${pre}BankHolderName`, draft.bankHolderName);

    return form;
  };

  const handleSave = async () => {
  if (saving) return;

  const v = validateRequired6(draft);
  if (!v.ok) {
    alert(`Please fill in required fields:\n\n- ${v.missing.join("\n- ")}`);
    return;
  }

  try {
    setSaving(true);

    const form = buildOneCardForm();
    form.set(`${side}${idx}PostalCode`, v.normalizedPostalCode);

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: form.toString(),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();

    if (json?.status === "success") {
      await onSaved?.(side, idx, draft); // ✅ parent will refresh + close
      return;
    }

    throw new Error(json?.error || json?.message || "Save failed.");
  } catch (e: any) {
    console.error("Popup save failed:", e);
    alert(e?.message || "Save failed. Please try again.");
  } finally {
    setSaving(false);
  }
};



  const handleCancel = () => {
    setDraft(baseRef.current);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => {
          // keep modal open on overlay click
        }}
      />

      {/* modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl max-h-[85vh] rounded-xl bg-white shadow-2xl overflow-hidden border border-gray-200 flex flex-col">

          {/* header */}
          <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-gray-700" />
              <div>
                <div className="text-base font-semibold text-gray-900">
                  Edit {side} {idx}
                </div>
                <div className="text-xs text-gray-500">
                  {dirty ? "You have unsaved changes..." : "No changes yet"}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* body */}
          <div className="p-5 bg-white overflow-y-auto flex-1">

            {/* Name */}
            <div className="mb-3">
              <div className={label}>Name<span className="text-red-500">*</span></div>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setField("name", e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Email / Phone */}
            <div className={`${gridRow} mb-3`}>
              <div>
                <div className={label}>Email</div>
                <div className="relative mt-1">
                  <Mail className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    value={draft.email}
                    onChange={(e) => setField("email", e.target.value)}
                    className="w-full rounded border border-gray-300 pl-8 pr-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className={label}>Phone Number<span className="text-red-500">*</span></div>
                <div className="relative mt-1">
                  <Phone className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="tel"
                    value={draft.hpNo}
                    onChange={(e) => setField("hpNo", e.target.value)}
                    className="w-full rounded border border-gray-300 pl-8 pr-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* ID / Mailing */}
            <div className={`${gridRow} mb-3`}>
              <div>
                <div className={label}>NRIC / Passport Number<span className="text-red-500">*</span></div>
                <input
                  type="text"
                  value={draft.id}
                  onChange={(e) => setField("id", e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className={label}>Mailing Address<span className="text-red-500">*</span></div>
                <textarea
                  value={draft.mailingAdd}
                  onChange={(e) => setField("mailingAdd", e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Postal */}
            <div>
  <div className={label}>
    Postal Code <span className="text-red-500">*</span>
  </div>
  <input
    type="text"
    maxLength={10}
    value={draft.postalCode}
    onChange={(e) => setField("postalCode", e.target.value.slice(0, 10))}
    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
    placeholder="Enter postal code"
  />
</div>

            {/* Expanded details */}
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-4">
              <div className={gridRow}>
                <div>
                  <div className={label}>TIN #</div>
                  <input
                    type="text"
                    value={draft.tinNo}
                    onChange={(e) => setField("tinNo", e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <div className={label}>SST #</div>
                  <input
                    type="text"
                    value={draft.sstNo}
                    onChange={(e) => setField("sstNo", e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
              </div>

              <div>
                <div className={label}>SSM #</div>
                <input
                  type="text"
                  value={draft.ssm}
                  onChange={(e) => setField("ssm", e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </div>

              <div className={gridRow}>
                <div>
                  <div className={label}>Gender</div>
                  <select
                    value={draft.gender}
                    onChange={(e) => setField("gender", e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  >
                    <option value="">-</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <div className={label}>D.O.B.</div>
                  <input
                    type="date"
                    value={draft.dob}
                    onChange={(e) => setField("dob", e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
              </div>

              <div className={gridRow}>
                <div>
                  <div className={label}>Purpose Of Trading</div>
                  <input
                    type="text"
                    value={draft.purposeOfTrading}
                    onChange={(e) => setField("purposeOfTrading", e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <div className={label}>Occupation</div>
                  <input
                    type="text"
                    value={draft.occupation}
                    onChange={(e) => setField("occupation", e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
              </div>

              <div className={gridRow}>
                <div>
                  <div className={label}>Person In Charge</div>
                  <input
                    type="text"
                    value={draft.personInCharge}
                    onChange={(e) => setField("personInCharge", e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <div className={label}>Nature Of Business</div>
                  <input
                    type="text"
                    value={draft.natureOfBusiness}
                    onChange={(e) => setField("natureOfBusiness", e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
              </div>

              <div className={gridRow}>
                <div>
                  <div className={label}>Country</div>
                  <select
  value={draft.nationality}
  onChange={(e) => setField("nationality", e.target.value)}
  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
>
  <option value="">-</option>
  {(countries ?? []).map((c) => (
    <option key={`${c.CountryCode}-${c.CountryName}`} value={c.CountryName}>
      {c.CountryName}
    </option>
  ))}
</select>

                </div>
                <div />
              </div>

              <div className="rounded-md border border-gray-200 bg-white p-3 space-y-3">
                <div className="text-xs font-semibold tracking-wide text-gray-700">Banking Information</div>

                <div className={gridRow}>
                  <div>
                    <div className={label}>Bank</div>
                    <input
                      type="text"
                      value={draft.banker}
                      onChange={(e) => setField("banker", e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </div>

                  <div>
                    <div className={label}>Bank Account No</div>
                    <input
                      type="text"
                      value={draft.bankAcNo}
                      onChange={(e) => setField("bankAcNo", e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <div className={label}>Account Holder Name</div>
                  <input
                    type="text"
                    value={draft.bankHolderName}
                    onChange={(e) => setField("bankHolderName", e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* footer */}
          <div className="px-5 py-4 border-t bg-gray-50 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="text-sm font-medium px-3 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
  type="button"
  onClick={handleSave}
  disabled={saving}
  className={`text-sm font-semibold px-4 py-2 rounded ${
    saving
      ? "bg-blue-300 text-white cursor-not-allowed"
      : "bg-blue-600 text-white hover:bg-blue-500"
  }`}
>
  {saving ? "Saving…" : "Save"}
</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantLandlordPopup;
