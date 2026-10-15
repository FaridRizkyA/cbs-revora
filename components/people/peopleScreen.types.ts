export type ScreenType = "users" | "members" | "staffs";

export type RoleOption = {
  id_role: string;
  role_name: string;
};

export type StaffGrade = {
  id_staff_grade: string;
  grade_code: string;
  grade_name: string;
  grade_order: number;
  description?: string | null;
  is_active?: string;
};

export type StaffGradeFormState = {
  grade_name: string;
  grade_order: string;
  description: string;
};

export type StaffsTab = "staffs" | "grades";

export type PersonRow = {
  id_user: string;
  id_profile?: string | null;
  id_member?: string;
  id_staff?: string;
  id_staff_grade?: string | null;
  created_at?: string | null;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  phone_number?: string | null;
  address?: string | null;
  profile_image?: string | null;
  is_active: "Y" | "N";
  roles?: RoleOption[];
  access_role?: string | null;
  member_code?: string;
  staff_code?: string;
  grade_name?: string | null;
  join_date?: string | null;
  exit_date?: string | null;
  total_spending?: number;
};

export type FormState = {
  id_user: string;
  email: string;
  password: string;
  password_confirmation: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  address: string;
  profile_image: string;
  role_ids: string[];
  access_role: string;
  member_code: string;
  staff_code: string;
  id_staff_grade: string;
  join_date: string;
  exit_date: string;
};

export type SelectedImage = {
  uri: string;
  name: string;
  mimeType?: string | null;
  file?: File;
};

