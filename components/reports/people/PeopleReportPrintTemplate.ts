import {
  buildReportDetailPrintHtml,
  buildReportPdfFileName,
  buildReportTablePrintHtml,
  ReportMetaItem,
  ReportTableColumn,
} from "../shared/ReportPrintTemplate";

export type PeopleReportType = "users" | "members" | "staffs";

export type PeopleReportRole = {
  id_role?: string;
  role_name: string;
};

export type PeopleReportRow = {
  id_user: string;
  id_profile?: string | null;
  created_at?: string | Date | null;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  phone_number?: string | null;
  address?: string | null;
  is_active: "Y" | "N" | string;
  roles?: PeopleReportRole[];
  access_role?: string | null;
  member_code?: string | null;
  staff_code?: string | null;
  grade_name?: string | null;
  join_date?: string | Date | null;
  exit_date?: string | Date | null;
  total_spending?: number | null;
};

export type PeopleReportOptions = {
  type: PeopleReportType;
  rows: PeopleReportRow[];
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

export type PeopleDetailReportOptions = {
  type: PeopleReportType;
  person: PeopleReportRow;
  generatedAt?: string | Date;
  generatedBy?: string | null;
  meta?: ReportMetaItem[];
};

const reportKeyByType: Record<PeopleReportType, string> = {
  users: "people-users",
  members: "people-members",
  staffs: "people-staffs",
};

const titleByType: Record<PeopleReportType, string> = {
  users: "Users Report",
  members: "Members Report",
  staffs: "Staffs Report",
};

const detailTitleByType: Record<PeopleReportType, string> = {
  users: "User Detail",
  members: "Member Detail",
  staffs: "Staff Detail",
};

const subtitleByType: Record<PeopleReportType, string> = {
  users: "Account access and role data",
  members: "Cooperative member profile data",
  staffs: "Staff profile and grade data",
};

const roleNames = (row: PeopleReportRow) => (row.roles || []).map((role) => role.role_name).join(", ") || "-";

const fullName = (row: PeopleReportRow) =>
  row.full_name || [row.first_name, row.last_name].filter(Boolean).join(" ") || "-";

const formatDateOnly = (value?: string | Date | null) => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
};

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(/\./g, ":");
};

const buildPeopleTableColumns = (type: PeopleReportType): ReportTableColumn<PeopleReportRow>[] => {
  const columns: ReportTableColumn<PeopleReportRow>[] = [
    {
      key: "row_number",
      title: "No.",
      align: "center",
      width: "42px",
      getValue: (_row, index) => index + 1,
    },
  ];

  if (type === "members") {
    columns.push({
      key: "member_code",
      title: "Member Code",
      width: "16%",
      getValue: (row) => row.member_code,
    });
  }

  if (type === "staffs") {
    columns.push({
      key: "staff_code",
      title: "Staff Code",
      width: "16%",
      getValue: (row) => row.staff_code,
    });
  }

  if (type !== "users") {
    columns.push(
      {
        key: "full_name",
        title: "Full Name",
        getValue: (row) => fullName(row),
      },
      {
        key: "email",
        title: "Email",
        width: "22%",
        getValue: (row) => row.email,
      },
      {
        key: "phone_number",
        title: "Phone",
        width: "15%",
        getValue: (row) => row.phone_number,
      }
    );
  }

  if (type === "users") {
    columns.push(
      {
        key: "email",
        title: "Email",
        getValue: (row) => row.email,
      },
      {
        key: "roles",
        title: "Roles",
        width: "24%",
        getValue: roleNames,
      },
      {
        key: "created_at",
        title: "Created At",
        width: "18%",
        getValue: (row) => formatDateTime(row.created_at),
      }
    );
  }

  if (type === "members") {
    columns.push({
      key: "join_date",
      title: "Join Date",
      width: "14%",
      getValue: (row) => formatDateOnly(row.join_date),
    });
  }

  if (type === "staffs") {
    columns.push(
      {
        key: "grade",
        title: "Grade",
        width: "16%",
        getValue: (row) => row.grade_name,
      },
      {
        key: "access_role",
        title: "Access Role",
        width: "13%",
        getValue: (row) => row.access_role,
      }
    );
  }

  return columns;
};

export const buildPeopleTableReportPdfFileName = (type: PeopleReportType, date?: string | Date | null) =>
  buildReportPdfFileName({
    reportKey: reportKeyByType[type],
    variant: "table",
    date,
  });

export const buildPeopleDetailReportPdfFileName = (
  type: PeopleReportType,
  person: PeopleReportRow,
  date?: string | Date | null
) =>
  buildReportPdfFileName({
    reportKey: reportKeyByType[type],
    variant: "detail",
    documentNumber: type === "members" ? person.member_code : type === "staffs" ? person.staff_code : person.email,
    date,
  });

export const buildPeopleTableReportPrintHtml = ({
  type,
  rows,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: PeopleReportOptions) =>
  buildReportTablePrintHtml({
    title: titleByType[type],
    subtitle: subtitleByType[type],
    reportKey: reportKeyByType[type],
    generatedAt,
    generatedBy,
    meta: [{ label: "Total Rows", value: rows.length }, ...meta],
    rows,
    columns: buildPeopleTableColumns(type),
    emptyText: `No ${type} data found.`,
  });

export const buildPeopleDetailReportPrintHtml = ({
  type,
  person,
  generatedAt = new Date(),
  generatedBy,
  meta = [],
}: PeopleDetailReportOptions) => {
  const fields =
    type === "users"
      ? [
          { label: "Email", value: person.email },
          { label: "Roles", value: roleNames(person) },
          { label: "Created At", value: formatDateTime(person.created_at) },
        ]
      : [
          ...(type === "members" ? [{ label: "Member Code", value: person.member_code }] : []),
          ...(type === "staffs"
            ? [
                { label: "Staff Code", value: person.staff_code },
                { label: "Grade", value: person.grade_name },
                { label: "Access Role", value: person.access_role },
              ]
            : []),
          { label: "Full Name", value: fullName(person) },
          { label: "Email", value: person.email },
          { label: "Phone Number", value: person.phone_number },
          { label: "Join Date", value: formatDateOnly(person.join_date) },
          ...(type === "staffs" ? [{ label: "Exit Date", value: formatDateOnly(person.exit_date) }] : []),
          { label: "Address", value: person.address },
          { label: "Created At", value: formatDateTime(person.created_at) },
        ];

  return buildReportDetailPrintHtml({
    title: detailTitleByType[type],
    subtitle: subtitleByType[type],
    reportKey: reportKeyByType[type],
    documentNumber: type === "members" ? person.member_code : type === "staffs" ? person.staff_code : person.email,
    generatedAt,
    generatedBy,
    meta,
    sections: [
      {
        title: "Profile Information",
        fields,
      },
    ],
  });
};
