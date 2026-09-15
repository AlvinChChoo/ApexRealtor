import { API_ENDPOINTS } from '../../config/apiConfig';
// src/pages/staff/AdminDetails.tsx
import React, { useEffect, useState, ChangeEvent, useCallback } from 'react';
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Save,
  X,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
} from 'lucide-react';

const ENDPOINT_GET_EMP = API_ENDPOINTS.INT_EMP_GET;
const ENDPOINT_SET_EMP = API_ENDPOINTS.INT_EMP_SET;
const ENDPOINT_GET_DEPTS = API_ENDPOINTS.INT_DEPT_GET;
const ENDPOINT_RESET_PWD = API_ENDPOINTS.ADMIN_USER_PWD_SET;

interface AdminDetailsProps {
  userName: string;
  onBack: () => void;
}

type Employee = {
  UserName: string;
  Branch: string | null;
  Nric: string | null;
  NricName: string | null;
  DisplayName: string | null;
  LastLogin: string | null;
  Active: number | string | null;
  EmpType: string | null;
  Dept: string | null;
  OriRecruitDate: string | null;
  RecruitDate: string | null;
  Resign: number | string | null;
  ResignDate: string | null;
  MobilePhone: string | null;
  HousePhone: string | null;
  Email: string | null;
  Address: string | null;
  City: string | null;
  State: string | null;
  PostCode: string | null;
  Country: string | null;
  CompanyName: string | null;
  CompanyNo: string | null;
  CreatedOn: string | null;
  CreatedBy: string | null;
  PayoutDueAmt: number | string | null;
  BankName: string | null;
  BankAcc: string | null;
  BankInfoType: string | null;
  BusinessNoNew: string | null;
  BusinessNoOld: string | null;
  BusinessTin: string | null;
  BdsAc: string | null;
  Remarks: string | null;
  RenNo: string | null;
  RefererL4: string | null;
  RefererL3: string | null;
  RefererL2: string | null;
  RefererL1: string | null;
  RefererL1Percent: number | string | null;
  RefererL2Percent: number | string | null;
  RefererL3Percent: number | string | null;
  RefererL4Percent: number | string | null;
  PettyCashAmt: number | string | null;
  EmpGroups: string | null;
  IndividualPctg: number | string | null;
  NricAttName: string | null;
  SsmAttName: string | null;
};

type ApiSuccess<T> = { status: 'success'; data: T };
type ApiNoData = { status: 'no_data_found'; error?: string };
type ApiError = { status: 'error'; error?: string; detail?: any };
type ApiResp<T> = ApiSuccess<T> | ApiNoData | ApiError;

type DeptItem = {
  Branch: string;
  Dept: string;
  LeaderId: string;
  Desc: string;
  UpdatedOn: string;
  UpdatedBy: string;
  TotalMembers: string;
};

const rowWrap = 'mb-3 grid grid-cols-1 sm:grid-cols-3 sm:items-center gap-1 sm:gap-4';
const labelCls = 'text-slate-500 sm:col-span-1 sm:text-right sm:pr-3';
const fieldWrapCls = 'sm:col-span-2';
const controlCls =
  'w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400';

const COUNTRIES = [
  'Malaysia',
  'Singapore',
  'Thailand',
  'Indonesia',
  'Brunei',
  'Vietnam',
  'Philippines',
  'India',
  'China',
  'Australia',
  'New Zealand',
  'United Kingdom',
  'United States',
  'Canada',
].map((c) => ({ label: c, value: c }));

const EMP_TYPES = [
  { label: 'Full Time', value: 'Full Time' },
  { label: 'License Holder', value: 'License Holder' },
  { label: 'Part Time', value: 'Part Time' },
  { label: 'Staff', value: 'Staff' },
];

const BANK_INFO_TYPES = [
  { label: 'Individual', value: 'Individual' },
  { label: 'Business', value: 'Business' },
];

