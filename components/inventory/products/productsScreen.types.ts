export type Product = {
  id_product: string;
  is_active?: string;
  id_supplier: string | null;
  supplier_name?: string | null;
  supplier_code?: string | null;
  product_code: string;
  barcode: string | null;
  product_name: string;
  description?: string | null;
  product_image?: string | null;
  selling_price: number;
  minimum_stock: number;
  available_stock: number;
};

export type ProductBatchSummary = {
  id_product_batch: string;
  batch_code: string;
  expired_date: string;
  batch_qty: number;
};

export type SupplierOption = {
  id_supplier: string;
  supplier_name: string;
};

export type ProductFormState = {
  id_supplier: string;
  barcode: string;
  product_name: string;
  description: string;
  selling_price: string;
  minimum_stock: string;
  product_image: string;
};

export type SelectedProductImage = {
  uri: string;
  name: string;
  mimeType?: string | null;
  file?: File;
};

export type PendingActionType = "create" | "edit" | "deactivate" | "activate";
