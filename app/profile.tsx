import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ResponsiveModal from "../components/common/ResponsiveModal";
import { InventoryConfirmModal, InventoryResultModal } from "../components/inventory/ActionModals";
import ProfileCard from "../components/profile/ProfileCard";
import AppNavigationSidebar, { NavigationItem } from "../components/navigation/AppNavigationSidebar";
import { API_BASE_URL } from "../utils/api";
import {
  AuthUser,
  canAccessCashierModeWithGrade,
  canAccessMainApp,
  getAuthSession,
  getRouteByRole,
  logoutAuthSession,
  normalizeRole,
  saveAuthSession,
} from "../utils/authSession";
import { pickSquareImageAsync } from "../utils/imageUpload";
import { isValidPasswordPolicy, PASSWORD_POLICY_MESSAGE } from "../utils/passwordPolicy";

const PROFILE_PLACEHOLDER = require("../assets/images/placeholders/default-profile.png");
const SIDEBAR_LOGO = require("../assets/images/ui/logo_horizontal.png");

const MAIN_MENU_ADMIN_STAFF: NavigationItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "grid" },
  { key: "inventory", label: "Inventory", icon: "package", children: ["Suppliers", "Products", "Product Batches"] },
  { key: "stock-movements", label: "Stock Movements", icon: "activity", children: ["Stock In", "Stock Out", "Stock Adjustment"] },
  { key: "people", label: "People", icon: "users", children: ["Users", "Members", "Staffs"] },
  { key: "external-financial", label: "External Financials", icon: "dollar-sign" },
  { key: "shu", label: "SHU", icon: "pie-chart" },
  { key: "reports", label: "Reports", icon: "file-text" },
  { key: "logs", label: "Logs", icon: "clipboard" },
];

const MAIN_MENU_CASHIER: NavigationItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "grid" },
  { key: "inventory", label: "Inventory", icon: "package", children: ["Suppliers", "Products", "Product Batches"] },
  { key: "stock-movements", label: "Stock Movements", icon: "activity", children: ["Stock In", "Stock Out", "Stock Adjustment"] },
  { key: "sales", label: "Sales", icon: "shopping-cart", children: ["Sales Items", "Sales Cost"] },
  { key: "reports", label: "Reports", icon: "file-text" },
];

const routeBySubmenu = (child: string) => {
  if (child === "Products") return "/(main)/inventory/products";
  if (child === "Suppliers") return "/(main)/inventory/suppliers";
  if (child === "Product Batches") return "/(main)/inventory/batches";
  if (child === "Stock In") return "/(main)/stock-movements/stock-in";
  if (child === "Stock Out") return "/(main)/stock-movements/stock-out";
  if (child === "Stock Adjustment") return "/(main)/stock-movements/stock-adjustment";
  if (child === "Sales Items") return "/(main)/sales/items";
  if (child === "Sales Cost") return "/(main)/sales/costs";
  if (child === "Users") return "/(main)/users";
  if (child === "Members") return "/(main)/members";
  if (child === "Staffs") return "/(main)/staffs";
  return "/(main)/dashboard";
};

type ProfileResponse = {
  id_user: string;
  email: string;
  is_active: "Y" | "N";
  id_profile?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
  address?: string | null;
  profile_image?: string | null;
  full_name?: string | null;
  roles?: { id_role: string; role_name: string }[];
};

type ProfileFormState = { first_name: string; last_name: string; phone_number: string; address: string };
type PasswordFormState = { current_password: string; new_password: string; confirm_password: string };
type WebCropState = { sourceUri: string; fileName: string; mimeType: string; objectUrl?: string; naturalWidth: number; naturalHeight: number };

