import apiClient from './client';
import { Memo, MemosResponse } from '@/types/memo';

export const memosApi = {
  // Get all memos
  getAll: async (params?: {
    page?: number;
    limit?: number;
    park_name?: string;
    user_id?: string;
  }): Promise<MemosResponse> => {
    const response = await apiClient.get('/memos', { params });
    return response.data;
  },

  // Get single memo by ID
  getById: async (id: string): Promise<Memo> => {
    const response = await apiClient.get(`/memos/${id}`);
    return response.data;
  },

  // Delete memo
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/memos/${id}`);
  },
};

