import apiClient from './client';
import { User, RegisterData } from '@/types/user';

export const authApi = {
  // Register new user in backend database
  register: async (data: RegisterData): Promise<User> => {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  },

  // Get current user info
  getMe: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
};

