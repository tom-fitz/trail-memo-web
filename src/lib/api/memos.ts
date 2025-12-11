import apiClient from './client';
import { Memo, MemosResponse } from '@/types/memo';

export interface CreateMemoData {
  text: string;
  title?: string;
  park_name?: string;
  latitude: number;
  longitude: number;
}

export const memosApi = {
  // Get all memos
  getAll: async (params?: {
    page?: number;
    limit?: number;
    park_name?: string;
    user_id?: string;
  }): Promise<MemosResponse> => {
    const response = await apiClient.get('/memos', { params });
    console.log('🔍 API Response from /memos:', response.data);
    console.log('🔍 First memo structure:', response.data.memos?.[0]);
    return response.data;
  },

  // Get single memo by ID
  getById: async (id: string): Promise<Memo> => {
    const response = await apiClient.get(`/memos/${id}`);
    return response.data;
  },

  // Create new memo (text-only from web)
  create: async (data: CreateMemoData): Promise<Memo> => {
    // Create a minimal silent audio file (1 second of silence)
    const silentAudio = createSilentAudio();
    
    const formData = new FormData();
    formData.append('audio', silentAudio, 'memo.m4a');
    formData.append('text', data.text);
    formData.append('duration_seconds', '1');
    formData.append('latitude', data.latitude.toString());
    formData.append('longitude', data.longitude.toString());
    
    if (data.title) {
      formData.append('title', data.title);
    }
    if (data.park_name) {
      formData.append('park_name', data.park_name);
    }

    const response = await apiClient.post('/memos', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Update memo location
  updateLocation: async (id: string, latitude: number, longitude: number): Promise<Memo> => {
    const response = await apiClient.put(`/memos/${id}`, {
      latitude,
      longitude,
    });
    return response.data;
  },

  // Delete memo
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/memos/${id}`);
  },
};

// Create a minimal silent audio file for web-created memos
function createSilentAudio(): Blob {
  // Base64 encoded 1-second silent M4A file (minimal size ~500 bytes)
  const base64Audio = 'AAAAIGZ0eXBNNEEgAAACAE00QSBpc29taXNvMgAAAAhmcmVlAAAA6G1kYXQAAAGzABAHAAABRBIJAgICAQAAAAEAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  
  const binaryString = atob(base64Audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return new Blob([bytes], { type: 'audio/m4a' });
}

