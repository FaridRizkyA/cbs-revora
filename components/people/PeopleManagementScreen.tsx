import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Print from "expo-print";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import ResponsiveModal from "../common/ResponsiveModal";
import DatePickerField from "../inventory/DatePickerField";
import FilterSelectField from "../inventory/FilterSelectField";
import FilterSheetModal from "../inventory/FilterSheetModal";
import InventoryDataTable, { InventoryDataTableColumn } from "../inventory/InventoryDataTable";
import InventoryFilterSection from "../inventory/InventoryFilterSection";
import InventoryPageHeader from "../inventory/InventoryPageHeader";
import InventoryRowActionsMenu from "../inventory/InventoryRowActionsMenu";
import PrimaryActionButton from "../inventory/PrimaryActionButton";
import {
  buildPeopleDetailReportPrintHtml,
  buildPeopleTableReportPrintHtml,
} from "../reports/people/PeopleReportPrintTemplate";
import { formatDate } from "../shu/formatters";
import { API_BASE_URL } from "../../utils/api";
import { logClientActivity } from "../../utils/activityLog";
import { canManagePeople, getAuthSession, normalizeRole } from "../../utils/authSession";
import { pickSquareImageAsync } from "../../utils/imageUpload";

type ScreenType = "users" | "members" | "staffs";

type RoleOption = {
  id_role: string;
  role_name: string;
};

type StaffGrade = {
  id_staff_grade: string;
  grade_code: string;
  grade_name: string;
  grade_order: number;
  description?: string | null;
  is_active?: string;
};

type StaffGradeFormState = {
  grade_name: string;
  grade_order: string;
  description: string;
};

type StaffsTab = "staffs" | "grades";

