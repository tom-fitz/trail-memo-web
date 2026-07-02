import apiClient from './client';

export interface ApprovedUser {
  email: string;
  added_by: string | null;
  created_at: string;
  registered: boolean;
  display_name: string | null;
}

export const adminApi = {
  listApprovedUsers: async (): Promise<ApprovedUser[]> => {
    const response = await apiClient.get('/admin/approved-users');
    return response.data.approved_users;
  },

  addApprovedUser: async (email: string): Promise<void> => {
    await apiClient.post('/admin/approved-users', { email });
  },

  removeApprovedUser: async (email: string): Promise<void> => {
    await apiClient.delete('/admin/approved-users', { params: { email } });
  },
};
