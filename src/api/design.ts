// src/api/design.ts
import axios from 'axios';
import type { DesignRequest, DesignResponse } from '../types/agent';

// 请根据实际情况修改后端地址
const API_BASE_URL = 'http://localhost:8080';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const sendDesignRequest = async (req: DesignRequest): Promise<DesignResponse> => {
  //const { data } = await apiClient.post<DesignResponse>('/api/design', req);
  const { data } = await apiClient.post<DesignResponse>('/api/design/fake', req);
  return data;
};