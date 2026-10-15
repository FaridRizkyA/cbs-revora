import { printReportHtml } from "../../utils/printUtils";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image } from "expo-image";
import { Modal, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import ResponsiveModal from "../common/ResponsiveModal";
import DatePickerField from "../inventory/DatePickerField";
import FilterSelectField from "../inventory/FilterSelectField";
import FilterSheetModal from "../inventory/FilterSheetModal";
import { InventoryConfirmModal, InventoryResultModal } from "../inventory/ActionModals";
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
import { fetchWithAuth } from "../../utils/fetchWithAuth";
import { canManagePeople, getAuthSession, normalizeRole } from "../../utils/authSession";
import { pickSquareImageAsync } from "../../utils/imageUpload";
import { isValidPasswordPolicy, PASSWORD_POLICY_MESSAGE } from "../../utils/passwordPolicy";
import { formatDisplayDateTime as formatDateTime, toLocalDateInput } from "../../utils/dateFormat";
import { styles } from "./peopleScreen.styles";
import { useSquareImageCrop } from "../../utils/useSquareImageCrop";
import { Input, Meta } from "./PeopleFields";
import { isValidPersonName, isValidPhone, roleNames, sanitizePersonNameInput, sanitizePhoneInput } from "./peopleScreen.helpers";
import type { ScreenType, StaffGrade, StaffGradeFormState, StaffsTab, PersonRow, FormState, SelectedImage } from "./peopleScreen.types";

type PendingAction =
  | { type: "save-person" }
  | { type: "save-grade" }
  | { type: "person-status"; row: PersonRow }
  | { type: "grade-status"; grade: StaffGrade };

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
  join_date: toLocalDateInput(),
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
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultStatus, setResultStatus] = useState<"success" | "error">("success");
  const [resultTitle, setResultTitle] = useState("");
  const [resultMessage, setResultMessage] = useState("");

  const showResult = useCallback((status: "success" | "error", title: string, message: string) => {
    setResultStatus(status);
    setResultTitle(title);
    setResultMessage(message);
    setResultModalOpen(true);
  }, []);

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
  const {
    webCrop,
    setWebCrop,
    cropViewportSize,
    setCropViewportSize,
    cropTransform,
    setCropTransform,
    cropTransformRef,
    cropBoxSize,
    clampCropTransform,
    setCropScale,
    beginCropDrag,
    closeWebCropper,
    renderCropToCanvas,
  } = useSquareImageCrop();
  const cropModalWidth = Math.min(440, Math.max(320, Math.floor(Math.min(width - 32, height - 300))));

  const loadRows = useCallback(() => {
    fetchWithAuth(screenConfig.endpoint)
      .then((response) => response.json())
      .then((payload) => setRows(Array.isArray(payload?.data) ? payload.data : []))
      .catch(() => setRows([]));
  }, [screenConfig.endpoint]);

  const loadSupportData = useCallback(() => {
    Promise.all([
      fetchWithAuth("/api/people/users").then((response) => response.json()).catch(() => ({ data: [] })),
      fetchWithAuth("/api/people/staff-grades").then((response) => response.json()).catch(() => ({ data: [] })),
      fetchWithAuth("/api/people/staff-grades?include_inactive=1").then((response) => response.json()).catch(() => ({ data: [] })),
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
      fetchWithAuth(`/api/people/users/${value}/profile`)
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
    image.onerror = () => { if (!cancelled) { showResult("error", "Error", "Failed to load image for cropping."); closeWebCropper(); } };
    image.src = webCrop.sourceUri;
    return () => { cancelled = true; };
  }, [webCrop, closeWebCropper, clampCropTransform, cropBoxSize, cropViewportSize, setCropTransform, setWebCrop, showResult]);

  const applyWebCrop = async () => {
    if (!webCrop || Platform.OS !== "web") return;
    const canvas = await renderCropToCanvas(512);
    if (!canvas) throw new Error("Canvas is not supported in this browser.");
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
    } catch { showResult("error", "Error", "Failed to pick image."); }
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
      join_date: row.join_date ? String(row.join_date).slice(0, 10) : toLocalDateInput(),
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
      await printReportHtml(html, {
        description: `Exported ${screenConfig.title.toLowerCase()} list as PDF.`,
        fileName: `report_${type}_${Date.now()}.pdf`,
      });
    } catch (error) {
      showResult("error", "Print Failed", error instanceof Error ? error.message : `Failed to print ${screenConfig.title.toLowerCase()} report.`);
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
      await printReportHtml(html, {
        description: `Exported ${screenConfig.title.toLowerCase()} list as PDF.`,
        fileName: `report_${type}_${Date.now()}.pdf`,
      });
    } catch (error) {
      showResult("error", "Print Failed", error instanceof Error ? error.message : "Failed to print profile detail.");
    }
  };

  const submitForm = async () => {
    if (type === "users" && !form.email.trim()) {
      showResult("error", "Validation", "Email is required.");
      return;
    }
    if (type === "users" && !editingRow && !isValidPasswordPolicy(form.password)) {
      showResult("error", "Validation", PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (type === "users" && editingRow && form.password && !isValidPasswordPolicy(form.password)) {
      showResult("error", "Validation", PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (type === "users" && form.password && form.password_confirmation !== form.password) {
      showResult("error", "Validation", "Password confirmation does not match.");
      return;
    }
    if (type !== "users" && !form.id_user) {
      showResult("error", "Validation", "Linked user is required.");
      return;
    }
    if (type !== "users" && !form.first_name.trim()) {
      showResult("error", "Validation", "First name is required.");
      return;
    }
    if (type !== "users" && !isValidPersonName(form.first_name, true)) {
      showResult("error", "Validation", "First name may only contain letters and spaces.");
      return;
    }
    if (type !== "users" && !isValidPersonName(form.last_name)) {
      showResult("error", "Validation", "Last name may only contain letters and spaces.");
      return;
    }
    if (type !== "users" && !isValidPhone(form.phone_number)) {
      showResult("error", "Validation", "Phone may only contain digits, +, spaces, and hyphens, with 3 to 20 digits.");
      return;
    }

    setSaving(true);
    try {
      let uploadedImageUrl: string | null = form.profile_image;
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
        const uploadRes = await fetchWithAuth("/api/people/profile-image", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData?.message || "Failed to upload image.");
        uploadedImageUrl = uploadData.data.image_url;
      } else if (!form.profile_image) {
        uploadedImageUrl = null;
      }

      const id = editingRow ? getRowId(type, editingRow) : "";
      const endpoint = editingRow ? `${screenConfig.endpoint}/${id}` : screenConfig.endpoint;
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
      const response = await fetchWithAuth(endpoint, {
        method: editingRow ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || data?.message || "Failed to save data.");
      setFormOpen(false);
      loadRows();
      loadSupportData();
      showResult(
        "success",
        "Action Completed",
        editingRow ? `${screenConfig.title.slice(0, -1)} updated successfully.` : `${screenConfig.title.slice(0, -1)} created successfully.`
      );
    } catch (error) {
      showResult("error", "Action Failed", error instanceof Error ? error.message : "Failed to save data.");
    } finally {
      setSaving(false);
    }
  };

  const submitGradeForm = async () => {
    const gradeOrder = Number(gradeForm.grade_order || 0);
    if (!gradeForm.grade_name.trim()) {
      showResult("error", "Validation", "Grade name is required.");
      return;
    }
    if (!Number.isInteger(gradeOrder) || gradeOrder < 0) {
      showResult("error", "Validation", "Grade order must be a non-negative integer.");
      return;
    }

    setSaving(true);
    try {
      const endpoint = editingGrade
        ? `/api/people/staff-grades/${editingGrade.id_staff_grade}`
        : `/api/people/staff-grades`;
      const response = await fetchWithAuth(endpoint, {
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
      showResult("success", "Action Completed", editingGrade ? "Grade updated successfully." : "Grade created successfully.");
    } catch (error) {
      showResult("error", "Action Failed", error instanceof Error ? error.message : "Failed to save grade.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = useCallback(async (row: PersonRow) => {
    try {
      const id = getRowId(type, row);
      const response = await fetchWithAuth(`${screenConfig.endpoint}/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: row.is_active === "Y" ? "N" : "Y", actor_id: actorId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || payload?.message || "Failed to update status.");      
      loadRows();
      loadSupportData();
      showResult(
        "success",
        "Action Completed",
        row.is_active === "Y" ? `${screenConfig.title.slice(0, -1)} deactivated successfully.` : `${screenConfig.title.slice(0, -1)} activated successfully.`
      );
    } catch (error) {
      showResult("error", "Action Failed", error instanceof Error ? error.message : "Failed to update status.");
    }
  }, [actorId, loadRows, loadSupportData, screenConfig.endpoint, screenConfig.title, showResult, type]);

  const toggleGradeStatus = useCallback(async (grade: StaffGrade) => {
    try {
      const response = await fetchWithAuth(`/api/people/staff-grades/${grade.id_staff_grade}/status`, {  
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: grade.is_active === "Y" ? "N" : "Y", actor_id: actorId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || payload?.message || "Failed to update grade status.");
      loadSupportData();
      showResult(
        "success",
        "Action Completed",
        grade.is_active === "Y" ? "Grade deactivated successfully." : "Grade activated successfully."
      );
    } catch (error) {
      showResult("error", "Action Failed", error instanceof Error ? error.message : "Failed to update grade status.");
    }
  }, [actorId, loadSupportData, showResult]);

  const getPendingActionMessage = () => {
    if (pendingAction?.type === "save-person") {
      return editingRow ? `Save changes to this ${screenConfig.title.slice(0, -1).toLowerCase()}?` : `Create this ${screenConfig.title.slice(0, -1).toLowerCase()}?`;
    }
    if (pendingAction?.type === "save-grade") {
      return editingGrade ? "Save changes to this grade?" : "Create this grade?";
    }
    if (pendingAction?.type === "person-status") {
      return pendingAction.row.is_active === "Y"
        ? `Deactivate this ${screenConfig.title.slice(0, -1).toLowerCase()}? It will be hidden from active lists.`
        : `Activate this ${screenConfig.title.slice(0, -1).toLowerCase()}?`;
    }
    if (pendingAction?.type === "grade-status") {
      return pendingAction.grade.is_active === "Y"
        ? "Deactivate this grade? It will be hidden from active lists."
        : "Activate this grade?";
    }
    return "Continue this action?";
  };

  const executePendingAction = async () => {
    const action = pendingAction;
    if (!action) return;
    setPendingAction(null);
    if (action.type === "save-person") {
      await submitForm();
      return;
    }
    if (action.type === "save-grade") {
      await submitGradeForm();
      return;
    }
    if (action.type === "person-status") {
      await toggleStatus(action.row);
      return;
    }
    await toggleGradeStatus(action.grade);
  };

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
                      setPendingAction({ type: "person-status", row });
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
  }, [canManage, openActionId, openEdit, type]);

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
            <Pressable style={styles.activateButton} onPress={() => setPendingAction({ type: "person-status", row })}>
              <Text style={styles.activateButtonText}>Activate</Text>
            </Pressable>
          ) : null,
      },
    ],
    [canManage, columns]
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
                    setPendingAction({ type: "grade-status", grade });
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
  ], [canManage, openActionId, openEditGrade, activeGrades]);

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
            <Pressable style={styles.activateButton} onPress={() => setPendingAction({ type: "grade-status", grade })}>
              <Text style={styles.activateButtonText}>Activate</Text>
            </Pressable>
          ) : null,
      },
    ],
    [canManage, gradeColumns]
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
              required
              value={gradeForm.grade_name}
              onChangeText={(value) => setGradeForm((prev) => ({ ...prev, grade_name: value }))}
            />
            <Input
              label="Order"
              required
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
            <Pressable style={styles.submitButton} onPress={() => setPendingAction({ type: "save-grade" })} disabled={saving}>
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
                <Input label="Email" required value={form.email} onChangeText={(value) => setForm((prev) => ({ ...prev, email: value.trim() }))} keyboardType="email-address" />
                <Input label={editingRow ? "New Password (optional)" : "Password"} required={!editingRow} value={form.password} onChangeText={(value) => setForm((prev) => ({ ...prev, password: value }))} secure />
                <Input
                  label="Confirm Password"
                  required={!editingRow}
                  value={form.password_confirmation}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, password_confirmation: value }))}        
                  secure
                />
              </>
            ) : (
              <FilterSelectField
                label="Linked User"
                required
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
                  <Input label="First Name" required value={form.first_name} onChangeText={(value) => setForm((prev) => ({ ...prev, first_name: sanitizePersonNameInput(value) }))} wrapStyle={styles.twoColField} editable={!isProfileLocked} />
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
            <Pressable style={styles.submitButton} onPress={() => setPendingAction({ type: "save-person" })} disabled={saving}>
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
      <InventoryConfirmModal
        visible={Boolean(pendingAction)}
        title="Please Confirm"
        message={getPendingActionMessage()}
        confirmLabel={
          pendingAction?.type === "person-status" && pendingAction.row.is_active === "Y"
            ? "Deactivate"
            : pendingAction?.type === "grade-status" && pendingAction.grade.is_active === "Y"
              ? "Deactivate"
              : "Yes, Continue"
        }
        tone={
          pendingAction?.type === "person-status" && pendingAction.row.is_active === "Y"
            ? "danger"
            : pendingAction?.type === "grade-status" && pendingAction.grade.is_active === "Y"
              ? "danger"
              : pendingAction?.type === "person-status" || pendingAction?.type === "grade-status"
                ? "success"
                : "primary"
        }
        loading={saving}
        onCancel={() => (saving ? null : setPendingAction(null))}
        onConfirm={executePendingAction}
      />
      <InventoryResultModal
        visible={resultModalOpen}
        status={resultStatus}
        title={resultTitle}
        message={resultMessage}
        onClose={() => setResultModalOpen(false)}
      />
    </View>
  );
}
