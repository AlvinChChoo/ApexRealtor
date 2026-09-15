export const API_BASE_URL = 'https://apexrealtor.myekad.com/php';
export const API_DEV_PROXY_BASE_URL = '/api/php';

export const API_BASE_URL_DEV_AWARE = import.meta.env.DEV
  ? API_DEV_PROXY_BASE_URL
  : API_BASE_URL;

const API_ENDPOINT_FILES = {
  ADMIN_USER_PWD_SET: 'AdminUserPwdSet.php',
  ALL_APPLICATION_STATUS_SUMMARY_GET: 'AllApplicationStatusSummaryGet.php',
  ALL_APPLICATION_SUMMARY_GET: 'AllApplicationSummaryGet.php',
  APPLICATION_APP_REJ_SET: 'ApplicationAppRejSet.php',
  APPLICATION_REQUEST_PROFORMA_INVOICE_SET: 'ApplicationRequestProformaInvoiceSet.php',
  APPLICATION_STATUS_SET: 'ApplicationStatusSet.php',
  APPLICATION_STATUS_SUMMARY_GET: 'ApplicationStatusSummaryGet.php',
  BILLING_DET_SET: 'BillingDetSet.php',
  CLAIM_DOC_TYPE: 'ClaimDocType.php',
  CLAIM_PAYOUT_DATE_SET: 'ClaimPayoutDateSet.php',
  CLAIM_SUBMISSION_DATE_SET: 'ClaimSubmissionDateSet.php',
  COMM_EXPLOSION: 'CommExplosion.php',
  COUNTRY_GET: 'CountryGet.php',
  E_SIGNING_SET: 'ESigningSet.php',
  FEES_COLLECTED_BY_PCTG_GET: 'FeesCollectedByPctgGet.php',
  GENERATE_INVOICE: 'GenerateInvoice.php',
  GENERATE_RECEIPT: 'GenerateReceipt.php',
  HOT_SPOT_BY_SUBBURB_GET: 'HotSpotBySubburbGet.php',
  INT_ADMIN_INSERT: 'IntAdminInsert.php',
  INT_APPLICATION_ATL_SET: 'intApplicationAtlSet.php',
  INT_APPLICATION_ATR_SET: 'IntApplicationAtrSet.php',
  INT_APPLICATION_INSERT: 'IntApplicationInsert.php',
  INT_APPLICATION_WTA_SET: 'IntApplicationWtaSet.php',
  INT_DEPT_GET: 'IntDeptGet.php',
  INT_DOC_M_LOG_GET: 'IntDocMLogGet.php',
  INT_DOC_M_TRNS_CNT_GET: 'IntDocMTrnsCntGet.php',
  INT_DOC_UPLOAD_DELETE: 'IntDocUploadDelete.php',
  INT_DOC_UPLOAD_GET: 'IntDocUploadGet.php',
  INT_DOC_UPLOAD_SET: 'IntDocUploadSet.php',
  INT_EMP_GET: 'IntEmpGet.php',
  INT_EMP_ONLY_GET: 'IntEmpOnlyGet.php',
  INT_EMP_SET: 'IntEmpSet.php',
  INT_EMP_SET_INDIVIDUAL_PCTG_BATCH: 'IntEmpSetIndividualPctgBatch.php',
  INT_FORM_INSERT: 'IntFormInsert.php',
  INT_INVENTORY_GET: 'IntInventoryGet.php',
  INT_INVENTORY_INSERT: 'IntInventoryInsert.php',
  INT_INVENTORY_LEGACY_GET: 'intinventoryGet.php',
  INT_INVENTORY_SET: 'IntInventorySet.php',
  INT_INVENTORY_TRANS_GET: 'IntInventoryTransGet.php',
  INT_INVOICE_DET_GET: 'IntInvoiceDetGet.php',
  INT_INVOICE_GET: 'IntInvoiceGet.php',
  INT_SP_APPLICATION_ATS_SET: 'intSpApplicationAtsSet.php',
  INT_SP_APPLICATION_PROPERTY_DET_SET: 'IntSpApplicationPropertyDetSet.php',
  INVENTORY_ADJUSTMENT_GET: 'InventoryAdjustmentGet.php',
  INVENTORY_ADJUSTMENT_INSERT: 'InventoryAdjustmentInsert.php',
  INVENTORY_TRANS_INSERT: 'InventoryTransInsert.php',
  INVOICE_DESC_GET: 'InvoiceDescGet.php',
  INVOICE_DESC_SALES_GET: 'InvoiceDescSalesGet.php',
  INVOICE_GENERATE: 'InvoiceGenerate.php',
  INVOICE_VOID_SET: 'InvoiceVoidSet.php',
  INV_OR_GET: 'InvOrGet.php',
  LISTER_CLOSER_BY_APPLICATION_ID_GET: 'ListerCloserByApplicationIdGet.php',
  LISTER_CLOSER_GET: 'ListerCloserGet.php',
  LISTER_CLOSER_UPDATE: 'ListerCloserUpdate.php',
  LOCATION_DELETE: 'LocationDelete.php',
  LOCATION_GET: 'LocationGet.php',
  LOCATION_INSERT: 'LocationInsert.php',
  LOCATION_SET: 'LocationSet.php',
  LOGIN_GET: 'LoginGet.php',
  PAYMENT_GET: 'PaymentGet.php',
  PAYMENT_SLIP_DELETE: 'PaymentSlipDelete.php',
  PAYMENT_SLIP_REMARKS_SET: 'PaymentSlipRemarksSet.php',
  PAYMENT_SLIP_STATUS_SET: 'PaymentSlipStatusSet.php',
  PAYMENT_TRANS_DET_GET: 'PaymentTransDetGet.php',
  PAYMENT_TRANS_INSERT: 'PaymentTransInsert.php',
  PAYMENT_TRANS_SET: 'PaymentTransSet.php',
  PAYOUT_COMMISSION_REPORT_GET: 'PayoutCommissionReportGet.php',
  PENDING_TASK_LOG_GET: 'PendingTaskLogGet.php',
  PETTY_CASH_SUMMARY_REPORT_GET: 'PettyCashSummaryReportGet.php',
  PROFORMA_INVOICE_EDIT: 'ProformaInvoiceEdit.php',
  PROFORMA_INVOICE_GENERATE: 'ProformaInvoiceGenerate.php',
  PROJECT_DELETE: 'ProjectDelete.php',
  PROJECT_GET: 'ProjectGet.php',
  PROJECT_INSERT: 'ProjectInsert.php',
  PROJECT_SET: 'ProjectSet.php',
  PROPERTY_CONDITION_GET: 'PropertyConditionGet.php',
  PROPERTY_TRANSACTED_RPT_GET: 'PropertyTransactedRptGet.php',
  PROPERTY_TYPE_GET: 'PropertyTypeGet.php',
  RENTAL_APPLICATION_GET: 'RentalApplicationGet.php',
  RENTAL_APPLICATION_SUMMARY_GET: 'RentalApplicationSummaryGet.php',
  REQUEST_COMM_SET: 'RequestCommSet.php',
  SEL_COUNTRY_UPLOAD: 'SelCountryUpload.php',
  TENANT_LANDLORD_UPDATE: 'TenantLandlordUpdate.php',
  TENANT_LANDLORD_UPDATE_POPUP: 'TenantLandlordUpdatePopup.php',
  TOP_UP_REN_INSERT: 'TopUpRenInsert.php',
  TOP_UP_TRANS_APPROVE_SET: 'TopUpTransApproveSet.php',
  TOP_UP_TRANS_GET: 'TopUpTransGet.php',
  UPLOAD: 'Upload.php',
  UPLOADED_FILE_GET: 'UploadedFileGet.php',
  WITHOLDING_TAX_RPT_GET: 'WitholdingTaxRptGet.php',
} as const;

