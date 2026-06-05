import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ResponsiveModal from "../components/common/ResponsiveModal";
import ProfileCard from "../components/profile/ProfileCard";
import AppNavigationSidebar, { NavigationItem } from "../components/navigation/AppNavigationSidebar";
import { API_BASE_URL } from "../utils/api";
import {
  AuthUser,
  canAccessCashierModeWithGrade,
  canAccessMainApp,
  clearAuthSession,
  getAuthSession,
  getRouteByRole,
  normalizeRole,
} from "../utils/authSession";
import { pickSquareImageAsync } from "../utils/imageUpload";

const PROFILE_PLACEHOLDER = require("../assets/images/placeholders/default-profile.png");
const SIDEBAR_LOGO = require("../assets/images/ui/logo_horizontal.png");

const MAIN_MENU_ADMIN_STAFF: NavigationItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "grid" },
  {
    key: "inventory",
    label: "Inventory",
    icon: "package",
    children: ["Suppliers", "Products", "Product Batches"],
  },
  {
    key: "stock-movements",
    label: "Stock Movements",
    icon: "activity",
    children: ["Stock In", "Stock Out", "Stock Adjustment"],
  },
  {
    key: "people",
    label: "People",
    icon: "users",
    children: ["Users", "Members", "Staffs"],
  },
  { key: "external-financial", label: "External Financials", icon: "dollar-sign" },
  { key: "shu", label: "SHU", icon: "pie-chart" },
  { key: "reports", label: "Reports", icon: "file-text" },
  { key: "logs", label: "Logs", icon: "clipboard" },
];

const MAIN_MENU_CASHIER: NavigationItem[] = [
  {
    key: "inventory",
    label: "Inventory",
    icon: "package",
    children: ["Suppliers", "Products", "Product Batches"],
  },
  {
    key: "stock-movements",
    label: "Stock Movements",
    icon: "activity",
    children: ["Stock In", "Stock Out", "Stock Adjustment"],
  },
  { key: "reports", label: "Reports", icon: "file-text" },
];

