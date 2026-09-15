import { API_ENDPOINTS_DEV_AWARE } from '../../config/apiConfig';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Building, Search, ChevronDown, RefreshCw } from 'lucide-react';
import RentalDetails from './RentalDetails';

/** DEV uses proxy (/api/php). PROD calls the real server. */

/** Endpoints */
const INSERT_ENDPOINT = API_ENDPOINTS_DEV_AWARE.INT_APPLICATION_INSERT;
const PROPERTY_TYPE_ENDPOINT = API_ENDPOINTS_DEV_AWARE.PROPERTY_TYPE_GET;
const PROJECT_GET_ENDPOINT = API_ENDPOINTS_DEV_AWARE.PROJECT_GET;

interface AddSalePurchaseProps {
  onBack: () => void;
  /** optional: parent can route to details after create */
  onCreated?: (applicationId: string) => void;
}

type AllPropertyTypeRow = {
  PropertyGroupId: number | string;
  PropertyGroupDesc: string;
  PropertyTypeId: number | string;
  PropertyTypeDesc: string;
};

type ProjectItem = {
  ProjectId: string;
  ProjectName: string;
};

/** ================= Penang Suburb List (Island + Mainland, flat) ================= */
const PENANG_SUBURBS: string[] = [
  // Penang Island
  'Georgetown',
  'Jelutong',
  'Perak Road',
  'Pulau Tikus',
  'Gelugor',
  'Greenlane',
  'Air Itam / Farlim / Paya Terubong',
  'Tanjung Tokong',
  'Tanjung Bungah',
  'Teluk Bahang',
  'Mount Erskine',
  'Pulau Tikus Fringe',
  'Batu Ferringhi',
  'Bayan Lepas',
  'Bayan Baru / Sungai Nibong / Sungai Dua',
  'Bukit Jambul',
  'Sungai Ara / Relau',
  'Bukit Gambir',
  'Teluk Kumbar',
  'Batu Maung',
  'Gertak Sanggul',
  'Permatang Damar Laut',
  'Balik Pulau',

  // Mainland
  'Kepala Batas',
  'Penaga',
  'Sungai Dua',
  'Tasek Gelugor',
  'Bukit Mertajam',
  'Permatang Pauh',
  'Bukit Tengah',
  'Juru',
  'Butterworth',
  'Perai',
  'Seberang Jaya',
  'Simpang Ampat',
  'Nibong Tebal',
  'Sungai Bakap / Valdor',
  'Jawi',
  'Batu Kawan (Bandar Cassia)',
  'Sungai Acheh',
  'Bukit Tambun',
];

/** ✅ Sorted list for Location dropdown (A-Z) */
const PENANG_SUBURBS_SORTED: string[] = [...PENANG_SUBURBS].sort((a, b) =>
  a.localeCompare(b, undefined, { sensitivity: 'base' })
);



/** Helpers to normalize */
const normalizeState = (s: string) => (s || '').trim().toUpperCase();
const isPenangState = (s: string) => normalizeState(s) === 'PENANG';

