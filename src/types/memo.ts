export interface Memo {
  memo_id: string;
  user_id: string;
  user_name: string;
  title: string | null;
  audio_url: string;
  text: string;
  duration_seconds: number;
  location: Location | null;
  park_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Location {
  latitude: number;
  longitude: number;
  accuracy: number;
  address: string | null;
}

export interface MemosResponse {
  memos: Memo[];
  pagination?: {
    current_page: number;
    total_pages: number;
    total_items: number;
    items_per_page: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

