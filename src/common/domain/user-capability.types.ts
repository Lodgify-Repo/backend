export type AccountPersona = 'CUSTOMER' | 'OWNER' | 'AGENT';

export type CommissionSpec =
  | { type: 'PERCENTAGE'; ratePercent: number }
  | { type: 'FIXED'; amount: number; currency: string };

export type AgentSpec =
  | { agencyType: 'INDIVIDUAL'; nationalId?: string }
  | { agencyType: 'ORGANIZATION'; organizationName: string; registrationNumber?: string };

export type PropertyDetails =
  | { category: 'HOTEL'; roomCount: number; starRating?: number }
  | { category: 'SHORTLET'; bedrooms: number; maxGuests: number; nightlyRate: number }
  | { category: 'RENTAL'; leaseDurationMonths: number; monthlyRent: number; furnished: boolean }
  | { category: 'SALE'; askingPrice: number; titleDeedType?: string; isLandedProperty: boolean };

export interface UserCapabilities {
  isCustomer: boolean;
  isOwner: boolean;
  isAgent: boolean;
  activePersonas: AccountPersona[];
}
