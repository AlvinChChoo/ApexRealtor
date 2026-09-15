import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Building,
  Search,
  ChevronDown as ChevronDownIcon,
  RefreshCw,
} from 'lucide-react';
import { RentalApplication } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface PropertyType {
  PropertyTypeId: string;
  PropertyTypeDesc: string;
}

interface AllPropertyType {
  PropertyGroupId: string;
  PropertyGroupDesc: string;
  PropertyTypeId: string;
  PropertyTypeDesc: string;
  OrderSeq: string;
}

interface PropertyConditionRow {
  PropertyConditionUid: string;
  PropertyConditionDesc: string;
}

interface PropertyTitleRow {
  PropertyTitleUid: string;
  PropertyTitleDesc: string;
}

interface ProjectItem {
  ProjectId: string;
  ProjectName: string;
}

interface LocationItem {
  StateName: string;
  Location: string;
}

interface PropertyDetSectionProps {
  application: RentalApplication;
  onSilentRefresh?: () => void;
}

/** Fixed Property Conditions (no API call) */
const FIXED_PROPERTY_CONDITIONS = [
  'Fully Furnished',
  'Partially Furnished',
  'Unfurnished',
] as const;
type FixedPropertyCondition = typeof FIXED_PROPERTY_CONDITIONS[number];

/** Fixed Property Titles (no API call) */
const FIXED_PROPERTY_TITLES = [
  'Freehold',
  'Leasehold',
  'Malay Reserve',
] as const;
type FixedPropertyTitle = typeof FIXED_PROPERTY_TITLES[number];

/** Helper: normalize uppercase / mixed title text from DB */
function normalizeTitle(raw: string): FixedPropertyTitle | '' {
  const t = (raw || '').trim().toLowerCase();
  if (t === 'freehold') return 'Freehold';
  if (t === 'leasehold') return 'Leasehold';
  if (t === 'malay reserve') return 'Malay Reserve';
  return '';
}

/** Searchable dropdown */
type ComboItem = { id: string; label: string };

