import { API_ENDPOINTS, LEGACY_API_ENDPOINTS } from '../../config/apiConfig';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Building,
  DollarSign,
  FileText,
  Upload,
  Printer,
  Send,
  Ban,
  ChevronUp,
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { RentalApplication } from '../../types';
import AddIncomingPayment from "./AddIncomingPayment";

import PropertyDetSection from './PropertyDetSalesSection';
import ATSSection from './ATSSection';
import ListerCloserSection from './ListerCloserSection';
import WTABSection from './WTABSection';
import ATPSection from './ATPSection';
import LandlordTenantForSalesSection from './LandlordTenantForSalesSection';
import FormHistorySession from './FormHistorySession';
import SalesFormSession from './SalesFormSession';
import PaymentSession from './PaymentSession';
import RentalUploadedDocSession from './RentalUploadedDocSession';
import BillingDetailsForSales from './BillingDetailsForSales';

/* ✅ MOBILE-ONLY FIX (no UI change)
   Forces overflow to visible ONLY on mobile for the BillingDetailsForSales area,
   so the REN dropdown menu won’t be clipped by overflow-hidden containers.
*/
const MobileRenDropdownOverflowFix: React.FC = () => (
  <style>{`
    @media (max-width: 640px) {
      .ren-mobile-overflow-fix,
      .ren-mobile-overflow-fix * {
        overflow: visible !important;
      }
    }
  `}</style>
);

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
  onSubmitReview: () => void;
  onDealAborted: () => void;
};

const GeneralInfoTab: React.FC<GeneralInfoTabProps> = React.memo(
  ({
    application,
    selectedDocMUid,
    selectedDocName,
    onSilentRefresh,
    onAtrSubmit,
    onWtaUpdate,
    onSubmitReview,
    onDealAborted,
  }) => {
    void selectedDocMUid;
    void selectedDocName;
    void onAtrSubmit;
    void onWtaUpdate;

    const formatDate = (dateStr?: string) =>
      (!dateStr || dateStr === '1900-01-01' ? 'Not specified' : dateStr);

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
              <div className="w-full">
                <p className="font-medium text-gray-900">
                  Current Status: {application.ApplicationStatus}
                </p>

                <p className="text-sm text-gray-600">
                  Last updated: {formatDate(application.AddDate)}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  {String(application.ApplicationStatus || '').trim().toUpperCase() === 'ACTIVE' && (
                    <>
                      <button
                        type="button"
                        onClick={onSubmitReview}
                        className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center gap-2"
                      >
                        <Send size={16} />
                        Submit Review
                      </button>

                      <button
                        type="button"
                        onClick={onDealAborted}
                        className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors flex items-center gap-2"
                      >
                        <Ban size={16} />
                        Deal Aborted
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={onSilentRefresh}
                    className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <PropertyDetSection application={application} />

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
            (application as any).ListerInvPctg,
            (application as any).ListerInvPctg1,
            (application as any).ListerInvPctg2,
          ]}
          closerInvPctgs={[
            (application as any).CloserInvPctg,
            (application as any).CloserInvPctg1,
            (application as any).CloserInvPctg2,
          ]}
          onUpdated={onSilentRefresh}
          applicationStatus={String(application.ApplicationStatus || '')}
        />

        <LandlordTenantForSalesSection application={application} onRefresh={onSilentRefresh} />

        <div className="ren-mobile-overflow-fix">
          <BillingDetailsForSales
            applicationId={String(application.ApplicationId)}
            application={application}
            title="TRANSACTION DETAILS"
            onRefresh={onSilentRefresh}
          />
        </div>

        <ATSSection
          applicationId={application.ApplicationId}
          application={application}
          docMUid={selectedDocMUid}
          docContent1={selectedDocName}
          onRefresh={onSilentRefresh}
        />

        <ATPSection
          application={application}
          onRefresh={onSilentRefresh}
        />

        <WTABSection application={application} onRefresh={onSilentRefresh} />
      </div>
    );
  }
);

/* =========================
   SalePurchaseDetails (parent)
========================= */
interface SalePurchaseDetailsProps {
  applicationId: string;
  onBack: () => void;
}

type TabKey = 'general' | 'forms' | 'payments' | 'documents';

const SalePurchaseDetails: React.FC<SalePurchaseDetailsProps> = ({ applicationId, onBack }) => {
  void Printer;

  const rootRef = useRef<HTMLDivElement | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [application, setApplication] = useState<RentalApplication | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [selectedDocMUid, setSelectedDocMUid] = useState<'EATL' | 'GATL'>('EATL');
  const [submitting, setSubmitting] = useState(false);

  const selectedDocName = useMemo(
    () =>
      selectedDocMUid === 'EATL'
        ? 'Exclusive Authorisation To Let (EATL)'
        : 'General Authorisation To Let (GATL)',
    [selectedDocMUid]
  );

  const REVIEW_STATUS = 'PENDING REVIEW';
  const ABORT_STATUS = 'DEAL ABORTED';

  useEffect(() => {
    const raw = (application as any)?.DocMUid;
    if (raw) {
      const v = String(raw).toUpperCase();
      if (v === 'EATL' || v === 'GATL') {
        setSelectedDocMUid(v as 'EATL' | 'GATL');
      }
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

  const fetchApplicationDetails = useCallback(
    async (silent: boolean = false) => {
      if (!silent) setLoading(true);
      setError(null);

      try {
        const formData = new URLSearchParams();

        if (localStorage.getItem('account') === 'N') {
          formData.append('UserName', localStorage.getItem('userName') || '');
        }

        formData.append('ApplicationId', applicationId);
        formData.append('TransType', 'Sales');
        formData.append('SearchKeyword', '');
        formData.append('ShowOnlyExpiringTrans', '');
        formData.append('ReturnRowCnt', '1');
        formData.append('Status', '');

        const response = await fetch(
          API_ENDPOINTS.RENTAL_APPLICATION_GET,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString(),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (
          result?.status === 'success' &&
          Array.isArray(result?.data) &&
          result.data.length > 0
        ) {
          setApplication(result.data[0] as RentalApplication);
        } else {
          throw new Error(result?.message || 'Application not found');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch application details');
        setApplication(null);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [applicationId]
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

      const res = await fetch(LEGACY_API_ENDPOINTS.INT_APPLICATION_WTA_SET, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: payload.toString(),
      });

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

  const onSilentRefresh = useCallback(
    () => fetchApplicationDetails(true),
    [fetchApplicationDetails]
  );

  const closeConfirm = useCallback(() => {
    // no-op
  }, []);

  const submitForReview = useCallback(async () => {
    if (!application?.ApplicationId) {
      alert('Missing ApplicationId.');
      return;
    }

    try {
      setSubmitting(true);

      const fd = new FormData();
      fd.append('ApplicationId', String(application.ApplicationId ?? ''));
      fd.append('ApplicationStatus', REVIEW_STATUS);
      fd.append('StatusCommand', 'RentalReviewSubmission');

      const res = await fetch(
        API_ENDPOINTS.APPLICATION_STATUS_SET,
        { method: 'POST', body: fd }
      );

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok || json?.status !== 'success') {
        throw new Error(json?.data || `HTTP ${res.status}`);
      }

      alert(json?.data || 'Submitted for review ✅');
      closeConfirm();
      await onSilentRefresh();
    } catch (e: any) {
      alert(`Submit failed: ${e?.message || e}`);
    } finally {
      setSubmitting(false);
    }
  }, [application?.ApplicationId, REVIEW_STATUS, closeConfirm, onSilentRefresh]);

  const submitDealAborted = useCallback(async () => {
    if (!application?.ApplicationId) {
      alert('Missing ApplicationId.');
      return;
    }

    try {
      setSubmitting(true);

      const fd = new FormData();
      fd.append('ApplicationId', String(application.ApplicationId ?? ''));
      fd.append('ApplicationStatus', ABORT_STATUS);
      fd.append('StatusCommand', 'DealAborted');

      const res = await fetch(
        API_ENDPOINTS.APPLICATION_STATUS_SET,
        { method: 'POST', body: fd }
      );

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok || json?.status !== 'success') {
        throw new Error(json?.data || `HTTP ${res.status}`);
      }

      alert(json?.data || 'Deal Aborted ✅');
      closeConfirm();
      await onSilentRefresh();
    } catch (e: any) {
      alert(`Deal Aborted failed: ${e?.message || e}`);
    } finally {
      setSubmitting(false);
    }
  }, [application?.ApplicationId, ABORT_STATUS, closeConfirm, onSilentRefresh]);

  const handleSubmitReview = useCallback(() => {
    if (submitting) return;
    void submitForReview();
  }, [submitting, submitForReview]);

  const handleDealAborted = useCallback(() => {
    if (submitting) return;
    void submitDealAborted();
  }, [submitting, submitDealAborted]);

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
      ['Transaction Type:', 'Sales & Purchase'],
      ['Sale Price:', 'RM ' + currency((application as any).AtlRentalAmt || 0)],
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
        name: (application as any).ListerUserName,
        share: (application as any).ListerSharingPctg,
        inv: (application as any).ListerInvPctg,
      },
      {
        name: (application as any).ListerUserName1,
        share: (application as any).ListerSharingPctg1,
        inv: (application as any).ListerInvPctg1,
      },
      {
        name: (application as any).ListerUserName2,
        share: (application as any).ListerSharingPctg2,
        inv: (application as any).ListerInvPctg2,
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
        name: (application as any).CloserUserName,
        share: (application as any).CloserSharingPctg,
        inv: (application as any).CloserInvPctg,
      },
      {
        name: (application as any).CloserUserName1,
        share: (application as any).CloserSharingPctg1,
        inv: (application as any).CloserInvPctg1,
      },
      {
        name: (application as any).CloserUserName2,
        share: (application as any).CloserSharingPctg2,
        inv: (application as any).CloserInvPctg2,
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
      ['Landlord Professional Fees:', 'RM ' + currency((application as any).AtlProFees || 0)],
      ['Landlord Admin Fees:', 'RM ' + currency((application as any).LandlordAdminFeesAmt || 0)],
      ['Tenant Service Fees:', 'RM ' + currency((application as any).TalServiceFeesAmt || 0)],
      ['Tenant Admin Fees:', 'RM ' + currency((application as any).TenantAdminFeesAmt || 0)],
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
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
          <h1 className="text-3xl font-bold text-gray-900">Sales & Purchase Application Details</h1>
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
            onSubmitReview={handleSubmitReview}
            onDealAborted={handleDealAborted}
          />
        );

      case 'forms':
        return (
          <div className="space-y-6">
            <SalesFormSession applicationId={String(application.ApplicationId ?? '').trim()} />
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
      <MobileRenDropdownOverflowFix />

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
            <h1 className="text-3xl font-bold text-gray-900">Sales & Purchase Application Details</h1>
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

      <div className="p-6">{renderTabContent()}</div>

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

export default SalePurchaseDetails;