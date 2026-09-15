import { RentalApplication } from "./index";
import { UploadRow } from "../components/Applications/PaymentHistory";

export interface PaymentSessionProps {
  application: RentalApplication;
  paymentsUrl?: string;
  uploadsUrl?: string;
  paymentTransId?: string | number;
  onNewPayment?: (applicationId: string) => void;
}

export interface IntInvoiceBundle {
  header: IntInvoiceHeader;
  details: IntInvoiceDetRow[];
  application?: RentalApplication;
}

export interface ApiRow {
  [key: string]: any;
}

export interface ApiResponseFlat {
  status: "success" | "no_data_found" | "failed";
  data?: ApiRow[];
  error?: any;
}

export interface UploadsResponse {
  status: "success" | "no_data_found" | "failed";
  data?: UploadRow[];
  error?: any;
}

export interface PaymentHeader {
  PaymentTransId: string;
  ApplicationId: string;
  PaymentTransRefNo?: string | null;
  PaymentTransType?: string | null;
  PaymentTransStatus?: string | null;
  AddByUserName?: string | null;
  AddDate?: string | null;
  TenantAdminFeesSstAmt?: string | number | null;

  Rem?: string | null;
  ItemListId?: string | null;
  TenantServiceFees?: string | null;
  TenantServiceFeesSst?: string | null;
  TenantServiceFeesTotal?: string | null;
  TenantAdminCharges?: string | null;
  TenantAdminChargesSst?: string | null;
  TenantAdminChargesTotal?: string | null;
  TenantStampDuty?: string | null;
  TenantToRen?: string | null;
  LandlordToRen?: string | null;
  LandlordProfFees?: string | null;
  LandlordProfFeesSst?: string | null;
  LandlordProfFeesTotal?: string | null;
  LandlordAdminCharges?: string | null;
  LandlordAdminChargesSst?: string | null;
  LandlordAdminChargesTotal?: string | null;
  LandlordStampDuty?: string | null;
  LandlordMisc?: string | null;
  TotalReceived?: string | null;
  RefundToTenant?: string | null;
  RefundToLandlord?: string | null;
  AtrOtherDepositAmt?: string | number | null;
  ClaimParty?: string | null;
  [key: string]: any;
}

export interface PaymentDetailRow {
  RowId: string;
  PaymentTransId: string;
  PaymentDesc?: string | null;
  PaymentAmt?: string | number | null;
  FromRowId?: string | null;
  PaymentCode?: string | null;
  AccessCardDeposit?: string | null;
  EarnestDeposit?: string | null;
  IndahWater?: string | null;
  OtherDeposit?: string | null;
  SecurityDeposit?: string | null;
  UtilityDeposit?: string | null;
}

export interface PaymentBundle {
  header: PaymentHeader;
  details: PaymentDetailRow[];
}

export interface PaymentDetSummary {
  EarnestDeposit: number;
  SecurityDeposit: number;
  UtilityDeposit: number;
  AccessCardDeposit: number;
  IndahWater: number;
  OtherDeposit: number;
}

export interface PaymentDetApiResponse {
  status: "success" | "failed" | "no_data_found";
  data?: any[];
  error?: any;
}

export interface IntInvoiceHeader {
  InvoiceId?: string;
  InvoiceDate?: string;
  InvoiceAmtGross?: string;
  AdminCharges?: string;
  StampDuty?: string;
  TenantToRen?: string;
  DocType?: string;
  InvoiceType?: string;
  [key: string]: any;
  InvoiceNo1?: string | null;
  ReceiptNo?: string | null;
}

export interface IntInvoiceDetRow {
  InvoiceDetId: string;
  InvoiceId: string;
  ItemDesc?: string;
  ItemGross?: string;
  ItemSst?: string;
  ItemNet?: string;
  [key: string]: any;
}

export type Party = "Tenant" | "Landlord";

export type LocalFileItem = {
  id: string;
  file: File;
  amount: string;
  date: string;
  party: Party;
};
