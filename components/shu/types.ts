export type ShuPeriod = {
  id_shu_period?: string;
  period_name: string;
  start_date: string;
  end_date: string;
  calculation_status?: string;
  gross_profit_display?: number;
  sales_income_amount?: number;
  sales_cost_amount?: number;
  sales_net_amount?: number;
  sales_manager_cut_amount?: number;
  sales_shu_pool_amount?: number;
  business_income_amount?: number;
  business_expense_amount?: number;
  business_net_amount?: number;
  business_manager_cut_amount?: number;
  business_shu_pool_amount?: number;
  total_shu_distributed_amount?: number;
  total_manager_fund_amount?: number;
  reconciliation_gap_amount?: number;
};

export type MemberDistribution = {
  id_member: string;
  full_name?: string;
  member_code?: string;
  is_active?: string;
  member_total_spending: number;
  spending_percentage: number;
  eligible_business_shu: boolean;
  sales_shu_amount: number;
  business_shu_amount: number;
  shu_amount: number;
};

export type OfficerDistribution = {
  id_staff: string;
  officer_role_code: string;
  shu_amount: number;
};
