export type UserRole = 'admin' | 'kasir' | 'operator';

export interface User {
  id: number;
  name: string;
  email: string;
  username: string | null;
  role: UserRole;
  is_active: boolean;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  products_count?: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category_id: number | null;
  category?: Category | null;
  unit: string;
  purchase_price: number; // HPP
  selling_price: number;
  current_stock: number;
  minimum_stock: number;
  expired_date: string | null;
  status: 'Aman' | 'Stok Tipis' | 'Habis';
  is_expiring_soon: boolean;
  is_expired: boolean;
  created_at?: string;
  updated_at?: string;
}

export type MovementType = 'INBOUND' | 'INBOUND_INITIAL' | 'OUTBOUND_SALE' | 'ADJUSTMENT';

export interface StockMovement {
  id: number;
  product_id: number;
  product?: Product;
  user_id: number | null;
  user?: User | null;
  type: MovementType;
  quantity: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number | null;
  product?: Product;
  product_name: string;
  product_sku: string;
  quantity: number;
  cost_price: number;
  selling_price: number;
  subtotal: number;
  profit: number;
}

export interface Sale {
  id: number;
  invoice_number: string;
  user_id: number | null;
  user?: User;
  total_amount: number;
  total_cost: number;
  total_profit: number;
  total_items: number;
  payment_method: 'cash' | 'qris' | 'transfer';
  payment_amount: number | null;
  change_amount: number | null;
  notes: string | null;
  created_at: string;
  items?: SaleItem[];
}

export interface DashboardSummary {
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  profit_margin: number;
  total_transactions: number;
  total_units_sold: number;
}

export interface DashboardAlertsCount {
  low_stock: number;
  out_of_stock: number;
  expiring_soon: number;
  expired: number;
}

export interface DailyTrend {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
  transaction_count: number;
  items_sold: number;
}

export interface TopProduct {
  product_id: number;
  product_name: string;
  product_sku: string;
  total_sold: number;
  total_revenue: number;
  total_profit: number;
}

export interface DashboardData {
  period: {
    type: string;
    start_date: string;
    end_date: string;
  };
  summary: DashboardSummary;
  alerts_count: DashboardAlertsCount;
  alerts_list: {
    low_stock: Product[];
    out_of_stock: Product[];
    expiring_soon: Product[];
    expired: Product[];
  };
  trends: DailyTrend[];
  top_products: TopProduct[];
}

export interface ImportRow {
  row_number: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  purchase_price: number;
  selling_price: number;
  current_stock: number;
  minimum_stock: number;
  expired_date: string | null;
  is_valid: boolean;
  errors: string[];
}

export interface ImportPreviewResponse {
  preview_id: string;
  summary: {
    total_rows: number;
    valid_count: number;
    invalid_count: number;
    can_execute: boolean;
  };
  rows: ImportRow[];
}
