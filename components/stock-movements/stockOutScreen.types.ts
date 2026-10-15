export type StockOutDocument = {
  id_stock_out: string;
  stock_out_code: string;
  stock_out_type?: string;
  cashier_name?: string;
  operator_name?: string;
  product_names?: string[];
  reason?: string | null;
  stock_out_date: string;
  notes: string | null;
  item_count: number;
  total_qty: number;
  total_buy?: number;
  total_sell?: number;
  total_profit?: number;
};

export type StockOutItem = {
  id_stock_movement: string;
  product_code: string;
  product_name: string;
  batch_code: string | null;
  quantity: number;
  reason?: string | null;
  buy_per_pcs?: number | null;
  sell_per_pcs?: number | null;
  total_buy?: number;
  total_sell?: number;
  profit?: number;
};

export type StockOutDetail = {
  id_stock_out: string;
  stock_out_code: string;
  stock_out_type?: string;
  cashier_name?: string;
  operator_name?: string;
  stock_out_date: string;
  notes: string | null;
  total_qty: number;
  total_buy?: number;
  total_sell?: number;
  total_profit?: number;
  items: StockOutItem[];
};

export type Product = {
  id_product: string;
  product_code: string;
  product_name: string;
  available_stock: number;
  is_active?: string;
};

export type ProductBatch = {
  id_product_batch: string;
  batch_code: string;
  expired_date?: string | null;
  batch_qty: number;
};

export type DraftItem = { id_product: string; id_product_batch?: string; quantity: string };
