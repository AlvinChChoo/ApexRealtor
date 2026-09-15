import { API_ENDPOINTS } from '../../config/apiConfig';
// src/components/Applications/PropertyDetSalesSection.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronUp, ChevronDown, Building, RefreshCw } from 'lucide-react';
import { createPortal } from 'react-dom';
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

interface PropertyDetSectionProps {
  application: RentalApplication;
}

interface ProjectItem {
  ProjectId: string;
  ProjectName: string;
}

interface LocationItem {
  StateName: string;
  Location: string;
}

const LOCATION_GET_URL = API_ENDPOINTS.LOCATION_GET;
const PROPERTY_TYPE_GET_URL = API_ENDPOINTS.PROPERTY_TYPE_GET;
const PROJECT_GET_URL = API_ENDPOINTS.PROJECT_GET;
const UPDATE_PROPERTY_URL =
  API_ENDPOINTS.INT_SP_APPLICATION_PROPERTY_DET_SET;

const isGuid = (s: any) =>
  typeof s === 'string' &&
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s.trim());

const normalizeConditionText = (v: string) => {
  if (isGuid(v) || !v) return 'Fully Furnished';
  return v;
};

const normalizeTitleText = (v: string) => {
  if (isGuid(v) || !v) return 'Freehold';
  return v;
};

