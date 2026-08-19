import client from './client';
import { Asset, PaginatedResponse } from '../types';

export interface AssetFilters {
  page?: number;
  pageSize?: number;
  status?: string;
  categoryId?: string;
  branchId?: string;
  costCenterId?: string;
  search?: string;
}

export interface AssetPayload {
  companyId: string;
  branchId?: string;
  costCenterId?: string;
  assetCode: string;
  description: string;
  categoryId: string;
  acquisitionDate: string;
  inServiceDate: string;
  acquisitionValue: number;
  residualValue?: number;
  usefulLifeMonths?: number;
  depreciationMethod?: string;
  status?: string;
}

export const getAssets = async (filters: AssetFilters = {}) => {
  const { data } = await client.get<PaginatedResponse<Asset>>('/assets', {
    params: filters,
  });
  return data;
};

export const getAsset = async (id: string) => {
  const { data } = await client.get<Asset>(`/assets/${id}`);
  return data;
};

export const createAsset = async (payload: AssetPayload) => {
  const { data } = await client.post<Asset>('/assets', payload);
  return data;
};

export const updateAsset = async (id: string, payload: Partial<AssetPayload>) => {
  const { data } = await client.patch<Asset>(`/assets/${id}`, payload);
  return data;
};