type PersonRow = {
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

type FormState = {
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

type SelectedImage = {
  uri: string;
  name: string;
  mimeType?: string | null;
  file?: File;
};

type WebCropState = {
  sourceUri: string;
  fileName: string;
  mimeType: string;
  objectUrl?: string;
  naturalWidth: number;
  naturalHeight: number;
};

const emptyForm: FormState = {
  id_user: "",
  email: "",
  password: "",
  password_confirmation: "",
  first_name: "",
  last_name: "",
  phone_number: "",
  address: "",
  profile_image: "",
  role_ids: [],
  access_role: "STAFF",
  member_code: "",
  staff_code: "",
  id_staff_grade: "",
  join_date: new Date().toISOString().slice(0, 10),
  exit_date: "",
};

const emptyGradeForm: StaffGradeFormState = {
  grade_name: "",
  grade_order: "0",
  description: "",
};

const config = {
  users: {
    title: "Users",
    subtitle: "Manage account access and authentication credentials.",
    endpoint: "/api/people/users",
    idKey: "id_user",
    addLabel: "Add User",
    inactiveTitle: "Inactive Users",
  },
  members: {
    title: "Members",
    subtitle: "Manage cooperative members and profile data used for SHU eligibility.",
    endpoint: "/api/people/members",
    idKey: "id_member",
    addLabel: "Add Member",
    inactiveTitle: "Inactive Members",
  },
  staffs: {
    title: "Staffs",
    subtitle: "Manage staff records, grades, and linked profile data.",
    endpoint: "/api/people/staffs",
    idKey: "id_staff",
    addLabel: "Add Staff",
    inactiveTitle: "Inactive Staffs",
  },
} satisfies Record<ScreenType, Record<string, string>>;

const getRowId = (type: ScreenType, row: PersonRow) => String(row[config[type].idKey as keyof PersonRow] || "");
const roleNames = (row: PersonRow) => (row.roles || []).map((role) => role.role_name).join(", ") || "-";
const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
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

const sanitizePersonNameInput = (value: string) => value.replace(/[^\p{L}\s]/gu, "").replace(/\s+/g, " ");
const sanitizePhoneInput = (value: string) => value.replace(/[^0-9+\-\s]/g, "").replace(/\s+/g, " ");
const countPhoneDigits = (value: string) => value.replace(/\D/g, "").length;
const isValidPersonName = (value: string, required = false) => {
  const text = value.trim();
  if (!text) return !required;
  return /^[\p{L}\s]+$/u.test(text);
};
const isValidPhone = (value: string) => {
  const text = value.trim();
  if (!text) return true;
  if (!/^[0-9+\-\s]{1,25}$/.test(text)) return false;
  if ((text.match(/\+/g) || []).length > 1 || (text.includes("+") && !text.startsWith("+"))) return false;
  const digitCount = countPhoneDigits(text);
  return digitCount >= 3 && digitCount <= 20;
};

const printReportHtml = async (html: string) => {
  await logClientActivity({
    activityType: "PRINT_REPORT",
    description: "Printed people management report.",
  });
  if (Platform.OS !== "web") {
    await Print.printAsync({ html });
    return;
  }

  if (typeof window === "undefined") return;

  const printWindow = window.open("", "_blank", "width=1024,height=720");
  if (!printWindow) {
    throw new Error("Please allow pop-ups to print this report.");
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => {
    printWindow.print();
  }, 250);
};

export default function PeopleManagementScreen({ type }: { type: ScreenType }) {
  const { width, height } = useWindowDimensions();
  const isPhone = width < 768;
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [users, setUsers] = useState<PersonRow[]>([]);
  const [grades, setGrades] = useState<StaffGrade[]>([]);
  const [gradeRows, setGradeRows] = useState<StaffGrade[]>([]);
  const [staffsTab, setStaffsTab] = useState<StaffsTab>("staffs");
  const [roleName, setRoleName] = useState("CASHIER");
  const [actorId, setActorId] = useState("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [inactiveOpen, setInactiveOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState<PersonRow | null>(null);
  const [profileImageFailed, setProfileImageFailed] = useState(false);
  const [editingRow, setEditingRow] = useState<PersonRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [gradeFormOpen, setGradeFormOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<StaffGrade | null>(null);
  const [gradeForm, setGradeForm] = useState<StaffGradeFormState>(emptyGradeForm);
  const [saving, setSaving] = useState(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [isProfileLocked, setIsProfileLocked] = useState(false);

  // Filter States
  const [filterOpen, setFilterOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [draftRoleFilter, setDraftRoleFilter] = useState("ALL");
  const [draftGradeFilter, setDraftGradeFilter] = useState("ALL");
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");

  const canManage = canManagePeople(roleName);
  const screenConfig = config[type];

  // Cropper States
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [webCrop, setWebCrop] = useState<WebCropState | null>(null);
  const [cropViewportSize, setCropViewportSize] = useState(320);
  const [cropTransform, setCropTransform] = useState({ scale: 1, translateX: 0, translateY: 0 });
  const cropTransformRef = useRef(cropTransform);
  const cropGestureRef = useRef({ startScale: 1, startTranslateX: 0, startTranslateY: 0, startClientX: 0, startClientY: 0 });
  const cropDragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const [isCropDragging, setIsCropDragging] = useState(false);
  const cropBoxRatio = 0.82;
  const cropBoxSize = Math.max(1, Math.floor(cropViewportSize * cropBoxRatio));
  const cropModalWidth = Math.min(440, Math.max(320, Math.floor(Math.min(width - 32, height - 300))));

  useEffect(() => {
    cropTransformRef.current = cropTransform;
  }, [cropTransform]);

  const loadRows = useCallback(() => {
    fetch(`${API_BASE_URL}${screenConfig.endpoint}`)
      .then((response) => response.json())
      .then((payload) => setRows(Array.isArray(payload?.data) ? payload.data : []))
      .catch(() => setRows([]));
  }, [screenConfig.endpoint]);

  const loadSupportData = useCallback(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/api/people/users`).then((response) => response.json()).catch(() => ({ data: [] })),
      fetch(`${API_BASE_URL}/api/people/staff-grades`).then((response) => response.json()).catch(() => ({ data: [] })),
      fetch(`${API_BASE_URL}/api/people/staff-grades?include_inactive=1`).then((response) => response.json()).catch(() => ({ data: [] })),
    ]).then(([userPayload, gradePayload, allGradePayload]) => {
      setUsers(Array.isArray(userPayload?.data) ? userPayload.data : []);
      setGrades(Array.isArray(gradePayload?.data) ? gradePayload.data : []);
      setGradeRows(Array.isArray(allGradePayload?.data) ? allGradePayload.data : []);
    });
  }, []);

  useEffect(() => {
    getAuthSession()
      .then((session) => {
        setRoleName(normalizeRole(session?.user?.role_name) || "CASHIER");
        setActorId(session?.user?.id_user || "");
      })
      .catch(() => setRoleName("CASHIER"));
    loadRows();
    loadSupportData();
  }, [loadRows, loadSupportData]);

  const handleUserChange = (value: string) => {
    setForm((prev) => ({ ...prev, id_user: value }));
    if (!value) {
      setForm((prev) => ({
        ...prev,
        first_name: "",
        last_name: "",
        phone_number: "",
        address: "",
        profile_image: "",
      }));
      setIsProfileLocked(false);
      return;
    }

    if (type !== "users" && formOpen && !editingRow) {
      fetch(`${API_BASE_URL}/api/people/users/${value}/profile`)
        .then((r) => r.json())
        .then((p) => {
          const profile = p?.data;
          if (profile && profile.first_name) {
            setForm((prev) => ({
              ...prev,
              first_name: profile.first_name || "",
              last_name: profile.last_name || "",
              phone_number: profile.phone_number || "",
              address: profile.address || "",
              profile_image: profile.profile_image || "",
            }));
            setIsProfileLocked(true);
          } else {
            setForm((prev) => ({
              ...prev,
              first_name: "",
              last_name: "",
              phone_number: "",
              address: "",
              profile_image: "",
            }));
            setIsProfileLocked(false);
          }
        })
        .catch(() => setIsProfileLocked(false));
    }
  };

  useEffect(() => {
    setProfileImageFailed(false);
  }, [profileOpen]);

  const closeWebCropper = useCallback(() => {
    if (webCrop?.objectUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(webCrop.objectUrl);
    }
    setWebCrop(null);
    setCropTransform({ scale: 1, translateX: 0, translateY: 0 });
  }, [webCrop]);

  const clampCropTransform = useCallback(
    (nextScale: number, nextTranslateX: number, nextTranslateY: number, sourceWidth: number, sourceHeight: number) => {
      const fitScale = Math.min(
        cropViewportSize / Math.max(1, sourceWidth),
        cropViewportSize / Math.max(1, sourceHeight)
      );
      const minCoverScale = Math.max(
        cropBoxSize / Math.max(1, sourceWidth * fitScale),
        cropBoxSize / Math.max(1, sourceHeight * fitScale)
      );
      const safeScale = Math.max(minCoverScale, nextScale);
      const displayWidth = Math.max(1, sourceWidth * fitScale * safeScale);
      const displayHeight = Math.max(1, sourceHeight * fitScale * safeScale);
      const overflowX = Math.max(0, (displayWidth - cropBoxSize) / 2);
      const overflowY = Math.max(0, (displayHeight - cropBoxSize) / 2);
      return {
        scale: safeScale,
        translateX: Math.min(overflowX, Math.max(-overflowX, nextTranslateX)),
        translateY: Math.min(overflowY, Math.max(-overflowY, nextTranslateY)),
      };
    },
    [cropBoxSize, cropViewportSize]
  );

  const setCropScale = useCallback(
    (nextScale: number) => {
      if (!webCrop) return;
      setCropTransform((current) =>
        clampCropTransform(
          nextScale,
          current.translateX,
          current.translateY,
          webCrop.naturalWidth || cropViewportSize,
          webCrop.naturalHeight || cropViewportSize
        )
      );
    },
    [clampCropTransform, cropViewportSize, webCrop]
  );

  const updateCropTranslation = useCallback(
    (nextTranslateX: number, nextTranslateY: number) => {
      if (!webCrop) return;
      setCropTransform((current) =>
        clampCropTransform(
          current.scale,
          nextTranslateX,
          nextTranslateY,
          webCrop.naturalWidth || cropViewportSize,
          webCrop.naturalHeight || cropViewportSize
        )
      );
    },
    [clampCropTransform, cropViewportSize, webCrop]
  );

  const beginCropDrag = useCallback(
    (clientX: number, clientY: number) => {
      cropDragRef.current = { active: true, lastX: clientX, lastY: clientY };
      cropGestureRef.current = {
        startScale: cropTransformRef.current.scale,
        startTranslateX: cropTransformRef.current.translateX,
        startTranslateY: cropTransformRef.current.translateY,
        startClientX: clientX,
        startClientY: clientY,
      };
      setIsCropDragging(true);
    },
    []
  );

  useEffect(() => {
    if (Platform.OS !== "web" || !isCropDragging || !webCrop) return;
    const handleMouseMove = (event: MouseEvent) => {
      if (!cropDragRef.current.active) return;
      const nextX = event.clientX;
      const nextY = event.clientY;
      updateCropTranslation(
        cropGestureRef.current.startTranslateX + (nextX - cropGestureRef.current.startClientX),
        cropGestureRef.current.startTranslateY + (nextY - cropGestureRef.current.startClientY)
      );
      event.preventDefault();
    };
    const handleMouseUp = () => {
      cropDragRef.current.active = false;
      setIsCropDragging(false);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isCropDragging, updateCropTranslation, webCrop]);

  useEffect(() => {
    if (Platform.OS !== "web" || !webCrop) return;
    let cancelled = false;
    const image = new window.Image();
    image.onload = () => {
      if (cancelled) return;
      const naturalWidth = image.naturalWidth || 1;
      const naturalHeight = image.naturalHeight || 1;
      const fitScale = Math.min(cropViewportSize / Math.max(1, naturalWidth), cropViewportSize / Math.max(1, naturalHeight));
      const minCoverScale = Math.max(cropBoxSize / Math.max(1, naturalWidth * fitScale), cropBoxSize / Math.max(1, naturalHeight * fitScale));
      setWebCrop((current) => (current ? { ...current, naturalWidth, naturalHeight } : current));
      setCropTransform((current) => clampCropTransform(Math.max(current.scale, minCoverScale), current.translateX, current.translateY, naturalWidth, naturalHeight));
    };
    image.onerror = () => { if (!cancelled) { Alert.alert("Error", "Failed to load image for cropping."); closeWebCropper(); } };
    image.src = webCrop.sourceUri;
    return () => { cancelled = true; };
  }, [webCrop, closeWebCropper, clampCropTransform, cropBoxSize, cropViewportSize]);

  const applyWebCrop = async () => {
    if (!webCrop || Platform.OS !== "web") return;
    const img = new window.Image();
    img.src = webCrop.sourceUri;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image for cropping."));
    });
    const cropSize = 512;
    const exportScale = cropSize / Math.max(1, cropBoxSize);
    const naturalWidth = img.naturalWidth || webCrop.naturalWidth || 1;
    const naturalHeight = img.naturalHeight || webCrop.naturalHeight || 1;
    const fitScale = Math.min(cropViewportSize / naturalWidth, cropViewportSize / naturalHeight);
    const renderScale = fitScale * cropTransform.scale * exportScale;
    const canvas = document.createElement("canvas");
    canvas.width = cropSize; canvas.height = cropSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported in this browser.");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cropSize, cropSize);
    ctx.translate(cropSize / 2 + cropTransform.translateX * exportScale, cropSize / 2 + cropTransform.translateY * exportScale);
    ctx.scale(renderScale, renderScale);
    ctx.translate(-naturalWidth / 2, -naturalHeight / 2);
    ctx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setSelectedImage({ uri: dataUrl, name: webCrop.fileName, mimeType: "image/jpeg" });
    closeWebCropper();
  };

  const pickImage = async () => {
    if (isProfileLocked) return;
    try {
      const image = await pickSquareImageAsync({ webMode: Platform.OS === "web" ? "raw" : "auto" });
      if (!image) return;
      if (Platform.OS === "web") {
        const uri = image.file ? URL.createObjectURL(image.file) : image.uri;
        setWebCrop({ sourceUri: uri, fileName: image.name || "profile.jpg", mimeType: image.mimeType || "image/jpeg", objectUrl: image.file ? uri : undefined, naturalWidth: 0, naturalHeight: 0 });
        return;
      }
      setSelectedImage({ uri: image.uri, name: image.name || "profile.jpg", mimeType: image.mimeType });
    } catch { Alert.alert("Error", "Failed to pick image."); }
  };

  const openCreate = () => {
    setEditingRow(null);
    setForm(emptyForm);
    setSelectedImage(null);
    setIsProfileLocked(false);
    setFormOpen(true);
  };

  const openEdit = useCallback((row: PersonRow) => {
    setEditingRow(row);
    setForm({
      id_user: row.id_user || "",
      email: row.email || "",
      password: "",
      password_confirmation: "",
      first_name: row.first_name || "",
      last_name: row.last_name || "",
      phone_number: row.phone_number || "",
      address: row.address || "",
      profile_image: row.profile_image || "",
      role_ids: (row.roles || []).map((role) => role.id_role),
      access_role: row.access_role || "STAFF",
      member_code: row.member_code || "",
      staff_code: row.staff_code || "",
      id_staff_grade: row.id_staff_grade || "",
      join_date: String(row.join_date || new Date().toISOString()).slice(0, 10),
      exit_date: row.exit_date ? String(row.exit_date).slice(0, 10) : "",
    });
    setSelectedImage(null);
    setIsProfileLocked(false);
    setFormOpen(true);
  }, []);

  const openCreateGrade = () => {
    setEditingGrade(null);
    setGradeForm(emptyGradeForm);
    setGradeFormOpen(true);
  };

  const openEditGrade = useCallback((grade: StaffGrade) => {
    setEditingGrade(grade);
    setGradeForm({
      grade_name: grade.grade_name || "",
      grade_order: String(grade.grade_order ?? 0),
      description: grade.description || "",
    });
    setGradeFormOpen(true);
  }, []);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const startDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const endDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    return rows.filter((row) => {
      // Search logic
      const searchable = [
        row.email,
        row.first_name,
        row.last_name,
        row.full_name,
        row.phone_number,
        row.member_code,
        row.staff_code,
        row.grade_name,
        roleNames(row),
      ].join(" ").toLowerCase();
      const matchSearch = !query || searchable.includes(query);

      // Filter logic
      let matchRole = true;
      if (type === "users" && roleFilter !== "ALL") {
        matchRole = (row.roles || []).some(r => r.role_name === roleFilter);
      }

      let matchGrade = true;
      if (type === "staffs" && staffsTab === "staffs" && gradeFilter !== "ALL") {
        matchGrade = row.grade_name === gradeFilter;
      }

      let matchDate = true;
      if (type !== "users") {
        const compareDate = row.join_date ? new Date(row.join_date) : null;
        if (startDate && (!compareDate || compareDate < startDate)) matchDate = false;
        if (endDate && (!compareDate || compareDate > endDate)) matchDate = false;
      }

      return matchSearch && matchRole && matchGrade && matchDate;
    });
  }, [rows, search, roleFilter, gradeFilter, dateFrom, dateTo, type, staffsTab]);

  const activeRows = useMemo(() => filteredRows.filter((row) => row.is_active === "Y"), [filteredRows]);
  const inactiveRows = useMemo(() => filteredRows.filter((row) => row.is_active !== "Y"), [filteredRows]);
  
  const activeFilters = useMemo(() => {
    const items: { key: string; label: string; value: string; onClear: () => void }[] = [];
    if (type === "users" && roleFilter !== "ALL") items.push({ key: "role", label: "Role", value: roleFilter, onClear: () => setRoleFilter("ALL") });
    if (type === "staffs" && gradeFilter !== "ALL") items.push({ key: "grade", label: "Grade", value: gradeFilter, onClear: () => setGradeFilter("ALL") });
    if (dateFrom) items.push({ key: "from", label: "From", value: dateFrom, onClear: () => setDateFrom("") });
    if (dateTo) items.push({ key: "to", label: "To", value: dateTo, onClear: () => setDateTo("") });
    return items;
  }, [type, roleFilter, gradeFilter, dateFrom, dateTo]);

  const roleOptions = useMemo(() => ["ALL", "ADMIN", "STAFF", "CASHIER", "MEMBER"], []);
  const gradeOptions = useMemo(() => ["ALL", ...Array.from(new Set(rows.map(r => r.grade_name).filter(Boolean) as string[])).sort()], [rows]);

  const filteredGrades = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sorted = [...gradeRows].sort((a, b) => Number(a.grade_order || 0) - Number(b.grade_order || 0) || String(a.grade_name || "").localeCompare(String(b.grade_name || "")));
    if (!query) return sorted;
    return sorted.filter((grade) =>
      `${grade.grade_code} ${grade.grade_name} ${grade.description || ""}`.toLowerCase().includes(query)
    );
  }, [gradeRows, search]);
  const activeGrades = useMemo(() => filteredGrades.filter((grade) => grade.is_active === "Y"), [filteredGrades]);
  const inactiveGrades = useMemo(() => filteredGrades.filter((grade) => grade.is_active !== "Y"), [filteredGrades]);
  const linkedUserOptions = useMemo(() => {
    if (type === "users") return users;

    const editingId = editingRow ? getRowId(type, editingRow) : "";
    const registeredUserIds = new Set(
      rows
        .filter((row) => getRowId(type, row) !== editingId)
        .map((row) => row.id_user)
        .filter(Boolean)
    );

    return users.filter((user) => user.id_user === form.id_user || !registeredUserIds.has(user.id_user));
  }, [editingRow, form.id_user, rows, type, users]);

  const buildCurrentPeopleReportMeta = () => {
    const items: { label: string; value: string }[] = [];
    const trimmedSearch = search.trim();
    if (trimmedSearch) items.push({ label: "Search", value: trimmedSearch });
    if (type === "staffs" && staffsTab === "staffs") items.push({ label: "Tab", value: "Staffs" });
    if (type === "users" && roleFilter !== "ALL") items.push({ label: "Role Filter", value: roleFilter });
    if (type === "staffs" && gradeFilter !== "ALL") items.push({ label: "Grade Filter", value: gradeFilter });
    if (dateFrom) items.push({ label: "Date From", value: dateFrom });
    if (dateTo) items.push({ label: "Date To", value: dateTo });
    return items;
  };

  const handlePrintPeopleTable = async () => {
    if (type === "staffs" && staffsTab === "grades") return;

    try {
      const html = buildPeopleTableReportPrintHtml({
        type,
        rows: activeRows,
        generatedAt: new Date(),
        generatedBy: roleName,
        meta: buildCurrentPeopleReportMeta(),
      });
      await printReportHtml(html);
    } catch (error) {
      Alert.alert("Print failed", error instanceof Error ? error.message : `Failed to print ${screenConfig.title.toLowerCase()} report.`);
    }
  };

  const handlePrintPeopleDetail = async () => {
    if (!profileOpen) return;

    try {
      const html = buildPeopleDetailReportPrintHtml({
        type,
        person: profileOpen,
        generatedAt: new Date(),
        generatedBy: roleName,
      });
      await printReportHtml(html);
    } catch (error) {
      Alert.alert("Print failed", error instanceof Error ? error.message : "Failed to print profile detail.");
    }
  };

  const submitForm = async () => {
    if (type === "users" && !form.email.trim()) {
      Alert.alert("Validation", "Email is required.");
      return;
    }
    if (type === "users" && !editingRow && form.password.length < 6) {
      Alert.alert("Validation", "Password must be at least 6 characters.");
      return;
    }
    if (type === "users" && form.password && form.password_confirmation !== form.password) {
      Alert.alert("Validation", "Password confirmation does not match.");
      return;
    }
    if (type !== "users" && !form.id_user) {
      Alert.alert("Validation", "Linked user is required.");
      return;
    }
    if (type !== "users" && !form.first_name.trim()) {
      Alert.alert("Validation", "First name is required.");
      return;
    }
    if (type !== "users" && !isValidPersonName(form.first_name, true)) {
      Alert.alert("Validation", "First name may only contain letters and spaces.");
      return;
    }
    if (type !== "users" && !isValidPersonName(form.last_name)) {
      Alert.alert("Validation", "Last name may only contain letters and spaces.");
      return;
    }
    if (type !== "users" && !isValidPhone(form.phone_number)) {
      Alert.alert("Validation", "Phone may only contain digits, +, spaces, and hyphens, with 3 to 20 digits.");
      return;
    }

    setSaving(true);
    try {
      let uploadedImageUrl = form.profile_image;
      if (selectedImage) {
        const formData = new FormData();
        formData.append("id_user", actorId);
        if (selectedImage.file) {
          formData.append("image", selectedImage.file, selectedImage.name);
        } else if (Platform.OS === "web" && selectedImage.uri.startsWith("data:")) {
          const blob = await (await fetch(selectedImage.uri)).blob();
          formData.append("image", blob, selectedImage.name);
        } else {
          formData.append("image", { uri: selectedImage.uri, name: selectedImage.name, type: selectedImage.mimeType || "image/jpeg" } as any);
        }
        const uploadRes = await fetch(`${API_BASE_URL}/api/people/profile-image`, { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData?.message || "Failed to upload image.");
        uploadedImageUrl = uploadData.data.image_url;
      } else if (!form.profile_image) {
        uploadedImageUrl = null;
      }

      const id = editingRow ? getRowId(type, editingRow) : "";
      const endpoint = editingRow ? `${API_BASE_URL}${screenConfig.endpoint}/${id}` : `${API_BASE_URL}${screenConfig.endpoint}`;
      const payload =
        type === "users"
          ? {
              email: form.email,
              password: form.password,
              actor_id: actorId,
            }
          : {
              id_user: form.id_user,
              first_name: form.first_name.trim(),
              last_name: form.last_name.trim(),
              phone_number: form.phone_number.trim(),
              address: form.address,
              profile_image: uploadedImageUrl,
              access_role: form.access_role,
              id_staff_grade: form.id_staff_grade || null,
              join_date: form.join_date,
              exit_date: type === "staffs" ? form.exit_date || null : null,
              actor_id: actorId,
            };
      const response = await fetch(endpoint, {
        method: editingRow ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || data?.message || "Failed to save data.");
      setFormOpen(false);
      loadRows();
      loadSupportData();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to save data.");
    } finally {
      setSaving(false);
    }
  };

  const submitGradeForm = async () => {
    const gradeOrder = Number(gradeForm.grade_order || 0);
    if (!gradeForm.grade_name.trim()) {
      Alert.alert("Validation", "Grade name is required.");
      return;
    }
    if (!Number.isInteger(gradeOrder) || gradeOrder < 0) {
      Alert.alert("Validation", "Grade order must be a non-negative integer.");
      return;
    }

    setSaving(true);
    try {
      const endpoint = editingGrade
        ? `${API_BASE_URL}/api/people/staff-grades/${editingGrade.id_staff_grade}`
        : `${API_BASE_URL}/api/people/staff-grades`;
      const response = await fetch(endpoint, {
        method: editingGrade ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade_name: gradeForm.grade_name,
          grade_order: gradeOrder,
          description: gradeForm.description || null,
          actor_id: actorId,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || payload?.message || "Failed to save grade.");
      setGradeFormOpen(false);
      loadSupportData();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to save grade.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = useCallback(async (row: PersonRow) => {
    try {
      const id = getRowId(type, row);
      const response = await fetch(`${API_BASE_URL}${screenConfig.endpoint}/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: row.is_active === "Y" ? "N" : "Y", actor_id: actorId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || payload?.message || "Failed to update status.");      
      loadRows();
      loadSupportData();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to update status.");
    }
  }, [actorId, loadRows, loadSupportData, screenConfig.endpoint, type]);

  const toggleGradeStatus = useCallback(async (grade: StaffGrade) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/people/staff-grades/${grade.id_staff_grade}/status`, {  
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: grade.is_active === "Y" ? "N" : "Y", actor_id: actorId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || payload?.message || "Failed to update grade status.");
      loadSupportData();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to update grade status.");
    }
  }, [actorId, loadSupportData]);

  const columns = useMemo<InventoryDataTableColumn<PersonRow>[]>(() => {
    const base: InventoryDataTableColumn<PersonRow>[] =
      type === "users"
        ? [
            {
              key: "email",
              title: "Email",
              weight: 38,
              sortable: true,
              sortValue: (row) => row.email || "",
              render: (row) => <Text style={styles.rowCell}>{row.email || "-"}</Text>,
            },
            {
              key: "roles",
              title: "Roles",
              weight: 32,
              sortable: true,
              sortValue: roleNames,
              render: (row) => <Text style={styles.rowCell}>{roleNames(row)}</Text>,
            },
            {
              key: "created_at",
              title: "Created At",
              weight: 16,
              sortable: true,
              defaultSort: "desc",
              sortValue: (row) => row.created_at || "",
              render: (row) => <Text style={styles.rowCell}>{formatDateTime(row.created_at)}</Text>,
            },
          ]
        : [
            {
              key: "name",
              title: "Full Name",
              weight: 24,
              sortable: true,
              defaultSort: "asc",
              sortValue: (row) => row.full_name || "",
              render: (row) => <Text style={styles.rowCell}>{row.full_name || "-"}</Text>,
            },
            {
              key: "email",
              title: "Email",
              weight: 24,
              sortable: true,
              sortValue: (row) => row.email || "",
              render: (row) => <Text style={styles.rowCell}>{row.email || "-"}</Text>,
            },
          ];

    if (type === "members") {
      base.unshift({
        key: "member_code",
        title: "Member Code",
        weight: 16,
        sortable: true,
        sortValue: (row) => row.member_code || "",
        render: (row) => <Text style={styles.rowCell}>{row.member_code || "-"}</Text>,
      });
      base.push({
        key: "join_date",
        title: "Join Date",
        weight: 16,
        sortable: true,
        sortValue: (row) => row.join_date || "",
        render: (row) => <Text style={styles.rowCell}>{formatDate(row.join_date || "")}</Text>,
      });
    }

    if (type === "staffs") {
      base.unshift({
        key: "staff_code",
        title: "Staff Code",
        weight: 16,
        sortable: true,
        sortValue: (row) => row.staff_code || "",
        render: (row) => <Text style={styles.rowCell}>{row.staff_code || "-"}</Text>,
      });
      base.push({
        key: "grade",
        title: "Grade",
        weight: 16,
        sortable: true,
        sortValue: (row) => row.grade_name || "",
        render: (row) => <Text style={styles.rowCell}>{row.grade_name || "-"}</Text>,
      });
    }

    base.push({
      key: "action",
      title: "Action",
      weight: 14,
      align: "center",
      render: (row, meta) => {
        const id = getRowId(type, row);
        return (
          <View style={[styles.actionCellWrap, openActionId === id ? styles.actionCellWrapOpen : null]}>        
            <InventoryRowActionsMenu
              open={openActionId === id}
              onToggle={() => setOpenActionId((prev) => (prev === id ? null : id))}
              direction={meta.rowIndex >= meta.totalRows - 2 ? "up" : "down"}
            >
              <Pressable
                style={[styles.actionOutlineBtn, styles.actionOutlineInfo]}
                onPress={() => {
                  setOpenActionId(null);
                  setProfileOpen(row);
                }}
              >
                <Text style={[styles.actionOutlineBtnText, styles.actionOutlineInfoText]}>
                  {type === "users" ? "User Detail" : "Profile Detail"}
                </Text>
              </Pressable>
              {canManage ? (
                <>
                  <Pressable
                    style={[styles.actionOutlineBtn, styles.actionOutlineEdit]}
                    onPress={() => {
                      setOpenActionId(null);
                      openEdit(row);
                    }}
                  >
                    <Text style={[styles.actionOutlineBtnText, styles.actionOutlineEditText]}>Edit</Text>       
                  </Pressable>
                  <Pressable
                    style={[styles.actionOutlineBtn, styles.actionOutlineDanger]}
                    onPress={() => {
                      setOpenActionId(null);
                      toggleStatus(row);
                    }}
                  >
                    <Text style={[styles.actionOutlineBtnText, styles.actionOutlineDangerText]}>Deactivate</Text>
                  </Pressable>
                </>
              ) : null}
            </InventoryRowActionsMenu>
          </View>
        );
      },
    });

    return base;
  }, [canManage, openActionId, openEdit, toggleStatus, type]);

  const inactiveColumns = useMemo<InventoryDataTableColumn<PersonRow>[]>(
    () => [
      ...columns.filter((column) => column.key !== "action"),
      {
        key: "action",
        title: "Action",
        weight: 14,
        align: "center",
        render: (row) =>
          canManage ? (
            <Pressable style={styles.activateButton} onPress={() => toggleStatus(row)}>
              <Text style={styles.activateButtonText}>Activate</Text>
            </Pressable>
          ) : null,
      },
    ],
    [canManage, columns, toggleStatus]
  );

  const gradeColumns = useMemo<InventoryDataTableColumn<StaffGrade>[]>(() => [
    {
      key: "grade_code",
      title: "Code",
      weight: 18,
      sortable: true,
      sortValue: (row) => row.grade_code || "",
      render: (row) => <Text style={styles.rowCell}>{row.grade_code}</Text>,
    },
    {
      key: "grade_name",
      title: "Grade Name",
      weight: 28,
      sortable: true,
      sortValue: (row) => row.grade_name || "",
      render: (row) => <Text style={styles.rowCell} numberOfLines={1}>{row.grade_name}</Text>,
    },
    {
      key: "grade_order",
      title: "Order",
      weight: 10,
      align: "center",
      sortable: true,
      sortValue: (row) => Number(row.grade_order || 0),
      render: (row) => <Text style={styles.rowCell}>{row.grade_order}</Text>,
    },
    {
      key: "description",
      title: "Description",
      weight: 30,
      sortable: true,
      sortValue: (row) => row.description || "",
      render: (row) => <Text style={styles.rowCell} numberOfLines={1}>{row.description || "-"}</Text>,
    },
    {
      key: "action",
      title: "Action",
      weight: 14,
      align: "center",
      render: (grade, meta) => (
        <View style={[styles.actionCellWrap, openActionId === grade.id_staff_grade ? styles.actionCellWrapOpen : null]}>
          <InventoryRowActionsMenu
            open={openActionId === grade.id_staff_grade}
            onToggle={() => setOpenActionId((prev) => (prev === grade.id_staff_grade ? null : grade.id_staff_grade))}
            direction={meta.rowIndex >= activeGrades.length - 2 ? "up" : "down"}
          >
            {canManage ? (
              <>
                <Pressable
                  style={[styles.actionOutlineBtn, styles.actionOutlineEdit]}
                  onPress={() => {
                    setOpenActionId(null);
                    openEditGrade(grade);
                  }}
                >
                  <Text style={[styles.actionOutlineBtnText, styles.actionOutlineEditText]}>Edit</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionOutlineBtn, styles.actionOutlineDanger]}
                  onPress={() => {
                    setOpenActionId(null);
                    toggleGradeStatus(grade);
                  }}
                >
                  <Text style={[styles.actionOutlineBtnText, styles.actionOutlineDangerText]}>Deactivate</Text> 
                </Pressable>
              </>
            ) : null}
          </InventoryRowActionsMenu>
        </View>
      ),
    },
  ], [canManage, openActionId, openEditGrade, toggleGradeStatus, activeGrades]);

  const inactiveGradeColumns = useMemo<InventoryDataTableColumn<StaffGrade>[]>(
    () => [
      ...gradeColumns.filter((column) => column.key !== "action"),
      {
        key: "action",
        title: "Action",
        weight: 14,
        align: "center",
        render: (grade) =>
          canManage ? (
            <Pressable style={styles.activateButton} onPress={() => toggleGradeStatus(grade)}>
              <Text style={styles.activateButtonText}>Activate</Text>
            </Pressable>
          ) : null,
      },
    ],
    [canManage, gradeColumns, toggleGradeStatus]
  );

  const isGradesTab = type === "staffs" && staffsTab === "grades" && roleName === "ADMIN";
  const pageTitle = isGradesTab ? "Grades" : screenConfig.title;
  const pageSubtitle = isGradesTab
    ? "Manage staff grade master data for report signatures and staff grouping."
    : screenConfig.subtitle;
  const addButtonLabel = isGradesTab ? "Add Grade" : screenConfig.addLabel;
  const searchPlaceholder = isGradesTab
    ? "Search by grade code, name, or description"
    : "Search by name, email, code, phone, role, or grade";
  const showExportButton = !isGradesTab;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <InventoryPageHeader
          title={pageTitle}
          subtitle={pageSubtitle}
          action={
            <View style={styles.headerActionRow}>
              {showExportButton ? (
                <Pressable
                  style={styles.exportIconButton}
                  onPress={handlePrintPeopleTable}
                  accessibilityLabel={`Print ${screenConfig.title.toLowerCase()} table report`}
                >
                  <MaterialCommunityIcons name="file-upload-outline" size={20} color="#1d4ed8" />
                </Pressable>
              ) : null}
              {canManage ? (
                <>
                  <Pressable style={styles.secondaryButton} onPress={() => setInactiveOpen(true)}>
                    <Text style={styles.secondaryButtonText}>Show Inactive</Text>
                  </Pressable>
                  <PrimaryActionButton label={addButtonLabel} onPress={isGradesTab ? openCreateGrade : openCreate} />
                </>
              ) : null}
            </View>
          }
        />

        {type === "staffs" && roleName === "ADMIN" ? (
          <View style={styles.tabRow}>
            <Pressable
              style={[styles.tabButton, staffsTab === "staffs" ? styles.tabButtonActive : null]}
              onPress={() => {
                setStaffsTab("staffs");
                setOpenActionId(null);
              }}
            >
              <Text style={[styles.tabButtonText, staffsTab === "staffs" ? styles.tabButtonTextActive : null]}>Staffs</Text>
            </Pressable>
            <Pressable
              style={[styles.tabButton, staffsTab === "grades" ? styles.tabButtonActive : null]}
              onPress={() => {
                setStaffsTab("grades");
                setOpenActionId(null);
              }}
            >
              <Text style={[styles.tabButtonText, staffsTab === "grades" ? styles.tabButtonTextActive : null]}>Grades</Text>
            </Pressable>
          </View>
        ) : null}

        <InventoryFilterSection
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={searchPlaceholder}
          onOpenFilter={() => {
            setDraftRoleFilter(roleFilter);
            setDraftGradeFilter(gradeFilter);
            setDraftDateFrom(dateFrom);
            setDraftDateTo(dateTo);
            setFilterOpen(true);
          }}
          activeFilters={activeFilters}
          onClearAllFilters={() => {
            setSearch("");
            setRoleFilter("ALL");
            setGradeFilter("ALL");
            setDateFrom("");
            setDateTo("");
          }}
        />

        {isGradesTab ? (
          <InventoryDataTable
            columns={gradeColumns}
            rows={activeGrades}
            rowKey={(row) => row.id_staff_grade}
            isRowActive={(row) => openActionId === row.id_staff_grade}
            emptyText="No grades found."
          />
        ) : (
          <InventoryDataTable
            columns={columns}
            rows={activeRows}
            rowKey={(row) => getRowId(type, row)}
            isRowActive={(row) => openActionId === getRowId(type, row)}
            emptyText={`No ${screenConfig.title.toLowerCase()} found.`}
          />
        )}

        <ResponsiveModal
          visible={inactiveOpen}
          onClose={() => setInactiveOpen(false)}
          maxWidthDesktop={980}
          maxWidthPhoneRatio={0.96}
          maxHeightDesktopRatio={0.9}
          maxHeightPhoneRatio={0.9}
          cardStyle={styles.modalCard}
        >
          <Text style={styles.modalTitle}>{isGradesTab ? "Inactive Grades" : screenConfig.inactiveTitle}</Text>   
          <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
            {isGradesTab ? (
              <InventoryDataTable
                columns={inactiveGradeColumns}
                rows={inactiveGrades}
                rowKey={(row) => row.id_staff_grade}
                emptyText="No inactive grades found."
              />
            ) : (
              <InventoryDataTable
                columns={inactiveColumns}
                rows={inactiveRows}
                rowKey={(row) => getRowId(type, row)}
                emptyText={`No inactive ${screenConfig.title.toLowerCase()} found.`}
              />
            )}
          </ScrollView>
          <Pressable style={styles.closeButton} onPress={() => setInactiveOpen(false)}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </ResponsiveModal>

        <ResponsiveModal
          visible={gradeFormOpen}
          onClose={() => (saving ? null : setGradeFormOpen(false))}
          maxWidthDesktop={520}
          maxWidthPhoneRatio={0.96}
          maxHeightDesktopRatio={0.86}
          maxHeightPhoneRatio={0.9}
          cardStyle={styles.modalCard}
        >
          <Text style={styles.modalTitle}>{editingGrade ? "Edit Grade" : "Add Grade"}</Text>
          <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
            {editingGrade ? <Meta label="Grade Code" value={editingGrade.grade_code} cardStyle={styles.profileMetaCardFull} /> : null}
            <Input
              label="Grade Name"
              value={gradeForm.grade_name}
              onChangeText={(value) => setGradeForm((prev) => ({ ...prev, grade_name: value }))}
            />
            <Input
              label="Order"
              value={gradeForm.grade_order}
              onChangeText={(value) => setGradeForm((prev) => ({ ...prev, grade_order: value.replace(/[^0-9]/g, "") }))}
            />
            <Input
              label="Description"
              value={gradeForm.description}
              onChangeText={(value) => setGradeForm((prev) => ({ ...prev, description: value }))}
            />
          </ScrollView>
          <View style={styles.footer}>
            <Pressable style={styles.cancelButton} onPress={() => setGradeFormOpen(false)} disabled={saving}>     
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.submitButton} onPress={submitGradeForm} disabled={saving}>
              <Text style={styles.submitButtonText}>{saving ? "Saving..." : "Save"}</Text>
            </Pressable>
          </View>
        </ResponsiveModal>

        <ResponsiveModal
          visible={Boolean(profileOpen)}
          onClose={() => setProfileOpen(null)}
          maxWidthDesktop={640}
          maxWidthPhoneRatio={0.96}
          maxHeightDesktopRatio={0.88}
          maxHeightPhoneRatio={0.9}
          cardStyle={styles.modalCard}
        >
          <View style={styles.detailModalHeader}>
            <Text style={styles.modalTitle}>{type === "users" ? "User Detail" : "Profile Detail"}</Text>
            <Pressable style={styles.detailPrintButton} onPress={handlePrintPeopleDetail}>
              <MaterialCommunityIcons name="file-upload-outline" size={18} color="#1d4ed8" />
              <Text style={styles.detailPrintButtonText}>Print Detail</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
            {type === "users" ? (
              <View style={styles.profileDetailWrap}>
                <Meta label="Email" value={profileOpen?.email} cardStyle={styles.profileMetaCardFull} />
                <Meta label="Roles" value={profileOpen ? roleNames(profileOpen) : "-"} cardStyle={styles.profileMetaCardFull} />
                <Meta label="Created At" value={formatDateTime(profileOpen?.created_at)} cardStyle={styles.profileMetaCardFull} />
              </View>
            ) : (
              <View style={styles.profileDetailWrap}>
                <View style={[styles.profileTopGrid, isPhone ? styles.profileTopGridPhone : styles.profileTopGridDesktop]}>
                  <View style={[styles.profileImageCard, isPhone ? styles.profileImageCardPhone : styles.profileImageCardDesktop]}>
                    {profileOpen?.profile_image && !profileImageFailed ? (
                      <Image
                        source={{ uri: profileOpen.profile_image }}
                        style={styles.profileImage}
                        contentFit="cover"
                        onError={() => setProfileImageFailed(true)}
                      />
                    ) : (
                      <Image source={require("../../assets/images/placeholders/default-profile.png")} style={styles.profileImage} contentFit="cover" />
                    )}
                  </View>
                  <View style={styles.profileMetaStack}>
                    <View style={styles.profileMetaRow}>
                      <Meta label="First Name" value={profileOpen?.first_name} cardStyle={styles.profileMetaCardHalf} />
                      <Meta label="Last Name" value={profileOpen?.last_name} cardStyle={styles.profileMetaCardHalf} />
                    </View>
                    <View style={styles.profileMetaRow}>
                      <Meta label="Email" value={profileOpen?.email} cardStyle={styles.profileMetaCardHalf} />    
                      <Meta label="Phone Number" value={profileOpen?.phone_number} cardStyle={styles.profileMetaCardHalf} />
                    </View>
                    {type === "members" ? (
                      <Meta label="Member Code" value={profileOpen?.member_code} cardStyle={styles.profileMetaCardFull} />
                    ) : null}
                    {type === "staffs" ? (
                      <View style={styles.profileMetaRow}>
                        <Meta label="Staff Code" value={profileOpen?.staff_code} cardStyle={styles.profileMetaCardHalf} />
                        <Meta label="Grade" value={profileOpen?.grade_name} cardStyle={styles.profileMetaCardHalf} />
                      </View>
                    ) : null}
                  </View>
                </View>
                <Meta label="Address" value={profileOpen?.address} textarea cardStyle={styles.profileMetaCardFull} />
              </View>
            )}
          </ScrollView>
          <Pressable style={styles.closeButton} onPress={() => setProfileOpen(null)}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </ResponsiveModal>

        <ResponsiveModal
          visible={formOpen}
          onClose={() => (saving ? null : setFormOpen(false))}
          maxWidthDesktop={560}
          maxWidthPhoneRatio={0.96}
          maxHeightDesktopRatio={0.9}
          maxHeightPhoneRatio={0.9}
          cardStyle={styles.modalCard}
        >
          <Text style={styles.modalTitle}>{editingRow ? `Edit ${screenConfig.title.slice(0, -1)}` : screenConfig.addLabel}</Text>
          <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
            {type === "users" ? (
              <>
                <Input label="Email" value={form.email} onChangeText={(value) => setForm((prev) => ({ ...prev, email: value.trim() }))} keyboardType="email-address" />
                <Input label={editingRow ? "New Password (optional)" : "Password"} value={form.password} onChangeText={(value) => setForm((prev) => ({ ...prev, password: value }))} secure />
                <Input
                  label="Confirm Password"
                  value={form.password_confirmation}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, password_confirmation: value }))}        
                  secure
                />
              </>
            ) : (
              <FilterSelectField
                label="Linked User"
                value={form.id_user}
                options={[
                  { label: "Select user", value: "" },
                  ...linkedUserOptions.map((user) => ({ label: user.email, value: user.id_user })),
                ]}
                onChange={handleUserChange}
              />
            )}

            {type === "staffs" ? (
              <FilterSelectField
                label="Access Role"
                value={form.access_role}
                options={["STAFF", "CASHIER", "ADMIN"].map((role) => ({ label: role, value: role }))}
                onChange={(value) => setForm((prev) => ({ ...prev, access_role: value }))}
              />
            ) : null}
            {type === "staffs" ? (
              <FilterSelectField
                label="Staff Grade"
                value={form.id_staff_grade}
                options={[{ label: "Select grade", value: "" }, ...grades.map((grade) => ({ label: grade.grade_name, value: grade.id_staff_grade }))]}
                onChange={(value) => setForm((prev) => ({ ...prev, id_staff_grade: value }))}
              />
            ) : null}

            {type !== "users" ? (
              <>
                <View style={styles.formField}>
                  <Text style={styles.label}>Profile Photo</Text>
                  <View style={styles.photoActionRow}>
                    <Pressable style={[styles.filePickerBtn, { flex: 1 }, isProfileLocked && { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" }]} onPress={pickImage}>
                      <Text style={[styles.filePickerBtnText, isProfileLocked && { color: "#94a3b8" }]}>{selectedImage || form.profile_image ? "Change Photo" : "Select Photo"}</Text>
                    </Pressable>
                    {(selectedImage || form.profile_image) && !isProfileLocked ? (
                      <Pressable
                        style={styles.removePhotoBtn}
                        onPress={() => {
                          setSelectedImage(null);
                          setForm(prev => ({ ...prev, profile_image: "" }));
                        }}
                      >
                        <MaterialCommunityIcons name="delete-outline" size={20} color="#dc2626" />
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={styles.filePickerHint}>{isProfileLocked ? "Profile photo is linked to existing record." : selectedImage?.name || (form.profile_image ? "Current photo will be kept." : "No photo selected (optional).")}</Text>
                </View>
                <View style={styles.twoCol}>
                  <Input label="First Name" value={form.first_name} onChangeText={(value) => setForm((prev) => ({ ...prev, first_name: sanitizePersonNameInput(value) }))} wrapStyle={styles.twoColField} editable={!isProfileLocked} />
                  <Input label="Last Name" value={form.last_name} onChangeText={(value) => setForm((prev) => ({ ...prev, last_name: sanitizePersonNameInput(value) }))} wrapStyle={styles.twoColField} editable={!isProfileLocked} />
                </View>
                <Input label="Phone" value={form.phone_number} onChangeText={(value) => setForm((prev) => ({ ...prev, phone_number: sanitizePhoneInput(value) }))} editable={!isProfileLocked} keyboardType="phone-pad" />
                <Input label="Address" value={form.address} onChangeText={(value) => setForm((prev) => ({ ...prev, address: value }))} editable={!isProfileLocked} />
              </>
            ) : null}

            {type !== "users" ? (
              <DatePickerField label="Join Date" value={form.join_date} onChange={(value) => setForm((prev) => ({ ...prev, join_date: value }))} />
            ) : null}
            {type === "staffs" && editingRow ? (
              <DatePickerField label="Exit Date" value={form.exit_date} placeholder="Optional exit date" onChange={(value) => setForm((prev) => ({ ...prev, exit_date: value }))} />
            ) : null}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable style={styles.cancelButton} onPress={() => setFormOpen(false)} disabled={saving}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.submitButton} onPress={submitForm} disabled={saving}>
              <Text style={styles.submitButtonText}>{saving ? "Saving..." : "Save"}</Text>
            </Pressable>
          </View>
        </ResponsiveModal>

        {webCrop ? (
          <Modal visible={!!webCrop} transparent animationType="fade" onRequestClose={closeWebCropper}>
            <View style={styles.cropOverlayRoot}>
              <View style={styles.cropOverlayBackdrop} />
              <View style={[styles.cropOverlayCard, { width: cropModalWidth, maxHeight: Math.max(320, height - 32) }]}>
                <View style={styles.cropModalHeader}>
                  <Text style={styles.modalTitle}>Crop Profile Photo</Text>
                  <Text style={styles.cropModalSubtitle}>Drag and zoom to adjust your 1:1 profile photo.</Text>   
                </View>
                <View style={styles.cropViewport} onLayout={(e) => setCropViewportSize(e.nativeEvent.layout.width)}>
                  <View
                    style={styles.cropCanvas}
                    // @ts-expect-error web
                    onMouseDown={(e: any) => { if (Platform.OS === 'web') beginCropDrag(e.clientX, e.clientY); }} 
                    onTouchStart={(e) => { const t = e.nativeEvent.touches?.[0] as any; if (t) beginCropDrag(t.clientX, t.clientY); }}
                    // @ts-expect-error web
                    onWheel={(e: any) => {
                      const delta = e.nativeEvent?.deltaY ?? 0;
                      const next = delta > 0 ? Math.max(0.2, cropTransformRef.current.scale - 0.1) : Math.min(3, cropTransformRef.current.scale + 0.1);
                      setCropScale(next);
                    }}
                  >
                    {webCrop ? (
                      <Image
                        source={{ uri: webCrop.sourceUri }}
                        style={[styles.cropImage, {
                          width: (webCrop.naturalWidth || cropViewportSize) * (Math.min(cropViewportSize/Math.max(1,webCrop.naturalWidth), cropViewportSize/Math.max(1,webCrop.naturalHeight))) * cropTransform.scale,
                          height: (webCrop.naturalHeight || cropViewportSize) * (Math.min(cropViewportSize/Math.max(1,webCrop.naturalWidth), cropViewportSize/Math.max(1,webCrop.naturalHeight))) * cropTransform.scale,
                          left: (cropViewportSize - (webCrop.naturalWidth || cropViewportSize) * (Math.min(cropViewportSize/Math.max(1,webCrop.naturalWidth), cropViewportSize/Math.max(1,webCrop.naturalHeight))) * cropTransform.scale) / 2 + cropTransform.translateX,
                          top: (cropViewportSize - (webCrop.naturalHeight || cropViewportSize) * (Math.min(cropViewportSize/Math.max(1,webCrop.naturalWidth), cropViewportSize/Math.max(1,webCrop.naturalHeight))) * cropTransform.scale) / 2 + cropTransform.translateY,
                        }]}
                        contentFit="contain"
                      />
                    ) : null}
                    <View pointerEvents="none" style={[styles.cropShade, { height: (cropViewportSize - cropBoxSize)/2, top: 0, left: 0, right: 0 }]} />
                    <View pointerEvents="none" style={[styles.cropShade, { height: (cropViewportSize - cropBoxSize)/2, bottom: 0, left: 0, right: 0 }]} />
                    <View pointerEvents="none" style={[styles.cropShade, { width: (cropViewportSize - cropBoxSize)/2, top: (cropViewportSize - cropBoxSize)/2, bottom: (cropViewportSize - cropBoxSize)/2, left: 0 }]} />
                    <View pointerEvents="none" style={[styles.cropShade, { width: (cropViewportSize - cropBoxSize)/2, top: (cropViewportSize - cropBoxSize)/2, bottom: (cropViewportSize - cropBoxSize)/2, right: 0 }]} />        
                    <View pointerEvents="none" style={[styles.cropBoxFrame, { width: cropBoxSize, height: cropBoxSize, left: (cropViewportSize - cropBoxSize)/2, top: (cropViewportSize - cropBoxSize)/2 }]} />
                  </View>
                </View>
                <View style={styles.cropModalFooter}>
                  <Pressable style={styles.cancelButton} onPress={closeWebCropper}><Text style={styles.cancelButtonText}>Cancel</Text></Pressable>
                  <Pressable style={styles.submitButton} onPress={applyWebCrop}><Text style={styles.submitButtonText}>Use Crop</Text></Pressable>
                </View>
              </View>
            </View>
          </Modal>
        ) : null}
      </ScrollView>

      <FilterSheetModal
        title={`Filter ${screenConfig.title}`}
        visible={filterOpen}
        onApply={() => {
          setRoleFilter(draftRoleFilter);
          setGradeFilter(draftGradeFilter);
          setDateFrom(draftDateFrom);
          setDateTo(draftDateTo);
          setFilterOpen(false);
        }}
        onReset={() => {
          setDraftRoleFilter("ALL");
          setDraftGradeFilter("ALL");
          setDraftDateFrom("");
          setDraftDateTo("");
          setRoleFilter("ALL");
          setGradeFilter("ALL");
          setDateFrom("");
          setDateTo("");
        }}
        onClose={() => setFilterOpen(false)}
      >
        {type === "users" ? (
          <FilterSelectField
            label="Role"
            value={draftRoleFilter}
            options={roleOptions.map(opt => ({ label: opt, value: opt }))}
            onChange={setDraftRoleFilter}
          />
        ) : null}
        
        {type === "staffs" && staffsTab === "staffs" ? (
          <FilterSelectField
            label="Grade"
            value={draftGradeFilter}
            options={gradeOptions.map(opt => ({ label: opt, value: opt }))}
            onChange={setDraftGradeFilter}
          />
        ) : null}

        {type !== "users" ? (
          <>
            <Text style={styles.filterLabel}>Join Date Range</Text>
            <View style={styles.rangeRow}>
              <View style={styles.rangeField}>
                <DatePickerField
                  label="From"
                  value={draftDateFrom}
                  onChange={setDraftDateFrom}
                  maximumDate={draftDateTo ? new Date(`${draftDateTo}T00:00:00`) : undefined}
                />
              </View>
              <View style={styles.rangeField}>
                <DatePickerField
                  label="To"
                  value={draftDateTo}
                  onChange={setDraftDateTo}
                  minimumDate={draftDateFrom ? new Date(`${draftDateFrom}T00:00:00`) : undefined}
                />
              </View>
            </View>
          </>
        ) : null}
      </FilterSheetModal>
    </View>
  );
}

function Input({
  label,
  value,
  onChangeText,
  secure,
  wrapStyle,
  editable = true,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secure?: boolean;
  wrapStyle?: object;
  editable?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
}) {
  return (
    <View style={[styles.fieldWrap, wrapStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        placeholder={label}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType}
        style={[styles.input, !editable && { backgroundColor: "#f1f5f9", color: "#64748b" }]}
        editable={editable}
      />
    </View>
  );
}

function Meta({
  label,
  value,
  textarea,
  cardStyle,
}: {
  label: string;
  value?: string | number | null;
  textarea?: boolean;
  cardStyle?: object;
}) {
  return (
    <View style={[styles.metaItem, textarea && styles.metaItemTextarea, cardStyle]}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value || "-"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f6fb" },
  content: { padding: 14, gap: 12 },
  headerActionRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  exportIconButton: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center" },
  tabRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  tabButton: {
    minHeight: 36,
    minWidth: 88,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonActive: { borderColor: "#1d4ed8", backgroundColor: "#eff6ff" },
  tabButtonText: { color: "#334155", fontSize: 12, fontWeight: "700" },
  tabButtonTextActive: { color: "#1d4ed8" },
  secondaryButton: { height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: "#1d4ed8", fontWeight: "700", fontSize: 12 },
  rowCell: { color: "#0f172a", fontSize: 12 },
  rowCellRight: { textAlign: "right" },
  actionCellWrap: { alignItems: "center", justifyContent: "center" },
  actionCellWrapOpen: { position: "relative", zIndex: 4000 },
  actionOutlineBtn: { minHeight: 30, borderRadius: 7, borderWidth: 1, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  actionOutlineBtnText: { fontSize: 11, fontWeight: "700" },
  actionOutlineInfo: { borderColor: "#93c5fd", backgroundColor: "#eff6ff" },
  actionOutlineInfoText: { color: "#1d4ed8" },
  actionOutlineEdit: { borderColor: "#fdba74", backgroundColor: "#fff7ed" },
  actionOutlineEditText: { color: "#c2410c" },
  actionOutlineDanger: { borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  actionOutlineDangerText: { color: "#b91c1c" },
  activateButton: { alignSelf: "center", minHeight: 30, borderRadius: 8, borderWidth: 1, borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  activateButtonText: { color: "#166534", fontSize: 11, fontWeight: "700" },
  modalCard: { width: "100%", backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10 },
  modalTitle: { color: "#0f172a", fontSize: 18, fontWeight: "800" },
  detailModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },  
  detailPrintButton: { minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  detailPrintButtonText: { color: "#1d4ed8", fontSize: 12, fontWeight: "700" },
  modalBody: { gap: 10, paddingBottom: 6 },
  fieldWrap: { gap: 6 },
  label: { color: "#334155", fontSize: 12, fontWeight: "700" },
  input: { height: 38, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 12, color: "#0f172a" },
  twoCol: { flexDirection: "row", gap: 8 },
  twoColField: { flex: 1 },
  profileDetailWrap: { gap: 10 },
  profileTopGrid: { width: "100%", gap: 12 },
  profileTopGridDesktop: { flexDirection: "row", alignItems: "stretch" },
  profileTopGridPhone: { flexDirection: "column" },
  profileImageCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    overflow: "hidden",
  },
  profileImageCardDesktop: { width: "30%", aspectRatio: 1, flexShrink: 0 },
  profileImageCardPhone: { width: "100%", aspectRatio: 1 },
  profileImage: { width: "100%", height: "100%" },
  profileMetaStack: { flex: 1, gap: 10, width: "100%" },
  profileMetaRow: { flexDirection: "row", gap: 10, width: "100%", flexWrap: "wrap" },
  metaItem: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", padding: 10, gap: 3 },
  metaItemTextarea: { flex: 0, width: "100%", minHeight: 124, alignItems: "stretch" },
  profileMetaCardHalf: { flexBasis: "48%", minWidth: 0 },
  profileMetaCardFull: { flexBasis: "100%", minWidth: 0 },
  metaLabel: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  metaValue: { color: "#0f172a", fontSize: 13, fontWeight: "700" },
  filterLabel: { color: "#334155", fontSize: 12, fontWeight: "700", marginTop: 8 },
  rangeRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  rangeField: { flex: 1 },
  footer: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  cancelButton: { minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  cancelButtonText: { color: "#334155", fontSize: 12, fontWeight: "700" },
  submitButton: { minHeight: 36, borderRadius: 10, backgroundColor: "#1d4ed8", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  submitButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  closeButton: { marginTop: 8, height: 38, borderRadius: 10, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  closeButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  formField: { gap: 6 },
  photoActionRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  removePhotoBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: "#dc2626", backgroundColor: "#fef2f2", alignItems: "center", justifyContent: "center" },
  filePickerBtn: { minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center" },
  filePickerBtnText: { color: "#1d4ed8", fontSize: 12, fontWeight: "700" },
  filePickerHint: { color: "#64748b", fontSize: 11, marginTop: -2 },
  cropOverlayRoot: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, alignItems: "center", justifyContent: "center" },
  cropOverlayBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.85)" },
  cropOverlayCard: { backgroundColor: "#fff", borderRadius: 16, overflow: "hidden" },
  cropModalHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  cropModalSubtitle: { color: "#64748b", fontSize: 12, marginTop: 4 },
  cropViewport: { width: "100%", aspectRatio: 1, backgroundColor: "#0f172a" },
  cropCanvas: { flex: 1, position: "relative" },
  cropImage: { position: "absolute" },
  cropShade: { position: "absolute", backgroundColor: "rgba(0,0,0,0.5)" },
  cropBoxFrame: { position: "absolute", borderWidth: 2, borderColor: "#fff" },
  cropModalFooter: { padding: 16, flexDirection: "row", justifyContent: "flex-end", gap: 10, borderTopWidth: 1, borderTopColor: "#e2e8f0" },
});