const AddSalePurchase: React.FC<AddSalePurchaseProps> = ({ onBack, onCreated }) => {
  
  const [createdId, setCreatedId] = useState<string | null>(null);

  
  const [propertyAddress, setPropertyAddress] = useState('');
  
  const [propertyState, setPropertyState] = useState<string>('Penang');
  const [propertyTown, setPropertyTown] = useState<string>('');
  const [postalCode, setPostalCode] = useState<string>('');

  const [propertyBuildUpArea, setPropertyBuildUpArea] = useState('');
  const [propertyLandArea, setPropertyLandArea] = useState('');

  const [propertyConditionUid, setPropertyConditionUid] = useState('');
  const [propertyTitleUid, setPropertyTitleUid] = useState('');

  const [renovated, setRenovated] = useState(false);


    
  const userName = (localStorage.getItem('userName') || '').trim();

  const [transType] = useState<'Sales'>('Sales');

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // --- property type data ---
  const [allPropertyTypes, setAllPropertyTypes] = useState<AllPropertyTypeRow[]>([]);
  const [loadingAllPropertyTypes, setLoadingAllPropertyTypes] = useState(false);

  // --- compact form state used in the Category/Type/Storey area ---
  const [formData, setFormData] = useState({
    category: '', // stores PropertyGroupDesc
    type: '', // stores PropertyTypeDesc
    storey: '100', // default N/A
  });

  // --- project data ---
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // ✅ NEW: project dropdown search UI state (keeps existing UI styling)
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState('');
  const projectWrapRef = useRef<HTMLDivElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);

  // ✅ NEW: refresh loading just for the icon (keeps existing UI)
  const [refreshingProjects, setRefreshingProjects] = useState(false);

  const handleInputChange = (key: keyof typeof formData, value: string) => {
    setFormData((prev) => {
      if (key === 'category') return { ...prev, category: value, type: '' }; // reset type on new category
      return { ...prev, [key]: value };
    });
  };

  // --- options ---
  const stateOptions = useMemo(
    () => [
      'Johor',
      'Kedah',
      'Kelantan',
      'Malacca',
      'Negeri Sembilan',
      'Pahang',
      'Penang',
      'Perak',
      'Perlis',
      'Sabah',
      'Sarawak',
      'Selangor',
      'Terengganu',
      'Kuala Lumpur',
      'Labuan',
      'Putrajaya',
    ],
    []
  );

  const conditionOptions = useMemo(
    () => [
      { id: 'Fully Furnished', label: 'Fully Furnished' },
      { id: 'Partially Furnished', label: 'Partially Furnished' },
      { id: 'Unfurnished', label: 'Unfurnished' },
    ],
    []
  );

  const titleOptions = useMemo(
    () => [
      { id: 'Freehold', label: 'Freehold' },
      { id: 'Leasehold', label: 'Leasehold' },
      { id: 'Malay Reserve', label: 'Malay Reserve' },
    ],
    []
  );

  // --- derived: distinct categories (group desc) ---
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    allPropertyTypes.forEach((r) => set.add(r.PropertyGroupDesc));
    return Array.from(set);
  }, [allPropertyTypes]);

  // --- derived: property types under the selected category ---
  const propertyTypes = useMemo(() => {
    if (!formData.category) return [];
    return allPropertyTypes
      .filter((r) => r.PropertyGroupDesc === formData.category)
      .map((r) => ({ id: r.PropertyTypeId, desc: r.PropertyTypeDesc }));
  }, [allPropertyTypes, formData.category]);

  // ✅ Extracted: fetchProjects so we can reuse for refresh icon
  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const fd = new FormData(); // no filters for now
      const response = await fetch(PROJECT_GET_ENDPOINT, {
        method: 'POST',
        body: fd,
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.status === 'success' && Array.isArray(result.data)) {
        const mapped: ProjectItem[] = result.data.map((row: any) => ({
          ProjectId: String(row.ProjectId ?? ''),
          ProjectName: String(row.ProjectName ?? ''),
        }));
        setProjects(mapped);
      } else if (result.status === 'no_data_found') {
        setProjects([]);
      } else {
        throw new Error(result.error || 'Failed to fetch projects');
      }
    } catch (err) {
      console.error('Fetch projects error:', err);
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  // --- load all property types + projects ---
  useEffect(() => {
    const fetchAllPropertyTypes = async () => {
      setLoadingAllPropertyTypes(true);
      try {
        const response = await fetch(PROPERTY_TYPE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: '', // No parameters needed for this endpoint
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        if (result.status === 'success' && Array.isArray(result.data)) {
          setAllPropertyTypes(result.data as AllPropertyTypeRow[]);
        } else {
          throw new Error(result.error || 'Failed to fetch all property types');
        }
      } catch (err) {
        console.error('Fetch all property types error:', err);
        setAllPropertyTypes([]);
      } finally {
        setLoadingAllPropertyTypes(false);
      }
    };

    fetchAllPropertyTypes();
    fetchProjects();
  }, []);

  // --- effect: keep Location (propertyTown) in sync with State ---
  useEffect(() => {
    if (isPenangState(propertyState)) {
      // For Penang, ensure propertyTown is either a valid suburb or empty placeholder (forces user selection)
      setPropertyTown((prev) => (PENANG_SUBURBS.includes(prev) ? prev : ''));
    } else {
      // Non-Penang: set to a fixed "-"
      setPropertyTown('-');
    }
  }, [propertyState]);

  // ✅ NEW: close project dropdown on outside click (no UI changes)
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!projectOpen) return;
      const el = projectWrapRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) {
        setProjectOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [projectOpen]);

  // ✅ NEW: focus search input when dropdown opens
  useEffect(() => {
    if (projectOpen) {
      window.setTimeout(() => projectInputRef.current?.focus(), 0);
    } else {
      setProjectQuery('');
    }
  }, [projectOpen]);

  // ✅ NEW: filtered projects list
  const filteredProjects = useMemo(() => {
    const q = projectQuery.trim().toLowerCase();
    if (!q) return projects;
    return (projects || []).filter((p) => {
      const name = String(p.ProjectName ?? '').toLowerCase();
      const id = String(p.ProjectId ?? '').toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [projects, projectQuery]);

  const selectedProjectName = useMemo(() => {
    return projects.find((p) => p.ProjectId === selectedProjectId)?.ProjectName || '';
  }, [projects, selectedProjectId]);

  // ✅ NEW: refresh click handler
  const handleRefreshProjects = async () => {
    if (refreshingProjects || loadingProjects) return;
    try {
      setRefreshingProjects(true);
      await fetchProjects();
    } finally {
      setRefreshingProjects(false);
    }
  };

  // --- Postal Code input guards ---
  const handlePostalChange = (v: string) => {
    const digitsOnly = v.replace(/\D/g, '').slice(0, 5); // Malaysia postcodes = 5 digits
    setPostalCode(digitsOnly);
  };

  const handlePostalKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (allowed.includes(e.key)) return;
    if (/^\d$/.test(e.key)) return; // allow 0-9
    e.preventDefault();
  };

  const handlePostalPaste: React.ClipboardEventHandler<HTMLInputElement> = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text') || '';
    handlePostalChange(text);
  };

  // -------------------- save handler --------------------
  const handleSave = async () => {
    setError(null);
    setNotice(null);

    if (!propertyAddress.trim()) {
      setError('Please enter Property Address.');
      return;
    }
    if (!propertyState.trim()) {
      setError('Please select Property State.');
      return;
    }
    // If Penang is selected, Location (dropdown) must be chosen
    if (isPenangState(propertyState) && !propertyTown) {
      setError('Please select a Location (suburb) for Penang.');
      return;
    }
    // Optional: ensure postal code is either empty or exactly 5 digits
    if (postalCode && postalCode.length !== 5) {
      setError('Postal Code must be 5 digits (e.g., 05000).');
      return;
    }
    // Project selection is compulsory
    if (!selectedProjectId) {
      setError('Please select a Project.');
      return;
    }

    // Map selected category/type (by description) to their IDs
    let propertyGroupId = '';
    let propertyTypeId = '';

    if (formData.category) {
      const groupRow = allPropertyTypes.find((r) => r.PropertyGroupDesc === formData.category);
      if (groupRow) propertyGroupId = String(groupRow.PropertyGroupId ?? '');
    }

    if (formData.type && formData.category) {
      const typeRow = allPropertyTypes.find(
        (r) => r.PropertyGroupDesc === formData.category && r.PropertyTypeDesc === formData.type
      );
      if (typeRow) propertyTypeId = String(typeRow.PropertyTypeId ?? '');
    }

    // Resolve selected project
    const selectedProject = projects.find((p) => p.ProjectId === selectedProjectId);

    try {
      setSaving(true);

      const form = new URLSearchParams();
      form.set('PropertyAddress', propertyAddress);
      form.set('PropertyTown', propertyTown);
      form.set('PropertyState', propertyState);
      form.set('PropertyPostalCode', postalCode || '');    
      form.set('PropertyGroupId', propertyGroupId);
      form.set('PropertyTypeId', propertyTypeId);
      form.set('PropertyBuildUpArea', propertyBuildUpArea || '');
      form.set('PropertyLandArea', propertyLandArea || '');
      form.set('PropertyConditionUid', propertyConditionUid || '');
      form.set('PropertyTitleUid', propertyTitleUid || '');
      //  const username = localStorage.getItem('userName');
      const rawUserName = localStorage.getItem('userName');
const safeUserName =
  rawUserName && rawUserName !== 'null' && rawUserName !== 'undefined'
    ? rawUserName.trim()
    : '';

form.set('UserName', safeUserName);

      
      form.set('TransType', transType);
      form.set('PropertyRenovated', renovated ? 'Y' : 'N');
      form.set('PropertyStoreyRowId', formData.storey);      
      form.set('ProjectId', selectedProjectId);
      form.set('ProjectName', selectedProject?.ProjectName || '');

      const res = await fetch(INSERT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText}${t ? ` — ${t}` : ''}`);
      }

      // { status: "success", data: [ { ApplicationId: <number> } ] }
      const json = await res.json().catch(() => null);
      const newId = String(json?.data?.[0]?.ApplicationId ?? '').trim();
      if (!json || json.status !== 'success' || !newId) {
        throw new Error(json?.error || 'Failed to create rental (no ApplicationId returned).');
      }

      setNotice(`New rental created (ApplicationId: ${newId}).`);

      if (onCreated) {
        onCreated(newId);
        return;
      }

      setCreatedId(newId);
    } catch (e: any) {
      setError(e?.message || 'Failed to create rental.');
    } finally {
      setSaving(false);
    }
  };

  // -------------------- after-create view --------------------
  if (createdId) {
    return <RentalDetails applicationId={createdId} onBack={() => setCreatedId(null)} />;
  }

  // -------------------- form UI --------------------
  const isPenang = isPenangState(propertyState);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            type="button"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Add Sale & Purchase Application
            </h1>
            <p className="text-gray-600">Fill in the property details below.</p>
          </div>
        </div>
      </div>

      {/* Property Section ONLY */}
      <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Building className="w-5 h-5 text-blue-600" />
          Property Details
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property Address
            </label>
            <input
              type="text"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
              maxLength={200} // adjust as you like
              placeholder="e.g. No. 1, Jalan Example 1, 47000 Damansara, Selangor"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* State */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <select
              value={propertyState}
              onChange={(e) => setPropertyState(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select state…</option>
              {stateOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Location (replaces Town/City) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            {isPenang ? (
              <select
                value={PENANG_SUBURBS.includes(propertyTown) ? propertyTown : ''}
                onChange={(e) => setPropertyTown(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="" disabled>
                  Select suburb
                </option>
                {PENANG_SUBURBS_SORTED.map((suburb) => (
  <option key={suburb} value={suburb}>
    {suburb}
  </option>
))}

              </select>
            ) : (
              <select
                value="-"
                onChange={(e) => setPropertyTown(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="-">-</option>
              </select>
            )}
          </div>

          {/* Postal Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
            <input
              type="text" // keep text to preserve leading zeros like "05000"
              inputMode="numeric"
              pattern="\d*"
              value={postalCode}
              onChange={(e) => handlePostalChange(e.target.value)}
              onKeyDown={handlePostalKeyDown}
              onPaste={handlePostalPaste}
              maxLength={5}
              placeholder="e.g. 05000"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <div>
              <select
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Category</option>
                {loadingAllPropertyTypes ? (
                  <option value="">Loading...</option>
                ) : (
                  categoryOptions.map((groupDesc) => (
                    <option key={groupDesc} value={groupDesc}>
                      {groupDesc}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Type + Storey in one row */}
          <div className="md:col-span-2 grid md:grid-cols-2 gap-5">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
                disabled={!formData.category || propertyTypes.length === 0}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {!formData.category || propertyTypes.length === 0 ? (
                  <option value="">Select a category first</option>
                ) : (
                  <>
                    <option value="">Select Type</option>
                    {propertyTypes.map((t) => (
                      <option key={String(t.id)} value={t.desc}>
                        {t.desc}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Storey */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Storey</label>
              <select
                value={formData.storey}
                onChange={(e) => handleInputChange('storey', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="100">N/A</option>
                <option value="101">1.0 sty</option>
                <option value="102">1.5 sty</option>
                <option value="103">2.0 sty</option>
                <option value="104">2.5 sty</option>
                <option value="105">3.0 sty</option>
                <option value="106">3.5 sty</option>
                <option value="107">4.0 sty</option>
                <option value="108">4.5 sty</option>
              </select>
            </div>
          </div>

          {/* Areas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Build-up Area (sqft)
            </label>
            <input
              type="text"
              value={propertyBuildUpArea}
              onChange={(e) => setPropertyBuildUpArea(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. 1200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Land Area (sqft)
            </label>
            <input
              type="text"
              value={propertyLandArea}
              onChange={(e) => setPropertyLandArea(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. 1800"
            />
          </div>

          {/* Condition / Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property Condition
            </label>
            <select
              value={propertyConditionUid}
              onChange={(e) => setPropertyConditionUid(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">—</option>
              {conditionOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <select
              value={propertyTitleUid}
              onChange={(e) => setPropertyTitleUid(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">—</option>
              {titleOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* ✅ UPDATED: Project label + refresh icon */}
          <div className="md:col-span-2" ref={projectWrapRef}>
            {/* ✅ UPDATED: Project label + refresh icon (no huge gap) */}
<div className="flex items-center gap-2 mb-1">
  <label className="block text-sm font-medium text-gray-700">Project</label>

  <button
    type="button"
    onClick={handleRefreshProjects}
    disabled={refreshingProjects || loadingProjects}
    className={`p-1 rounded hover:bg-gray-100 transition-colors ${
      refreshingProjects || loadingProjects ? 'opacity-50 cursor-not-allowed' : ''
    }`}
    title="Refresh projects"
  >
    <RefreshCw
      className={`w-4 h-4 text-gray-600 ${refreshingProjects ? 'animate-spin' : ''}`}
    />
  </button>
</div>


            {/* Trigger (keeps the same "select" look) */}
            <button
              type="button"
              onClick={() => setProjectOpen((v) => !v)}
              className="w-full border border-gray-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left flex items-center justify-between"
            > 
              <span className={selectedProjectId ? 'text-gray-900' : 'text-gray-400'}>
                {selectedProjectId ? selectedProjectName : 'Select Project…'}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>

            {/* Dropdown */}
            {projectOpen && (
              <div className="relative">
                <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  {/* Search box (matches screenshot style: icon + input) */}
                  <div className="p-3 border-b border-gray-100">
                    <div className="flex items-center gap-2 border border-gray-200 rounded-md px-3 py-2">
                      <Search className="w-4 h-4 text-gray-400" />
                      <input
                        ref={projectInputRef}
                        value={projectQuery}
                        onChange={(e) => setProjectQuery(e.target.value)}
                        placeholder="Type to filter projects..."
                        className="w-full outline-none text-sm"
                      />
                    </div>
                  </div>

                  {/* Options */}
                  <div className="max-h-64 overflow-auto">
                    {/* Please select row */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProjectId('');
                        setProjectOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-600 hover:bg-gray-50"
                    >
                      Please select
                    </button>

                    {loadingProjects ? (
                      <div className="px-4 py-3 text-sm text-gray-400">Loading projects…</div>
                    ) : filteredProjects.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-400">No projects found.</div>
                    ) : (
                      filteredProjects.map((p) => {
                        const active = p.ProjectId === selectedProjectId;
                        return (
                          <button
                            key={p.ProjectId}
                            type="button"
                            onClick={() => {
                              setSelectedProjectId(p.ProjectId);
                              setProjectOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${
                              active ? 'bg-blue-50' : ''
                            }`}
                          >
                            <span className="font-medium text-gray-900">{p.ProjectName}</span>
                            <span className="text-gray-400"> ({p.ProjectId})</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {loadingProjects && !projectOpen && (
              <p className="mt-1 text-xs text-gray-400">Loading projects…</p>
            )}
          </div> 

          {/* NEW: Renovated checkbox */}
          <div className="md:col-span-2 flex items-center gap-3 pt-2">
            <input
              id="renovated"
              type="checkbox"
              checked={renovated}
              onChange={(e) => setRenovated(e.target.checked)}
              className="h-4 w-4 border-gray-300 rounded"
            />
            <label htmlFor="renovated" className="text-sm text-gray-700 select-none">
              Tick if renovated
            </label>
          </div>
        </div>

        {error && (
          <div className="px-4 py-2 rounded bg-red-50 text-red-700 text-sm">{error}</div>
        )}
        {notice && (
          <div className="px-4 py-2 rounded bg-green-50 text-green-700 text-sm">{notice}</div>
        )}

        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors ${
              saving ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-700'
            }`}
            type="button"
          >
            {saving ? 'Saving…' : 'SAVE AS NEW S & P APPLICATION'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddSalePurchase;
