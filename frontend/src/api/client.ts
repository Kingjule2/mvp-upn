import type {
  Category,
  DashboardData,
  ImportPreviewResponse,
  Product,
  Sale,
  StockMovement,
  User,
} from '../types';

const rawApiUrl = import.meta.env.VITE_API_URL?.trim();
const API_BASE = rawApiUrl
  ? rawApiUrl.replace(/\/+$/, '').endsWith('/api')
    ? rawApiUrl.replace(/\/+$/, '')
    : `${rawApiUrl.replace(/\/+$/, '')}/api`
  : '/api';

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem('koperasi_token', token);
  } else {
    localStorage.removeItem('koperasi_token');
  }
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const val = data.message;
    if (typeof val === 'string') {
      return val;
    }
  }
  return fallback;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('koperasi_token');
  const headers = new Headers(options.headers || {});

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    setToken(null);
    localStorage.removeItem('koperasi_user');
    window.dispatchEvent(new Event('auth:unauthorized'));
  }

  if (!response.ok) {
    let errorData: unknown = null;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }
    const message = extractErrorMessage(errorData, `Request failed with status ${response.status}`);
    throw new ApiError(message, response.status, errorData);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export interface ProductsResponse {
  data: {
    data: Product[];
    total: number;
    current_page: number;
    last_page: number;
  };
  summary: {
    total_products: number;
    total_low_stock: number;
    total_out_of_stock: number;
    total_expiring_soon: number;
  };
}

export const api = {
  // Auth
  async login(login: string, password: string): Promise<{ message: string; token: string; user: User }> {
    const res = await request<{ message: string; token: string; user: User }>('/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });
    setToken(res.token);
    localStorage.setItem('koperasi_user', JSON.stringify(res.user));
    return res;
  },

  async logout(): Promise<void> {
    try {
      await request('/logout', { method: 'POST' });
    } finally {
      setToken(null);
      localStorage.removeItem('koperasi_user');
    }
  },

  async getMe(): Promise<{ user: User }> {
    return request<{ user: User }>('/me');
  },

  // Dashboard & Analytics
  async getDashboard(params?: { period?: string; date_from?: string; date_to?: string }): Promise<DashboardData> {
    const query = new URLSearchParams();
    if (params) {
      if (params.period) query.set('period', params.period);
      if (params.date_from) query.set('date_from', params.date_from);
      if (params.date_to) query.set('date_to', params.date_to);
    }
    return request<DashboardData>(`/dashboard${query.toString() ? `?${query.toString()}` : ''}`);
  },

  // Categories
  async getCategories(): Promise<{ data: Category[] }> {
    return request<{ data: Category[] }>('/categories');
  },

  async createCategory(data: { name: string; description?: string }): Promise<{ message: string; data: Category }> {
    return request('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Products
  async getProducts(params?: {
    search?: string;
    category_id?: number | string;
    status?: string;
    expiring_soon?: boolean;
    expired?: boolean;
    per_page?: number;
    page?: number;
  }): Promise<ProductsResponse> {
    const query = new URLSearchParams();
    if (params) {
      if (params.search) query.set('search', params.search);
      if (params.category_id) query.set('category_id', String(params.category_id));
      if (params.status) query.set('status', params.status);
      if (params.expiring_soon) query.set('expiring_soon', '1');
      if (params.expired) query.set('expired', '1');
      if (params.per_page) query.set('per_page', String(params.per_page));
      if (params.page) query.set('page', String(params.page));
    }
    return request<ProductsResponse>(`/products${query.toString() ? `?${query.toString()}` : ''}`);
  },

  async getProduct(id: number): Promise<{ data: Product }> {
    return request<{ data: Product }>(`/products/${id}`);
  },

  async createProduct(data: Partial<Product> & { category_name?: string }): Promise<{ message: string; data: Product }> {
    return request('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateProduct(id: number, data: Partial<Product> & { category_name?: string }): Promise<{ message: string; data: Product }> {
    return request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteProduct(id: number): Promise<{ message: string }> {
    return request(`/products/${id}`, {
      method: 'DELETE',
    });
  },

  async adjustStock(id: number, data: { type: 'INBOUND' | 'ADJUSTMENT'; quantity: number; notes: string }): Promise<{ message: string; current_stock: number; product: Product }> {
    return request(`/products/${id}/adjust-stock`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Stock Movements
  async getStockMovements(params?: {
    product_id?: number;
    type?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    per_page?: number;
  }): Promise<{ data: { data: StockMovement[]; total: number; current_page: number; last_page: number } }> {
    const query = new URLSearchParams();
    if (params) {
      if (params.product_id) query.set('product_id', String(params.product_id));
      if (params.type) query.set('type', params.type);
      if (params.search) query.set('search', params.search);
      if (params.date_from) query.set('date_from', params.date_from);
      if (params.date_to) query.set('date_to', params.date_to);
      if (params.page) query.set('page', String(params.page));
      if (params.per_page) query.set('per_page', String(params.per_page));
    }
    return request(`/stock-movements${query.toString() ? `?${query.toString()}` : ''}`);
  },

  // Sales & POS
  async getSales(params?: { search?: string; date_from?: string; date_to?: string; page?: number }): Promise<{ data: { data: Sale[]; total: number; current_page: number } }> {
    const query = new URLSearchParams();
    if (params) {
      if (params.search) query.set('search', params.search);
      if (params.date_from) query.set('date_from', params.date_from);
      if (params.date_to) query.set('date_to', params.date_to);
      if (params.page) query.set('page', String(params.page));
    }
    return request(`/sales${query.toString() ? `?${query.toString()}` : ''}`);
  },

  async createSale(data: {
    items: { product_id: number; quantity: number }[];
    payment_method: 'cash' | 'qris' | 'transfer';
    payment_amount?: number;
    notes?: string;
  }): Promise<{ message: string; data: Sale }> {
    return request('/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Bulk Import
  async previewImport(file: File): Promise<ImportPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return request<ImportPreviewResponse>('/import/preview', {
      method: 'POST',
      body: formData,
    });
  },

  async executeImport(previewId: string, mode: 'valid_only' | 'all_or_nothing'): Promise<{ message: string; batch_id: string; imported_count: number }> {
    return request('/import/execute', {
      method: 'POST',
      body: JSON.stringify({ preview_id: previewId, mode }),
    });
  },

  getTemplateUrl(format: 'xlsx' | 'csv' | 'stock_opname' = 'xlsx'): string {
    return `${API_BASE}/import/template?format=${format}`;
  },
};