const emptyForm: ProfileFormState = { first_name: "", last_name: "", phone_number: "", address: "" };
const emptyPasswordForm: PasswordFormState = { current_password: "", new_password: "", confirm_password: "" };

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: vw, height: vh } = useWindowDimensions();

  // Dynamic Scaling Logic
  const isTablet = vw >= 768;
  const scale = vw < 768 ? Math.max(0.65, vw / 480) : 1;
  const avatarSize = Math.min(vw * 0.5, vh * 0.3, 260);
  const modalPadding = 18 * scale;
  const elementGap = 10 * scale;

  const shortSide = Math.min(vw, vh);
  const isPhoneLandscape = shortSide < 768 && vw > vh;
  const BASE_WIDTH = 1366;
  const BASE_HEIGHT = 768;
  const topPad = Math.max(insets.top, 12) + (isPhoneLandscape ? 14 : 0);
  const bottomPad = Math.max(insets.bottom, 8);
  const usableHeight = Math.max(vh - topPad - bottomPad, 320);
  const appScale = Math.min(1, Math.min(vw / BASE_WIDTH, usableHeight / BASE_HEIGHT));
  const isCompact = vw < 900;

  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [profileImageFailed, setProfileImageFailed] = useState(false);
  const [form, setForm] = useState<ProfileFormState>(emptyForm);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(emptyPasswordForm);
  const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [avatarDeleteConfirmOpen, setAvatarDeleteConfirmOpen] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultStatus, setResultStatus] = useState<"success" | "error">("success");
  const [resultTitle, setResultTitle] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({ inventory: true, "stock-movements": true, people: true });

  const [webCrop, setWebCrop] = useState<WebCropState | null>(null);
  const [cropViewportSize, setCropViewportSize] = useState(320);
  const [cropTransform, setCropTransform] = useState({ scale: 1, translateX: 0, translateY: 0 });
  const cropTransformRef = useRef(cropTransform);
  const cropGestureRef = useRef({ startScale: 1, startTranslateX: 0, startTranslateY: 0, startClientX: 0, startClientY: 0 });
  const cropDragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const [isCropDragging, setIsCropDragging] = useState(false);

  const cropBoxRatio = 0.82;
  const cropBoxSize = Math.max(1, Math.floor(cropViewportSize * cropBoxRatio));
  const cropModalWidth = Math.min(440, Math.max(300, Math.floor(Math.min(vw - 32, vh - 300))));

  const showResult = useCallback((status: "success" | "error", title: string, message: string) => {
    setResultStatus(status); setResultTitle(title); setResultMessage(message); setResultModalOpen(true);
  }, []);

  const roleName = useMemo(() => normalizeRole(sessionUser?.role_name) || "USER", [sessionUser?.role_name]);
  const menuItems = useMemo(() => (roleName === "CASHIER" ? MAIN_MENU_CASHIER : MAIN_MENU_ADMIN_STAFF), [roleName]);
  
  const displayName = useMemo(() => {
    const name = `${profile?.first_name || sessionUser?.first_name || ""} ${profile?.last_name || sessionUser?.last_name || ""}`.trim();
    return name || profile?.full_name || sessionUser?.full_name || "User Profile";
  }, [profile?.first_name, profile?.last_name, profile?.full_name, sessionUser?.first_name, sessionUser?.last_name, sessionUser?.full_name]);
  
  const emailValue = profile?.email || sessionUser?.email || "-";
  const phoneValue = profile?.phone_number || "-";
  const addressValue = profile?.address || "-";
  const roleLabel = roleName;

  const loadProfile = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/people/users/${userId}/profile`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || payload?.message || "Failed to load profile.");
      const nextProfile = payload?.data as ProfileResponse | undefined;
      setProfile(nextProfile || null);
      setForm({
        first_name: nextProfile?.first_name || "",
        last_name: nextProfile?.last_name || "",
        phone_number: nextProfile?.phone_number || "",
        address: nextProfile?.address || "",
      });
      const session = await getAuthSession().catch(() => null);
      if (session?.user?.id_user === userId && nextProfile) {
        const firstName = nextProfile.first_name || session.user.first_name || "";
        const lastName = nextProfile.last_name || session.user.last_name || "";
        const nextUser = {
          ...session.user,
          first_name: firstName,
          last_name: lastName,
          full_name: nextProfile.full_name || `${firstName} ${lastName}`.trim() || session.user.full_name,
          profile_image: nextProfile.profile_image || null,
        };
        await saveAuthSession({
          ...session,
          user: nextUser,
        });
        setSessionUser(nextUser);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getAuthSession()
      .then((session) => {
        if (!active) return;
        if (!session?.token || !session?.user?.id_user) {
          router.replace("/login");
          return;
        }
        if (!canAccessMainApp(session.user.role_name)) {
          router.replace(getRouteByRole(session.user.role_name));
          return;
        }
        setSessionUser(session.user);
        loadProfile(session.user.id_user).catch((error) => {
          if (active) showResult("error", "Error", error instanceof Error ? error.message : "Failed to load profile.");
        });
      })
      .catch(() => router.replace("/login"));
    return () => { active = false; };
  }, [loadProfile, router, showResult]);

  useEffect(() => { setProfileImageFailed(false); }, [profile?.profile_image]);
  useEffect(() => { cropTransformRef.current = cropTransform; }, [cropTransform]);

  const handleLogout = async () => {
    setLogoutConfirmOpen(false); setProfileMenuOpen(false); await logoutAuthSession(); router.replace("/login");
  };

  const handleOpenEdit = () => {
    setForm({
      first_name: profile?.first_name || sessionUser?.first_name || "",
      last_name: profile?.last_name || sessionUser?.last_name || "",
      phone_number: profile?.phone_number || "",
      address: profile?.address || "",
    });
    setEditOpen(true);
  };

  const handleOpenChangePassword = () => { setPasswordForm(emptyPasswordForm); setPasswordOpen(true); };
  const handleOpenAvatarViewer = () => { setProfileImageFailed(false); setAvatarViewerOpen(true); };

  const uploadProfileImage = async (imageUri: string, fileName: string, mimeType: string, file?: File) => {
    const formData = new FormData();
    if (Platform.OS === "web") {
      if (file) { formData.append("image", file, fileName); }
      else if (imageUri.startsWith("data:")) {
        const blob = await (await fetch(imageUri)).blob();
        formData.append("image", blob, fileName);
      } else throw new Error("Image file is required.");
    } else {
      formData.append("image", { uri: imageUri, name: fileName, type: mimeType } as unknown as Blob);
    }
    const uploadResponse = await fetch(`${API_BASE_URL}/api/people/profile-image`, { method: "POST", body: formData });
    const uploadPayload = await uploadResponse.json();
    if (!uploadResponse.ok) throw new Error(uploadPayload?.error || uploadPayload?.message || "Failed to upload profile image.");
    return String(uploadPayload?.data?.image_url || "").trim();
  };

  const updateProfileDetails = async (payload: { first_name: string; last_name: string; phone_number: string; address: string; profile_image?: string | null }) => {
    if (!sessionUser?.id_user) throw new Error("Session expired.");
    const response = await fetch(`${API_BASE_URL}/api/people/users/${sessionUser.id_user}/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_user: sessionUser.id_user, actor_id: sessionUser.id_user, ...payload }),
    });
    const payloadResponse = await response.json();
    if (!response.ok) throw new Error(payloadResponse?.error || payloadResponse?.message || "Failed to save profile.");
    await loadProfile(sessionUser.id_user);
  };

  const handleSaveDetails = async () => {
    if (!form.first_name.trim()) { showResult("error", "Validation", "First name is required."); return; }
    setSaving(true);
    try {
      await updateProfileDetails({ first_name: form.first_name.trim(), last_name: form.last_name.trim(), phone_number: form.phone_number.trim(), address: form.address.trim() });
      setEditOpen(false); showResult("success", "Action Completed", "Profile updated.");
    } catch (error) { showResult("error", "Action Failed", error instanceof Error ? error.message : "Failed to save."); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!sessionUser?.id_user) { showResult("error", "Session Expired", "Please sign in again."); return; }
    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) { showResult("error", "Validation", "All fields are required."); return; }
    if (!isValidPasswordPolicy(passwordForm.new_password)) { showResult("error", "Validation", PASSWORD_POLICY_MESSAGE); return; }
    if (passwordForm.new_password !== passwordForm.confirm_password) { showResult("error", "Validation", "No match."); return; }
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/people/users/${sessionUser.id_user}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_user: sessionUser.id_user, actor_id: sessionUser.id_user, ...passwordForm }),
      });
      if (!response.ok) { const payload = await response.json(); throw new Error(payload?.error || "Failed."); }
      setPasswordOpen(false); setPasswordForm(emptyPasswordForm); showResult("success", "Action Completed", "Password changed.");
    } catch (error) { showResult("error", "Action Failed", error instanceof Error ? error.message : "Failed."); }
    finally { setSaving(false); }
  };

  const saveAvatarImage = async (imageUri: string, fileName: string, mimeType: string, file?: File) => {
    const uploadedImageUrl = await uploadProfileImage(imageUri, fileName, mimeType, file);
    await updateProfileDetails({
      first_name: (profile?.first_name || sessionUser?.first_name || "").trim(),
      last_name: (profile?.last_name || sessionUser?.last_name || "").trim(),
      phone_number: (profile?.phone_number || "").trim(),
      address: (profile?.address || "").trim(),
      profile_image: uploadedImageUrl,
    });
  };

  // --- WEB CROPPER LOGIC ---
  const closeWebCropper = useCallback(() => {
    if (webCrop?.objectUrl?.startsWith("blob:")) URL.revokeObjectURL(webCrop.objectUrl);
    setWebCrop(null); setCropTransform({ scale: 1, translateX: 0, translateY: 0 });
  }, [webCrop]);

  const clampCropTransform = useCallback((nextScale: number, nextTranslateX: number, nextTranslateY: number, sourceWidth: number, sourceHeight: number) => {
    const fitScale = Math.min(cropViewportSize / Math.max(1, sourceWidth), cropViewportSize / Math.max(1, sourceHeight));
    const minCoverScale = Math.max(cropBoxSize / Math.max(1, sourceWidth * fitScale), cropBoxSize / Math.max(1, sourceHeight * fitScale));
    const displayWidth = Math.max(1, sourceWidth * fitScale * Math.max(minCoverScale, nextScale));
    const displayHeight = Math.max(1, sourceHeight * fitScale * Math.max(minCoverScale, nextScale));
    const overflowX = Math.max(0, (displayWidth - cropBoxSize) / 2);
    const overflowY = Math.max(0, (displayHeight - cropBoxSize) / 2);
    return { scale: Math.max(minCoverScale, nextScale), translateX: Math.min(overflowX, Math.max(-overflowX, nextTranslateX)), translateY: Math.min(overflowY, Math.max(-overflowY, nextTranslateY)) };
  }, [cropBoxSize, cropViewportSize]);

  const updateCropTranslation = useCallback((nextX: number, nextY: number) => { if (!webCrop) return; setCropTransform(c => clampCropTransform(c.scale, nextX, nextY, webCrop.naturalWidth || 320, webCrop.naturalHeight || 320)); }, [clampCropTransform, webCrop]);

  const beginCropDrag = useCallback((x: number, y: number) => {
    cropDragRef.current = { active: true, lastX: x, lastY: y };
    cropGestureRef.current = { startScale: cropTransformRef.current.scale, startTranslateX: cropTransformRef.current.translateX, startTranslateY: cropTransformRef.current.translateY, startClientX: x, startClientY: y };
    setIsCropDragging(true);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || !isCropDragging || !webCrop) return;
    const onMove = (e: MouseEvent) => { if (cropDragRef.current.active) updateCropTranslation(cropGestureRef.current.startTranslateX + (e.clientX - cropGestureRef.current.startClientX), cropGestureRef.current.startTranslateY + (e.clientY - cropGestureRef.current.startClientY)); };
    const onUp = () => { cropDragRef.current.active = false; setIsCropDragging(false); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [isCropDragging, updateCropTranslation, webCrop]);

  useEffect(() => {
    if (Platform.OS !== "web" || !webCrop) return;
    let cancel = false; const img = new window.Image();
    img.onload = () => {
      if (cancel) return; setWebCrop(c => c ? { ...c, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight } : c);
      const fitScale = Math.min(cropViewportSize / img.naturalWidth, cropViewportSize / img.naturalHeight);
      const minCoverScale = Math.max(cropBoxSize / (img.naturalWidth * fitScale), cropBoxSize / (img.naturalHeight * fitScale));
      setCropTransform(c => clampCropTransform(Math.max(c.scale, minCoverScale), c.translateX, c.translateY, img.naturalWidth, img.naturalHeight));
    };
    img.src = webCrop.sourceUri; return () => { cancel = true; };
  }, [webCrop, clampCropTransform, cropBoxSize, cropViewportSize]);

  const applyWebCrop = async () => {
    if (!webCrop || Platform.OS !== "web") return;
    const img = new window.Image(); img.src = webCrop.sourceUri;
    await new Promise<void>((r) => { img.onload = () => r(); });
    const cropSize = 1024; const exportScale = cropSize / cropBoxSize;
    const fitScale = Math.min(cropViewportSize / img.naturalWidth, cropViewportSize / img.naturalHeight);
    const renderScale = fitScale * cropTransform.scale * exportScale;
    const canvas = document.createElement("canvas"); canvas.width = cropSize; canvas.height = cropSize;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cropSize, cropSize);
    ctx.translate(cropSize / 2 + cropTransform.translateX * exportScale, cropSize / 2 + cropTransform.translateY * exportScale);
    ctx.scale(renderScale, renderScale); ctx.translate(-img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    try {
      setSaving(true); await saveAvatarImage(dataUrl, webCrop.fileName, webCrop.mimeType);
      setAvatarViewerOpen(false); closeWebCropper(); showResult("success", "Action Completed", "Profile updated.");
    } catch { showResult("error", "Action Failed", "Failed to save."); }
    finally { setSaving(false); }
  };

  const handleChooseAvatarPhoto = async () => {
    try {
      const image = await pickSquareImageAsync({ webMode: Platform.OS === "web" ? "raw" : "auto" });
      if (!image) return;
      if (Platform.OS === "web") {
        setAvatarViewerOpen(false); const url = image.file ? URL.createObjectURL(image.file) : image.uri;
        setCropTransform({ scale: 1, translateX: 0, translateY: 0 });
        setWebCrop({ sourceUri: url, fileName: image.name, mimeType: image.mimeType, objectUrl: image.file ? url : undefined, naturalWidth: 0, naturalHeight: 0 });
        return;
      }
      setSaving(true); const url = await uploadProfileImage(image.uri, image.name || "p.jpg", image.mimeType || "image/jpeg", image.file);
      await saveAvatarImage(url, image.name || "p.jpg", image.mimeType || "image/jpeg");
      setAvatarViewerOpen(false); showResult("success", "Action Completed", "Profile updated.");
    } catch { showResult("error", "Action Failed", "Failed to pick image."); }
    finally { setSaving(false); }
  };

  const deleteAvatar = async () => {
    if (!sessionUser?.id_user) return;
    setAvatarDeleteConfirmOpen(false);
    try {
      setSaving(true);
      await updateProfileDetails({ first_name: (profile?.first_name || sessionUser?.first_name || "").trim(), last_name: (profile?.last_name || sessionUser?.last_name || "").trim(), phone_number: (profile?.phone_number || "").trim(), address: (profile?.address || "").trim(), profile_image: null });
      setAvatarViewerOpen(false); showResult("success", "Action Completed", "Photo removed.");
    } catch { showResult("error", "Action Failed", "Failed."); }
    finally { setSaving(false); }
  };

  if (loading && !profile) {
    return <View style={styles.loadingScreen}><ActivityIndicator size="large" color="#1d4ed8" /><Text style={styles.loadingText}>Loading profile...</Text></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc", alignItems: "center", justifyContent: "center", overflow: "hidden", paddingTop: topPad, paddingBottom: bottomPad }}>
      <View style={{ width: BASE_WIDTH, height: BASE_HEIGHT, transform: [{ scale: appScale }] }}>
        <View style={{ flex: 1, flexDirection: "row", backgroundColor: "#f8fafc" }}>
          <AppNavigationSidebar
            logoSource={SIDEBAR_LOGO} navItems={menuItems.map((item) => ({ ...item, active: false }))} expandedMenus={expandedMenus}
            onMenuPress={(item) => {
              if (item.key === "inventory" || item.key === "stock-movements" || item.key === "people") { setExpandedMenus((current) => ({ ...current, [item.key]: !current[item.key] })); return; }
              if (item.key === "dashboard") { router.push("/(main)/dashboard"); return; }
              if (item.key === "reports") { router.push("/(main)/reports"); return; }
              if (item.key === "shu") { router.push("/(main)/shu"); return; }
              if (item.key === "external-financial") { router.push("/(main)/external-financial"); return; }
              if (item.key === "logs") { router.push("/(main)/logs"); }
            }}
            onSubmenuPress={(_, child) => router.push(routeBySubmenu(child) as never)}
            renderNavIcon={(item) => item.icon === "package" ? <MaterialCommunityIcons name="package-variant-closed" size={18} color="#475569" /> : <Feather name={item.icon as any} size={18} color="#475569" />}
            renderChevronIcon={(expanded) => <Feather name="chevron-down" size={14} color="#64748b" style={expanded ? { transform: [{ rotate: "180deg" }] } : undefined} />}
            profileName={sessionUser?.full_name || "User"} profileRole={roleLabel} profileImageSource={(profile?.profile_image || sessionUser?.profile_image) ? { uri: profile?.profile_image || sessionUser?.profile_image || "" } : PROFILE_PLACEHOLDER} profileMenuOpen={profileMenuOpen} onToggleProfileMenu={() => setProfileMenuOpen((prev) => !prev)}
            profileMenuItems={[
              { key: "profile", label: "Profile", icon: "user", tone: "default", onPress: () => { setProfileMenuOpen(false); router.replace("/profile"); } },
              ...(canAccessCashierModeWithGrade(roleName, sessionUser?.staff_grade_name || null) ? [{ key: "workspace", label: "Enter Cashier Mode", icon: "shopping-cart", tone: "blue" as const, onPress: () => { setProfileMenuOpen(false); router.replace("/(cashier)"); } }] : []),
              ...(hasMemberAccess && roleName === "MEMBER" ? [{ key: "member", label: "Enter Member Portal", icon: "users", tone: "blue" as const, onPress: () => { setProfileMenuOpen(false); router.replace("/(member)/dashboard"); } }] : []),
              { key: "logout", label: "Logout", icon: "log-out", tone: "danger", onPress: () => { setProfileMenuOpen(false); setLogoutConfirmOpen(true); } }
            ]}
            onLogoutPress={() => setLogoutConfirmOpen(true)}
          />

          <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
              <View style={styles.shell}>
                <View style={styles.header}><View style={styles.headerCopy}><Text style={styles.title}>My Profile</Text><Text style={styles.subtitle}>Manage your details and avatar.</Text></View></View>
                <ProfileCard isCompact={isCompact} profileImage={profile?.profile_image} onOpenAvatarViewer={handleOpenAvatarViewer} displayName={displayName} roleLabel={roleLabel} emailValue={emailValue} phoneValue={phoneValue} addressValue={addressValue} />
                <View style={styles.actionRow}>
                  <Pressable style={styles.editButton} onPress={handleOpenEdit}><Feather name="edit-3" size={16} color="#ffffff" /><Text style={styles.editButtonText}>Edit Profile</Text></Pressable>
                  <Pressable style={styles.changePasswordButton} onPress={handleOpenChangePassword}><Feather name="lock" size={16} color="#1d4ed8" /><Text style={styles.changePasswordButtonText}>Change Password</Text></Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </View>

      <ResponsiveModal
        visible={avatarViewerOpen}
        onClose={() => setAvatarViewerOpen(false)}
        maxWidthDesktop={480}
        maxWidthPhoneRatio={0.94}
        maxHeightDesktopRatio={0.85}
        maxHeightPhoneRatio={0.9}
        cardStyle={[styles.avatarViewerCard, { maxWidth: isTablet ? 480 : vw * 0.94 }]}
      >
        <ScrollView style={styles.modalScroll} contentContainerStyle={[styles.modalScrollContent, { padding: modalPadding, gap: elementGap }]} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={styles.modalHeader}><Text style={[styles.modalTitle, { fontSize: Math.max(16, 20 * scale) }]}>Update Photo</Text><Text style={[styles.modalSubtitle, { fontSize: Math.max(11, 13 * scale) }]}>Change or remove your profile avatar.</Text></View>
          <View style={[styles.avatarViewerPreview, { marginVertical: 8 * scale }]}><View style={[styles.avatarSquareFrame, { width: avatarSize, height: avatarSize, borderRadius: 28 * scale, borderWidth: Math.max(3, 5 * scale) }]}>{profile?.profile_image && !profileImageFailed ? <Image source={{ uri: profile.profile_image }} style={[styles.avatarViewerImage, { borderRadius: 24 * scale }]} contentFit="cover" onError={() => setProfileImageFailed(true)} /> : <Image source={PROFILE_PLACEHOLDER} style={[styles.avatarViewerImage, { borderRadius: 24 * scale }]} contentFit="cover" />}</View></View>
          <View style={[styles.avatarViewerActions, { gap: 10 * scale }]}><Pressable style={[styles.avatarPrimaryButton, { minHeight: 42 * scale, borderRadius: 12 * scale }, saving && styles.saveButtonDisabled]} onPress={handleChooseAvatarPhoto} disabled={saving}><Feather name="upload" size={16 * scale} color="#ffffff" /><Text style={[styles.avatarPrimaryButtonText, { fontSize: Math.max(11, 13 * scale) }]}>{saving ? "Working..." : "Choose Photo"}</Text></Pressable>{profile?.profile_image ? <Pressable style={[styles.avatarDangerButton, { minHeight: 42 * scale, borderRadius: 12 * scale }]} onPress={() => setAvatarDeleteConfirmOpen(true)} disabled={saving}><Feather name="trash-2" size={16 * scale} color="#dc2626" /><Text style={[styles.avatarDangerButtonText, { fontSize: Math.max(11, 13 * scale) }]}>Remove</Text></Pressable> : null}</View>
          <View style={[styles.modalFooter, { marginTop: 8 * scale }]}><Pressable style={[styles.cancelButton, { minHeight: 38 * scale, borderRadius: 10 * scale, paddingHorizontal: 20 * scale }]} onPress={() => setAvatarViewerOpen(false)} disabled={saving}><Text style={[styles.cancelButtonText, { fontSize: Math.max(11, 13 * scale) }]}>Close</Text></Pressable></View>
        </ScrollView>
      </ResponsiveModal>

      {webCrop ? (
        <View style={styles.cropOverlayRoot}><View style={styles.cropOverlayBackdrop} /><View style={[styles.cropOverlayCard, { width: cropModalWidth, maxHeight: Math.max(320, vh - 32) }]}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Crop Photo</Text><Text style={styles.modalSubtitle}>Drag and zoom then save.</Text></View><View style={styles.cropViewport} onLayout={(e) => { const s = Math.floor(e.nativeEvent.layout.width); if (s > 0) setCropViewportSize(s); }}>
          {(() => {
            const fitScale = Math.min(cropViewportSize / (webCrop.naturalWidth || 1), cropViewportSize / (webCrop.naturalHeight || 1)); const dw = Math.max(1, (webCrop.naturalWidth || 1) * fitScale * cropTransform.scale); const dh = Math.max(1, (webCrop.naturalHeight || 1) * fitScale * cropTransform.scale); const edge = Math.max(0, (cropViewportSize - cropBoxSize) / 2);
            return (
              <View style={styles.cropCanvas} onMouseDown={(e) => { if (Platform.OS === "web") { e.preventDefault(); beginCropDrag(e.nativeEvent.clientX, e.nativeEvent.clientY); } }} onWheel={(e: any) => { e.preventDefault(); const delta = e.nativeEvent?.deltaY ?? 0; setCropTransform(c => clampCropTransform(delta > 0 ? Math.max(0.2, c.scale - 0.08) : Math.min(3, c.scale + 0.08), c.translateX, c.translateY, webCrop.naturalWidth || 320, webCrop.naturalHeight || 320)); }}><Image source={{ uri: webCrop.sourceUri }} style={[styles.cropImage, { width: dw, height: dh, left: (cropViewportSize - dw) / 2 + cropTransform.translateX, top: (cropViewportSize - dh) / 2 + cropTransform.translateY }]} contentFit="contain" pointerEvents="none" /><View pointerEvents="none" style={[styles.cropShadeTop, { height: edge }]} /><View pointerEvents="none" style={[styles.cropShadeBottom, { height: edge }]} /><View pointerEvents="none" style={[styles.cropShadeLeft, { width: edge, top: edge, height: cropBoxSize }]} /><View pointerEvents="none" style={[styles.cropShadeRight, { width: edge, top: edge, height: cropBoxSize }]} /><View pointerEvents="none" style={[styles.cropBoxFrame, { width: cropBoxSize, height: cropBoxSize, left: edge, top: edge }]} /></View>
            );
          })()}</View><View style={styles.modalFooter}><Pressable style={styles.cancelButton} onPress={closeWebCropper}><Text style={styles.cancelButtonText}>Cancel</Text></Pressable><Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={applyWebCrop} disabled={saving}><Text style={styles.saveButtonText}>Use Crop</Text></Pressable></View></View></View>
      ) : null}

      <ResponsiveModal visible={editOpen} onClose={() => setEditOpen(false)} maxWidthDesktop={660} maxWidthPhoneRatio={0.96} maxHeightDesktopRatio={0.9} maxHeightPhoneRatio={0.9} cardStyle={styles.editModalCard}><View style={styles.modalInner}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Edit Profile</Text><Text style={styles.modalSubtitle}>Update personal details.</Text></View><ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}><View style={[styles.formGrid, isCompact && styles.formGridCompact]}><InputField label="First Name" value={form.first_name} onChangeText={(v) => setForm(p => ({ ...p, first_name: v }))} compact={isCompact} /><InputField label="Last Name" value={form.last_name} onChangeText={(v) => setForm(p => ({ ...p, last_name: v }))} compact={isCompact} /><InputField label="Phone Number" value={form.phone_number} onChangeText={(v) => setForm(p => ({ ...p, phone_number: v }))} compact={isCompact} /><InputField label="Address" value={form.address} onChangeText={(v) => setForm(p => ({ ...p, address: v }))} textarea compact={isCompact} /></View><View style={styles.modalFooter}><Pressable style={styles.cancelButton} onPress={() => setEditOpen(false)} disabled={saving}><Text style={styles.cancelButtonText}>Cancel</Text></Pressable><Pressable style={[styles.saveButton, (saving || loading) && styles.saveButtonDisabled]} onPress={handleSaveDetails} disabled={saving || loading}><Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Changes"}</Text></Pressable></View></ScrollView></View></ResponsiveModal>
      <ResponsiveModal visible={passwordOpen} onClose={() => setPasswordOpen(false)} maxWidthDesktop={560} maxWidthPhoneRatio={0.96} maxHeightDesktopRatio={0.9} maxHeightPhoneRatio={0.9} cardStyle={styles.editModalCard}><View style={styles.modalInner}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Change Password</Text><Text style={styles.modalSubtitle}>Set new security credentials.</Text></View><ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}><View style={styles.formGrid}><InputField label="Current Password" value={passwordForm.current_password} onChangeText={(v) => setPasswordForm(p => ({ ...p, current_password: v }))} secure compact /><InputField label="New Password" value={passwordForm.new_password} onChangeText={(v) => setPasswordForm(p => ({ ...p, new_password: v }))} secure compact /><InputField label="Confirm New Password" value={passwordForm.confirm_password} onChangeText={(v) => setPasswordForm(p => ({ ...p, confirm_password: v }))} secure compact /></View><View style={styles.modalFooter}><Pressable style={styles.cancelButton} onPress={() => setPasswordOpen(false)} disabled={saving}><Text style={styles.cancelButtonText}>Cancel</Text></Pressable><Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleChangePassword} disabled={saving}><Text style={styles.saveButtonText}>Save Password</Text></Pressable></View></ScrollView></View></ResponsiveModal>
      <InventoryConfirmModal visible={logoutConfirmOpen} title="Logout?" message="End this session?" confirmLabel="Logout" tone="danger" onCancel={() => setLogoutConfirmOpen(false)} onConfirm={handleLogout} /><InventoryConfirmModal visible={avatarDeleteConfirmOpen} title="Delete Photo?" message="Remove current profile photo?" confirmLabel="Delete Photo" tone="danger" loading={saving} onCancel={() => setAvatarDeleteConfirmOpen(false)} onConfirm={deleteAvatar} /><InventoryResultModal visible={resultModalOpen} status={resultStatus} title={resultTitle} message={resultMessage} onClose={() => setResultModalOpen(false)} />
    </View>
  );
}