const routeBySubmenu = (child: string) => {
  if (child === "Products") return "/(main)/inventory/products";
  if (child === "Suppliers") return "/(main)/inventory/suppliers";
  if (child === "Product Batches") return "/(main)/inventory/batches";
  if (child === "Stock In") return "/(main)/stock-movements/stock-in";
  if (child === "Stock Out") return "/(main)/stock-movements/stock-out";
  if (child === "Stock Adjustment") return "/(main)/stock-movements/stock-adjustment";
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

type ProfileFormState = {
  first_name: string;
  last_name: string;
  phone_number: string;
  address: string;
  profile_image: string;
  profile_image_file_name: string;
};

type PasswordFormState = {
  current_password: string;
  new_password: string;
  confirm_password: string;
};

type WebCropState = {
  sourceUri: string;
  fileName: string;
  mimeType: string;
  objectUrl?: string;
  naturalWidth: number;
  naturalHeight: number;
};

const emptyForm: ProfileFormState = {
  first_name: "",
  last_name: "",
  phone_number: "",
  address: "",
  profile_image: "",
  profile_image_file_name: "",
};

const emptyPasswordForm: PasswordFormState = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const shortSide = Math.min(width, height);
  const isPhoneLandscape = shortSide < 768 && width > height;
  const BASE_WIDTH = 1366;
  const BASE_HEIGHT = 768;
  const topPad = Math.max(insets.top, 12) + (isPhoneLandscape ? 14 : 0);
  const bottomPad = Math.max(insets.bottom, 8);
  const usableHeight = Math.max(height - topPad - bottomPad, 320);
  const appScale = Math.min(1, Math.min(width / BASE_WIDTH, usableHeight / BASE_HEIGHT));
  const isCompact = width < 900;
  const cropModalWidth = Math.min(440, Math.max(320, Math.floor(Math.min(width - 32, height - 300))));

  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [profileImageFailed, setProfileImageFailed] = useState(false);
  const [form, setForm] = useState<ProfileFormState>(emptyForm);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(emptyPasswordForm);
  const [webCrop, setWebCrop] = useState<WebCropState | null>(null);
  const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);
  const [cropViewportSize, setCropViewportSize] = useState(320);
  const [cropTransform, setCropTransform] = useState({ scale: 1, translateX: 0, translateY: 0 });
  const cropTransformRef = useRef(cropTransform);
  const cropGestureRef = useRef({ startScale: 1, startTranslateX: 0, startTranslateY: 0, startClientX: 0, startClientY: 0 });
  const cropDragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const [isCropDragging, setIsCropDragging] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    inventory: true,
    "stock-movements": true,
    people: true,
  });

  const roleName = useMemo(() => normalizeRole(sessionUser?.role_name) || "USER", [sessionUser?.role_name]);
  const menuItems = useMemo(() => (roleName === "CASHIER" ? MAIN_MENU_CASHIER : MAIN_MENU_ADMIN_STAFF), [roleName]);
  const cropBoxRatio = 0.82;
  const cropBoxSize = Math.max(1, Math.floor(cropViewportSize * cropBoxRatio));
  const displayName = useMemo(() => {
    const name = `${profile?.first_name || sessionUser?.first_name || ""} ${profile?.last_name || sessionUser?.last_name || ""}`.trim();
    return name || profile?.full_name || sessionUser?.full_name || "User Profile";
  }, [profile?.first_name, profile?.last_name, profile?.full_name, sessionUser?.first_name, sessionUser?.last_name, sessionUser?.full_name]);
  const emailValue = profile?.email || sessionUser?.email || "-";
  const phoneValue = profile?.phone_number || "-";
  const addressValue = profile?.address || "-";
  const roleLabel = roleName;

  useEffect(() => {
    cropTransformRef.current = cropTransform;
  }, [cropTransform]);

  const loadProfile = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/people/users/${userId}/profile`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "Failed to load profile.");
      }

      const nextProfile = payload?.data as ProfileResponse | undefined;
      setProfile(nextProfile || null);
      setForm({
        first_name: nextProfile?.first_name || "",
        last_name: nextProfile?.last_name || "",
        phone_number: nextProfile?.phone_number || "",
        address: nextProfile?.address || "",
        profile_image: nextProfile?.profile_image || "",
        profile_image_file_name: "",
      });
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
          Alert.alert("Error", error instanceof Error ? error.message : "Failed to load profile.");
        });
      })
      .catch(() => router.replace("/login"));

    return () => {
      active = false;
    };
  }, [loadProfile, router]);

  useEffect(() => {
    setProfileImageFailed(false);
  }, [profile?.profile_image]);

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
      const needsSlack = Math.abs(sourceWidth - sourceHeight) > 2;
      const minInteractiveScale = needsSlack ? minCoverScale * 1.08 : minCoverScale;
      const safeScale = Math.max(minInteractiveScale, nextScale);
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
      cropDragRef.current = {
        active: true,
        lastX: clientX,
        lastY: clientY,
      };
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
      cropDragRef.current = {
        active: true,
        lastX: nextX,
        lastY: nextY,
      };
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
      const fitScale = Math.min(
        cropViewportSize / Math.max(1, naturalWidth),
        cropViewportSize / Math.max(1, naturalHeight)
      );
      const minCoverScale = Math.max(
        cropBoxSize / Math.max(1, naturalWidth * fitScale),
        cropBoxSize / Math.max(1, naturalHeight * fitScale)
      );
      const needsSlack = Math.abs(naturalWidth - naturalHeight) > 2;
      const initialScale = needsSlack ? minCoverScale * 1.08 : minCoverScale;
      setWebCrop((current) =>
        current
          ? {
              ...current,
              naturalWidth,
              naturalHeight,
          }
          : current
      );
      setCropTransform((current) =>
        clampCropTransform(
          Math.max(current.scale, initialScale),
          current.translateX,
          current.translateY,
          naturalWidth,
          naturalHeight
        )
      );
    };
    image.onerror = () => {
      if (cancelled) return;
      Alert.alert("Error", "Failed to load image for cropping.");
      closeWebCropper();
    };
    image.src = webCrop.sourceUri;

    return () => {
      cancelled = true;
    };
  }, [webCrop, closeWebCropper, clampCropTransform, cropBoxSize, cropViewportSize]);

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    await clearAuthSession();
    router.replace("/login");
  };

  const syncFormFromProfile = () => {
    setForm({
      first_name: profile?.first_name || sessionUser?.first_name || "",
      last_name: profile?.last_name || sessionUser?.last_name || "",
      phone_number: profile?.phone_number || "",
      address: profile?.address || "",
      profile_image: profile?.profile_image || "",
      profile_image_file_name: "",
    });
  };

  const handleOpenEdit = () => {
    syncFormFromProfile();
    setEditOpen(true);
  };

  const handleOpenChangePassword = () => {
    setPasswordForm(emptyPasswordForm);
    setPasswordOpen(true);
  };

  const handleOpenAvatarViewer = () => {
    setProfileImageFailed(false);
    setAvatarViewerOpen(true);
  };

  const openWebCropperFromSource = (sourceUri: string, fileName: string, mimeType: string, objectUrl?: string) => {
    setCropTransform({ scale: 1, translateX: 0, translateY: 0 });
    setWebCrop({
      sourceUri,
      fileName,
      mimeType,
      objectUrl,
      naturalWidth: 0,
      naturalHeight: 0,
    });
  };

  const uploadProfileImage = async (imageUri: string, fileName: string, mimeType: string) => {
    const formData = new FormData();
    if (Platform.OS === "web" && imageUri.startsWith("data:")) {
      const blob = await (await fetch(imageUri)).blob();
      formData.append("image", blob, fileName);
    } else {
      formData.append("image", {
        uri: imageUri,
        name: fileName,
        type: mimeType,
      } as unknown as Blob);
    }

    const uploadResponse = await fetch(`${API_BASE_URL}/api/people/profile-image`, {
      method: "POST",
      body: formData,
    });
    const uploadPayload = await uploadResponse.json();
    if (!uploadResponse.ok) {
      throw new Error(uploadPayload?.error || uploadPayload?.message || "Failed to upload profile image.");
    }

    const imageUrl = String(uploadPayload?.data?.image_url || "").trim();
    if (!imageUrl) {
      throw new Error("Failed to upload profile image.");
    }
    return imageUrl;
  };

  const updateProfileDetails = async (payload: {
    first_name: string;
    last_name: string;
    phone_number: string;
    address: string;
    profile_image?: string | null;
  }) => {
    if (!sessionUser?.id_user) {
      Alert.alert("Session expired", "Please sign in again.");
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/people/users/${sessionUser.id_user}/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id_user: sessionUser.id_user,
        actor_id: sessionUser.id_user,
        ...payload,
      }),
    });
    const payloadResponse = await response.json();
    if (!response.ok) {
      throw new Error(payloadResponse?.error || payloadResponse?.message || "Failed to save profile.");
    }

    await loadProfile(sessionUser.id_user);
  };

  const handleSave = async () => {
    if (!form.first_name.trim()) {
      Alert.alert("Validation", "First name is required.");
      return;
    }

    setSaving(true);
    try {
      await updateProfileDetails({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone_number: form.phone_number.trim(),
        address: form.address.trim(),
      });
      setEditOpen(false);
      Alert.alert("Success", "Profile updated successfully.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!sessionUser?.id_user) {
      Alert.alert("Session expired", "Please sign in again.");
      return;
    }
    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      Alert.alert("Validation", "Current password, new password, and confirmation are required.");
      return;
    }
    if (passwordForm.new_password.length < 6) {
      Alert.alert("Validation", "New password must be at least 6 characters.");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      Alert.alert("Validation", "New password confirmation does not match.");
      return;
    }
    if (passwordForm.current_password === passwordForm.new_password) {
      Alert.alert("Validation", "New password must be different from current password.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/people/users/${sessionUser.id_user}/password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_user: sessionUser.id_user,
          actor_id: sessionUser.id_user,
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password,
          confirm_password: passwordForm.confirm_password,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "Failed to change password.");
      }

      setPasswordOpen(false);
      setPasswordForm(emptyPasswordForm);
      Alert.alert("Success", "Password changed successfully.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to change password.");
    } finally {
      setSaving(false);
    }
  };

  const saveAvatarImage = async (imageUri: string, fileName: string, mimeType: string) => {
    if (!form.first_name.trim()) {
      syncFormFromProfile();
    }
    const uploadedImageUrl = await uploadProfileImage(imageUri, fileName, mimeType);
    await updateProfileDetails({
      first_name: (profile?.first_name || sessionUser?.first_name || "").trim(),
      last_name: (profile?.last_name || sessionUser?.last_name || "").trim(),
      phone_number: (profile?.phone_number || "").trim(),
      address: (profile?.address || "").trim(),
      profile_image: uploadedImageUrl,
    });
  };

  const handleDeleteAvatar = () => {
    if (!sessionUser?.id_user) return;
    Alert.alert("Delete profile photo?", "This will remove the current profile photo.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setSaving(true);
            await updateProfileDetails({
              first_name: (profile?.first_name || sessionUser?.first_name || "").trim(),
              last_name: (profile?.last_name || sessionUser?.last_name || "").trim(),
              phone_number: (profile?.phone_number || "").trim(),
              address: (profile?.address || "").trim(),
              profile_image: null,
            });
            setAvatarViewerOpen(false);
            Alert.alert("Success", "Profile photo removed.");
          } catch (error) {
            Alert.alert("Error", error instanceof Error ? error.message : "Failed to remove profile photo.");
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const handleChooseAvatarPhoto = async () => {
    try {
      const image = await pickSquareImageAsync({
        webMode: Platform.OS === "web" ? "raw" : "auto",
      });
      if (!image) return;

      setProfileImageFailed(false);
      if (Platform.OS === "web" && image.file) {
        setAvatarViewerOpen(false);
        const objectUrl = URL.createObjectURL(image.file);
        openWebCropperFromSource(objectUrl, image.name, image.mimeType, objectUrl);
        return;
      }

      if (Platform.OS === "web") {
        setAvatarViewerOpen(false);
        openWebCropperFromSource(image.uri, image.name, image.mimeType, image.uri.startsWith("blob:") ? image.uri : undefined);
        return;
      }

      setSaving(true);
      await saveAvatarImage(image.uri, image.name, image.mimeType);
      setAvatarViewerOpen(false);
      Alert.alert("Success", "Profile photo updated successfully.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to pick image.");
    } finally {
      setSaving(false);
    }
  };

  const applyWebCrop = async () => {
    if (!webCrop || Platform.OS !== "web") return;
    const img = new window.Image();
    img.src = webCrop.sourceUri;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image for cropping."));
    });

    const cropSize = 1024;
    const exportScale = cropSize / Math.max(1, cropBoxSize);
    const naturalWidth = img.naturalWidth || webCrop.naturalWidth || 1;
    const naturalHeight = img.naturalHeight || webCrop.naturalHeight || 1;
    const fitScale = Math.min(cropViewportSize / naturalWidth, cropViewportSize / naturalHeight);
    const renderScale = fitScale * cropTransform.scale * exportScale;

    const canvas = document.createElement("canvas");
    canvas.width = cropSize;
    canvas.height = cropSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas is not supported in this browser.");
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cropSize, cropSize);
    ctx.translate(
      cropSize / 2 + cropTransform.translateX * exportScale,
      cropSize / 2 + cropTransform.translateY * exportScale
    );
    ctx.scale(renderScale, renderScale);
    ctx.translate(-naturalWidth / 2, -naturalHeight / 2);
    ctx.drawImage(img, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    try {
      setSaving(true);
      await saveAvatarImage(dataUrl, webCrop.fileName, webCrop.mimeType);
      setProfileImageFailed(false);
      setAvatarViewerOpen(false);
      closeWebCropper();
      Alert.alert("Success", "Profile photo updated successfully.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to save cropped image.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !profile) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#1d4ed8" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#f8fafc",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        paddingTop: topPad,
        paddingBottom: bottomPad,
      }}
    >
      <View style={{ width: BASE_WIDTH, height: BASE_HEIGHT, transform: [{ scale: appScale }] }}>
        <View style={{ flex: 1, flexDirection: "row", backgroundColor: "#f8fafc" }}>
          <AppNavigationSidebar
            logoSource={SIDEBAR_LOGO}
            navItems={menuItems.map((item) => ({
              ...item,
              active: false,
            }))}
            expandedMenus={expandedMenus}
            onMenuPress={(item) => {
              if (item.key === "inventory" || item.key === "stock-movements" || item.key === "people") {
                setExpandedMenus((current) => ({
                  ...current,
                  [item.key]: !current[item.key],
                }));
                return;
              }
              if (item.key === "dashboard") {
                router.push("/(main)/dashboard");
                return;
              }
              if (item.key === "reports") {
                router.push("/(main)/reports");
                return;
              }
              if (item.key === "shu") {
                router.push("/(main)/shu");
                return;
              }
              if (item.key === "external-financial") {
                router.push("/(main)/external-financial");
                return;
              }
              if (item.key === "logs") {
                router.push("/(main)/logs");
              }
            }}
            onSubmenuPress={(_, child) => {
              router.push(routeBySubmenu(child) as never);
            }}
            renderNavIcon={(item) => {
              if (item.icon === "package") {
                return <MaterialCommunityIcons name="package-variant-closed" size={18} color="#475569" />;
              }
              return <Feather name={item.icon as React.ComponentProps<typeof Feather>["name"]} size={18} color="#475569" />;
            }}
            renderChevronIcon={(expanded) => (
              <Feather
                name="chevron-down"
                size={14}
                color="#64748b"
                style={expanded ? { transform: [{ rotate: "180deg" }] } : undefined}
              />
            )}
            profileName={sessionUser?.full_name || "User"}
            profileRole={roleLabel}
            profileImageSource={PROFILE_PLACEHOLDER}
            profileMenuOpen={profileMenuOpen}
            onToggleProfileMenu={() => setProfileMenuOpen((prev) => !prev)}
            profileMenuItems={[
              {
                key: "profile",
                label: "Profile",
                icon: "user",
                tone: "default",
                onPress: () => {
                  setProfileMenuOpen(false);
                  router.replace("/profile");
                },
              },
              ...(canAccessCashierModeWithGrade(roleName, sessionUser?.staff_grade_name || null)
                ? [
                    {
                      key: "workspace",
                      label: "Enter Cashier Mode",
                      icon: "shopping-cart",
                      tone: "blue" as const,
                      onPress: () => {
                        setProfileMenuOpen(false);
                        router.replace("/(cashier)");
                      },
                    },
                  ]
                : []),
              {
                key: "logout",
                label: "Logout",
                icon: "log-out",
                tone: "danger",
                onPress: handleLogout,
              },
            ]}
            onLogoutPress={handleLogout}
          />

          <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
              <View style={styles.shell}>
                <View style={styles.header}>
                  <View style={styles.headerCopy}>
                    <Text style={styles.title}>My Profile</Text>
                    <Text style={styles.subtitle}>Manage your profile details and avatar from one place.</Text>
                  </View>
                </View>

                <ProfileCard
                  isCompact={isCompact}
                  profileImage={profile?.profile_image}
                  onOpenAvatarViewer={handleOpenAvatarViewer}
                  displayName={displayName}
                  roleLabel={roleLabel}
                  emailValue={emailValue}
                  phoneValue={phoneValue}
                  addressValue={addressValue}
                />

                <View style={styles.actionRow}>
                  <Pressable style={styles.editButton} onPress={handleOpenEdit}>
                    <Feather name="edit-3" size={16} color="#ffffff" />
                    <Text style={styles.editButtonText}>Edit Profile</Text>
                  </Pressable>
                  <Pressable style={styles.changePasswordButton} onPress={handleOpenChangePassword}>
                    <Feather name="lock" size={16} color="#1d4ed8" />
                    <Text style={styles.changePasswordButtonText}>Change Password</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </View>

      <ResponsiveModal
        visible={avatarViewerOpen}
        onClose={() => setAvatarViewerOpen(false)}
        cardStyle={styles.avatarViewerCard}
      >
        <View style={styles.modalInner}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Current Profile Photo</Text>
            <Text style={styles.modalSubtitle}>Edit or remove the current avatar.</Text>
          </View>

          <View style={styles.avatarViewerPreview}>
            {profile?.profile_image && !profileImageFailed ? (
              <Image source={{ uri: profile.profile_image }} style={styles.avatarViewerImage} contentFit="contain" onError={() => setProfileImageFailed(true)} />
            ) : (
              <Image source={PROFILE_PLACEHOLDER} style={styles.avatarViewerImage} contentFit="contain" />
            )}
          </View>

          <View style={styles.avatarViewerActions}>
            <Pressable style={[styles.avatarPrimaryButton, saving && styles.saveButtonDisabled]} onPress={handleChooseAvatarPhoto} disabled={saving}>
              <Feather name="edit-3" size={16} color="#ffffff" />
              <Text style={styles.avatarPrimaryButtonText}>{saving ? "Working..." : "Edit / Change Photo"}</Text>
            </Pressable>

            <Pressable style={styles.avatarDangerButton} onPress={handleDeleteAvatar} disabled={saving}>
              <Feather name="trash-2" size={16} color="#dc2626" />
              <Text style={styles.avatarDangerButtonText}>Delete Photo</Text>
            </Pressable>
          </View>

          <View style={styles.modalFooter}>
            <Pressable style={styles.cancelButton} onPress={() => setAvatarViewerOpen(false)} disabled={saving}>
              <Text style={styles.cancelButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </ResponsiveModal>

      {webCrop ? (
        <View style={styles.cropOverlayRoot}>
          <View style={styles.cropOverlayBackdrop} />
          <View style={[styles.cropOverlayCard, { width: cropModalWidth, maxHeight: Math.max(320, height - 32) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Crop Profile Photo</Text>
              <Text style={styles.modalSubtitle}>Drag the image, zoom in or out, then save the square crop.</Text>
            </View>

            <View
              style={styles.cropViewport}
              onLayout={(event) => {
                const nextSize = Math.floor(event.nativeEvent.layout.width);
                if (nextSize > 0) setCropViewportSize(nextSize);
              }}
            >
              {webCrop
                  ? (() => {
                    const fitScale = Math.min(
                      cropViewportSize / Math.max(1, webCrop.naturalWidth || cropViewportSize),
                      cropViewportSize / Math.max(1, webCrop.naturalHeight || cropViewportSize)
                    );
                    const displayWidth = Math.max(1, (webCrop.naturalWidth || cropViewportSize) * fitScale * cropTransform.scale);
                    const displayHeight = Math.max(1, (webCrop.naturalHeight || cropViewportSize) * fitScale * cropTransform.scale);
                    const edgeSize = Math.max(0, (cropViewportSize - cropBoxSize) / 2);
                    return (
                      <View
                        style={styles.cropCanvas}
                        onMouseDown={(event) => {
                          if (Platform.OS !== "web") return;
                          event.preventDefault?.();
                          beginCropDrag(event.nativeEvent.clientX, event.nativeEvent.clientY);
                        }}
                        onTouchStart={(event) => {
                          const touch = event.nativeEvent.touches?.[0];
                          if (!touch) return;
                          beginCropDrag(touch.clientX, touch.clientY);
                        }}
                        onTouchMove={(event) => {
                          const touch = event.nativeEvent.touches?.[0];
                          if (!touch || !cropDragRef.current.active) return;
                          cropDragRef.current = {
                            active: true,
                            lastX: touch.clientX,
                            lastY: touch.clientY,
                          };
                          updateCropTranslation(
                            cropGestureRef.current.startTranslateX + (touch.clientX - cropGestureRef.current.startClientX),
                            cropGestureRef.current.startTranslateY + (touch.clientY - cropGestureRef.current.startClientY)
                          );
                        }}
                        onTouchEnd={() => {
                          cropDragRef.current.active = false;
                          setIsCropDragging(false);
                        }}
                        onWheel={(event: any) => {
                          if (!webCrop) return;
                          event.preventDefault?.();
                          const delta = event.nativeEvent?.deltaY ?? event.deltaY ?? 0;
                          const nextScale = delta > 0
                            ? Math.max(0.2, Number((cropTransformRef.current.scale - 0.08).toFixed(2)))
                            : Math.min(3, Number((cropTransformRef.current.scale + 0.08).toFixed(2)));
                          setCropScale(nextScale);
                        }}
                      >
                        <Image
                          source={{ uri: webCrop.sourceUri }}
                          style={[
                            styles.cropImage,
                            {
                              width: displayWidth,
                              height: displayHeight,
                              left: (cropViewportSize - displayWidth) / 2 + cropTransform.translateX,
                              top: (cropViewportSize - displayHeight) / 2 + cropTransform.translateY,
                            },
                          ]}
                          contentFit="contain"
                          pointerEvents="none"
                        />

                        <View pointerEvents="none" style={[styles.cropShadeTop, { height: edgeSize }]} />
                        <View pointerEvents="none" style={[styles.cropShadeBottom, { height: edgeSize }]} />
                        <View pointerEvents="none" style={[styles.cropShadeLeft, { width: edgeSize, top: edgeSize, height: cropBoxSize }]} />
                        <View pointerEvents="none" style={[styles.cropShadeRight, { width: edgeSize, top: edgeSize, height: cropBoxSize }]} />
                        <View
                          pointerEvents="none"
                          style={[
                            styles.cropBoxFrame,
                            {
                              width: cropBoxSize,
                              height: cropBoxSize,
                              left: edgeSize,
                              top: edgeSize,
                            },
                          ]}
                        />
                      </View>
                    );
                  })()
                : null}
            </View>

            <View style={styles.modalFooter}>
              <Pressable style={styles.cancelButton} onPress={closeWebCropper} disabled={saving}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={applyWebCrop} disabled={saving}>
                <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Use Crop"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      <ResponsiveModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        cardStyle={styles.editModalCard}
      >
        <View style={styles.modalInner}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.formGrid, isCompact && styles.formGridCompact]}>
              <InputField
                label="First Name"
                value={form.first_name}
                onChangeText={(value) => setForm((prev) => ({ ...prev, first_name: value }))}
                compact={isCompact}
              />
              <InputField
                label="Last Name"
                value={form.last_name}
                onChangeText={(value) => setForm((prev) => ({ ...prev, last_name: value }))}
                compact={isCompact}
              />
              <InputField
                label="Phone Number"
                value={form.phone_number}
                onChangeText={(value) => setForm((prev) => ({ ...prev, phone_number: value }))}
                compact={isCompact}
              />
              <InputField
                label="Address"
                value={form.address}
                onChangeText={(value) => setForm((prev) => ({ ...prev, address: value }))}
                textarea
                compact={isCompact}
              />
            </View>

            <View style={styles.modalFooter}>
              <Pressable style={styles.cancelButton} onPress={() => setEditOpen(false)} disabled={saving}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.saveButton, (saving || loading) && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving || loading}>
                <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Changes"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </ResponsiveModal>

      <ResponsiveModal
        visible={passwordOpen}
        onClose={() => (saving ? null : setPasswordOpen(false))}
        cardStyle={styles.editModalCard}
      >
        <View style={styles.modalInner}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <Text style={styles.modalSubtitle}>Verify your current password before setting a new one.</Text>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formGrid}>
              <InputField
                label="Current Password"
                value={passwordForm.current_password}
                onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, current_password: value }))}
                secure
                compact
              />
              <InputField
                label="New Password"
                value={passwordForm.new_password}
                onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, new_password: value }))}
                secure
                compact
              />
              <InputField
                label="Confirm New Password"
                value={passwordForm.confirm_password}
                onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, confirm_password: value }))}
                secure
                compact
              />
            </View>

            <View style={styles.modalFooter}>
              <Pressable style={styles.cancelButton} onPress={() => setPasswordOpen(false)} disabled={saving}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleChangePassword} disabled={saving}>
                <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Password"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </ResponsiveModal>
    </View>
  );
}



function InputField({
  label,
  value,
  onChangeText,
  textarea = false,
  compact = false,
  secure = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  textarea?: boolean;
  compact?: boolean;
  secure?: boolean;
}) {
  return (
    <View style={[styles.field, textarea && styles.fieldTextarea, compact && styles.fieldCompact]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="#94a3b8"
        multiline={textarea}
        secureTextEntry={secure}
        textAlignVertical={textarea ? "top" : "center"}
        style={[styles.input, textarea && styles.textarea]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef3fb" },
  content: { padding: 16, paddingBottom: 28 },
  shell: { width: "100%", maxWidth: 1120, alignSelf: "center", gap: 16 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: "#0f172a", fontSize: 28, fontWeight: "800" },
  subtitle: { color: "#64748b", fontSize: 13, marginTop: 4, lineHeight: 18 },
  actionRow: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 10 },
  editButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: "#1d4ed8",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#1d4ed8",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  editButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  changePasswordButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  changePasswordButtonText: { color: "#1d4ed8", fontSize: 13, fontWeight: "700" },
  editModalCard: {
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d8e2f0",
    overflow: "hidden",
  },
  avatarViewerCard: {
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d8e2f0",
    overflow: "hidden",
    maxWidth: 360,
  },
  modalInner: { flex: 1, padding: 16, gap: 12 },
  modalHeader: { gap: 4 },
  modalTitle: { color: "#0f172a", fontSize: 20, fontWeight: "800" },
  modalSubtitle: { color: "#64748b", fontSize: 12, fontWeight: "600" },
  modalContent: { paddingBottom: 4, gap: 12 },
  avatarViewerPreview: {
    width: "100%",
    maxWidth: 220,
    aspectRatio: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#dbe5f3",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  avatarViewerImage: { width: "100%", height: "100%" },
  avatarViewerActions: { gap: 10 },
  avatarPrimaryButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#1d4ed8",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  avatarPrimaryButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  avatarDangerButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff5f5",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  avatarDangerButtonText: { color: "#dc2626", fontSize: 13, fontWeight: "800" },
  cropOverlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    elevation: 20,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  cropOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.58)",
  },
  cropOverlayCard: {
    width: "100%",
    maxWidth: 560,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d8e2f0",
    padding: 16,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  cropViewport: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#dbe5f3",
  },
  cropCanvas: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#0f172a",
    cursor: "grab",
    touchAction: "none",
  },
  cropImage: {
    position: "absolute",
  },
  cropShadeTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: "rgba(15, 23, 42, 0.34)",
  },
  cropShadeBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.34)",
  },
  cropShadeLeft: {
    position: "absolute",
    left: 0,
    backgroundColor: "rgba(15, 23, 42, 0.34)",
  },
  cropShadeRight: {
    position: "absolute",
    right: 0,
    backgroundColor: "rgba(15, 23, 42, 0.34)",
  },
  cropBoxFrame: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.88)",
    borderStyle: "solid",
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  cropControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  cropControlButton: {
    minWidth: 42,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe5f3",
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  cropControlButtonText: { color: "#1d4ed8", fontSize: 18, fontWeight: "800" },
  cropScaleLabel: { color: "#475569", fontSize: 13, fontWeight: "700", minWidth: 54, textAlign: "center" },
  cropResetButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe5f3",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cropResetButtonText: { color: "#334155", fontSize: 13, fontWeight: "700" },
  editPreviewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dbe5f3",
    backgroundColor: "#f8fbff",
    padding: 12,
  },
  editPreviewImageWrap: {
    width: 76,
    height: 76,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
    flexShrink: 0,
  },
  editPreviewImage: { width: "100%", height: "100%" },
  editPreviewMeta: { flex: 1, gap: 4 },
  editPreviewName: { color: "#0f172a", fontSize: 18, fontWeight: "800" },
  editPreviewRole: { color: "#1d4ed8", fontSize: 12, fontWeight: "700" },
  formGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  formGridCompact: { gap: 10 },
  field: { flexBasis: "48%", flexGrow: 1, gap: 6 },
  fieldTextarea: { flexBasis: "100%" },
  fieldCompact: { flexBasis: "100%" },
  fieldLabel: { color: "#334155", fontSize: 12, fontWeight: "700" },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    color: "#0f172a",
  },
  textarea: { minHeight: 100, paddingTop: 12, paddingBottom: 12 },
  uploadBlock: { gap: 6 },
  uploadRow: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  uploadButton: {
    height: "100%",
    minHeight: 44,
    backgroundColor: "#eff6ff",
    borderRightWidth: 1,
    borderRightColor: "#bfdbfe",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadButtonText: { color: "#1d4ed8", fontSize: 12, fontWeight: "800" },
  uploadHint: { flex: 1, color: "#475569", fontSize: 12, fontWeight: "600", paddingHorizontal: 10 },
  modalFooter: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
  cancelButton: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: { color: "#334155", fontSize: 13, fontWeight: "700" },
  saveButton: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: "#1d4ed8",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: { opacity: 0.65 },
  saveButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  loadingScreen: {
    flex: 1,
    backgroundColor: "#eef3fb",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: { color: "#64748b", fontSize: 13, fontWeight: "700" },
});
