import { API_ENDPOINTS } from '../../config/apiConfig';
import React, { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import FormHistorySession from './FormHistorySession';
import ESigningPage from './ESigningPage';

type FormRow = {
  DocMUid: string;
  DocDesc: string;
  Cnt: number;
};

type ESignItem = {
  ApplicationId: string;
  DocMLogId: string;
  DocMUid: string;
  AttName: string | null;
};

interface SalesFormSessionProps {
  applicationId: string | number;
}

const SalesFormSession: React.FC<SalesFormSessionProps> = ({ applicationId }) => {
  const [rows, setRows] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedForm, setSelectedForm] = useState<{ docMUid: string; docDesc: string } | null>(
    null
  );

  const [showESigning, setShowESigning] = useState(false);
  const [selectedESignItem, setSelectedESignItem] = useState<ESignItem | null>(null);

  const fetchForms = async () => {
    const idRaw = String(applicationId ?? '').trim();

    setLoading(true);
    setErr(null);
    setRows([]);

    try {
      const body = new URLSearchParams();
      body.append('ApplicationId', idRaw);
      body.append('DocGroup', 'SALES');

      const resp = await fetch(API_ENDPOINTS.INT_DOC_M_TRNS_CNT_GET, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const json: any = await resp.json().catch(() => ({}));

      if (json && json.status === 'success' && Array.isArray(json.data)) {
        const mapped: FormRow[] = json.data.map((it: any) => ({
          DocMUid: String(it.DocMUid ?? ''),
          DocDesc: String(it.DocDesc ?? ''),
          Cnt: Number(it.Cnt) || 0,
        }));
        setRows(mapped);
        setErr(null);
      } else if (json && json.status === 'no_data_found') {
        setRows([]);
        setErr(null);
      } else {
        setRows([]);
        setErr(typeof json?.error === 'string' ? json.error : 'Unexpected response.');
      }
    } catch (e) {
      setRows([]);
      setErr(e instanceof Error ? e.message : 'Failed to load forms.');
    } finally {
      setLoading(false);
      setLastFetchedAt(new Date().toLocaleString());
    }
  };

  useEffect(() => {
    fetchForms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  const handleViewClick = (form: FormRow) => {
    setSelectedForm({
      docMUid: form.DocMUid,
      docDesc: form.DocDesc,
    });
    setShowHistoryModal(true);
  };

  const handleCloseModal = () => {
    setShowHistoryModal(false);
    setSelectedForm(null);
  };

  const handleCloseESigning = () => {
    setShowESigning(false);
    setSelectedESignItem(null);
  };

  return (
    <>
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Sales Agreement Forms</h3>
            <button
              type="button"
              onClick={fetchForms}
              className="px-3 py-2 rounded bg-gray-100 text-gray-800 text-sm hover:bg-gray-200"
              title="Reload"
            >
              Reload
            </button>
          </div>

          <div className="text-xs text-gray-500 mb-3">
            DocGroup used: <span className="font-medium">SALES</span>
            {lastFetchedAt ? <span className="ml-2">• Last fetched: {lastFetchedAt}</span> : null}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12 text-gray-600">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3" />
              Loading forms...
            </div>
          )}

          {err && !loading && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
              <div className="font-medium">Failed to load forms</div>
              <div className="text-sm break-all">{err}</div>
            </div>
          )}

          {!loading && !err && rows.length === 0 && (
            <div className="p-6 text-center text-gray-600 bg-gray-50 rounded-lg">
              No forms found for this application.
            </div>
          )}

          {!loading && !err && rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left border border-gray-200">
                <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2">Cnt</th>
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((form) => (
                    <tr key={form.DocMUid} className="border-b border-gray-200">
                      <td className="px-4 py-2">{form.DocDesc}</td>
                      <td className="px-4 py-2">{form.Cnt}</td>
                      <td className="px-4 py-2 space-x-2">
                        <button
                          type="button"
                          onClick={() => handleViewClick(form)}
                          className="bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100 inline-flex items-center"
                        >
                          <Eye size={14} className="mr-1" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showHistoryModal && selectedForm && (
        <FormHistorySession
          isOpen={showHistoryModal}
          onClose={handleCloseModal}
          docMUid={selectedForm.docMUid}
          docDesc={selectedForm.docDesc}
          applicationId={String(applicationId)}
          onESigning={(item) => {
            setSelectedESignItem({
              ApplicationId: String(item.ApplicationId ?? ''),
              DocMLogId: String(item.DocMLogId ?? ''),
              DocMUid: String(item.DocMUid ?? ''),
              AttName: item.AttName ?? null,
            });
      
            // close FormHistorySession first
            setShowHistoryModal(false);
            setSelectedForm(null);
      
            // then open e-signing
            setShowESigning(true);
          }}
        />
      )}

      {showESigning && selectedESignItem && (
        <div className="fixed inset-0 z-[9999] bg-white overflow-auto">
          <ESigningPage
            applicationId={selectedESignItem.ApplicationId}
            docMLogId={selectedESignItem.DocMLogId}
            docMUid={selectedESignItem.DocMUid}
            fileName={selectedESignItem.AttName}
            onClose={handleCloseESigning}
          />
        </div>
      )}
    </>
  );
};

export default SalesFormSession;