function Field({
  title,
  value,
  editing,
  name,
  onChange,
  placeholder,
  type = 'text',
}: {
  title: string;
  value: any;
  editing: boolean;
  name: keyof Employee;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  placeholder?: string;
  type?: 'text' | 'date' | 'email' | 'tel' | 'number';
}) {
  const isTextarea = /address|remarks/i.test(title);

  return (
    <div className={rowWrap}>
      <div className={labelCls}>{title}:</div>
      <div className={fieldWrapCls}>
        {!editing ? (
          <div className="text-slate-900 text-sm break-words">{value ?? '-'}</div>
        ) : isTextarea ? (
          <textarea
            name={name}
            className={controlCls}
            rows={2}
            value={value ?? ''}
            onChange={onChange}
            placeholder={placeholder}
          />
        ) : (
          <input
            type={type}
            name={name}
            className={controlCls}
            value={value ?? ''}
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
  editing,
  name,
  onChange,
  options,
  placeholder,
}: {
  title: string;
  value: any;
  editing: boolean;
  name: keyof Employee;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}) {
  const renderDisplay = () => {
    if (name === 'Active') {
      if (value === '1' || value === 1) return 'Active';
      if (value === '0' || value === 0) return 'Resigned';
      return '-';
    }
    return value ?? '-';
  };

  return (
    <div className={rowWrap}>
      <div className={labelCls}>{title}:</div>
      <div className={fieldWrapCls}>
        {!editing ? (
          <div className="text-slate-900 text-sm break-words">{renderDisplay()}</div>
        ) : (
          <select name={name} className={controlCls} value={value ?? ''} onChange={onChange}>
            <option value="">{placeholder ?? 'Select...'}</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

const AdminDetails: React.FC<AdminDetailsProps> = ({ userName, onBack }) => {
  const [row, setRow] = useState<Employee | null>(null);
  const [form, setForm] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);

  const [deptOpts, setDeptOpts] = useState<{ label: string; value: string }[]>([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [deptErr, setDeptErr] = useState<string>('');

  const [empOpts, setEmpOpts] = useState<{ label: string; value: string }[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empErr, setEmpErr] = useState<string>('');

  const [snackbar, setSnackbar] = useState<{ open: boolean; msg: string; type: 'success' | 'error' }>({
    open: false,
    msg: '',
    type: 'success',
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [editMode, setEditMode] = useState(false);

  const [showPwdModal, setShowPwdModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  const isAccountUser = typeof window !== 'undefined' && localStorage.getItem('account') === 'Y';

  const toStatusValue = (v: unknown): '1' | '0' | '' => {
    const s = String(v ?? '').trim().toLowerCase();
    if (s === '1' || s === 'active' || s === 'yes' || s === 'y' || s === 'true') return '1';
    if (s === '0' || s === 'resigned' || s === 'inactive' || s === 'no' || s === 'n' || s === 'false') return '0';
    return '';
  };

  const showSnackbar = useCallback((msg: string, type: 'success' | 'error') => {
    setSnackbar({ open: true, msg, type });
    window.clearTimeout((showSnackbar as any)._t);
    (showSnackbar as any)._t = window.setTimeout(() => {
      setSnackbar((s) => ({ ...s, open: false }));
    }, 2800);
  }, []);

  const loadDepts = useCallback(async () => {
    setDeptLoading(true);
    setDeptErr('');
    try {
      const body = new URLSearchParams();
      body.set('Dept', '');
      body.set('SearchKeyword', '');

      const res = await fetch(ENDPOINT_GET_DEPTS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body.toString(),
      });

      const json: ApiResp<DeptItem[]> = await res.json();

      if (json.status === 'success') {
        const options = json.data.map((d) => ({ label: d.Desc || d.Dept, value: d.Dept }));
        setDeptOpts(options);
      } else if (json.status === 'no_data_found') {
        setDeptOpts([]);
        setDeptErr(json.error || 'No team data found.');
      } else {
        setDeptOpts([]);
        setDeptErr(json.error || 'Failed to load teams.');
      }
    } catch (e: any) {
      setDeptErr(e?.message || 'Network error while loading teams.');
      setDeptOpts([]);
    } finally {
      setDeptLoading(false);
    }
  }, []);

  const loadEmpOptions = useCallback(async () => {
    setEmpLoading(true);
    setEmpErr('');
    try {
      const body = new FormData();
      body.append('User_Name', '');

      const res = await fetch(ENDPOINT_GET_EMP, {
        method: 'POST',
        body,
        cache: 'no-store',
      });

      const json: ApiResp<Employee[]> = await res.json();

      if (json.status === 'success') {
        const rows = Array.isArray(json.data) ? json.data : [];
        const options = rows
          .filter((r) => (r?.UserName ?? '').trim() !== '')
          .map((r) => ({
            label: r.DisplayName && r.DisplayName.trim() !== '' ? r.DisplayName : r.UserName,
            value: r.UserName,
          }))
          .sort((a, b) => a.label.localeCompare(b.label));

        setEmpOpts(options);
      } else if (json.status === 'no_data_found') {
        setEmpOpts([]);
        setEmpErr(json.error || 'No employee data found.');
      } else {
        setEmpOpts([]);
        setEmpErr(json.error || 'Failed to load employee list.');
      }
    } catch (e: any) {
      setEmpErr(e?.message || 'Network error while loading employee list.');
      setEmpOpts([]);
    } finally {
      setEmpLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      setErr('');
      try {
        const body = new FormData();
        body.append('User_Name', String(userName).trim());

        const res = await fetch(ENDPOINT_GET_EMP, {
          method: 'POST',
          body,
          cache: 'no-store',
        });

        const json: ApiResp<Employee[]> = await res.json();

        if (json.status === 'success') {
          const item = json.data?.[0] ?? null;
          if (item) {
            if (!item.Country || item.Country.trim() === '') item.Country = 'Malaysia';
            if (!item.BankInfoType || item.BankInfoType.trim() === '') item.BankInfoType = 'Individual';
          }
          setRow(item);
          setForm(item ? { ...item } : null);
          if (!item) setErr('No data found.');
        } else if (json.status === 'no_data_found') {
          setRow(null);
          setForm(null);
          setErr(json.error || 'No data found.');
        } else {
          setRow(null);
          setForm(null);
          setErr(json.error || 'Server error.');
        }
      } catch (e: any) {
        setRow(null);
        setForm(null);
        setErr(e?.message || 'Network error.');
      } finally {
        setLoading(false);
      }
    };

    if (userName) {
      loadDepts();
      loadEmpOptions();
      fetchDetails();
    }
  }, [userName, loadDepts, loadEmpOptions]);

  type InputEl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

  const onInputChange = (e: ChangeEvent<InputEl>) => {
    const { name, value } = e.target;
    setForm((prev) => (prev ? ({ ...prev, [name]: value } as Employee) : prev));
  };

  const isValid2dp = (s: string) => /^\d*(\.\d{0,2})?$/.test(s);

  const setPercent = useCallback((key: keyof Employee, raw: string) => {
    const v = raw.trim();
    if (v === '' || isValid2dp(v)) {
      setForm((prev) => (prev ? ({ ...prev, [key]: v } as Employee) : prev));
    }
  }, []);

  const fmt2 = useCallback((v: any) => {
    const s = String(v ?? '').trim();
    if (s === '') return '-';
    const n = Number(s);
    if (!Number.isFinite(n)) return s;
    return n.toFixed(2);
  }, []);

  useEffect(() => {
    if (!editMode || !form) return;
    const bt = (form.BankInfoType ?? 'Individual').trim();
    if (bt !== 'Business') {
      setForm((prev) =>
        prev
          ? ({
              ...prev,
              BankInfoType: 'Individual',
              BusinessNoNew: '',
              BusinessNoOld: '',
              BusinessTin: '',
            } as Employee)
          : prev
      );
    }
  }, [editMode, form?.BankInfoType]);

  const onEdit = () => {
    if (!row) return;
    setForm({ ...row });
    setEditMode(true);
    setErr('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onCancel = () => {
    setForm(row ? { ...row } : null);
    setEditMode(false);
    setErr('');
  };

  const onUpdate = async () => {
    if (!form) return;

    setSaving(true);
    setErr('');

    try {
      const body = new URLSearchParams();

      body.set('User_Name', form.UserName);

      (Object.keys(form) as (keyof Employee)[]).forEach((k) => {
        const v = form[k];
        body.set(k.toString(), v === null || v === undefined ? '' : String(v));
      });

      const activeNorm = toStatusValue(form.Active) || '';
      body.set('Active', activeNorm);

      body.set('BankInfoType', form.BankInfoType ?? '');
      body.set('BusinessNoNew', form.BusinessNoNew ?? '');
      body.set('BusinessNoOld', form.BusinessNoOld ?? '');
      body.set('BusinessTin', form.BusinessTin ?? '');

      body.set('RefererL1', form.RefererL1 ?? '');
      body.set('RefererL2', form.RefererL2 ?? '');
      body.set('RefererL3', form.RefererL3 ?? '');
      body.set('RefererL4', form.RefererL4 ?? '');
      body.set('Referer_L1', form.RefererL1 ?? '');
      body.set('Referer_L2', form.RefererL2 ?? '');
      body.set('Referer_L3', form.RefererL3 ?? '');
      body.set('Referer_L4', form.RefererL4 ?? '');

      const p1 = (form.RefererL1Percent ?? '').toString();
      const p2 = (form.RefererL2Percent ?? '').toString();
      const p3 = (form.RefererL3Percent ?? '').toString();
      const p4 = (form.RefererL4Percent ?? '').toString();

      body.set('RefererL1Percent', p1);
      body.set('RefererL2Percent', p2);
      body.set('RefererL3Percent', p3);
      body.set('RefererL4Percent', p4);

      body.set('Referer_L1_Percent', p1);
      body.set('Referer_L2_Percent', p2);
      body.set('Referer_L3_Percent', p3);
      body.set('Referer_L4_Percent', p4);

      const res = await fetch(ENDPOINT_SET_EMP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body.toString(),
      });

      const json = await res.json();

      if (json?.status === 'success') {
        setRow({ ...form });
        setEditMode(false);
        showSnackbar('Details updated successfully.', 'success');
      } else {
        const msg = json?.error || 'Update failed.';
        setErr(msg);
        showSnackbar(msg, 'error');
      }
    } catch (e: any) {
      const msg = e?.message || 'Network error during update.';
      setErr(msg);
      showSnackbar(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const onOpenChangePassword = () => {
    setNewPassword('');
    setShowPwdModal(true);
  };

  const onCloseChangePassword = () => {
    if (pwdSaving) return;
    setShowPwdModal(false);
    setNewPassword('');
  };

  const onResetPassword = async () => {
  const pwd = newPassword.trim();

  if (!pwd) {
    alert('Please enter new password.');
    return;
  }

  setPwdSaving(true);

  try {
    const body = new URLSearchParams();
    body.set('UserName', userName);
    body.set('Psw', pwd);

    const res = await fetch(ENDPOINT_RESET_PWD, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: body.toString(),
    });

    const json = await res.json();
    console.log('AdminUserPwdSet.php response = ', json);

    if (json?.success === true) {
      setShowPwdModal(false);
      setNewPassword('');
      alert(json?.message || 'Password updated successfully.');
    } else {
      alert(json?.message || json?.error || 'Password update failed.');
    }
  } catch (e: any) {
    alert(e?.message || 'Network error during password update.');
  } finally {
    setPwdSaving(false);
  }
};

  const wrapperCls = `rounded-lg border p-4 ${editMode ? 'bg-amber-50/30 border-amber-200' : ''}`;
  const dateVal = (v: string | null | undefined) => (v && v.length >= 10 ? v.substring(0, 10) : '');

  const openDoc = (url?: string | null) => {
    const u = String(url ?? '').trim();
    if (!u || u === '-') {
      showSnackbar('No file uploaded.', 'error');
      return;
    }
    window.open(u, '_blank', 'noopener,noreferrer');
  };

  const isBusiness = (form?.BankInfoType ?? 'Individual') === 'Business';

  const getEmpLabel = useCallback(
    (user: string | null | undefined) => {
      const u = String(user ?? '').trim();
      if (!u) return '-';
      const found = empOpts.find((x) => x.value === u);
      return found?.label ?? u;
    },
    [empOpts]
  );

  const renderReferralHeader = useCallback(
    () => (
      <div className={rowWrap}>
        <div className={`${labelCls} font-semibold text-slate-700`}>Title</div>
        <div className={fieldWrapCls}>
          <div className="grid grid-cols-4 gap-3 items-center">
            <div className="col-span-3 font-semibold text-slate-700">Ren</div>
            <div className="col-span-1 text-right font-semibold text-slate-700">Percentage</div>
          </div>
        </div>
      </div>
    ),
    []
  );

  const renderReferralRow = useCallback(
    ({
      title,
      userKey,
      pctKey,
    }: {
      title: string;
      userKey: keyof Employee;
      pctKey: keyof Employee;
    }) => {
      const selectedUser = String((form as any)?.[userKey] ?? '');
      const pctVal = String((form as any)?.[pctKey] ?? '');

      return (
        <div className={rowWrap}>
          <div className={labelCls}>{title}:</div>

          <div className={fieldWrapCls}>
            {!editMode ? (
              <div className="grid grid-cols-4 gap-3 items-center">
                <div className="col-span-3 text-slate-900 text-sm break-words">{getEmpLabel(selectedUser)}</div>
                <div className="col-span-1 text-right text-slate-900 text-sm">{fmt2(pctVal)}</div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3 items-center">
                <select
                  name={userKey as string}
                  className={`${controlCls} col-span-3`}
                  value={selectedUser}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((prev) =>
                      prev
                        ? ({
                            ...prev,
                            [userKey]: v,
                            [pctKey]: String(v ?? '').trim() !== '' ? '0.00' : '',
                          } as Employee)
                        : prev
                    );
                  }}
                >
                  <option value="">{empLoading ? 'Loading...' : '--Select--'}</option>
                  {empOpts.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <input
                  className={`${controlCls} col-span-1 text-right`}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={pctVal}
                  onChange={(e) => setPercent(pctKey, e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      );
    },
    [editMode, empLoading, empOpts, form, getEmpLabel, setPercent, fmt2]
  );

  const TopButtons = () => (
    <div className="flex items-center gap-2 flex-wrap">
      {!editMode ? (
        <>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-50"
            title="Edit"
            disabled={!row || loading}
          >
            <Pencil size={16} /> EDIT
          </button>

          {isAccountUser && (
            <button
              type="button"
              onClick={onOpenChangePassword}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-50"
              title="Change Password"
              disabled={!row || loading}
            >
              <KeyRound size={16} /> Change Password
            </button>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onUpdate}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white bg-green-600 hover:bg-green-700 ${
              saving ? 'opacity-60 cursor-not-allowed' : ''
            }`}
            title="Update"
            disabled={saving}
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            {saving ? 'Saving…' : 'UPDATE'}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-50"
            title="Cancel"
            disabled={saving}
          >
            <X size={16} /> CANCEL
          </button>
        </>
      )}

      {!editMode && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-50"
          title="Back"
        >
          <ArrowLeft size={16} /> Back
        </button>
      )}
    </div>
  );

  const EditToolbar = () =>
    editMode ? (
      <div className="sticky top-0 z-30 mb-4 -mx-6 px-6 py-3 bg-amber-50/80 backdrop-blur border-b border-amber-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-900">
            <Edit3 size={16} />
            <span className="font-medium">Editing Admin Details</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">{userName}</span>
          </div>
          <TopButtons />
        </div>
      </div>
    ) : null;

  return (
    <div className="p-6">
      <EditToolbar />

      {!editMode && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-800">Admin Details</h2>
            <p className="text-sm text-slate-500">User: {userName}</p>
          </div>
          <TopButtons />
        </div>
      )}

      {(loading || deptLoading || empLoading) && (
        <div className="text-slate-600 flex items-center gap-2">
          <Loader2 className="animate-spin" size={16} /> Loading…
        </div>
      )}

      {(err || deptErr || empErr) && !(loading || deptLoading || empLoading) && (
        <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {err || deptErr || empErr}
        </div>
      )}

      {!loading && !deptLoading && row && form && (
        <div className={wrapperCls}>
          <Field title="User Name" value={form.UserName} editing={false} name="UserName" onChange={onInputChange} />
          <Field title="Nric No" value={form.Nric} editing={editMode} name="Nric" onChange={onInputChange} />
          <Field title="Display Name" value={form.DisplayName} editing={editMode} name="DisplayName" onChange={onInputChange} />
          <Field title="IC Name" value={form.NricName} editing={editMode} name="NricName" onChange={onInputChange} />
          <Field title="Ren No" value={form.RenNo} editing={editMode} name="RenNo" onChange={onInputChange} />

          <SelectField
            title="Team"
            value={form.Dept ?? ''}
            editing={editMode}
            name="Dept"
            onChange={onInputChange as React.ChangeEventHandler<HTMLSelectElement>}
            options={deptOpts}
            placeholder="Select Team"
          />

          <SelectField
            title="Employment Type"
            value={form.EmpType}
            editing={editMode}
            name="EmpType"
            onChange={onInputChange as React.ChangeEventHandler<HTMLSelectElement>}
            options={EMP_TYPES}
            placeholder="Select Employment Type"
          />

          <SelectField
            title="Bank Info Type"
            value={form.BankInfoType ?? 'Individual'}
            editing={editMode}
            name="BankInfoType"
            onChange={onInputChange as React.ChangeEventHandler<HTMLSelectElement>}
            options={BANK_INFO_TYPES}
            placeholder="Select Bank Info Type"
          />

          <Field title="Bank Name" value={form.BankName} editing={editMode} name="BankName" onChange={onInputChange} />
          <Field title="Bank Account" value={form.BankAcc} editing={editMode} name="BankAcc" onChange={onInputChange} />

          {isBusiness && (
            <>
              <Field
                title="Business No (New)"
                value={form.BusinessNoNew}
                editing={editMode}
                name="BusinessNoNew"
                onChange={onInputChange}
              />
              <Field
                title="Business No (Old)"
                value={form.BusinessNoOld}
                editing={editMode}
                name="BusinessNoOld"
                onChange={onInputChange}
              />
              <Field
                title="Business TIN"
                value={form.BusinessTin}
                editing={editMode}
                name="BusinessTin"
                onChange={onInputChange}
              />
            </>
          )}

          <Field
            title="Join Date"
            value={dateVal(form.RecruitDate)}
            editing={editMode}
            name="RecruitDate"
            onChange={onInputChange}
            type="date"
          />
          <Field
            title="Resign Date"
            value={dateVal(form.ResignDate)}
            editing={editMode}
            name="ResignDate"
            onChange={onInputChange}
            type="date"
          />

          <SelectField
            title="Status"
            value={toStatusValue(form.Active)}
            editing={editMode}
            name="Active"
            onChange={(e) => {
              const dbVal = e.target.value;
              setForm((prev) => (prev ? ({ ...prev, Active: dbVal } as Employee) : prev));
            }}
            options={[
              { label: 'Active', value: '1' },
              { label: 'Resigned', value: '0' },
            ]}
            placeholder="Select Status"
          />

          <Field title="Mobile No" value={form.MobilePhone} editing={editMode} name="MobilePhone" onChange={onInputChange} />
          <Field title="Email" value={form.Email} editing={editMode} name="Email" onChange={onInputChange} />
          <Field title="Address" value={form.Address} editing={editMode} name="Address" onChange={onInputChange} />
          <Field title="City" value={form.City} editing={editMode} name="City" onChange={onInputChange} />
          <Field title="State" value={form.State} editing={editMode} name="State" onChange={onInputChange} />
          <Field title="Postcode" value={form.PostCode} editing={editMode} name="PostCode" onChange={onInputChange} />

          <SelectField
            title="Country"
            value={form.Country ?? 'Malaysia'}
            editing={editMode}
            name="Country"
            onChange={onInputChange as React.ChangeEventHandler<HTMLSelectElement>}
            options={COUNTRIES}
            placeholder="Select Country"
          />

          <Field title="Company Name" value={form.CompanyName} editing={editMode} name="CompanyName" onChange={onInputChange} />
          <Field title="Company No" value={form.CompanyNo} editing={editMode} name="CompanyNo" onChange={onInputChange} />

          {renderReferralHeader()}
          {renderReferralRow({ title: 'Referral 1', userKey: 'RefererL1', pctKey: 'RefererL1Percent' })}
          {renderReferralRow({ title: 'Referral 2', userKey: 'RefererL2', pctKey: 'RefererL2Percent' })}
          {renderReferralRow({ title: 'Referral 3', userKey: 'RefererL3', pctKey: 'RefererL3Percent' })}
          {renderReferralRow({ title: 'Referral 4', userKey: 'RefererL4', pctKey: 'RefererL4Percent' })}

          {(() => {
            const hasDoc = (u?: string | null) => {
              const s = String(u ?? '').trim();
              return !!s && s !== '-';
            };

            const nricOk = hasDoc(form.NricAttName);
            const ssmOk = hasDoc(form.SsmAttName);

            const btnBase =
              'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition';
            const btnGreen = 'bg-green-600 text-white border-green-600 hover:bg-green-700';
            const btnGrey = 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed';

            return (
              <div className={rowWrap}>
                <div className={labelCls}>Attachments:</div>

                <div className={`${fieldWrapCls} flex flex-col sm:flex-row gap-2`}>
                  <button
                    type="button"
                    onClick={() => openDoc(form.NricAttName)}
                    disabled={!nricOk}
                    className={`${btnBase} ${nricOk ? btnGreen : btnGrey}`}
                    title={nricOk ? 'Open NRIC' : 'No NRIC uploaded'}
                  >
                    View NRIC
                  </button>

                  {isBusiness && (
                    <button
                      type="button"
                      onClick={() => openDoc(form.SsmAttName)}
                      disabled={!ssmOk}
                      className={`${btnBase} ${ssmOk ? btnGreen : btnGrey}`}
                      title={ssmOk ? 'Open SSM' : 'No SSM uploaded'}
                    >
                      View SSM
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {row && (
        <div className="mt-6 flex justify-end">
          <TopButtons />
        </div>
      )}

      {showPwdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Change Password</h3>
                <p className="text-sm text-slate-500">User: {userName}</p>
              </div>
              <button
                type="button"
                onClick={onCloseChangePassword}
                className="inline-flex items-center justify-center rounded-md p-2 hover:bg-slate-100"
                disabled={pwdSaving}
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">New Password</label>
              <input
                type="text"
                className={controlCls}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !pwdSaving) {
                    e.preventDefault();
                    onResetPassword();
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onCloseChangePassword}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-50"
                disabled={pwdSaving}
              >
                <X size={16} /> Cancel
              </button>

              <button
                type="button"
                onClick={onResetPassword}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white bg-green-600 hover:bg-green-700 ${
                  pwdSaving ? 'opacity-60 cursor-not-allowed' : ''
                }`}
                disabled={pwdSaving}
              >
                {pwdSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                {pwdSaving ? 'Saving…' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        aria-live="polite"
        className={`fixed left-1/2 -translate-x-1/2 bottom-6 z-50 transition-all ${
          snackbar.open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        <div
          className={`flex items-center gap-2 rounded-lg px-4 py-2 shadow-md ${
            snackbar.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {snackbar.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span className="text-sm font-medium">{snackbar.msg}</span>
        </div>
      </div>
    </div>
  );
};

export default AdminDetails;