import client from './client';
import { DepreciationRun, PaginatedResponse } from '../types';

export interface RunDepreciationPayload {
  period: string;
  companyId: string;
  bookType?: string;
}

export const runDepreciation = async (payload: RunDepreciationPayload) => {
  const { data } = await client.post<DepreciationRun>('/depreciation/run', payload);
  return data;
};

export const getDepreciationRuns = async (page = 1, pageSize = 10) => {
  const { data } = await client.get<PaginatedResponse<DepreciationRun>>('/depreciation/runs', {
    params: { page, pageSize },
  });
  return data;
};
