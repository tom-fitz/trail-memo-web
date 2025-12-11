export interface User {
  user_id: string;
  email: string;
  display_name: string | null;
  department: string | null;
  color: string;
  created_at: string;
}

export interface RegisterData {
  display_name: string;
  department?: string;
}

