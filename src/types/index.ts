export interface Meter {
  code_meter: string;
  location: string;
  description: string;
  status: string;
  created_at: string;
}

export interface Reading {
  id: number;
  meter_id: string;
  value: number;
  photo_url: string;
  period: string;
  created_at: string;
}

export interface Comment {
  id: number;
  meter_id_comment: string;
  notes: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface Period {
  month: string;
  year: number;
  label: string;
} 