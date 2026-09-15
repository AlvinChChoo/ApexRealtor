import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, Users, ChevronDown, ChevronUp, Search } from 'lucide-react';

type ShareValue = number | '';

interface AgentEntry {
  id: string;
  name: string;
  share: ShareValue;
  ind: ShareValue;
}

interface Agent {
  UserName: string;
  DisplayName: string;
  IndividualPctg?: number | string | null;
}

interface ListerCloserSectionProps {
  applicationId: string | number | undefined;  
  applicationStatus?: string;
  listerUserNames: (string | undefined)[];
  listerSharingPctgs: (number | string | undefined)[];
  closerUserNames: (string | undefined)[];
  closerSharingPctgs: (number | string | undefined)[];
  /** NEW: Individual % values from application object */
  listerInvPctgs: (number | string | undefined)[];
  closerInvPctgs: (number | string | undefined)[];
  /** Called after a successful update so the parent can refresh */
  onUpdated?: () => Promise<void> | void;
}

/** Searchable dropdown with an input as the first list item */
const SearchableSelect: React.FC<{
  options: { value: string; label: string }[];
  value: string; // selected value (UserName)
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  errorText?: string;
}> = ({ options, value, onChange, placeholder = 'Please select', disabled, errorText }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Label for the closed button. If options not loaded yet -> shows placeholder (NOT the code)
  const selected = useMemo(
    () => options.find((o) => o.value === value)?.label ?? '',
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery('');
    }
  }, [open]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'Enter' && filtered.length > 0) {
      onChange(filtered[0].value);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={[
          'w-full border rounded px-3 py-2 text-left flex items-center justify-between',
          disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
        ].join(' ')}
        title={disabled ? errorText || '' : ''}
      >
        <span className={selected ? '' : 'text-gray-500'}>
          {selected || placeholder}
        </span>
        <ChevronDown className="w-4 h-4 opacity-70" />
      </button>

      {open && !disabled && (
        <div
          className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg"
          onKeyDown={handleKey}
        >
          {/* First item: search box */}
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to filter agents..."
              className="w-full outline-none"
            />
          </div>

          {/* Options */}
          <div className="max-h-56 overflow-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
            ) : (
              filtered.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={[
                      'w-full text-left px-3 py-2 hover:bg-blue-50',
                      isSelected ? 'bg-blue-50 font-medium' : '',
                    ].join(' ')}
                  >
                    {opt.label} <span className="text-gray-500">({opt.value})</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper to parse any numeric percentage into 0–100 or ''.
const parseShare = (v: number | string | undefined | null): ShareValue => {
  if (v === undefined || v === null || v === '') return '';
  const n = Number(v);
  if (Number.isNaN(n)) return '';
  return Math.min(100, Math.max(0, n));
};

const ListerCloserSection: React.FC<ListerCloserSectionProps> = ({
  applicationId,
  applicationStatus,
  listerUserNames,
  listerSharingPctgs,
  closerUserNames,
  closerSharingPctgs,
  listerInvPctgs,
  closerInvPctgs,
  onUpdated,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [listers, setListers] = useState<AgentEntry[]>([]);
  const [closers, setClosers] = useState<AgentEntry[]>([]);
  const [saving, setSaving] = useState(false);
  //const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // NEW: from localStorage('account') — controls Ind% visibility
  const [showInd, setShowInd] = useState<boolean>(false);

  useEffect(() => {
    try {
      const acc = localStorage.getItem('account');
      setShowInd(acc === 'Y');
    } catch {
      setShowInd(false);
    }
  }, []);

// ✅ NEW: only Account users can edit Ind %
const isAccountUser =
  String(localStorage.getItem("account") || "").trim().toUpperCase() === "Y";
  
  const normalizedStatus = (applicationStatus || '')
    .toString()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const canEdit =
  isAccountUser ||
  normalizedStatus === 'active' ||
  normalizedStatus === 'pending review' ||
  normalizedStatus === 'rejected';


  const disableInputs = !canEdit;

  // Normalize incoming arrays to length 3 safely
  const safeListerNames = useMemo(
    () => [listerUserNames?.[0] ?? '', listerUserNames?.[1] ?? '', listerUserNames?.[2] ?? ''],
    [listerUserNames]
  );
  const safeListerShares = useMemo(
    () => [listerSharingPctgs?.[0], listerSharingPctgs?.[1], listerSharingPctgs?.[2]],
    [listerSharingPctgs]
  );
  const safeCloserNames = useMemo(
    () => [closerUserNames?.[0] ?? '', closerUserNames?.[1] ?? '', closerUserNames?.[2] ?? ''],
    [closerUserNames]
  );
  const safeCloserShares = useMemo(
    () => [closerSharingPctgs?.[0], closerSharingPctgs?.[1], closerSharingPctgs?.[2]],
    [closerSharingPctgs]
  );

  // NEW: safe arrays for Individual % (InvPctg) from application object
  const safeListerInvPctgs = useMemo(
    () => [listerInvPctgs?.[0], listerInvPctgs?.[1], listerInvPctgs?.[2]],
    [listerInvPctgs]
  );
  const safeCloserInvPctgs = useMemo(
    () => [closerInvPctgs?.[0], closerInvPctgs?.[1], closerInvPctgs?.[2]],
    [closerInvPctgs]
  );

  // Fetch agents once
  useEffect(() => {
    const fetchAgents = async () => {
      setLoadingAgents(true);
      setError(null);
      try {
        const response = await fetch(
          API_ENDPOINTS.LISTER_CLOSER_GET,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: '', // endpoint doesn't need params
          }
        );
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        if (result.status === 'success' && Array.isArray(result.data)) {
          setAgents(result.data as Agent[]);
        } else if (result.status === 'no_data_found') {
          setAgents([]);
        } else {
          throw new Error(result.error || 'Failed to fetch agents');
        }
      } catch (err) {
        console.error('Fetch agents error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch agents');
        setAgents([]);
      } finally {
        setLoadingAgents(false);
      }
    };
    fetchAgents();
  }, []);

  // Initialize Listers/Closers from props (this shows previous-screen shares + Inv % immediately)
  useEffect(() => {
    const initTriplet = (
      prefix: 'lister..' | 'closer..',
      names: string[],
      invs: (number | string | undefined)[],
      shares: (number | string | undefined)[]
    ): AgentEntry[] =>
      [0, 1, 2].map<AgentEntry>((i) => {
        const rawName = (names[i] ?? '').toString();

        // If old data stored DisplayName, try to map to proper UserName using agents list
        const agent = agents.find(
          (a) => a.UserName === rawName || a.DisplayName === rawName
        );

        const correctUserName = agent?.UserName ?? rawName;

        return {
          id: `${prefix}-${i + 1}`,
          name: correctUserName,
          ind: parseShare(invs[i]),    // initial Ind % from application object
          share: parseShare(shares[i]) // existing Share %
        };
      });

    setListers(initTriplet('lister', safeListerNames, safeListerInvPctgs, safeListerShares));
    setClosers(initTriplet('closer', safeCloserNames, safeCloserInvPctgs, safeCloserShares));
  }, [
    safeListerNames,
    safeListerShares,
    safeCloserNames,
    safeCloserShares,
    safeListerInvPctgs,
    safeCloserInvPctgs,
    agents,
  ]);

  const handleNameChange = (
    type: 'lister' | 'closer',
    id: string, 
    newUserName: string
  ) => {
    if (disableInputs) return;
 
    // Find the selected agent (UserName comes from options.value)
    const agent = agents.find((a) => a.UserName === newUserName);

    // Parse IND % from agent.IndividualPctg (from PHP endpoint)
    const newInd: ShareValue = agent
      ? parseShare(agent.IndividualPctg as number | string | undefined)
      : '';

    if (type === 'lister') {
      setListers((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, name: newUserName, ind: newInd } : a
        )
      );
    } else {
      setClosers((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, name: newUserName, ind: newInd } : a
        )
      );
    }
  };

  const handleShareChange = (type: 'lister' | 'closer', id: string, newShareStr: string) => {
    if (disableInputs) return;
    let newShare: ShareValue = '';
    if (newShareStr.trim() !== '') {
      const num = Number(newShareStr);
      if (!Number.isNaN(num)) newShare = Math.min(100, Math.max(0, num));
    }
    if (type === 'lister') {
      setListers((prev) => prev.map((a) => (a.id === id ? { ...a, share: newShare } : a)));
    } else {
      setClosers((prev) => prev.map((a) => (a.id === id ? { ...a, share: newShare } : a)));
    }
  };


  const handleIndChange = (type: 'lister' | 'closer', id: string, newIndStr: string) => {
  // ✅ Ind% rule: ONLY account can edit
  if (!isAccountUser) return;

  let newInd: ShareValue = '';
  if (newIndStr.trim() !== '') {
    const num = Number(newIndStr);
    if (!Number.isNaN(num)) newInd = Math.min(100, Math.max(0, num));
  }

  if (type === 'lister') {
    setListers((prev) => prev.map((a) => (a.id === id ? { ...a, ind: newInd } : a)));
  } else {
    setClosers((prev) => prev.map((a) => (a.id === id ? { ...a, ind: newInd } : a)));
  }
};

  
  const handleClearRow = (type: 'lister' | 'closer', id: string) => {
    if (disableInputs) return;
    const clear = (a: AgentEntry) =>
      a.id === id ? { ...a, name: '', share: '' } : a; // keep a.ind as-is
    if (type === 'lister') setListers((prev) => prev.map(clear));
    else setClosers((prev) => prev.map(clear));
  };

  const totalShare = (rows: AgentEntry[]) =>
    rows.reduce((sum, r) => sum + (typeof r.share === 'number' ? r.share : 0), 0);

  const agentOptions = useMemo(
    () =>
      agents.map((a) => ({
        value: a.UserName,
        label: a.DisplayName,
      })),
    [agents]
  );


    const getDisplayNameByUserName = (userName: string): string => {
    const trimmed = (userName || '').trim();
    if (!trimmed) return '';
    return agents.find((a) => a.UserName === trimmed)?.DisplayName ?? '';
  };

  
  const submitUpdate = async () => {
    if (disableInputs) {
      alert('Editing allowed only for Account users, or when status is Active, Pending Review, or Rejected.');
      return;
    }

    if (!applicationId || Number(applicationId) <= 0) {
      alert('Invalid Application ID.');
      return;
    }

    // Optional: block if totals exceed 100
    const listerTotal = totalShare(listers);
    const closerTotal = totalShare(closers);
    if (listerTotal > 100 || closerTotal > 100) {
      alert('Total share cannot exceed 100% for Lister or Closer.');
      return;
    }

    setSaving(true);
    //setMsg(null);
    try {
            const data: Record<string, string> = {
        ApplicationId: String(applicationId),

        // usernames (codes)
        ListerUserName: (listers[0]?.name || '').trim(),
        ListerUserName1: (listers[1]?.name || '').trim(),
        ListerUserName2: (listers[2]?.name || '').trim(),
        CloserUserName: (closers[0]?.name || '').trim(),
        CloserUserName1: (closers[1]?.name || '').trim(),
        CloserUserName2: (closers[2]?.name || '').trim(),

        // display names (from dropdown label)
        ListerDisplayName: getDisplayNameByUserName((listers[0]?.name || '').trim()),
        Lister1DisplayName: getDisplayNameByUserName((listers[1]?.name || '').trim()),
        Lister2DisplayName: getDisplayNameByUserName((listers[2]?.name || '').trim()),
        CloserDisplayName: getDisplayNameByUserName((closers[0]?.name || '').trim()),
        Closer1DisplayName: getDisplayNameByUserName((closers[1]?.name || '').trim()),
        Closer2DisplayName: getDisplayNameByUserName((closers[2]?.name || '').trim()),

        // shares
        ListerSharingPctg:
          typeof listers[0]?.share === 'number' ? String(listers[0].share) : '0',
        ListerSharingPctg1:
          typeof listers[1]?.share === 'number' ? String(listers[1].share) : '0',
        ListerSharingPctg2:
          typeof listers[2]?.share === 'number' ? String(listers[2].share) : '0',
        CloserSharingPctg:
          typeof closers[0]?.share === 'number' ? String(closers[0].share) : '0',
        CloserSharingPctg1:
          typeof closers[1]?.share === 'number' ? String(closers[1].share) : '0',
        CloserSharingPctg2:
          typeof closers[2]?.share === 'number' ? String(closers[2].share) : '0',

        // ind %
        ListerInvPctg:
          typeof listers[0]?.ind === 'number' ? String(listers[0].ind) : '',
        ListerInvPctg1:
          typeof listers[1]?.ind === 'number' ? String(listers[1].ind) : '',
        ListerInvPctg2:
          typeof listers[2]?.ind === 'number' ? String(listers[2].ind) : '',

        CloserInvPctg:
          typeof closers[0]?.ind === 'number' ? String(closers[0].ind) : '',
        CloserInvPctg1:
          typeof closers[1]?.ind === 'number' ? String(closers[1].ind) : '',
        CloserInvPctg2:
          typeof closers[2]?.ind === 'number' ? String(closers[2].ind) : '',
      };

      const body = new URLSearchParams(data).toString();

      const resp = await fetch(
        API_ENDPOINTS.LISTER_CLOSER_UPDATE,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        }
      );

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json().catch(() => ({}));

      if (json?.status === 'success') {
        alert('Lister / Closer updated successfully.');
      
        // Notify parent to refresh (no UI change)
        try {
          await Promise.resolve(onUpdated?.());
        } catch (e) {
          console.warn('onUpdated callback failed:', e);
        }
      } else {
        alert((json && (json.data || json.error)) || 'Update failed.');
      }
      
    } catch (e) {
      setMsg({
        type: 'error',
        text: e instanceof Error ? e.message : 'Network error while saving.',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderAgentSection = (title: string, items: AgentEntry[], type: 'lister' | 'closer') => (
    <div className="relative z-0 flex-1 border border-gray-300 rounded-lg overflow-visible">
      <div className="bg-gray-200 text-gray-800 px-4 py-2 flex justify-center text-lg font-semibold uppercase">
        {title}
      </div>
      <div className="bg-white p-4">
        <div className="flex items-center mb-2 bg-black text-white rounded font-semibold text-sm uppercase">
          <div className="w-6 px-2 text-center">#</div>
          <div className="flex-[2] px-3 py-2 text-left">Name</div>
          {showInd && (
            <div className="flex-[1] px-3 py-2 text-left">Ind %</div>
          )}
          <div className="flex-[1] px-3 py-2 text-left">Share %</div>
          <div className="w-6 px-2 text-center" />
        </div>

        <div className="space-y-4">
          {items.map((row, index) => (
            <div key={row.id} className="flex items-center space-x-2">
              <div className="w-6 text-right text-gray-700 font-medium">{index + 1}.</div>

              {/* Name with SearchableSelect */}
              <div className="flex-[2]">
                {loadingAgents ? (
                  <div className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-100 text-gray-500">
                    Loading agents...
                  </div>
                ) : error ? (
                  <SearchableSelect
                    options={[]}
                    value=""
                    onChange={() => {}}
                    placeholder="Please select"
                    disabled
                    errorText="Error loading agents"
                  />
                ) : (
                  <SearchableSelect
                    options={agentOptions}
                    value={row.name}
                    onChange={(val) => handleNameChange(type, row.id, val)}
                    placeholder="Please select"
                    disabled={disableInputs}
                    errorText={
                      !canEdit
                        ? 'Editing allowed only when status is Active / Pending Review / Rejected'
                        : undefined
                    }
                  />
                )}
              </div>
              
              {/* Ind % (Account can edit; Non-account read-only) */}
{showInd && (
  <div className="flex-[1]">
    {isAccountUser ? (
      <input
        type="number"
        inputMode="decimal"
        value={row.ind}
        onChange={(e) => handleIndChange(type, row.id, e.target.value)}
        placeholder="0"
        min={0}
        max={100}
        step={0.1}
        className="w-full border border-gray-300 rounded px-3 py-2 text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    ) : (
      <div className="w-full border border-gray-300 rounded px-3 py-2 text-center bg-gray-50 text-gray-700">
        {row.ind === '' ? '' : row.ind}
      </div>
    )}
  </div>
)}

              

              {/* Share % (editable, as before) */}
              <div className="flex-[1]">
                <input
                  type="number"
                  inputMode="decimal"
                  value={row.share}
                  onChange={(e) => handleShareChange(type, row.id, e.target.value)}
                  placeholder="0"
                  min={0}
                  max={100}
                  step={0.1}
                  disabled={disableInputs}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>

              {/* Clear */}
              <div className="w-6 flex justify-end">
                <button
                  onClick={() => handleClearRow(type, row.id)}
                  disabled={disableInputs}
                  className={[
                    'text-gray-600 p-1 rounded-full transition-colors',
                    disableInputs
                      ? 'cursor-not-allowed opacity-50'
                      : 'hover:text-red-600 hover:bg-gray-200',
                  ].join(' ')}
                  title={
                    !canEdit
                      ? 'Editing allowed only when status is Active / Pending Review / Rejected'
                      : 'Clear selection'
                  }
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-visible mb-6">
      {/* Header Section (Collapsible) */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full bg-gray-400 hover:bg-gray-500 text-white px-6 py-4 flex items-center justify-between cursor-pointer select-none rounded-xl transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5" />
          <h2 className="text-lg font-semibold">LISTER / CLOSER INFORMATION</h2>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {/* Body */}
      {isExpanded && (
        <div className="p-6 bg-gray-50">
          {/* Server message */}
          
          {/* Error Banner for agents */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
              <p className="text-sm">
                <strong>Error loading agents:</strong> {error}
              </p>
            </div>
          )}

          {/* Two columns */}
          <div className="flex flex-col md:flex-row md:space-x-6 space-y-6 md:space-y-0 mb-8">
            {renderAgentSection('Professional Fees', listers, 'lister')}
            {renderAgentSection('Service Fees', closers, 'closer')}
          </div>

          {/* Summary */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-blue-700">
                  <strong>Total Lister Share:</strong> {totalShare(listers).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-blue-700">
                  <strong>Total Closer Share:</strong> {totalShare(closers).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={submitUpdate}
              disabled={disableInputs || saving || loadingAgents}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              title={
                !canEdit
                  ? 'Editing allowed only when status is Active / Pending Review / Rejected'
                  : undefined
              }
            >
              {(saving || loadingAgents) && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              )}
              <span>{saving ? 'Saving...' : 'UPDATE LISTER / CLOSER'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListerCloserSection;
