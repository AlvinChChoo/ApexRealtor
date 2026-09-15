import { API_ENDPOINTS_DEV_AWARE } from '../../config/apiConfig';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Building, RefreshCw } from 'lucide-react';
import RentalDetails from './RentalDetails';
import SalesPurchaseDetails from './SalePurchaseDetails';

/** DEV uses proxy (/api/php). PROD calls the real server. */

/** Endpoints */
const INSERT_ENDPOINT = API_ENDPOINTS_DEV_AWARE.INT_APPLICATION_INSERT;
const PROPERTY_TYPE_ENDPOINT = API_ENDPOINTS_DEV_AWARE.PROPERTY_TYPE_GET;
const PROJECT_GET_ENDPOINT = API_ENDPOINTS_DEV_AWARE.PROJECT_GET;
const LOCATION_GET_ENDPOINT = API_ENDPOINTS_DEV_AWARE.LOCATION_GET;

interface AddRentalProps {
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

type LocationItem = {
  StateName: string;
  Location: string;
};

/** Helpers to normalize */
const normalizeState = (s: string) => (s || '').trim().toUpperCase();
const isPenangState = (s: string) => normalizeState(s) === 'PENANG';

const AddRental: React.FC<AddRentalProps> = ({ onBack, onCreated }) => {
  // If we already created one, render RentalDetails directly.
  const [createdId, setCreatedId] = useState<string | null>(null);

  // -------------------- form fields (Property only) --------------------
  const [propertyAddress, setPropertyAddress] = useState('');
  const [propertyState, setPropertyState] = useState<string>('Penang');
  const [propertyTown, setPropertyTown] = useState<string>('');

  // NEW: Postal Code (string to preserve leading zeros, e.g., "05000")
  const [postalCode, setPostalCode] = useState<string>('');

  const [propertyBuildUpArea, setPropertyBuildUpArea] = useState('');
  const [propertyLandArea, setPropertyLandArea] = useState('');

  const [propertyConditionUid, setPropertyConditionUid] = useState('');
  const [propertyTitleUid, setPropertyTitleUid] = useState('');

  const [renovated, setRenovated] = useState(false);

  // fixed fields for this flow
  const userName = (localStorage.getItem('userName') || '').trim();
  const [transType, setTransType] = useState<'Rental' | 'RMS' | 'Sales' | 'Project'>('Rental');

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

  // --- location data ---
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [penangLocations, setPenangLocations] = useState<LocationItem[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  // ✅ project searchable dropdown state
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState('');
  const projectWrapRef = useRef<HTMLDivElement | null>(null);
  const projectSearchRef = useRef<HTMLInputElement | null>(null);

  const handleInputChange = (key: keyof typeof formData, value: string) => {
    setFormData((prev) => {
      if (key === 'category') return { ...prev, category: value, type: '' };
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

  // ✅ sorted projects A→Z
  const projectsSorted = useMemo(() => {
    return [...projects].sort((a, b) =>
      String(a.ProjectName || '').localeCompare(String(b.ProjectName || ''), undefined, {
        sensitivity: 'base',
      })
    );
  }, [projects]);

  // ✅ filter projects by query
  const projectsFiltered = useMemo(() => {
    const q = projectQuery.trim().toLowerCase();
    if (!q) return projectsSorted;
    return projectsSorted.filter((p) => String(p.ProjectName || '').toLowerCase().includes(q));
  }, [projectsSorted, projectQuery]);

  // --- load all property types ---
  useEffect(() => {
    const fetchAllPropertyTypes = async () => {
      setLoadingAllPropertyTypes(true);
      try {
        const response = await fetch(PROPERTY_TYPE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: '',
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
  }, []);

  // --- load projects ---
  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const formDataObj = new FormData();
      const response = await fetch(PROJECT_GET_ENDPOINT, {
        method: 'POST',
        body: formDataObj,
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

  useEffect(() => {
    loadProjects();
  }, []);

  // --- load Penang locations once from API ---
  const fetchPenangLocationsOnce = async () => {
    setLoadingLocations(true);

    try {
      const body = new URLSearchParams();
      body.append('StateName', 'Penang');

      const response = await fetch(LOCATION_GET_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.status === 'success' && Array.isArray(result.data)) {
        const rows: LocationItem[] = result.data.map((row: any) => ({
          StateName: String(row.StateName ?? ''),
          Location: String(row.Location ?? ''),
        }));

        setPenangLocations(rows);

        if (isPenangState(propertyState)) {
          setLocations(rows);

          setPropertyTown((prev) => {
            const currentLocation = String(prev || '').trim();
            const exists = rows.some(
              (x) => String(x.Location).trim().toLowerCase() === currentLocation.toLowerCase()
            );
            return exists ? prev : '';
          });
        } else {
          setLocations([]);
        }
      } else {
        setPenangLocations([]);
        setLocations([]);
        setPropertyTown('');
      }
    } catch (error) {
      console.error('Fetch locations error:', error);
      setPenangLocations([]);
      setLocations([]);
      setPropertyTown('');
    } finally {
      setLoadingLocations(false);
    }
  };

  useEffect(() => {
    fetchPenangLocationsOnce();
  }, []);

  // --- keep visible location list in sync with selected state ---
  useEffect(() => {
    if (isPenangState(propertyState)) {
      setLocations(penangLocations);

      setPropertyTown((prev) => {
        const currentLocation = String(prev || '').trim();
        const exists = penangLocations.some(
          (x) => String(x.Location).trim().toLowerCase() === currentLocation.toLowerCase()
        );
        return exists ? prev : '';
      });
    } else {
      setLocations([]);
      setPropertyTown('');
    }
  }, [propertyState, penangLocations]);

  // ✅ close project dropdown on outside click + ESC
  useEffect(() => {
    if (!isProjectOpen) return;

    const onDocMouseDown = (e: MouseEvent) => {
      const wrap = projectWrapRef.current;
      if (!wrap) return;
      if (!wrap.contains(e.target as Node)) {
        setIsProjectOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsProjectOpen(false);
    };

    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isProjectOpen]);

  // ✅ autofocus the search input when opening dropdown
  useEffect(() => {
    if (isProjectOpen) {
      setTimeout(() => projectSearchRef.current?.focus(), 0);
    }
  }, [isProjectOpen]);

  // --- Postal Code input guards ---
  const handlePostalChange = (v: string) => {
    const digitsOnly = v.replace(/\D/g, '').slice(0, 5);
    setPostalCode(digitsOnly);
  };

  const handlePostalKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (allowed.includes(e.key)) return;
    if (/^\d$/.test(e.key)) return;
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

    if (isPenangState(propertyState) && !propertyTown) {
      setError('Please select a Location for Penang.');
      return;
    }

    if (postalCode && postalCode.length !== 5) {
      setError('Postal Code must be 5 digits (e.g. 05000).');
      return;
    }

    if (!selectedProjectId) {
      setError('Please select a Project.');
      return;
    }

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
      form.set('UserName', userName);
      form.set('TransType', transType);
      form.set('PropertyRenovated', renovated ? 'Y' : 'N');
      form.set('PropertyStoreyRowId', formData.storey);
      form.set('ProjectId', selectedProjectId);
      form.set('ProjectName', selectedProject?.ProjectName ?? '');

      const res = await fetch(INSERT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText}${t ? ` — ${t}` : ''}`);
      }

      const json = await res.json().catch(() => null);
      const newId = String(json?.data?.[0]?.ApplicationId ?? '').trim();

      if (!json || json.status !== 'success' || !newId) {
        throw new Error(
          json?.error || `Failed to create ${transType.toLowerCase()} (no ApplicationId returned).`
        );
      }

      setNotice(`New ${transType.toLowerCase()} created (ApplicationId: ${newId}).`);

      if (onCreated) {
        onCreated(newId);
        return;
      }

      setCreatedId(newId);
    } catch (e: any) {
      setError(e?.message || `Failed to create ${transType.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  };

  // -------------------- after-create view --------------------
  if (createdId) {
    if (transType === 'Sales' || transType === 'Project') {
      return (
        <SalesPurchaseDetails
          applicationId={createdId}
          onBack={() => setCreatedId(null)}
        />
      );
    }

    if (transType === 'Rental' || transType === 'RMS') {
      return (
        <RentalDetails
          applicationId={createdId}
          onBack={() => setCreatedId(null)}
        />
      );
    }

    return (
      <RentalDetails
        applicationId={createdId}
        onBack={() => setCreatedId(null)}
      />
    );
  }

  // -------------------- form UI --------------------
  const isPenang = isPenangState(propertyState);

  const selectedProjectName =
    projectsSorted.find((p) => p.ProjectId === selectedProjectId)?.ProjectName || '';

  return (
    <div className="p-6 space-y-6">
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
            <h1 className="text-3xl font-bold text-gray-900">Add Property Application</h1>
            <p className="text-gray-600">Fill in the property details below.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Building className="w-5 h-5 text-blue-600" />
          Property Details
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transaction Type
            </label>
            <select
              value={transType}
              onChange={(e) =>
                setTransType(e.target.value as 'Rental' | 'RMS' | 'Sales' | 'Project')
              }
              className="w-full border border-gray-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Rental">Rental</option>
              <option value="RMS">RMS</option>
              <option value="Sales">Sale</option>
              <option value="Project">Project</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property Address
            </label>
            <input
              type="text"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
              maxLength={200}
              placeholder="e.g. No. 1, Jalan Example 1, 47000 Damansara, Selangor"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <select
              value={propertyState}
              onChange={(e) => {
                const newState = e.target.value;
                setPropertyState(newState);
                setPropertyTown('');
              }}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <select
              value={isPenang ? propertyTown : ''}
              onChange={(e) => setPropertyTown(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">
                {isPenang
                  ? loadingLocations
                    ? 'Loading...'
                    : 'Please select location'
                  : 'Please select location'}
              </option>

              {isPenang &&
                locations.map((item, index) => (
                  <option
                    key={`${item.StateName}-${item.Location}-${index}`}
                    value={item.Location}
                  >
                    {item.Location}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
            <input
              type="text"
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

          <div className="md:col-span-2 grid md:grid-cols-2 gap-5">
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

          <div className="md:col-span-2" ref={projectWrapRef}>
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">Project</label>

              <button
                type="button"
                onClick={() => {
                  loadProjects();
                }}
                disabled={loadingProjects}
                title="Refresh projects"
                className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                  loadingProjects ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                <RefreshCw
                  size={16}
                  className={loadingProjects ? 'animate-spin text-gray-400' : 'text-gray-500'}
                />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsProjectOpen((v) => !v);
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
              aria-haspopup="listbox"
              aria-expanded={isProjectOpen}
            >
              <span className={selectedProjectId ? 'text-gray-900' : 'text-gray-400'}>
                {selectedProjectId ? selectedProjectName : 'Select Project…'}
              </span>
              <span className="text-gray-400 ml-2">▾</span>
            </button>

            {isProjectOpen && (
              <div className="relative">
                <div className="absolute z-50 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
                  <div className="p-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 px-2 py-2 border border-gray-200 rounded-md">
                      <span className="text-gray-400">🔎</span>
                      <input
                        ref={projectSearchRef}
                        value={projectQuery}
                        onChange={(e) => setProjectQuery(e.target.value)}
                        placeholder="Type to filter projects..."
                        className="w-full outline-none text-sm"
                      />
                    </div>
                  </div>

                  <div className="max-h-64 overflow-auto py-1" role="listbox">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProjectId('');
                        setIsProjectOpen(false);
                        setProjectQuery('');
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700"
                    >
                      Please select
                    </button>

                    {projectsFiltered.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-400">No matching projects.</div>
                    ) : (
                      projectsFiltered.map((p) => {
                        const isSelected = p.ProjectId === selectedProjectId;
                        return (
                          <button
                            key={p.ProjectId}
                            type="button"
                            onClick={() => {
                              setSelectedProjectId(p.ProjectId);
                              setIsProjectOpen(false);
                              setProjectQuery('');
                            }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                              isSelected ? 'bg-blue-50 text-gray-900' : 'text-gray-800'
                            }`}
                          >
                            {p.ProjectName}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {loadingProjects && <p className="mt-1 text-xs text-gray-400">Loading projects…</p>}
          </div>
        </div>

        {error && <div className="px-4 py-2 rounded bg-red-50 text-red-700 text-sm">{error}</div>}
        {notice && <div className="px-4 py-2 rounded bg-green-50 text-green-700 text-sm">{notice}</div>}

        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors ${
              saving ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-700'
            }`}
            type="button"
          >
            {saving ? 'Saving…' : `SAVE AS NEW ${transType.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddRental;