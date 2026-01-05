export interface Admin {
  id: string;
  username: string;
}

export interface ActivationCode {
  id: string;
  code: string;
  admin_id: string;
  app_name: string;
  user_name: string;
  status: 'pending' | 'activated' | 'expired' | 'revoked';
  duration_hours: number;
  activated_at: string | null;
  expired_at: string | null;
  request_count: number;
  remark: string | null;
  created_at: string;
  updated_at: string;
}

export interface OperationLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: string | null;
  ip: string;
  created_at: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedData<T> {
  list: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface StatsItem {
  app_name?: string;
  period?: string;
  status?: string;
  total?: number;
  count?: number;
  generated?: number;
  activated?: number;
  pending?: number;
  expired?: number;
  revoked?: number;
}