function InputField({ label, value, onChangeText, textarea = false, compact = false, secure = false }: { label: string; value: string; onChangeText: (v: string) => void; textarea?: boolean; compact?: boolean; secure?: boolean; }) {
  return (
    <View style={[styles.field, textarea && styles.fieldTextarea, compact && styles.fieldCompact]}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={label} placeholderTextColor="#94a3b8" multiline={textarea} secureTextEntry={secure} textAlignVertical={textarea ? "top" : "center"} style={[styles.input, textarea && styles.textarea]} /></View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef3fb" },
  content: { padding: 16, paddingBottom: 28 },
  shell: { width: "100%", maxWidth: 1120, alignSelf: "center", gap: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: "#0f172a", fontSize: 28, fontWeight: "800" },
  subtitle: { color: "#64748b", fontSize: 13, marginTop: 4, lineHeight: 18 },
  actionRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 4 },
  editButton: { minHeight: 42, borderRadius: 12, backgroundColor: "#1d4ed8", paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: "#1d4ed8", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  editButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  changePasswordButton: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  changePasswordButtonText: { color: "#1d4ed8", fontSize: 13, fontWeight: "700" },
  editModalCard: { width: "100%", maxWidth: 660, borderRadius: 24, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#d8e2f0", overflow: "hidden" },
  avatarViewerCard: { width: "100%", backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#d8e2f0", borderRadius: 24, overflow: "hidden" },
  modalInner: { padding: 16, gap: 12 },
  modalHeader: { gap: 4, alignItems: "center" },
  modalTitle: { color: "#0f172a", fontWeight: "800" },
  modalSubtitle: { color: "#64748b", fontWeight: "600", textAlign: "center" },
  modalContent: { gap: 12, paddingBottom: 4 },
  modalScroll: { width: "100%" },
  modalScrollContent: { minHeight: 0 },
  avatarViewerPreview: { width: "100%", alignItems: "center", justifyContent: "center" },
  avatarSquareFrame: { aspectRatio: 1, overflow: "hidden", backgroundColor: "#f1f5f9", borderColor: "#ffffff", shadowColor: "#0f172a", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  avatarViewerImage: { width: "100%", height: "100%" },
  avatarViewerActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  avatarPrimaryButton: { flex: 1, backgroundColor: "#1d4ed8", paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  avatarPrimaryButtonText: { color: "#ffffff", fontWeight: "800" },
  avatarDangerButton: { flex: 1, borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fff5f5", paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  avatarDangerButtonText: { color: "#dc2626", fontWeight: "800" },
  modalFooter: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 4 },
  cancelButton: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  cancelButtonText: { color: "#334155", fontSize: 13, fontWeight: "700" },
  saveButton: { minHeight: 42, borderRadius: 10, backgroundColor: "#1d4ed8", paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  saveButtonDisabled: { opacity: 0.65 },
  saveButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  formGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  formGridCompact: { gap: 10 },
  field: { flexBasis: "48%", flexGrow: 1, gap: 6 },
  fieldTextarea: { flexBasis: "100%" },
  fieldCompact: { flexBasis: "100%" },
  fieldLabel: { color: "#334155", fontSize: 12, fontWeight: "700" },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 12, color: "#0f172a" },
  textarea: { minHeight: 100, paddingTop: 12, paddingBottom: 12 },
  loadingScreen: { flex: 1, backgroundColor: "#eef3fb", alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: "#64748b", fontSize: 13, fontWeight: "700" },
  cropOverlayRoot: { ...StyleSheet.absoluteFillObject, zIndex: 200, elevation: 20, alignItems: "center", justifyContent: "center", padding: 16 },
  cropOverlayBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.58)" },
  cropOverlayCard: { width: "100%", maxWidth: 560, borderRadius: 22, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#d8e2f0", padding: 16, gap: 12, shadowColor: "#0f172a", shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  cropViewport: { width: "100%", aspectRatio: 1, borderRadius: 18, overflow: "hidden", backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#dbe5f3" },
  cropCanvas: { flex: 1, overflow: "hidden", backgroundColor: "#0f172a" },
  cropImage: { position: "absolute" },
  cropShadeTop: { position: "absolute", left: 0, right: 0, top: 0, backgroundColor: "rgba(15, 23, 42, 0.34)" },
  cropShadeBottom: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.34)" },
  cropShadeLeft: { position: "absolute", left: 0, backgroundColor: "rgba(15, 23, 42, 0.34)" },
  cropShadeRight: { position: "absolute", right: 0, backgroundColor: "rgba(15, 23, 42, 0.34)" },
  cropBoxFrame: { position: "absolute", borderWidth: 2, borderColor: "rgba(255,255,255,0.88)", borderStyle: "solid", borderRadius: 16, backgroundColor: "transparent" },
});
