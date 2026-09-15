import { API_ENDPOINTS } from '../../config/apiConfig';
// src/pages/RentalDetails.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ArrowLeft, Building, DollarSign, FileText, Upload, ChevronUp } from 'lucide-react';

import { useParams, useNavigate, useLocation } from 'react-router-dom';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

import { RentalApplication } from '../../types';
import AddIncomingPayment from './AddIncomingPayment';

import PropertyDetSection from './PropertyDetSection';
import ATLSection from './ATLSection';
import ListerCloserSection from './ListerCloserSection';
import WTASection from './WTASection';
import ATRSection from './ATRSection';
import LandlordTenantSection from './LandlordTenantSection';
import FormHistorySession from './FormHistorySession';
import FormSession from './FormSession';
import PaymentSession from './PaymentSession';
import RentalUploadedDocSession from './RentalUploadedDocSession';
import BillingDetails from './BillingDetails';

/* =========================
   Task List (PendingTaskLog)
========================= */
type PendingTaskLog = {
  TaskLogId: number;
  TaskType: string;
  TaskDesc: string;
  RequestDate?: string;
  RequestUserName?: string;
  RequestStatus?: string;
  RefId?: string;
  RowId?: string | number;
};

const PENDING_TASK_LOG_URL =
  API_ENDPOINTS.PENDING_TASK_LOG_GET;

/* =========================
   GeneralInfoTab (top-level)
========================= */
type GeneralInfoTabProps = {
  application: RentalApplication;
  selectedDocMUid: 'EATL' | 'GATL';
  selectedDocName: string;
  onSilentRefresh: () => Promise<void>;
  onAtrSubmit: (formData: FormData) => Promise<void>;
  onWtaUpdate: (payload: URLSearchParams) => Promise<void>;
  rowId?: string;
};