type EndpointFileMap = typeof API_ENDPOINT_FILES;
type EndpointUrlMap = { [K in keyof EndpointFileMap]: string };

const buildEndpointMap = (baseUrl: string): EndpointUrlMap =>
  Object.fromEntries(
    Object.entries(API_ENDPOINT_FILES).map(([key, fileName]) => [key, `${baseUrl}/${fileName}`])
  ) as EndpointUrlMap;

/** Production endpoints. */
export const API_ENDPOINTS = buildEndpointMap(API_BASE_URL);

/** /api/php endpoints used by Vite development proxy branches. */
export const API_DEV_ENDPOINTS = buildEndpointMap(API_DEV_PROXY_BASE_URL);

/** Endpoints that automatically use the existing DEV proxy in development and production host otherwise. */
export const API_ENDPOINTS_DEV_AWARE = buildEndpointMap(API_BASE_URL_DEV_AWARE);

export const API_PATHS = {
  DOC_FILES: `${API_BASE_URL}/DocFiles`,
} as const;

/**
 * Alternate domain found in the original source. It is preserved here intentionally
 * so this URL-only refactor does not silently change application behavior.
 */
export const LEGACY_API_BASE_URL = 'https://myekad.myekad.com/php';
export const LEGACY_API_ENDPOINTS = {
  INT_APPLICATION_WTA_SET: `${LEGACY_API_BASE_URL}/IntApplicationWtaSet.php`,
} as const;

/** Placeholder retained exactly from the unused/template LoginForm component. */
export const PLACEHOLDER_LOGIN_URL = 'https://YOUR_ENDPOINT/login.php';
