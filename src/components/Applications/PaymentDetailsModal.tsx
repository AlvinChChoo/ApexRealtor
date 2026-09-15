import React from 'react';
import { X, Calendar, DollarSign, FileText, User, CreditCard, Building, Hash } from 'lucide-react';

interface PaymentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: any;
  formatCurrency: (amount: any) => string;
}

const PaymentDetailsModal: React.FC<PaymentDetailsModalProps> = ({
  isOpen,
  onClose,
  payment,
  formatCurrency
}) => {
  if (!isOpen || !payment) return null;

  // Helper function to get value with fallback
  const getValue = (keys: string[], fallback = 'Not specified') => {
    for (const key of keys) {
      const value = payment[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value);
      }
    }
    return fallback;
  };

  // Helper function to format date
  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'Not specified') return dateStr;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-MY', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const refNo = getValue(['RefNo', 'ReferenceNo', 'ReceiptNo', 'InvNo']);
  const paymentDate = getValue(['PaymentDate', 'DueDate', 'TransDate', 'AddDate']);
  const status = getValue(['Status', 'PaymentStatus']);
  const type = getValue(['Type', 'TransType', 'PaymentType']);
  const amount = payment.Amount ?? payment.PaymentAmt ?? payment.LineAmt ?? payment.TotalAmt ?? payment.Amt;
  const description = getValue(['Description', 'Remarks', 'Notes', 'PaymentDesc']);
  const paymentMethod = getValue(['PaymentMethod', 'Method', 'PaymentType']);
  const paidBy = getValue(['PaidBy', 'PayerName', 'ClientName', 'TenantName']);
  const receivedBy = getValue(['ReceivedBy', 'AgentName', 'UserName']);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <DollarSign className="w-6 h-6" />
              <div>
                <h2 className="text-xl font-semibold">Payment Details</h2>
                <p className="text-blue-100 text-sm">Reference: {refNo}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors p-1 rounded-full hover:bg-blue-700"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
            {/* Payment Summary */}
            <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Payment Amount</h3>
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(amount)}</p>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    /paid/i.test(status)
                      ? 'bg-green-100 text-green-800'
                      : /pending|unpaid|due/i.test(status)
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {status}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">Basic Information</h4>
                
                <div className="flex items-start space-x-3">
                  <Hash className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Reference Number</label>
                    <p className="text-gray-900 font-medium">{refNo}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Payment Date</label>
                    <p className="text-gray-900">{formatDate(paymentDate)}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Payment Type</label>
                    <p className="text-gray-900">{type}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <CreditCard className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Payment Method</label>
                    <p className="text-gray-900">{paymentMethod}</p>
                  </div>
                </div>
              </div>

              {/* Party Information */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">Party Information</h4>
                
                <div className="flex items-start space-x-3">
                  <User className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Paid By</label>
                    <p className="text-gray-900">{paidBy}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Building className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Received By</label>
                    <p className="text-gray-900">{receivedBy}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Hash className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Application ID</label>
                    <p className="text-gray-900">{getValue(['ApplicationId', 'AppId'])}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            {description !== 'Not specified' && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3">Description</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700">{description}</p>
                </div>
              </div>
            )}

            {/* Additional Details */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3">Additional Details</h4>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {Object.entries(payment).map(([key, value]) => {
                    // Skip already displayed fields and empty values
                    if (!value || 
                        ['RefNo', 'ReferenceNo', 'ReceiptNo', 'InvNo', 'PaymentDate', 'DueDate', 'TransDate', 'AddDate',
                         'Status', 'PaymentStatus', 'Type', 'TransType', 'PaymentType', 'Amount', 'PaymentAmt', 
                         'LineAmt', 'TotalAmt', 'Amt', 'Description', 'Remarks', 'Notes', 'PaymentDesc',
                         'PaymentMethod', 'Method', 'PaidBy', 'PayerName', 'ClientName', 'TenantName',
                         'ReceivedBy', 'AgentName', 'UserName', 'ApplicationId', 'AppId'].includes(key)) {
                      return null;
                    }
                    
                    return (
                      <div key={key} className="flex justify-between">
                        <span className="font-medium text-gray-600">{key}:</span>
                        <span className="text-gray-900">{String(value)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Transaction Summary */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h4 className="text-blue-800 font-semibold mb-2">Transaction Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">Payment ID:</span>
                  <span className="text-blue-900 font-medium">{getValue(['PaymentId', 'Id', 'TransId'])}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Created Date:</span>
                  <span className="text-blue-900 font-medium">{formatDate(getValue(['CreatedDate', 'AddDate']))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Last Updated:</span>
                  <span className="text-blue-900 font-medium">{formatDate(getValue(['UpdatedDate', 'ModDate']))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentDetailsModal;