export type ShuPeriod = {
  id_shu_period?: string;
  period_name: string;
  start_date: string;
  end_date: string;
  calculation_status?: string;
  gross_profit_display?: number;
  income_belanja_amount?: number;
  expense_belanja_amount?: number;
  net_belanja_amount?: number;
  manager_cut_belanja_amount?: number;
  shu_belanja_pool_amount?: number;
  income_usaha_amount?: number;
  expense_usaha_amount?: number;
  net_usaha_amount?: number;
  manager_cut_usaha_amount?: number;
  shu_usaha_pool_amount?: number;
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
  eligible_shu_usaha: boolean;
  shu_belanja_amount: number;
  shu_usaha_amount: number;
  shu_amount: number;
};

export type OfficerDistribution = {
  id_staff: string;
  officer_role_code: string;
  shu_amount: number;
};