function SearchableCombo({
  value,
  items,
  placeholder = 'Please select',
  disabled,
  loading,
  searchPlaceholder = 'Type to filter...',
  onChange,
}: {
  value: string;
  items: ComboItem[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  searchPlaceholder?: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(() => items.find(i => i.id === value), [items, value]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      i => (i.label || '').toLowerCase().includes(s) || (i.id || '').toLowerCase().includes(s)
    );
  }, [items, q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQ('');
    }
  }, [open]);

  const buttonText = loading ? 'Loading...' : selected ? selected.label : placeholder;

  return (
    <div ref={wrapRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between
          border border-gray-300 rounded-lg px-4 py-3 bg-white text-left
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          ${(disabled || loading) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
      >
        <span className={`${selected ? 'text-gray-900' : 'text-gray-400'}`}>{buttonText}</span>
        <ChevronDownIcon className="w-5 h-5 text-gray-400" />
      </button>

      {open && !disabled && !loading && (
        <div className="absolute z-[9999] mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full outline-none text-gray-700 placeholder:text-gray-400"
            />
          </div>

          <div className="max-h-72 overflow-auto">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="w-full text-left px-4 py-3 text-sm text-gray-500 hover:bg-gray-50"
            >
              {placeholder}
            </button>

            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">No results</div>
            ) : (
              filtered.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    onChange(it.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${
                    it.id === value ? 'bg-blue-50' : ''
                  }`}
                >
                  <span className="text-gray-900 font-medium">{it.label}</span>{' '}
                  <span className="text-gray-400">({it.id})</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const LOCATION_GET_URL = API_ENDPOINTS.LOCATION_GET;

const FIELD_CLASS =
  'w-full border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent';

const FIELD_CLASS_DISABLED =
  'w-full border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500';

const PropertyDetSession: React.FC<PropertyDetSectionProps> = ({ application, onSilentRefresh }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { user } = useAuth();

  const isAccountUser =
    String(localStorage.getItem('account') || '').trim().toUpperCase() === 'Y';

  const statusLower = (application?.ApplicationStatus || '').toString().trim().toLowerCase();

  const canEdit =
    isAccountUser ||
    statusLower === 'active' ||
    statusLower === 'pending review' ||
    statusLower === 'rejected' ||
    statusLower === 'review rejected';

  const disableInputs = !canEdit;

  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [allPropertyTypes, setAllPropertyTypes] = useState<AllPropertyType[]>([]);
  const [loadingAllPropertyTypes, setLoadingAllPropertyTypes] = useState(false);

  const [loadingTitles, setLoadingTitles] = useState<boolean>(false);
  const [titles, setTitles] = useState<PropertyTitleRow[]>([]);
  const [loadingConditions, setLoadingConditions] = useState<boolean>(false);
  const [conditions, setConditions] = useState<PropertyConditionRow[]>([]);

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Active dropdown options currently shown
  const [locations, setLocations] = useState<LocationItem[]>([]);
  // Cached Penang locations loaded once on page load
  const [penangLocations, setPenangLocations] = useState<LocationItem[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  const [formData, setFormData] = useState({
    transType: 'RENTAL',
    propertyAddress: application.PropertyAddress || '',
    location: application.PropertyLocation || '',
    state: application.PropertyState || 'Penang',
    category: '',
    type: '',
    storey: application.PropertyStoreyRowId || '',
    builtUp: application.PropertyBuildUpArea || '',
    landArea: application.PropertyLandArea || '',

    propertyConditionUid: (application as any).PropertyConditionUid || '',
    propertyTitleUid: normalizeTitle(
      (application as any).PropertyTitleUid || (application as any).PropertyTitle || ''
    ),
    postalCode: (application as any).PropertyPostalCode || (application as any).PostalCode || '',
    renovated: ((application as any)?.PropertyRenovated ?? '') === 'Y',

    propertyCondition: (application as any).PropertyCondition || '',

    projectId: String((application as any).ProjectId ?? '').trim(),
    projectName: String((application as any).ProjectName ?? '').trim(),
  });

  const isPenangState = String(formData.state || '').trim().toLowerCase() === 'penang';
  const disableLocationDropdown = disableInputs || loadingLocations || !isPenangState;

  useEffect(() => {
    if (formData.category && allPropertyTypes.length > 0) {
      const filteredTypes = allPropertyTypes.filter(
        item => item.PropertyGroupDesc === formData.category
      );

      setPropertyTypes(filteredTypes as unknown as PropertyType[]);

      const phpPropertyType = (application.PropertyType || '').toString().trim();

      setFormData(prev => ({
        ...prev,
        type: phpPropertyType,
      }));
    } else {
      setPropertyTypes([]);
      setFormData(prev => ({
        ...prev,
        type: '',
      }));
    }
  }, [formData.category, allPropertyTypes, application.PropertyType]);

  useEffect(() => {
    fetchAllPropertyTypes();
    fetchProjects();

    // IMPORTANT:
    // Always load Penang locations once on page load and cache them.
    // Do not use application.PropertyState here.
    fetchPenangLocationsOnce();

    setLoadingTitles(true);
    const fixedTitles: PropertyTitleRow[] = FIXED_PROPERTY_TITLES.map(t => ({
      PropertyTitleUid: t,
      PropertyTitleDesc: t,
    }));
    setTitles(fixedTitles);
    setLoadingTitles(false);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep visible location list in sync with selected state, without any new API call
  useEffect(() => {
    if (isPenangState) {
      setLocations(penangLocations);
    } else {
      setLocations([]);
    }
  }, [isPenangState, penangLocations]);

  useEffect(() => {
    if (allPropertyTypes.length > 0 && (application.PropertyGroup || application.PropertyType)) {
      const selectedCategory = application.PropertyGroup || '';
      const selectedType = application.PropertyType || '';

      setFormData(prev => ({
        ...prev,
        category: selectedCategory,
        type: selectedType,
      }));

      if (selectedCategory) {
        const filteredTypes = allPropertyTypes.filter(
          item => item.PropertyGroupDesc === selectedCategory
        );
        setPropertyTypes(filteredTypes as unknown as PropertyType[]);
      }
    }
  }, [allPropertyTypes, application.PropertyGroup, application.PropertyType]);

  const fetchAllPropertyTypes = async () => {
    setLoadingAllPropertyTypes(true);
    try {
      const response = await fetch(API_ENDPOINTS.PROPERTY_TYPE_GET, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: '',
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      if (result.status === 'success' && result.data) {
        setAllPropertyTypes(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch all property types');
      }
    } catch (error) {
      console.error('Fetch all property types error:', error);
      setAllPropertyTypes([]);
    } finally {
      setLoadingAllPropertyTypes(false);
    }
  };

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const fd = new FormData();
      const response = await fetch(API_ENDPOINTS.PROJECT_GET, {
        method: 'POST',
        body: fd,
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      if (result.status === 'success' && Array.isArray(result.data)) {
        const mapped: ProjectItem[] = result.data.map((row: any) => ({
          ProjectId: String(row.ProjectId ?? ''),
          ProjectName: String(row.ProjectName ?? ''),
        }));
        setProjects(mapped);

        const appProjectId = String((application as any).ProjectId ?? '').trim();
        const appProjectName = String((application as any).ProjectName ?? '').trim();

        if (appProjectId) {
          const matchById = mapped.find(p => String(p.ProjectId).trim() === appProjectId);
          if (matchById) {
            setFormData(prev => ({
              ...prev,
              projectId: matchById.ProjectId,
              projectName: matchById.ProjectName,
            }));
          }
        } else if (appProjectName) {
          const nameLower = appProjectName.toLowerCase();
          const matchByName = mapped.find(
            p => (p.ProjectName || '').trim().toLowerCase() === nameLower
          );
          if (matchByName) {
            setFormData(prev => ({
              ...prev,
              projectId: matchByName.ProjectId,
              projectName: matchByName.ProjectName,
            }));
          } else {
            setFormData(prev => ({
              ...prev,
              projectName: appProjectName,
            }));
          }
        }
      } else if (result.status === 'no_data_found') {
        setProjects([]);
      } else {
        console.error('Failed to fetch projects:', result.error || 'Unknown error');
        setProjects([]);
      }
    } catch (err) {
      console.error('Fetch projects error:', err);
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchPenangLocationsOnce = async () => {
    setLoadingLocations(true);

    try {
      const body = new URLSearchParams();
      body.append('StateName', 'Penang');

      const response = await fetch(LOCATION_GET_URL, {
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

        if (String(formData.state || '').trim().toLowerCase() === 'penang') {
          setLocations(rows);

          const currentLocation = String(formData.location || '').trim();
          const exists = rows.some(
            x => String(x.Location).trim().toLowerCase() === currentLocation.toLowerCase()
          );

          if (!exists) {
            setFormData(prev => ({
              ...prev,
              location: '',
            }));
          }
        } else {
          setLocations([]);
        }
      } else {
        setPenangLocations([]);
        setLocations([]);
        setFormData(prev => ({
          ...prev,
          location: '',
        }));
      }
    } catch (error) {
      console.error('Fetch locations error:', error);
      setPenangLocations([]);
      setLocations([]);
      setFormData(prev => ({
        ...prev,
        location: '',
      }));
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleRefreshProjects = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disableInputs) return;
    if (loadingProjects) return;

    await fetchProjects();
  };

  const fetchPropertyConditions = async () => {
    setLoadingConditions(true);
    try {
      await fetch(API_ENDPOINTS.PROPERTY_CONDITION_GET, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: '',
      });
    } catch (e) {
      console.error('fetchPropertyConditions', e);
      setConditions([]);
    } finally {
      setLoadingConditions(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleUpdateProperty = async () => {
    if (!user) {
      setMessage({ type: 'error', text: 'User not authenticated' });
      return;
    }

    if (!canEdit) {
      setMessage({
        type: 'error',
        text: `This application is not editable in its current status (${application?.ApplicationStatus || 'Unknown'}).`,
      });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const formDataToSend = new URLSearchParams();

      formDataToSend.append('ApplicationId', application.ApplicationId || '');
      formDataToSend.append('TransType', formData.transType || '');
      formDataToSend.append('PropertyAddress', formData.propertyAddress || '');
      formDataToSend.append('PropertyLocation', formData.location || '');
      formDataToSend.append('PropertyState', formData.state || '');
      formDataToSend.append('PropertyGroup', getCategoryName(formData.category));
      formDataToSend.append('PropertyType', formData.type || '');
      formDataToSend.append('PropertyGroupId', formData.category || '');
      formDataToSend.append('PropertyTypeId', getPropertyTypeId(formData.type));
      formDataToSend.append('PropertyStoreyRowId', getStoreyId(formData.storey));
      formDataToSend.append('PropertyBuildUpArea', formData.builtUp || '');
      formDataToSend.append('PropertyLandArea', formData.landArea || '');
      formDataToSend.append('PropertyCondition', formData.propertyCondition || '');
      formDataToSend.append('PropertyConditionUid', formData.propertyConditionUid || '');
      formDataToSend.append('PropertyTitleUid', formData.propertyTitleUid || '');
      formDataToSend.append('PropertyPostalCode', formData.postalCode || '');
      formDataToSend.append('PropertyRenovated', formData.renovated ? 'Y' : 'N');
      formDataToSend.append('ProjectId', formData.projectId || '');
      formDataToSend.append('ProjectName', formData.projectName || '');

      const response = await fetch(
        API_ENDPOINTS.INT_SP_APPLICATION_PROPERTY_DET_SET,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formDataToSend.toString(),
        }
      );

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();

      if (result.status === 'success') {
        alert('Property details updated successfully.');
        onSilentRefresh?.();
      } else {
        throw new Error(result.error || 'Failed to update property details');
      }
    } catch (error) {
      console.error('Update property error:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update property details',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryName = (categoryId: string): string => {
    const c = (categoryId || '').toString().trim().toUpperCase();

    if (c === 'RESIDENTIAL') return 'Residential';
    if (c === 'COMMERCIAL') return 'Commercial';
    if (c === 'INDUSTRIAL') return 'Industrial';
    if (c === 'LAND') return 'Land';

    switch (categoryId) {
      case '1000':
        return 'Residential';
      case '1010':
        return 'Commercial';
      case '1020':
        return 'Industrial';
      case '1030':
        return 'Land';
      default:
        if (c === 'RESIDENTIAL') return 'Residential';
        if (c === 'COMMERCIAL') return 'Commercial';
        if (c === 'INDUSTRIAL') return 'Industrial';
        if (c === 'LAND') return 'Land';
        return c || 'Commercial';
    }
  };

  const getPropertyTypeId = (type: string): string => {
    const propertyType = propertyTypes.find(pt => pt.PropertyTypeDesc === type);
    return propertyType ? propertyType.PropertyTypeId : '1';
  };

  const getStoreyId = (storey: any): string => {
    return (storey ?? '').toString() || '100';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-visible mb-6">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-gray-400 hover:bg-gray-500 text-white px-6 py-4 flex items-center justify-between cursor-pointer select-none rounded-xl transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Building className="w-5 h-5" />
          <h2 className="text-lg font-semibold">PROPERTY DETAILS</h2>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </div>

      {isExpanded && (
        <div className="p-6 bg-gray-50">
          {message && message.type === 'error' && (
            <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-800">
              {message.text}
            </div>
          )}

          <div className="space-y-1">
            <div className="grid grid-cols-4 gap-4 items-center">
              <label className="text-sm font-medium text-gray-700">Trans Type</label>
              <div className="col-span-3">
                <select
                  value={formData.transType}
                  onChange={(e) => handleInputChange('transType', e.target.value)}
                  disabled={disableInputs}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="RENTAL">RENTAL</option>
                  <option value="RMS">RMS</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 items-center">
              <label className="text-sm font-medium text-gray-700">Property Address</label>
              <div className="col-span-3">
                <input
                  type="text"
                  value={formData.propertyAddress}
                  onChange={(e) => handleInputChange('propertyAddress', e.target.value)}
                  disabled={disableInputs}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 items-center">
              <label className="text-sm font-medium text-gray-700">Location</label>
              <div>
                <select
                  value={isPenangState ? (formData.location || '') : ''}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  disabled={disableLocationDropdown}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">
                    {isPenangState
                      ? (loadingLocations ? 'Loading...' : 'Please select location')
                      : 'Please select location'}
                  </option>
                  {isPenangState &&
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

              <label className="text-sm font-medium text-gray-700 text-right">State</label>
              <div>
                <select
                  value={formData.state}
                  onChange={(e) => {
                    const newState = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      state: newState,
                      location: '',
                    }));
                  }}
                  disabled={disableInputs}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Penang">Penang</option>
                  <option value="Johor">Johor</option>
                  <option value="Kedah">Kedah</option>
                  <option value="Kelantan">Kelantan</option>
                  <option value="Kuala Lumpur">Kuala Lumpur</option>
                  <option value="Melaka">Melaka</option>
                  <option value="Negeri Sembilan">Negeri Sembilan</option>
                  <option value="Pahang">Pahang</option>
                  <option value="Perak">Perak</option>
                  <option value="Perlis">Perlis</option>
                  <option value="Sabah">Sabah</option>
                  <option value="Sarawak">Sarawak</option>
                  <option value="Selangor">Selangor</option>
                  <option value="Terengganu">Terengganu</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 items-center">
              <label className="text-sm font-medium text-gray-700">Category</label>
              <div>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  disabled={disableInputs}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Category</option>
                  {loadingAllPropertyTypes ? (
                    <option value="">Loading...</option>
                  ) : (
                    Array.from(new Set(allPropertyTypes.map(item => item.PropertyGroupDesc))).map(
                      groupDesc => {
                        const groupItem = allPropertyTypes.find(
                          item => item.PropertyGroupDesc === groupDesc
                        );
                        return (
                          <option
                            key={groupItem?.PropertyGroupDesc}
                            value={groupItem?.PropertyGroupDesc || ''}
                          >
                            {groupDesc}
                          </option>
                        );
                      }
                    )
                  )}
                </select>
              </div>

              <label className="text-sm font-medium text-gray-700 text-right">Type</label>
              <div>
                <select
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  disabled={disableInputs || propertyTypes.length === 0}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Type</option>
                  {propertyTypes.map((propertyType) => (
                    <option
                      key={propertyType.PropertyTypeId}
                      value={propertyType.PropertyTypeDesc}
                    >
                      {propertyType.PropertyTypeDesc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 items-center">
              <label className="text-sm font-medium text-gray-700">Storey</label>
              <div>
                <select
                  value={formData.storey}
                  onChange={(e) => handleInputChange('storey', e.target.value)}
                  disabled={disableInputs}
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

              <label className="text-sm font-medium text-gray-700 text-right">Postal Code</label>
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.postalCode}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 5);
                    handleInputChange('postalCode', digitsOnly);
                  }}
                  disabled={disableInputs}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. 11900"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 items-center">
              <label className="text-sm font-medium text-gray-700">Built Up (Sqft)</label>
              <div>
                <input
                  type="text"
                  value={formData.builtUp}
                  onChange={(e) => handleInputChange('builtUp', e.target.value)}
                  disabled={disableInputs}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <label className="text-sm font-medium text-gray-700 text-right">
                Land Area (Sqft)
              </label>
              <div>
                <input
                  type="text"
                  value={formData.landArea}
                  onChange={(e) => handleInputChange('landArea', e.target.value)}
                  disabled={disableInputs}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 items-center">
              <label className="text-sm font-medium text-gray-700">Property Condition</label>
              <div>
                <select
                  value={
                    (formData.propertyConditionUid || '').toUpperCase() === 'FULLY FURNISHED'
                      ? 'Fully Furnished'
                      : (formData.propertyConditionUid || '').toUpperCase() === 'PARTIALLY FURNISHED'
                      ? 'Partially Furnished'
                      : (formData.propertyConditionUid || '').toUpperCase() === 'UNFURNISHED'
                      ? 'Unfurnished'
                      : ''
                  }
                  onChange={(e) =>
                    setFormData(prev => ({
                      ...prev,
                      propertyConditionUid: e.target.value,
                      propertyCondition: e.target.value,
                    }))
                  }
                  disabled={disableInputs}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select condition</option>
                  <option value="Fully Furnished">Fully Furnished</option>
                  <option value="Partially Furnished">Partially Furnished</option>
                  <option value="Unfurnished">Unfurnished</option>
                </select>
              </div>

              <label className="text-sm font-medium text-gray-700 text-right">Property Title</label>
              <div>
                <select
                  value={formData.propertyTitleUid}
                  onChange={(e) => handleInputChange('propertyTitleUid', e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={disableInputs || loadingTitles}
                >
                  <option value="">{loadingTitles ? 'Loading…' : 'Select title'}</option>
                  {titles.map(t => (
                    <option key={t.PropertyTitleUid} value={t.PropertyTitleUid}>
                      {t.PropertyTitleDesc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 items-center">
              <label className="text-sm font-medium text-gray-700">
                <span className="inline-flex items-center gap-2">
                  Project
                  <button
                    type="button"
                    onClick={handleRefreshProjects}
                    disabled={disableInputs || loadingProjects}
                    className={`inline-flex items-center justify-center ${
                      disableInputs || loadingProjects
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:opacity-80'
                    }`}
                    aria-label="Refresh projects"
                    title="Refresh projects"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingProjects ? 'animate-spin' : ''}`} />
                  </button>
                </span>
              </label>
              <div className="col-span-3">
                <SearchableCombo
                  value={formData.projectId}
                  placeholder="Please select"
                  disabled={disableInputs}
                  loading={loadingProjects}
                  searchPlaceholder="Type to filter projects..."
                  items={projects.map(p => ({
                    id: p.ProjectId,
                    label: p.ProjectName,
                  }))}
                  onChange={(newId) => {
                    const match = projects.find(p => p.ProjectId === newId);
                    setFormData(prev => ({
                      ...prev,
                      projectId: newId,
                      projectName: match ? match.ProjectName : '',
                    }));
                  }}
                />
                {loadingProjects && (
                  <p className="mt-1 text-xs text-gray-400">Loading projects…</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 items-center">
              <label className="text-sm font-medium text-gray-700">Renovated</label>
              <div className="flex items-center">
                <input
                  id="renovated"
                  type="checkbox"
                  checked={formData.renovated}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, renovated: e.target.checked }))
                  }
                  disabled={disableInputs}
                  className="h-4 w-4 border-gray-300 rounded"
                />
                <label htmlFor="renovated" className="ml-2 text-sm text-gray-700 select-none">
                  Tick if renovated
                </label>
              </div>
              <div></div>
              <div></div>
            </div>

            <div className="flex justify-center pt-4">
              <button
                onClick={handleUpdateProperty}
                disabled={disableInputs || isLoading}
                className="bg-green-600 text-white px-8 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <span>{isLoading ? 'Updating...' : 'UPDATE PROPERTY DETAILS'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyDetSession;