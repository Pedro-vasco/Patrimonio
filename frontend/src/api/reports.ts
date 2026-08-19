import client from './client';
import { DepreciationMapResponse, PositionReportResponse } from '../types';

export const getPositionReport = async (period: string, companyId: string) => {
  const { data } = await client.get<PositionReportResponse>('/reports/position', {
    params: { period, companyId },
  });
  return data;
};

export const getDepreciationMap = async (
  period: string,
  companyId: string,
  groupBy: 'costCenter' | 'category' | 'branch',
) => {
  const { data } = await client.get<DepreciationMapResponse>('/reports/depreciation-map', {
    params: { period, companyId, groupBy },
  });
  return data;
};
