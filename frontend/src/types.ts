export interface LookupItem {
  id: string;
  name: string;
  code?: string;
  companyId?: string;
}

export interface Category extends LookupItem {
  usefulLifeMonths: number;
  residualPercent: string;
}

export interface Asset {
  id: string;
  companyId: string;
  branchId: string | null;
  costCenterId: string | null;
  assetCode: string;
  description: string;
  categoryId: string;
  acquisitionDate: string;
  inServiceDate: string;
  acquisitionValue: string;
  residualValue: string;
  depreciableBase: string;
  usefulLifeMonths: number;
  depreciationMethod: string;
  status: string;
  disposalDate: string | null;
  disposalValue: string | null;
  accumulatedDepreciation: string;
  netBookValue: string;
  company?: LookupItem;
  branch?: LookupItem | null;
  costCenter?: LookupItem | null;
  category?: Category;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface LookupResponse {
  companies: LookupItem[];
  branches: LookupItem[];
  costCenters: LookupItem[];
  categories: Category[];
}

export interface DepreciationEntry {
  id: string;
  assetId: string;
  period: string;
  deprAmount: string;
  openingGrossValue: string;
  openingAccumDepr: string;
  closingAccumDepr: string;
  closingNetValue: string;
  asset?: Asset;
}

export interface DepreciationRun {
  id: string;
  companyId: string;
  period: string;
  bookType: string;
  status: string;
  startedAt: string;
  closedAt: string | null;
  company?: LookupItem;
  entries?: DepreciationEntry[];
  _count?: {
    entries: number;
  };
}

export interface PositionReportItem {
  id: string;
  code: string;
  description: string;
  category: string;
  branch: string | null;
  costCenter: string | null;
  grossValue: number;
  accumDepr: number;
  netValue: number;
}

export interface PositionReportResponse {
  period: string;
  companyId: string;
  data: PositionReportItem[];
}

export interface DepreciationMapItem {
  group: string;
  assetCount: number;
  depreciationAmount: number;
  grossValue: number;
  netValue: number;
}

export interface DepreciationMapResponse {
  period: string;
  companyId: string;
  groupBy: 'costCenter' | 'category' | 'branch';
  data: DepreciationMapItem[];
}
