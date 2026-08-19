import client from './client';
import { LookupResponse } from '../types';

export const getLookups = async () => {
  const { data } = await client.get<LookupResponse>('/lookups');
  return data;
};
