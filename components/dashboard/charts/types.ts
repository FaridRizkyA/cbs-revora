export type LineGraphItem = {
  month_key: string;
  month_label: string;
  total_profit: number;
  total_transactions: number;
};

export type PieGraphItem = {
  id_product: string;
  product_name: string;
  available_stock: number;
  percentage: number;
};

export type BarGraphItem = {
  id_product: string;
  product_name: string;
  transaction_count: number;
  total_quantity: number;
};

export type DonutGraphItem = {
  safe_stock: number;
  low_stock: number;
  out_of_stock: number;
};

export type GraphsResponse = {
  line_graph: LineGraphItem[];
  pie_graph: PieGraphItem[];
  bar_graph: BarGraphItem[];
  donut_graph: DonutGraphItem;
};
