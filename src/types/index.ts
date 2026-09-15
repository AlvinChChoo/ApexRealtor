export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent' | 'manager';
  nricName?: string;
  pettyCashAmt?: string;
}

export interface Property {
  id: string;
  title: string;
  type: 'rental' | 'sale';
  price: number;
  location: string;
  status: 'available' | 'pending' | 'sold' | 'rented';
  agent: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  propertyId: string;
  clientName: string;
  amount: number;
  type: 'rental' | 'sale' | 'payment';
  status: 'pending' | 'completed' | 'cancelled';
  date: string;
  agent: string;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  role: string;
  renPercentage: number;
  isActive: boolean;
  joinDate: string;
}

export interface RENPerformance {
  totalRevenue: number;
  monthlyTarget: number;
  completedDeals: number;
  activeListings: number;
}

export interface RentalApplication {
  ApplicationId: string;
  PropertyType: string;
  PropertyAddress: string;
  PropertyLocation: string;
  PropertyBuildUpArea: string;
  PropertyLandArea: string;
  TalRentalAmt: string;
  ApplicationStatus: string;
  AddDate: string;
  ListerUserName: string;
  CloserUserName: string;
  UserName: string;
  TransType: string;
  RefNo: string;
  TenancyPeriodFrom: string;
  TenancyPeriodTo: string;
  Tenant1Name: string;
  Tenant1Email: string;
  Tenant1HpNo: string;
  Landlord1Name: string;
  Landlord1Email: string;
  Landlord1HpNo: string;
  PropertyTown: string;
  PropertyState: string;
  TalServiceFeesAmt: string;
  TalProfessionalFeesTotalAmt: string;
  FeesCollectionPctg: string;
  ProjectName?: string | null;

  //Tenant1Id: string;
  //Landlord1Id: string;
  
}