const PropertyDetSalesSection: React.FC<PropertyDetSectionProps> = ({ application }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { user } = useAuth();

  const isAccountUser =
    String(localStorage.getItem('account') || '')
      .trim()
      .toUpperCase() === 'Y';

  const statusLower = (application?.ApplicationStatus || '').toString().trim().toLowerCase();
  const isDealAborted = statusLower === 'deal aborted';

  const canEdit =
    !isDealAborted &&
    (isAccountUser ||
      statusLower === 'active' ||
      statusLower === 'pending review' ||
      statusLower === 'rejected' ||
      statusLower === 'review rejected');

  const disableInputs = !canEdit;

  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [allPropertyTypes, setAllPropertyTypes] = useState<AllPropertyType[]>([]);
  const [loadingAllPropertyTypes, setLoadingAllPropertyTypes] = useState(false);

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    ((application as any).ProjectId || '').toString()
  );

  const [projectOpen, setProjectOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState('');

  const projectWrapRef = useRef<HTMLDivElement | null>(null);
  const projectButtonRef = useRef<HTMLButtonElement | null>(null);
  const projectSearchRef = useRef<HTMLInputElement | null>(null);
  const projectPortalRef = useRef<HTMLDivElement | null>(null);

  const [projectPos, setProjectPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  const [penangLocations, setPenangLocations] = useState<LocationItem[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [lastPenangLocation, setLastPenangLocation] = useState<string>('');

  const [formData, setFormData] = useState({
    //transType: 'SALES',
    transType: application.TransType || '',
    
    propertyAddress: application.PropertyAddress || '',
    location: application.PropertyLocation || '',
    state: (application.PropertyState || 'Penang').toString(),
    category: '',
    type: '',
    storey: application.PropertyStoreyRowId || '',
    builtUp: application.PropertyBuildUpArea || '',
    landArea: application.PropertyLandArea || '',
    propertyCondition: normalizeConditionText(
      (application as any).PropertyCondition ||
        (application as any).PropertyConditionDesc ||
        (application as any).PropertyConditionUid ||
        ''
    ),
    propertyTitle: normalizeTitleText(
      (application as any).PropertyTitle ||
        (application as any).PropertyTitleDesc ||
        (application as any).PropertyTitleUid ||
        ''
    ),
    postalCode: (application as any).PropertyPostalCode || (application as any).PostalCode || '',
    renovated: ((application as any)?.PropertyRenovated ?? '') === 'Y',
  });

  const isPenangState = String(formData.state || '').trim().toLowerCase() === 'penang';
  const disableLocationDropdown = disableInputs || loadingLocations || !isPenangState;

  const filteredProjects = useMemo(() => {
    const q = projectQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => String(p.ProjectName || '').toLowerCase().includes(q));
  }, [projects, projectQuery]);

  const selectedProjectName = useMemo(() => {
    const p = projects.find((x) => x.ProjectId === selectedProjectId);
    return p?.ProjectName || '';
  }, [projects, selectedProjectId]);

  const updateProjectDropdownPos = () => {
    const el = projectButtonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setProjectPos({
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  };

  useEffect(() => {
    if (disableInputs && projectOpen) {
      setProjectOpen(false);
    }
  }, [disableInputs, projectOpen]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inWrap = projectWrapRef.current?.contains(target);
      const inPortal = projectPortalRef.current?.contains(target);

      if (!inWrap && !inPortal) {
        setProjectOpen(false);
      }
    };

    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    if (projectOpen) {
      updateProjectDropdownPos();
      setTimeout(() => projectSearchRef.current?.focus(), 0);

      const onScroll = () => updateProjectDropdownPos();
      const onResize = () => updateProjectDropdownPos();

      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', onResize);

      return () => {
        window.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('resize', onResize);
      };
    } else {
      setProjectQuery('');
    }
  }, [projectOpen]);

  useEffect(() => {
    fetchAllPropertyTypes();
    fetchProjects();
    fetchPenangLocationsOnce();
  }, []);

  useEffect(() => {
    const appCategory = String(application.PropertyGroup || '').trim();
    const appType = String(application.PropertyType || '').trim();

    setFormData((prev) => ({
      ...prev,
      category: appCategory,
      type: appType,
    }));
  }, [application.PropertyGroup, application.PropertyType]);

  useEffect(() => {
    if (formData.category && allPropertyTypes.length > 0) {
      const filteredTypes = allPropertyTypes
        .filter((item) => item.PropertyGroupDesc === formData.category)
        .map((item) => ({
          PropertyTypeId: item.PropertyTypeId,
          PropertyTypeDesc: item.PropertyTypeDesc,
        }));

      setPropertyTypes(filteredTypes);

      const jsonPropertyType = String(application.PropertyType || '').trim();

      if (
        jsonPropertyType &&
        filteredTypes.some((item) => item.PropertyTypeDesc === jsonPropertyType)
      ) {
        setFormData((prev) => ({
          ...prev,
          type: jsonPropertyType,
        }));
      } else if (
        formData.type &&
        filteredTypes.some((item) => item.PropertyTypeDesc === formData.type)
      ) {
        // keep current user selection
      } else {
        setFormData((prev) => ({
          ...prev,
          type: '',
        }));
      }
    } else {
      setPropertyTypes([]);
      setFormData((prev) => ({
        ...prev,
        type: '',
      }));
    }
  }, [formData.category, allPropertyTypes, application.PropertyType]);

  useEffect(() => {
    if (isPenangState) {
      setLocations(penangLocations);
    } else {
      setLocations([]);
    }
  }, [isPenangState, penangLocations]);

  const fetchAllPropertyTypes = async () => {
    setLoadingAllPropertyTypes(true);
    try {
      const response = await fetch(PROPERTY_TYPE_GET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: '',
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();

      if (result.status === 'success' && Array.isArray(result.data)) {
        setAllPropertyTypes(result.data);
      } else {
        setAllPropertyTypes([]);
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
      const response = await fetch(PROJECT_GET_URL, {
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

        if (!selectedProjectId && (application as any).ProjectId) {
          setSelectedProjectId(String((application as any).ProjectId || ''));
        }
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error('Fetch projects error:', error);
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
        const rows: LocationItem[] = result.data
          .map((row: any) => ({
            StateName: String(row.StateName ?? ''),
            Location: String(row.Location ?? ''),
          }))
          .filter((x) => String(x.Location || '').trim() !== '')
          .sort((a, b) => a.Location.localeCompare(b.Location, undefined, { sensitivity: 'base' }));

        setPenangLocations(rows);

        const phpLocation = String(application.PropertyLocation || '').trim();
        const phpLocationExists = rows.some(
          (x) => String(x.Location).trim().toLowerCase() === phpLocation.toLowerCase()
        );

        if (phpLocationExists) {
          setLastPenangLocation(phpLocation);
        }

        if (String(formData.state || '').trim().toLowerCase() === 'penang') {
          setLocations(rows);

          setFormData((prev) => ({
            ...prev,
            location: phpLocationExists ? phpLocation : '',
          }));
        } else {
          setLocations([]);
          setFormData((prev) => ({
            ...prev,
            location: '',
          }));
        }
      } else {
        setPenangLocations([]);
        setLocations([]);
        setFormData((prev) => ({
          ...prev,
          location: '',
        }));
      }
    } catch (error) {
      console.error('Fetch locations error:', error);
      setPenangLocations([]);
      setLocations([]);
      setFormData((prev) => ({
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

    if (disableInputs || loadingProjects) return;

    await fetchProjects();

    if (projectOpen) {
      setTimeout(() => updateProjectDropdownPos(), 0);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => {
      if (field === 'location') {
        const newLocation = String(value || '');

        if (String(prev.state || '').trim().toLowerCase() === 'penang') {
          setLastPenangLocation(newLocation);
        }

        return { ...prev, location: newLocation };
      }

      if (field === 'state') {
        const newState = String(value || '');
        const isNewPenang = newState.trim().toLowerCase() === 'penang';

        if (!isNewPenang) {
          if (String(prev.location || '').trim()) {
            setLastPenangLocation(String(prev.location || '').trim());
          }

          return {
            ...prev,
            state: newState,
            location: '',
          };
        }

        const restoredLocation = String(lastPenangLocation || '').trim();
        const restoredExists = penangLocations.some(
          (item) => String(item.Location).trim().toLowerCase() === restoredLocation.toLowerCase()
        );

        return {
          ...prev,
          state: newState,
          location: restoredExists ? restoredLocation : '',
        };
      }

      if (field === 'category') {
        return {
          ...prev,
          category: String(value || ''),
          type: '',
        };
      }

      return { ...prev, [field]: value };
    });
  };

  const getCategoryName = (categoryIdOrDesc: string): string => {
    switch (categoryIdOrDesc) {
      case '1000':
      case 'Residential':
        return 'Residential';
      case '1010':
      case 'Commercial':
        return 'Commercial';
      case '1020':
      case 'Industrial':
        return 'Industrial';
      case '1030':
      case 'Land':
        return 'Land';
      default:
        return categoryIdOrDesc || 'Commercial';
    }
  };

  const getPropertyTypeId = (type: string): string => {
    const propertyType = propertyTypes.find((pt) => pt.PropertyTypeDesc === type);
    return propertyType ? propertyType.PropertyTypeId : '1';
  };

  const getStoreyId = (storey: string): string => {
    return storey || '100';
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
      formDataToSend.append('TransType', formData.transType);
      formDataToSend.append('PropertyAddress', formData.propertyAddress);
      formDataToSend.append('PropertyLocation', formData.location || '');
      formDataToSend.append('PropertyState', formData.state);
      formDataToSend.append('PropertyGroup', getCategoryName(formData.category));
      formDataToSend.append('PropertyType', formData.type);
      formDataToSend.append('PropertyGroupId', formData.category);
      formDataToSend.append('PropertyTypeId', getPropertyTypeId(formData.type));
      formDataToSend.append('PropertyStoreyRowId', getStoreyId(formData.storey));
      formDataToSend.append('PropertyBuildUpArea', formData.builtUp);
      formDataToSend.append('PropertyLandArea', formData.landArea);
      formDataToSend.append('PropertyCondition', normalizeConditionText(formData.propertyCondition));
      formDataToSend.append('PropertyTitle', normalizeTitleText(formData.propertyTitle));
      formDataToSend.append('PropertyPostalCode', formData.postalCode);
      formDataToSend.append('PropertyRenovated', formData.renovated ? 'Y' : 'N');

      const selectedProject = projects.find((p) => p.ProjectId === selectedProjectId);
      formDataToSend.append('ProjectId', selectedProjectId || '');
      formDataToSend.append('ProjectName', selectedProject?.ProjectName || '');

      const response = await fetch(UPDATE_PROPERTY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formDataToSend.toString(),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();

      if (result.status === 'success') {
        setMessage({ type: 'success', text: 'Property details updated successfully!' });
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

  const projectDropdownPortal =
    projectOpen &&
    createPortal(
      <div
        ref={projectPortalRef}
        style={{
          position: 'fixed',
          top: projectPos.top,
          left: projectPos.left,
          width: projectPos.width,
          zIndex: 9999,
        }}
      >
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={projectSearchRef}
              value={projectQuery}
              onChange={(e) => setProjectQuery(e.target.value)}
              placeholder="Type to filter projects..."
              disabled={disableInputs}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="max-h-64 overflow-auto">
            {loadingProjects ? (
              <div className="px-3 py-2 text-sm text-gray-400">Loading projects…</div>
            ) : filteredProjects.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">No projects found</div>
            ) : (
              <>
                <button
                  type="button"
                  disabled={disableInputs}
                  onClick={() => {
                    if (disableInputs) return;
                    setSelectedProjectId('');
                    setProjectOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-600"
                >
                  Please select
                </button>

                {filteredProjects.map((p) => (
                  <button
                    key={p.ProjectId}
                    type="button"
                    disabled={disableInputs}
                    onClick={() => {
                      if (disableInputs) return;
                      setSelectedProjectId(p.ProjectId);
                      setProjectOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                      p.ProjectId === selectedProjectId ? 'bg-gray-50 font-medium' : ''
                    }`}
                  >
                    {p.ProjectName}
                    {p.ProjectId ? <span className="text-gray-400"> ({p.ProjectId})</span> : null}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
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
          {message && (
            <div
              className={`mb-4 p-3 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4 items-center">
              <label className="text-sm font-medium text-gray-700">Trans Type</label>
              <div className="col-span-3">
                <select
                  value={formData.transType}
                  onChange={(e) => handleInputChange('transType', e.target.value)}
                  disabled={disableInputs}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="SALES">SALE</option>
                  <option value="PROJECT">PROJECT</option>
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
                  value={isPenangState ? formData.location || '' : ''}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  disabled={disableLocationDropdown}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">
                    {isPenangState && loadingLocations ? 'Loading...' : 'Please select location'}
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
                  onChange={(e) => handleInputChange('state', e.target.value)}
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
                    Array.from(new Set(allPropertyTypes.map((item) => item.PropertyGroupDesc))).map(
                      (groupDesc) => {
                        const groupItem = allPropertyTypes.find(
                          (item) => item.PropertyGroupDesc === groupDesc
                        );

                        return (
                          <option
                            key={groupItem?.PropertyGroupDesc || groupDesc}
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
                    <option key={propertyType.PropertyTypeId} value={propertyType.PropertyTypeDesc}>
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

              <label className="text-sm font-medium text-gray-700 text-right">Land Area (Sqft)</label>
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
                  value={formData.propertyCondition}
                  onChange={(e) => handleInputChange('propertyCondition', e.target.value)}
                  disabled={disableInputs}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Fully Furnished">Fully Furnished</option>
                  <option value="Partially Furnished">Partially Furnished</option>
                  <option value="Unfurnished">Unfurnished</option>
                </select>
              </div>

              <label className="text-sm font-medium text-gray-700 text-right">Property Title</label>
              <div>
                <select
                  value={formData.propertyTitle}
                  onChange={(e) => handleInputChange('propertyTitle', e.target.value)}
                  disabled={disableInputs}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Freehold">Freehold</option>
                  <option value="Leasehold">Leasehold</option>
                  <option value="Malay Reserve">Malay Reserve</option>
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

              <div className="col-span-3" ref={projectWrapRef}>
                <button
                  ref={projectButtonRef}
                  type="button"
                  disabled={disableInputs}
                  onClick={() => {
                    if (disableInputs) return;
                    setProjectOpen((v) => !v);
                    setTimeout(() => updateProjectDropdownPos(), 0);
                  }}
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
                >
                  <span className={selectedProjectId ? 'text-gray-900' : 'text-gray-400'}>
                    {selectedProjectId ? selectedProjectName : 'Select Project…'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {loadingProjects && !projectOpen && (
                  <p className="mt-1 text-xs text-gray-400">Loading projects…</p>
                )}

                {projectDropdownPortal}
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
                    setFormData((prev) => ({ ...prev, renovated: e.target.checked }))
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

export default PropertyDetSalesSection;