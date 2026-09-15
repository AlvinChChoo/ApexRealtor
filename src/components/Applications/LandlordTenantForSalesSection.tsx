import { API_ENDPOINTS } from '../../config/apiConfig';
// src/components/LandlordTenantForSalesSection.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, Mail, Phone, UserCheck } from "lucide-react";
import { RentalApplication } from "../../types";
import TenantLandlordPopup from "./TenantLandlordPopup"; // adjust path

/** =========================
 *  CONFIG
 *  ========================= */
const ENDPOINT = API_ENDPOINTS.TENANT_LANDLORD_UPDATE;
const COUNTRY_GET_URL = API_ENDPOINTS.COUNTRY_GET;

type Side = "Landlord" | "Tenant";
type Index = 1 | 2 | 3 | 4;

const label = "text-xs font-medium tracking-wide text-gray-500";
const value = "text-sm text-gray-900";
const card = "rounded-lg border border-gray-300 bg-white";
const cardHeader = "flex items-center justify-between px-3 py-2 border-b bg-gray-50";
const gridRow = "grid grid-cols-1 sm:grid-cols-2 gap-3";

/** =========================
 *  Helpers
 *  ========================= */
const g = (o: any, k: string, fb = "") => {
  const v = o?.[k];
  return v === null || v === undefined ? fb : String(v);
};

function prefixKey(side: Side, idx: Index, field: string) {
  return `${side}${idx}${field}`;
}

/** Country option shape from CountryGet.php */
type CountryRow = {
  CountryId: string;
  CountryCode: string;
  CountryName: string;
  Sel: string; // Y/N
};

type CountryApiResp =
  | { status: "success"; data: CountryRow[] }
  | { status: "no_data_found"; error?: string }
  | { status: "error"; error?: string }
  | { status: string; data?: any; error?: string };

/** Data shape per person
 *  ✅ MUST match TenantLandlordPopup PersonData (includes postalCode + ssm)
 */
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

function readOne(app: any, side: Side, idx: Index): PersonData {
  const P = (field: string, fb = "") => g(app, prefixKey(side, idx, field), fb);

  return {
    name: P("Name"),
    email: P("Email"),
    hpNo: P("HpNo"),
    id: P("Id"),
    mailingAdd: P("MailingAdd"),
    postalCode: P("PostalCode"),

    tinNo: P("TinNo"),
    sstNo: P("SstNo"),
    ssm: P("Ssm") || P("SsmNo"),
    gender: P("Gender"),
    dob: P("Dob"),
    purposeOfTrading: P("PurposeOfTrading"),
    occupation: P("Occupation"),
    personInCharge: P("PersonInCharge"),
    natureOfBusiness: P("NatureOfBusiness"),

    nationality: P("Nationality"),

    nameType: P("NameType"),
    idType: P("IdType"),
    countryCode: P("CountryCode"),
    countryName: P("CountryName"),

    banker: P("Banker"),
    bankAcNo: P("BankAcNo"),
    bankHolderName: P("BankHolderName"),
  };
}

/** Build URLSearchParams for PHP from the entire snapshot */
function buildPhpForm(
  applicationId: string | number,
  all: Record<Side, Record<Index, PersonData>>,
  tenantCnt = 3,
  landlordCnt = 3
) {
  const form = new URLSearchParams();
  form.set("ApplicationId", String(applicationId));
  form.set("TenantCnt", String(tenantCnt));
  form.set("LandlordCnt", String(landlordCnt));

  (["Tenant", "Landlord"] as Side[]).forEach((side) => {
    ([1, 2, 3, 4] as Index[]).forEach((idx) => {
      const d = all[side][idx] || emptyPerson();
      const pre = `${side}${idx}`;

      form.set(`${pre}NameType`, d.nameType);
      form.set(`${pre}Name`, d.name);
      form.set(`${pre}Id`, d.id);
      form.set(`${pre}IdType`, d.idType);

      form.set(`${pre}SstNo`, d.sstNo);
      form.set(`${pre}Ssm`, d.ssm);
      form.set(`${pre}TinNo`, d.tinNo);

      form.set(`${pre}HpNo`, d.hpNo);
      form.set(`${pre}Email`, d.email);

      form.set(`${pre}PurposeOfTrading`, d.purposeOfTrading);
      form.set(`${pre}Occupation`, d.occupation);
      form.set(`${pre}PersonInCharge`, d.personInCharge);
      form.set(`${pre}NatureOfBusiness`, d.natureOfBusiness);

      form.set(`${pre}MailingAdd`, d.mailingAdd);
      form.set(`${pre}PostalCode`, d.postalCode);

      form.set(`${pre}CountryCode`, d.countryCode);
      form.set(`${pre}CountryName`, d.countryName);

      form.set(`${pre}Gender`, d.gender);
      form.set(`${pre}Dob`, d.dob);

      // ✅ backend expects Nationality key
      form.set(`${pre}Nationality`, d.nationality);

      // Banking
      form.set(`${pre}Banker`, d.banker);
      form.set(`${pre}BankAcNo`, d.bankAcNo);
      form.set(`${pre}BankHolderName`, d.bankHolderName);
    });
  });

  // some backends duplicate these keys for 1..3
  [1, 2, 3].forEach((i) => {
    const t = all.Tenant[i as Index] || emptyPerson();
    form.set(`Tenant${i}Banker`, t.banker);
    form.set(`Tenant${i}BankAcNo`, t.bankAcNo);
    form.set(`Tenant${i}BankHolderName`, t.bankHolderName);
    form.set(`Tenant${i}PostalCode`, t.postalCode);
    form.set(`Tenant${i}Ssm`, t.ssm);
  });

  [1, 2, 3].forEach((i) => {
    const l = all.Landlord[i as Index] || emptyPerson();
    form.set(`Landlord${i}Banker`, l.banker);
    form.set(`Landlord${i}BankAcNo`, l.bankAcNo);
    form.set(`Landlord${i}BankHolderName`, l.bankHolderName);
    form.set(`Landlord${i}PostalCode`, l.postalCode);
    form.set(`Landlord${i}Ssm`, l.ssm);
  });

  return form;
}

/** =========================
 *  PersonCard
 *  ========================= */
function PersonCard({
  titleSide,
  idx,
  data,
  onOpen,
  owner,
  ownerDisplayName,
  canEdit,
  canToggleDetails,
  canAccess,
}: {
  titleSide: string;
  idx: Index;
  data: PersonData;
  onOpen: () => void;
  owner?: string;
  ownerDisplayName?: string;

  /** ✅ computed in parent */
  canEdit: boolean;
  canToggleDetails: boolean;
  canAccess: boolean;
}) {
  const [open, setOpen] = useState(false);

  const showValue = (v: string) => {
    if (canAccess) return v || "-";
    return "Restricted";
  };

  const ownerCode = String(owner ?? "").trim();

  return (
    <div className={card}>
      <div className={cardHeader}>
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-gray-600" />
          <h5 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <span>
              {titleSide} {idx}
            </span>

            {(ownerDisplayName || ownerCode) ? (
              <span className="text-xs font-medium text-gray-600">
                (Keyin By : {ownerDisplayName || "-"}
                {ownerCode ? ` (${ownerCode})` : ""})
              </span>
            ) : null}
          </h5>
        </div>

        <div className="flex items-center gap-2">
          {canEdit ? (
            <button
              type="button"
              onClick={onOpen}
              className="text-xs font-medium text-blue-700 hover:underline"
            >
              EDIT
            </button>
          ) : null}

          {canToggleDetails ? (
            <button
              type="button"
              onClick={() => setOpen((s) => !s)}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
              {open ? "Hide details" : "Show all details"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Basic info */}
      <div className="p-3 space-y-3">
        <div>
          <div className={label}>Name</div>
          <div className={value}>{data.name || "-"}</div>
        </div>

        <div className={gridRow}>
          <div>
            <div className={label}>Email</div>
            <div className={`${value} flex items-center gap-2`}>
              <Mail className="h-4 w-4 text-gray-500" />
              <span>{showValue(data.email)}</span>
            </div>
          </div>
          <div>
            <div className={label}>Phone Number</div>
            <div className={`${value} flex items-center gap-2`}>
              <Phone className="h-4 w-4 text-gray-500" />
              <span>{showValue(data.hpNo)}</span>
            </div>
          </div>
        </div>

        <div className={gridRow}>
          <div>
            <div className={label}>NRIC / Passport Number</div>
            <div className={value}>{showValue(data.id)}</div>
          </div>
          <div>
            <div className={label}>Mailing Address</div>
            <div className={value}>{showValue(data.mailingAdd)}</div>
          </div>
        </div>

        {open && canToggleDetails && (
          <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3 space-y-3">
            <div className={gridRow}>
              <div>
                <div className={label}>TIN #</div>
                <div className={value}>{showValue(data.tinNo)}</div>
              </div>
              <div>
                <div className={label}>SST #</div>
                <div className={value}>{showValue(data.sstNo)}</div>
              </div>
            </div>

            <div>
              <div className={label}>SSM #</div>
              <div className={value}>{showValue(data.ssm)}</div>
            </div>

            <div className={gridRow}>
              <div>
                <div className={label}>Gender</div>
                <div className={value}>{showValue(data.gender)}</div>
              </div>
              <div>
                <div className={label}>D.O.B.</div>
                <div className={value}>{showValue(data.dob)}</div>
              </div>
            </div>

            <div className={gridRow}>
              <div>
                <div className={label}>Purpose Of Trading</div>
                <div className={value}>{showValue(data.purposeOfTrading)}</div>
              </div>
              <div>
                <div className={label}>Occupation</div>
                <div className={value}>{showValue(data.occupation)}</div>
              </div>
            </div>

            <div className={gridRow}>
              <div>
                <div className={label}>Person In Charge</div>
                <div className={value}>{showValue(data.personInCharge)}</div>
              </div>
              <div>
                <div className={label}>Nature Of Business</div>
                <div className={value}>{showValue(data.natureOfBusiness)}</div>
              </div>
            </div>

            <div className={gridRow}>
              <div>
                <div className={label}>Country</div>
                <div className={value}>{showValue(data.nationality)}</div>
              </div>
              <div />
            </div>

            <div className="mt-3 rounded-md border border-gray-200 bg-white p-3 space-y-3">
              <div className="text-xs font-semibold tracking-wide text-gray-700">Banking Information</div>
              <div className={gridRow}>
                <div>
                  <div className={label}>Bank</div>
                  <div className={value}>{showValue(data.banker)}</div>
                </div>
                <div>
                  <div className={label}>Bank Account No</div>
                  <div className={value}>{showValue(data.bankAcNo)}</div>
                </div>
              </div>
              <div>
                <div className={label}>Account Holder Name</div>
                <div className={value}>{showValue(data.bankHolderName)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** =========================
 *  Main Section
 *  ========================= */
interface Props {
  application: RentalApplication;
  onRefresh?: () => Promise<void> | void;
}

const LandlordTenantForSalesSection: React.FC<Props> = ({ application, onRefresh }) => {
  // ✅ status rule for non-account user edit visibility
  const rawStatus = String((application as any)?.ApplicationStatus ?? "").trim().toUpperCase();
  const status = rawStatus.replace(/\s+/g, " ");
  const canEditByStatus =
    status === "ACTIVE" || status === "PENDING REVIEW" || status === "REJECTED";

  // ✅ login + account flag
  const loginUserName = String(localStorage.getItem("userName") ?? "").trim();
  const isAccountUser =
    String(localStorage.getItem("account") || "").trim().toUpperCase() === "Y";

  // ✅ keep owner check for details / restricted masking only
  const isOwner = (owner?: string) => {
    const o = String(owner ?? "").trim().toUpperCase();
    const u = String(loginUserName ?? "").trim().toUpperCase();

    if (o === "") return true;
    return u !== "" && o === u;
  };

  // ✅ NEW EDIT RULE
  // account = Y  -> always can edit
  // account = N  -> can edit only when status is ACTIVE / PENDING REVIEW / REJECTED
  const canEditSlot = (_slotOwner?: string) => {
    if (isAccountUser) return true;
    return canEditByStatus;
  };

  // ✅ keep existing detail visibility / restricted masking rule
  const canToggleDetails = (slotOwner?: string) => isAccountUser || isOwner(slotOwner);
  const canAccessData = (slotOwner?: string) => isAccountUser || isOwner(slotOwner);

  // Countries list
  const [countries, setCountries] = useState<{ CountryCode: string; CountryName: string }[]>([]);

  // ✅ popup state
  const [popup, setPopup] = useState<null | { side: Side; idx: Index }>(null);
  const openPopup = (side: Side, idx: Index) => setPopup({ side, idx });
  const closePopup = () => setPopup(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const form = new URLSearchParams();
        form.append("Sel", "Y");

        const res = await fetch(COUNTRY_GET_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
          body: form.toString(),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: CountryApiResp = await res.json();
        if (!alive) return;

        if (json.status === "success" && Array.isArray((json as any).data)) {
          const list = (json as any).data
            .map((r: any) => ({
              CountryCode: String(r?.CountryCode ?? "").trim(),
              CountryName: String(r?.CountryName ?? "").trim(),
            }))
            .filter((x: any) => x.CountryName !== "");

          list.sort((a: any, b: any) => a.CountryName.localeCompare(b.CountryName));
          setCountries(list);
        } else {
          setCountries([]);
        }
      } catch {
        setCountries([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // initial snapshot
  const initialAll = useMemo(() => {
    const app: any = application || {};
    return {
      Landlord: {
        1: readOne(app, "Landlord", 1),
        2: readOne(app, "Landlord", 2),
        3: readOne(app, "Landlord", 3),
        4: readOne(app, "Landlord", 4),
      },
      Tenant: {
        1: readOne(app, "Tenant", 1),
        2: readOne(app, "Tenant", 2),
        3: readOne(app, "Tenant", 3),
        4: readOne(app, "Tenant", 4),
      },
    } as Record<Side, Record<Index, PersonData>>;
  }, [application]);

  const [allData, setAllData] = useState(initialAll);
  const [msg, setMsg] = useState<null | { type: "ok" | "err"; text: string }>(null);

  useEffect(() => {
    setAllData(initialAll);
  }, [initialAll]);

  const applicationId = (application as any)?.ApplicationId ?? (application as any)?.applicationId ?? "";

  const [mainOpen, setMainOpen] = useState(false);

  useEffect(() => {
    const key = `lt-main-open-${applicationId || "global"}`;
    const saved = localStorage.getItem(key);
    if (saved != null) setMainOpen(saved === "1");
  }, [applicationId]);

  const toggleMain = () => {
    setMainOpen((v) => {
      const nv = !v;
      localStorage.setItem(`lt-main-open-${applicationId || "global"}`, nv ? "1" : "0");
      return nv;
    });
  };

  const saveOne = (side: Side, idx: Index) => async (updated: PersonData) => {
    const nextAll = {
      ...allData,
      [side]: { ...allData[side], [idx]: updated },
    } as Record<Side, Record<Index, PersonData>>;

    // update UI immediately
    setAllData(nextAll);

    try {
      setMsg(null);
      const form = buildPhpForm(applicationId, nextAll, 3, 3);

      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (json?.status === "success") {
        setMsg({ type: "ok", text: json?.data || "Saved." });
        await onRefresh?.();
      } else {
        throw new Error(json?.data || json?.message || "Save failed.");
      }
    } catch (e: any) {
      console.error("TenantLandlordUpdate error:", e);
      setMsg({ type: "err", text: e?.message || "Save failed." });
      throw e;
    }
  };

  // ✅ Only open popup if edit is allowed by NEW rule
  const canOpenPopup = (side: Side, idx: 1 | 2 | 3) => {
    const ownerKey = `${side}${idx}Owner`;
    const ownerVal = (application as any)?.[ownerKey];
    return canEditSlot(ownerVal);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
      <button
        type="button"
        onClick={toggleMain}
        aria-expanded={mainOpen}
        aria-controls="lt-main-panel"
        className="w-full bg-gray-400 text-white px-6 py-4 flex items-center justify-between hover:bg-gray-500"
      >
        <div className="flex items-center space-x-2">
          <UserCheck className="w-5 h-5" />
          <h2 className="text-lg font-semibold">VENDOR / BUYER</h2>
        </div>
        <ChevronDown className={`w-5 h-5 transition-transform ${mainOpen ? "rotate-180" : ""}`} />
      </button>

      <div
        id="lt-main-panel"
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          mainOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="p-6 bg-gray-50">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <PersonCard
                  titleSide="Vendor"
                  idx={1}
                  data={allData.Landlord[1]}
                  onOpen={() => {
                    if (canOpenPopup("Landlord", 1)) openPopup("Landlord", 1);
                  }}
                  owner={String((application as any)?.Landlord1Owner ?? "")}
                  ownerDisplayName={String((application as any)?.Landlord1OwnerDisplayName ?? "")}
                  canEdit={canEditSlot((application as any)?.Landlord1Owner)}
                  canToggleDetails={canToggleDetails((application as any)?.Landlord1Owner)}
                  canAccess={canAccessData((application as any)?.Landlord1Owner)}
                />

                <PersonCard
                  titleSide="Vendor"
                  idx={2}
                  data={allData.Landlord[2]}
                  onOpen={() => {
                    if (canOpenPopup("Landlord", 2)) openPopup("Landlord", 2);
                  }}
                  owner={String((application as any)?.Landlord2Owner ?? "")}
                  ownerDisplayName={String((application as any)?.Landlord2OwnerDisplayName ?? "")}
                  canEdit={canEditSlot((application as any)?.Landlord2Owner)}
                  canToggleDetails={canToggleDetails((application as any)?.Landlord2Owner)}
                  canAccess={canAccessData((application as any)?.Landlord2Owner)}
                />

                <PersonCard
                  titleSide="Vendor"
                  idx={3}
                  data={allData.Landlord[3]}
                  onOpen={() => {
                    if (canOpenPopup("Landlord", 3)) openPopup("Landlord", 3);
                  }}
                  owner={String((application as any)?.Landlord3Owner ?? "")}
                  ownerDisplayName={String((application as any)?.Landlord3OwnerDisplayName ?? "")}
                  canEdit={canEditSlot((application as any)?.Landlord3Owner)}
                  canToggleDetails={canToggleDetails((application as any)?.Landlord3Owner)}
                  canAccess={canAccessData((application as any)?.Landlord3Owner)}
                />
              </div>

              <div className="space-y-6">
                <PersonCard
                  titleSide="Buyer"
                  idx={1}
                  data={allData.Tenant[1]}
                  onOpen={() => {
                    if (canOpenPopup("Tenant", 1)) openPopup("Tenant", 1);
                  }}
                  owner={String((application as any)?.Tenant1Owner ?? "")}
                  ownerDisplayName={String((application as any)?.Tenant1OwnerDisplayName ?? "")}
                  canEdit={canEditSlot((application as any)?.Tenant1Owner)}
                  canToggleDetails={canToggleDetails((application as any)?.Tenant1Owner)}
                  canAccess={canAccessData((application as any)?.Tenant1Owner)}
                />

                <PersonCard
                  titleSide="Buyer"
                  idx={2}
                  data={allData.Tenant[2]}
                  onOpen={() => {
                    if (canOpenPopup("Tenant", 2)) openPopup("Tenant", 2);
                  }}
                  owner={String((application as any)?.Tenant2Owner ?? "")}
                  ownerDisplayName={String((application as any)?.Tenant2OwnerDisplayName ?? "")}
                  canEdit={canEditSlot((application as any)?.Tenant2Owner)}
                  canToggleDetails={canToggleDetails((application as any)?.Tenant2Owner)}
                  canAccess={canAccessData((application as any)?.Tenant2Owner)}
                />

                <PersonCard
                  titleSide="Buyer"
                  idx={3}
                  data={allData.Tenant[3]}
                  onOpen={() => {
                    if (canOpenPopup("Tenant", 3)) openPopup("Tenant", 3);
                  }}
                  owner={String((application as any)?.Tenant3Owner ?? "")}
                  ownerDisplayName={String((application as any)?.Tenant3OwnerDisplayName ?? "")}
                  canEdit={canEditSlot((application as any)?.Tenant3Owner)}
                  canToggleDetails={canToggleDetails((application as any)?.Tenant3Owner)}
                  canAccess={canAccessData((application as any)?.Tenant3Owner)}
                />
              </div>
            </div>

            {msg && (
              <div
                className={`mt-4 text-sm px-3 py-2 rounded ${
                  msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}
              >
                {msg.text}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ✅ Popup render */}
      {popup && (
        <TenantLandlordPopup
          open={true}
          side={popup.side}
          idx={popup.idx}
          applicationId={applicationId}
          allData={allData as any}
          countries={countries}
          canEdit={canEditSlot((application as any)?.[`${popup.side}${popup.idx}Owner`])}
          onClose={closePopup}
          onSaved={async (side: Side, idx: Index, updated: PersonData) => {
            setAllData((prev) => ({
              ...prev,
              [side]: { ...prev[side], [idx]: updated },
            }) as any);

            await saveOne(side, idx)(updated);
            closePopup();
          }}
        />
      )}
    </div>
  );
};

export default LandlordTenantForSalesSection;