const GeneralInfoTab: React.FC<GeneralInfoTabProps> = React.memo(
  ({
    application,
    selectedDocMUid,
    selectedDocName,
    onSilentRefresh,
    onWtaUpdate,
  }) => {
    void selectedDocMUid;
    void selectedDocName;
    void onWtaUpdate;

    const formatDate = (dateStr?: string | null) =>
      !dateStr || dateStr === '1900-01-01' ? 'Not specified' : String(dateStr);

    const [showConfirm, setShowConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const REVIEW_STATUS = 'Pending Review';
    const ABORT_STATUS = 'Deal Aborted';

    const [confirmAction, setConfirmAction] = useState<'review' | 'abort'>('review');

    const openConfirmReview = () => {
      setConfirmAction('review');
      setShowConfirm(true);
    };

    const openConfirmAbort = () => {
      setConfirmAction('abort');
      setShowConfirm(true);
    };

    const closeConfirm = () => setShowConfirm(false);

    const submitForReview = async () => {
      try {
        setSubmitting(true);

        const nextStatus = confirmAction === 'abort' ? ABORT_STATUS : REVIEW_STATUS;

        const fd = new FormData();
        fd.append('ApplicationId', String(application.ApplicationId ?? ''));
        fd.append('ApplicationStatus', nextStatus);
        fd.append('StatusCommand', 'RentalReviewSubmission');

        const res = await fetch(
          API_ENDPOINTS.APPLICATION_STATUS_SET,
          { method: 'POST', body: fd }
        );

        const json = await res.json().catch(() => ({} as any));
        if (!res.ok || json?.status !== 'success') {
          throw new Error(json?.data || `HTTP ${res.status}`);
        }

        alert(
          json?.data ||
            (confirmAction === 'abort' ? 'Deal Aborted ✅' : 'Submitted for review ✅')
        );
        closeConfirm();
        await onSilentRefresh();
      } catch (e: any) {
        alert(`Submit failed: ${e?.message || e}`);
      } finally {
        setSubmitting(false);
      }
    };

    const [showDecisionModal, setShowDecisionModal] = useState(false);
    const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
    const [remarks, setRemarks] = useState('');
    const [decSubmitting, setDecSubmitting] = useState(false);
    const [decisionTaskLogId, setDecisionTaskLogId] = useState<string>('');

    const openDecision = () => {
      setDecision(null);
      setRemarks('');
      setShowDecisionModal(true);
    };

    const closeDecision = () => setShowDecisionModal(false);

    const submitDecision = async () => {
      if (!decision) {
        alert('Please choose Approve or Reject.');
        return;
      }
      if (decision === 'reject' && !remarks.trim()) {
        alert('Remarks are required when rejecting.');
        return;
      }
      if (!decisionTaskLogId) {
        alert('TaskLogId is missing. Please click Approve/Reject from a task row.');
        return;
      }

      try {
        setDecSubmitting(true);

        const fd = new FormData();
        fd.append('ApplicationId', String(application.ApplicationId ?? ''));
        fd.append(
          'ApplicationStatus',
          decision === 'approve' ? 'Pending Commission' : 'Review Rejected'
        );
        fd.append('StatusCommand', 'RentalReviewSubmission');

        if (remarks.trim()) fd.append('AppRejRem', remarks.trim());

        fd.append(
          'RequestStatus',
          decision === 'approve' ? 'Pending Commission' : 'Review Rejected'
        );
        fd.append('TaskLogId', String(decisionTaskLogId));
        fd.append('TaskStatus', decision === 'approve' ? 'Approved' : 'Rejected');

        const res = await fetch(
          API_ENDPOINTS.APPLICATION_APP_REJ_SET,
          { method: 'POST', body: fd }
        );

        const json = await res.json().catch(() => ({} as any));
        if (!res.ok || json?.status !== 'success') {
          throw new Error(json?.data || `HTTP ${res.status}`);
        }

        alert(json?.data || 'Status updated ✅');
        closeDecision();
        await onSilentRefresh();
        await fetchTasks();
      } catch (e: any) {
        alert(`Update failed: ${e?.message || e}`);
      } finally {
        setDecSubmitting(false);
      }
    };

    const statusLower = String(application.ApplicationStatus || '').toLowerCase();

    const canEdit = useMemo(() => {
      if (statusLower === 'deal aborted') return false;
      return (
        statusLower === 'active' ||
        statusLower === 'pending review' ||
        statusLower === 'rejected' ||
        statusLower === 'review rejected'
      );
    }, [statusLower]);

    const [taskLoading, setTaskLoading] = useState(false);
    const [taskError, setTaskError] = useState<string | null>(null);
    const [tasks, setTasks] = useState<PendingTaskLog[]>([]);

    const isPendingReview = (s?: string) =>
      String(s ?? '').trim().toLowerCase() === 'pending review';

    const hasPendingReviewTask = useMemo(
      () => tasks.some((t) => isPendingReview(t.RequestStatus)),
      [tasks]
    );

    const fetchTasks = useCallback(async () => {
      try {
        setTaskLoading(true);
        setTaskError(null);

        const resp = await fetch(PENDING_TASK_LOG_URL, { method: 'POST' });
        const json = await resp.json();

        if (json?.status !== 'success' || !Array.isArray(json?.data)) {
          throw new Error('Invalid task list response');
        }

        const appIdStr = String(application.ApplicationId ?? '').trim();
        const filtered: PendingTaskLog[] = (json.data as PendingTaskLog[])
          .filter((t) => String(t.RefId ?? '').trim() === appIdStr)
          .sort((a, b) => (b.TaskLogId ?? 0) - (a.TaskLogId ?? 0));

        setTasks(filtered);
      } catch (e: any) {
        setTaskError(e?.message || 'Failed to load task list');
        setTasks([]);
      } finally {
        setTaskLoading(false);
      }
    }, [application.ApplicationId]);

    useEffect(() => {
      if (application?.ApplicationId) {
        void fetchTasks();
      }
    }, [application?.ApplicationId, fetchTasks]);

    const editableProp = useMemo(() => ({ editable: canEdit } as any), [canEdit]);

    void openDecision;
    void taskLoading;
    void taskError;
    void setDecisionTaskLogId;

    return (
      <div className="space-y-6">
        {/* Application Timeline */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Application Timeline</h2>
          <div className="space-y-4">
            <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <div>
                <p className="font-medium text-gray-900">Application Created</p>
                <p className="text-sm text-gray-600">{formatDate(application.AddDate)}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <div>
                <p className="font-medium text-gray-900">
                  Current Status: {application.ApplicationStatus}
                </p>
                <p className="text-sm text-gray-600">
                  Last updated: {formatDate(application.AddDate)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            {statusLower === 'active' && statusLower !== 'deal aborted' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={openConfirmReview}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                  type="button"
                >
                  Submit for Review
                </button>

                <button
                  onClick={openConfirmAbort}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
                  type="button"
                >
                  Deal Aborted
                </button>
              </div>
            )}

            {hasPendingReviewTask && (
              <span className="text-xs text-gray-500">
                There are pending tasks awaiting decision.
              </span>
            )}
          </div>

          {showConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
              <div className="bg-white w-full max-w-md rounded-xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {confirmAction === 'abort'
                    ? 'This will mark the application as Deal Aborted.'
                    : 'This will send the application for internal review.'}
                </h3>

                <p className="text-sm text-gray-600 mb-6">Are you sure to proceed ?</p>

                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={closeConfirm}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                    type="button"
                    disabled={submitting}
                  >
                    No
                  </button>
                  <button
                    onClick={submitForReview}
                    className={`px-4 py-2 rounded-lg text-white disabled:opacity-60 ${
                      confirmAction === 'abort'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    type="button"
                    disabled={submitting}
                  >
                    {submitting
                      ? 'Submitting…'
                      : confirmAction === 'abort'
                        ? 'Yes, Abort Deal'
                        : 'Yes, Submit'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showDecisionModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
              <div className="bg-white w-full max-w-md rounded-xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Approve/Reject Review
                </h3>
                <p className="text-sm text-gray-600 mb-1">
                  Choose to approve or reject this review. Remarks are required only if rejecting.
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  TaskLogId: {decisionTaskLogId || '— (click Approve/Reject on a task)'}
                </p>

                <div className="flex gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setDecision('approve')}
                    className={`px-3 py-2 rounded-lg border ${
                      decision === 'approve'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                    disabled={decSubmitting}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('reject')}
                    className={`px-3 py-2 rounded-lg border ${
                      decision === 'reject'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                    disabled={decSubmitting}
                  >
                    Reject
                  </button>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Remarks {decision === 'reject' && <span className="text-red-600">*</span>}
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    rows={4}
                    placeholder={
                      decision === 'reject'
                        ? 'Enter rejection remarks...'
                        : 'Remarks (optional)'
                    }
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    disabled={decSubmitting}
                  />
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={closeDecision}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                    type="button"
                    disabled={decSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitDecision}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
                    type="button"
                    disabled={decSubmitting || !decision || (decision === 'reject' && !remarks.trim())}
                  >
                    {decSubmitting ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <PropertyDetSection
          application={application}
          onSilentRefresh={onSilentRefresh}
          {...editableProp}
        />

        <ListerCloserSection
          applicationId={application.ApplicationId}
          listerUserNames={[
            application.ListerUserName,
            application.ListerUserName1,
            application.ListerUserName2,
          ]}
          listerSharingPctgs={[
            application.ListerSharingPctg,
            application.ListerSharingPctg1,
            application.ListerSharingPctg2,
          ]}
          closerUserNames={[
            application.CloserUserName,
            application.CloserUserName1,
            application.CloserUserName2,
          ]}
          closerSharingPctgs={[
            application.CloserSharingPctg,
            application.CloserSharingPctg1,
            application.CloserSharingPctg2,
          ]}
          listerInvPctgs={[
            application.ListerInvPctg,
            application.ListerInvPctg1,
            application.ListerInvPctg2,
          ]}
          closerInvPctgs={[
            application.CloserInvPctg,
            application.CloserInvPctg1,
            application.CloserInvPctg2,
          ]}
          onUpdated={onSilentRefresh}
          {...editableProp}
          applicationStatus={String(application.ApplicationStatus || '')}
        />

        <LandlordTenantSection
          application={application}
          onRefresh={onSilentRefresh}
          {...editableProp}
        />

        <BillingDetails
          applicationId={String(application.ApplicationId)}
          application={application}
          title="TRANSACTION DETAILS"
          onRefresh={onSilentRefresh}
          {...editableProp}
        />

        <ATLSection
          applicationId={application.ApplicationId}
          application={application}
          docMUid={selectedDocMUid}
          docContent1={selectedDocName}
          onSilentRefresh={onSilentRefresh}
          {...editableProp}
        />

        <ATRSection application={application} onRefresh={onSilentRefresh} {...editableProp} />

        <WTASection application={application} onUpdate={onWtaUpdate} {...editableProp} />
      </div>
    );
  }
);

/* =========================
   RentalDetails (parent)
========================= */
interface RentalDetailsProps {
  applicationId: string;
  onBack: () => void;
  rowId?: string;
  preloadApplication?: RentalApplication | null;
  preloadRowId?: string;
}

type TabKey = 'general' | 'forms' | 'payments' | 'documents';

const RentalDetails: React.FC<RentalDetailsProps> = ({
  applicationId,
  onBack,
  rowId,
  preloadApplication,
  preloadRowId,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [application, setApplication] = useState<RentalApplication | null>(preloadApplication ?? null);
  const [loading, setLoading] = useState<boolean>(!preloadApplication);
  const [error, setError] = useState<string | null>(null);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [selectedDocMUid, setSelectedDocMUid] = useState<'EATL' | 'GATL'>('EATL');

  const selectedDocName = useMemo(
    () =>
      selectedDocMUid === 'EATL'
        ? 'Exclusive Authorisation To Let (EATL)'
        : 'General Authorisation To Let (GATL)',
    [selectedDocMUid]
  );

  useEffect(() => {
    const raw = (application as any)?.DocMUid;
    if (raw) {
      const v = String(raw).toUpperCase();
      if (v === 'EATL' || v === 'GATL') setSelectedDocMUid(v as 'EATL' | 'GATL');
    }
  }, [application]);

  const tabs = useMemo(
    () =>
      [
        { id: 'general', label: 'General Info', icon: Building },
        { id: 'forms', label: 'Forms', icon: FileText },
        { id: 'payments', label: 'Incoming Payment', icon: DollarSign },
        { id: 'documents', label: 'Uploaded Document', icon: Upload },
      ] as const,
    []
  );

  const effectiveRowId = preloadRowId ?? rowId;

  const fetchApplicationDetails = useCallback(
    async (silent: boolean = false) => {
      if (!applicationId) {
        setError('Missing ApplicationId');
        setApplication(null);
        return;
      }

      if (!silent) setLoading(true);
      if (!silent) setError(null);

      try {
        const formData = new URLSearchParams();

        if (localStorage.getItem('account') === 'N') {
          formData.append('UserName', localStorage.getItem('userName') || '');
        }

        formData.append('ApplicationId', applicationId);
        formData.append('SearchKeyword', '');
        formData.append('ShowOnlyExpiringTrans', '');
        formData.append('ReturnRowCnt', '1');
        formData.append('Status', '');

        if (effectiveRowId) formData.append('RowId', effectiveRowId);

        const response = await fetch(
          API_ENDPOINTS.RENTAL_APPLICATION_GET,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString(),
          }
        );

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();

        if (result?.status === 'success' && Array.isArray(result?.data) && result.data.length > 0) {
          setApplication(result.data[0] as RentalApplication);
        } else {
          throw new Error(result?.message || 'Application not found');
        }
      } catch (err: any) {
        if (!silent) {
          setError(err?.message || 'Failed to fetch application details');
          setApplication(null);
        } else {
          console.error('Silent refresh failed:', err);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [applicationId, effectiveRowId]
  );

  useEffect(() => {
    void fetchApplicationDetails();
  }, [fetchApplicationDetails]);

  const handleWtaUpdate = useCallback(
    async (payload: URLSearchParams) => {
      if (!application?.ApplicationId) {
        alert('Missing ApplicationId.');
        return;
      }

      payload.set('ApplicationId', String(application.ApplicationId));

      const res = await fetch(
        API_ENDPOINTS.INT_APPLICATION_WTA_SET,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: payload.toString(),
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      alert(json?.data || json?.message || 'WTA saved ✅');
      await fetchApplicationDetails();
    },
    [application?.ApplicationId, fetchApplicationDetails]
  );

  const handleAtrSubmit = useCallback(
    async (formBody: FormData) => {
      if (!application?.ApplicationId) {
        alert('Missing ApplicationId.');
        return;
      }

      formBody.set('ApplicationId', String(application.ApplicationId));

      const res = await fetch(
        API_ENDPOINTS.INT_APPLICATION_ATR_SET,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(formBody as any).toString(),
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      alert(json?.data || json?.message || 'ATR saved ✅');
      await fetchApplicationDetails();
    },
    [application?.ApplicationId, fetchApplicationDetails]
  );

  const onSilentRefresh = useCallback(() => fetchApplicationDetails(true), [fetchApplicationDetails]);

  const getScrollableParent = useCallback((element: HTMLElement | null): HTMLElement | null => {
    if (!element) return null;

    let parent = element.parentElement;

    while (parent) {
      const style = window.getComputedStyle(parent);
      const overflowY = style.overflowY;
      const isScrollable =
        (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
        parent.scrollHeight > parent.clientHeight;

      if (isScrollable) {
        return parent;
      }

      parent = parent.parentElement;
    }

    return null;
  }, []);

  const handleScrollToTop = useCallback(() => {
    const currentRoot = rootRef.current;

    if (currentRoot) {
      const scrollParent = getScrollableParent(currentRoot);

      if (scrollParent) {
        scrollParent.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      }
    }

    if (currentRoot) {
      currentRoot.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }

    document.documentElement.scrollTo({
      top: 0,
      behavior: 'smooth',
    });

    document.body.scrollTo({
      top: 0,
      behavior: 'smooth',
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, [getScrollableParent]);

  const handlePrintClaimForm = useCallback(async () => {
    if (!application) return;

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    const currency = (n: string | number) => {
      const num = typeof n === 'string' ? parseFloat(n || '0') : n || 0;
      return Number.isFinite(num) ? num.toFixed(2) : '0.00';
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text('COMMISSION CLAIM FORM', pageW / 2, 20, { align: 'center' });

    doc.setDrawColor(0);
    doc.line(20, 25, pageW - 20, 25);

    let yPos = 35;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('APPLICATION DETAILS', 20, yPos);

    yPos += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const details = [
      ['Application ID:', String(application.ApplicationId || '-')],
      ['Reference No:', String(application.RefNo || '-')],
      ['Property Address:', String(application.PropertyAddress || '-')],
      ['Transaction Type:', 'Rental'],
      ['Monthly Rental:', 'RM ' + currency(application.AtlRentalAmt || 0)],
      ['Status:', String(application.ApplicationStatus || '-')],
    ];

    details.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, yPos);
      doc.setFont('helvetica', 'normal');
      const wrappedText = doc.splitTextToSize(value, 120);
      doc.text(wrappedText, 65, yPos);
      yPos += 6;
    });

    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('LISTER(S) INFORMATION', 20, yPos);

    yPos += 8;
    doc.setFontSize(10);
    const listers = [
      {
        name: application.ListerUserName,
        share: application.ListerSharingPctg,
        inv: application.ListerInvPctg,
      },
      {
        name: application.ListerUserName1,
        share: application.ListerSharingPctg1,
        inv: application.ListerInvPctg1,
      },
      {
        name: application.ListerUserName2,
        share: application.ListerSharingPctg2,
        inv: application.ListerInvPctg2,
      },
    ].filter((l) => l.name);

    if (listers.length > 0) {
      listers.forEach((lister, idx) => {
        doc.setFont('helvetica', 'normal');
        doc.text(`${idx + 1}. ${String(lister.name)}`, 25, yPos);
        doc.text(`Share: ${currency(lister.share || 0)}%`, 100, yPos);
        doc.text(`Ind: ${currency(lister.inv || 0)}%`, 140, yPos);
        yPos += 6;
      });
    } else {
      doc.setFont('helvetica', 'italic');
      doc.text('No listers assigned', 25, yPos);
      yPos += 6;
    }

    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('CLOSER(S) INFORMATION', 20, yPos);

    yPos += 8;
    doc.setFontSize(10);
    const closers = [
      {
        name: application.CloserUserName,
        share: application.CloserSharingPctg,
        inv: application.CloserInvPctg,
      },
      {
        name: application.CloserUserName1,
        share: application.CloserSharingPctg1,
        inv: application.CloserInvPctg1,
      },
      {
        name: application.CloserUserName2,
        share: application.CloserSharingPctg2,
        inv: application.CloserInvPctg2,
      },
    ].filter((c) => c.name);

    if (closers.length > 0) {
      closers.forEach((closer, idx) => {
        doc.setFont('helvetica', 'normal');
        doc.text(`${idx + 1}. ${String(closer.name)}`, 25, yPos);
        doc.text(`Share: ${currency(closer.share || 0)}%`, 100, yPos);
        doc.text(`Ind: ${currency(closer.inv || 0)}%`, 140, yPos);
        yPos += 6;
      });
    } else {
      doc.setFont('helvetica', 'italic');
      doc.text('No closers assigned', 25, yPos);
      yPos += 6;
    }

    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('COMMISSION DETAILS', 20, yPos);

    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const commDetails = [
      ['Landlord Professional Fees:', 'RM ' + currency(application.AtlProFees || 0)],
      ['Landlord Admin Fees:', 'RM ' + currency(application.LandlordAdminFeesAmt || 0)],
      ['Tenant Service Fees:', 'RM ' + currency(application.TalServiceFeesAmt || 0)],
      ['Tenant Admin Fees:', 'RM ' + currency(application.TenantAdminFeesAmt || 0)],
    ];

    commDetails.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 100, yPos);
      yPos += 6;
    });

    yPos += 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Generated on: ' + new Date().toLocaleString(), 20, yPos);

    const filename = `Claim_Form_${application.ApplicationId || 'unknown'}.pdf`;
    doc.save(filename);
  }, [application]);

  void handlePrintClaimForm;

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="relative z-30 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            type="button"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Loading Application Details...</h1>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading application details...</p>
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            type="button"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Rental Application Details</h1>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <p className="text-red-600 mb-4">{error || 'Application not found'}</p>
          <button
            onClick={() => void fetchApplicationDetails()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            type="button"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <GeneralInfoTab
            application={application}
            selectedDocMUid={selectedDocMUid}
            selectedDocName={selectedDocName}
            onSilentRefresh={onSilentRefresh}
            onAtrSubmit={handleAtrSubmit}
            onWtaUpdate={handleWtaUpdate}
            rowId={effectiveRowId}
          />
        );
      case 'forms':
        return (
          <div className="space-y-6">
            <FormSession applicationId={String(application.ApplicationId ?? '').trim()} />
            <FormHistorySession applicationId={String(application.ApplicationId ?? '').trim()} />
          </div>
        );
      case 'payments':
        return (
          <>
            {showAddPayment ? (
              <AddIncomingPayment
                applicationId={String(application.ApplicationId)}
                application={application}
                onSaved={onSilentRefresh}
                onBack={() => setShowAddPayment(false)}
              />
            ) : (
              <PaymentSession
                application={application}
                onNewPayment={() => setShowAddPayment(true)}
              />
            )}
          </>
        );
      case 'documents':
        return <RentalUploadedDocSession application={application} />;
      default:
        return null;
    }
  };

  return (
    <div ref={rootRef} className="p-6 space-y-6">
      {/* Header */}
      <div className="relative flex items-center justify-between pl-12 md:pl-0">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            type="button"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Rental Application Details</h1>
            <p className="text-gray-600">
              {application.PropertyAddress} • Ref: {application.RefNo || application.ApplicationId}
            </p>
          </div>
        </div>

        <button
          onClick={() => void fetchApplicationDetails()}
          className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
          type="button"
        >
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <nav className="bg-white rounded-xl shadow-lg">
        <div className="flex space-x-8 px-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabKey)}
                className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                type="button"
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {renderTabContent()}

      {/* FAB Scroll To Top */}
      <button
        type="button"
        onClick={handleScrollToTop}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl"
        aria-label="Scroll to top"
        title="Scroll to top"
      >
        <ChevronUp size={24} />
      </button>
    </div>
  );
};

export default RentalDetails;

/* ===========================================
   URL wrapper for deep linking:
   IMPORTANT: Your route should be:
   <Route path="/rental/:applicationId/:rowId" element={<RentalDetailsRouteWrapper />} />
   (State-based navigation also supported.)
=========================================== */
export const RentalDetailsRouteWrapper: React.FC = () => {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const state = (location.state as any) || {};
  const preloadApp = (state?.application as RentalApplication | null | undefined) ?? null;
  const preloadRowId = (state?.RowId as string | undefined) ?? undefined;

  const appIdFromState = preloadApp?.ApplicationId != null ? String(preloadApp.ApplicationId) : '';
  const appIdFromParam = String(params.applicationId ?? '').trim();
  const appId = appIdFromState || appIdFromParam;

  const rowIdFromParam = String(params.rowId ?? '').trim() || undefined;

  return (
    <RentalDetails
      applicationId={appId}
      rowId={rowIdFromParam}
      preloadApplication={preloadApp}
      preloadRowId={preloadRowId}
      onBack={() => {
        if (window.history.length > 1) navigate(-1);
        else navigate('/');
      }}
    />
  );
};