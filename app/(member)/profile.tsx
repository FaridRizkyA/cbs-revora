import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import ResponsiveModal from "../../components/common/ResponsiveModal";
import { InventoryConfirmModal, InventoryResultModal } from "../../components/inventory/ActionModals";
import MemberShell from "../../components/member/MemberShell";
import ProfileCard from "../../components/profile/ProfileCard";
import { API_BASE_URL } from "../../utils/api";
import { getAuthSession, saveAuthSession, type AuthSession } from "../../utils/authSession";
import { fetchWithAuth } from "../../utils/fetchWithAuth";
import { pickSquareImageAsync } from "../../utils/imageUpload";
import { isValidPasswordPolicy, PASSWORD_POLICY_MESSAGE } from "../../utils/passwordPolicy";

const PROFILE_PLACEHOLDER = require("../../assets/images/placeholders/default-profile.png");

type MemberProfile = {
  id_user: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
  address?: string | null;
  profile_image?: string | null;
  full_name?: string | null;
};

type FormState = {
  first_name: string;
  last_name: string;
  phone_number: string;
  address: string;
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

const emptyForm: FormState = {
  first_name: "",
  last_name: "",
  phone_number: "",
  address: "",
};

const emptyPasswordForm: PasswordFormState = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

export default function MemberProfileScreen() {
  const router = useRouter();
  const { height: vh, width: vw } = useWindowDimensions();
  
  // Dynamic Scaling Logic
  const isTablet = vw >= 768;
  const isPhoneLandscape = vw > vh && vh < 520;
  // scale factor: 1 for tablet+, down to ~0.75 for small phones
  const scale = isTablet ? 1 : Math.max(0.75, vw / 440);
  
  // Layout constraints: ensure everything fits in vh
  const avatarSize = Math.min(vw * 0.55, vh * 0.35, 260);
  const modalPadding = 20 * scale;
  const elementGap = 12 * scale;
  
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(emptyPasswordForm);
  const [profileImageFailed, setProfileImageFailed] = useState(false);
  const [photoDeleteConfirmOpen, setPhotoDeleteConfirmOpen] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultStatus, setResultStatus] = useState<"success" | "error">("success");
  const [resultTitle, setResultTitle] = useState("");
  const [resultMessage, setResultMessage] = useState("");

  // Web Cropper States
  const [webCrop, setWebCrop] = useState<WebCropState | null>(null);
  const [cropViewportSize, setCropViewportSize] = useState(320);
  const [cropTransform, setCropTransform] = useState({ scale: 1, translateX: 0, translateY: 0 });
  const cropTransformRef = useRef(cropTransform);
  const cropGestureRef = useRef({ startScale: 1, startTranslateX: 0, startTranslateY: 0, startClientX: 0, startClientY: 0 });
  const cropDragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const [isCropDragging, setIsCropDragging] = useState(false);

  const cropBoxRatio = 0.82;
  const cropBoxSize = Math.max(1, Math.floor(cropViewportSize * cropBoxRatio));
  const cropModalWidth = Math.min(440, Math.max(320, Math.floor(Math.min(vw - 32, vh - 300))));

  const showResult = useCallback((status: "success" | "error", title: string, message: string) => {
    setResultStatus(status);
    setResultTitle(title);
    setResultMessage(message);
    setResultModalOpen(true);
  }, []);

  const loadProfile = useCallback(async (nextSession: AuthSession) => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/people/users/${nextSession.user.id_user}/profile`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load profile.");
      }

      const nextProfile = payload?.data as MemberProfile | null;
      setProfile(nextProfile);
      setForm({
        first_name: nextProfile?.first_name || "",
        last_name: nextProfile?.last_name || "",
        phone_number: nextProfile?.phone_number || "",
        address: nextProfile?.address || "",
      });
      const storedSession = await getAuthSession().catch(() => null);
      if (storedSession?.user?.id_user === nextSession.user.id_user && nextProfile) {
        const firstName = nextProfile.first_name || storedSession.user.first_name || "";
        const lastName = nextProfile.last_name || storedSession.user.last_name || "";
        const nextUser = {
          ...storedSession.user,
          first_name: firstName,
          last_name: lastName,
          full_name: nextProfile.full_name || `${firstName} ${lastName}`.trim() || storedSession.user.full_name,
          profile_image: nextProfile.profile_image || null,
        };
        await saveAuthSession({
          ...storedSession,
          user: nextUser,
        });
        setSession({ ...storedSession, user: nextUser });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getAuthSession().then(nextSession => {
      if (nextSession) {
        setSession(nextSession);
        loadProfile(nextSession).catch((error) => {
          showResult("error", "Error", error instanceof Error ? error.message : "Failed to load profile.");
        });
      }
    });
  }, [loadProfile, showResult]);

  useEffect(() => {
    setProfileImageFailed(false);
  }, [profile?.profile_image]);

  useEffect(() => {
    cropTransformRef.current = cropTransform;
  }, [cropTransform]);

  const displayName = useMemo(
    () => `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || profile?.full_name || session?.user.full_name || "Member",
    [profile?.first_name, profile?.last_name, profile?.full_name, session?.user.full_name]
  );

  const handleOpenAvatarViewer = () => {
    setProfileImageFailed(false);
    setAvatarViewerOpen(true);
  };

  const uploadProfileImage = async (imageUri: string, fileName: string, mimeType: string, file?: File) => {
    if (!session?.token) throw new Error("Session expired. Please sign in again.");

    const formData = new FormData();
    if (Platform.OS === "web") {
      if (file) {
        formData.append("image", file, fileName);
      } else if (imageUri.startsWith("data:")) {
        const blob = await (await fetch(imageUri)).blob();
        formData.append("image", blob, fileName);
      } else {
        throw new Error("Image file is required.");
      }
    } else {
      formData.append(
        "image",
        {
          uri: imageUri,
          name: fileName,
          type: mimeType,
        } as unknown as Blob
      );
    }

    const response = await fetch(`${API_BASE_URL}/api/people/profile-image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || "Failed to upload profile photo.");
    }

    const imageUrl = String(payload?.data?.image_url || "").trim();
    if (!imageUrl) throw new Error("Failed to upload profile photo.");
    return imageUrl;
  };

  const saveProfileDetails = async (payload: FormState & { profile_image?: string | null }) => {
    if (!session?.user?.id_user) {
      throw new Error("Session expired. Please sign in again.");
    }

    const response = await fetchWithAuth(`/api/people/users/${session.user.id_user}/profile`, {
      method: "PUT",
      body: JSON.stringify({
        id_user: session.user.id_user,
        actor_id: session.user.id_user,
        ...payload,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.message || result?.error || "Failed to save profile.");
    }
    await loadProfile(session);
  };

  const handleSaveDetails = async () => {
    if (!form.first_name.trim()) {
      showResult("error", "Validation", "First name is required.");
      return;
    }

    setSaving(true);
    try {
      await saveProfileDetails({
        ...form,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone_number: form.phone_number.trim(),
        address: form.address.trim(),
      });
      setEditOpen(false);
      showResult("success", "Action Completed", "Profile updated successfully.");
    } catch (error) {
      showResult("error", "Action Failed", error instanceof Error ? error.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!session?.user?.id_user) {
      showResult("error", "Session Expired", "Please sign in again.");
      return;
    }
    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      showResult("error", "Validation", "Current password, new password, and confirmation are required.");
      return;
    }
    if (!isValidPasswordPolicy(passwordForm.new_password)) {
      showResult("error", "Validation", PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showResult("error", "Validation", "New password confirmation does not match.");
      return;
    }
    if (passwordForm.current_password === passwordForm.new_password) {
      showResult("error", "Validation", "New password must be different from current password.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/people/users/${session.user.id_user}/password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_user: session.user.id_user,
          actor_id: session.user.id_user,
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password,
          confirm_password: passwordForm.confirm_password,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || "Failed to change password.");
      }

      setPasswordOpen(false);
      setPasswordForm(emptyPasswordForm);
      showResult("success", "Action Completed", "Password changed successfully.");
    } catch (error) {
      showResult("error", "Action Failed", error instanceof Error ? error.message : "Failed to change password.");
    } finally {
      setSaving(false);
    }
  };

  // --- WEB CROPPER LOGIC ---

  const closeWebCropper = useCallback(() => {
    if (webCrop?.objectUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(webCrop.objectUrl);
    }
    setWebCrop(null);
    setCropTransform({ scale: 1, translateX: 0, translateY: 0 });
  }, [webCrop]);

  const clampCropTransform = useCallback(
    (nextScale: number, nextTranslateX: number, nextTranslateY: number, sourceWidth: number, sourceHeight: number) => {
      const fitScale = Math.min(cropViewportSize / Math.max(1, sourceWidth), cropViewportSize / Math.max(1, sourceHeight));
      const minCoverScale = Math.max(cropBoxSize / Math.max(1, sourceWidth * fitScale), cropBoxSize / Math.max(1, sourceHeight * fitScale));
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

  const beginCropDrag = useCallback((clientX: number, clientY: number) => {
    cropDragRef.current = { active: true, lastX: clientX, lastY: clientY };
    cropGestureRef.current = {
      startScale: cropTransformRef.current.scale,
      startTranslateX: cropTransformRef.current.translateX,
      startTranslateY: cropTransformRef.current.translateY,
      startClientX: clientX,
      startClientY: clientY,
    };
    setIsCropDragging(true);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || !isCropDragging || !webCrop) return;
    const handleMouseMove = (event: MouseEvent) => {
      if (!cropDragRef.current.active) return;
      updateCropTranslation(
        cropGestureRef.current.startTranslateX + (event.clientX - cropGestureRef.current.startClientX),
        cropGestureRef.current.startTranslateY + (event.clientY - cropGestureRef.current.startClientY)
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
      const initialScale = Math.max(minCoverScale, Math.abs(naturalWidth - naturalHeight) > 2 ? minCoverScale * 1.08 : minCoverScale);
      setWebCrop((current) => (current ? { ...current, naturalWidth, naturalHeight } : current));
      setCropTransform((current) => clampCropTransform(Math.max(current.scale, initialScale), current.translateX, current.translateY, naturalWidth, naturalHeight));
    };
    image.onerror = () => {
      if (cancelled) return;
      showResult("error", "Error", "Failed to load image for cropping.");
      closeWebCropper();
    };
    image.src = webCrop.sourceUri;
    return () => { cancelled = true; };
  }, [webCrop, closeWebCropper, clampCropTransform, cropBoxSize, cropViewportSize, showResult]);

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
    if (!ctx) throw new Error("Canvas is not supported in this browser.");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cropSize, cropSize);
    ctx.translate(cropSize / 2 + cropTransform.translateX * exportScale, cropSize / 2 + cropTransform.translateY * exportScale);
    ctx.scale(renderScale, renderScale);
    ctx.translate(-naturalWidth / 2, -naturalHeight / 2);
    ctx.drawImage(img, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    try {
      setSaving(true);
      const uploadedUrl = await uploadProfileImage(dataUrl, webCrop.fileName, webCrop.mimeType);
      await saveProfileDetails({ ...form, profile_image: uploadedUrl });
      setAvatarViewerOpen(false);
      closeWebCropper();
      showResult("success", "Action Completed", "Profile photo updated successfully.");
    } catch (error) {
      showResult("error", "Action Failed", error instanceof Error ? error.message : "Failed to save cropped image.");
    } finally {
      setSaving(false);
    }
  };

  const handlePickPhoto = async () => {
    try {
      const image = await pickSquareImageAsync({ webMode: Platform.OS === "web" ? "raw" : "auto" });
      if (!image) return;

      if (Platform.OS === "web") {
        setAvatarViewerOpen(false);
        const objectUrl = image.file ? URL.createObjectURL(image.file) : image.uri;
        setCropTransform({ scale: 1, translateX: 0, translateY: 0 });
        setWebCrop({
          sourceUri: objectUrl,
          fileName: image.name,
          mimeType: image.mimeType,
          objectUrl: image.file ? objectUrl : undefined,
          naturalWidth: 0,
          naturalHeight: 0,
        });
        return;
      }

      setSaving(true);
      const uploadedUrl = await uploadProfileImage(image.uri, image.name || "profile.jpg", image.mimeType || "image/jpeg", image.file);
      await saveProfileDetails({ ...form, profile_image: uploadedUrl });
      setAvatarViewerOpen(false);
      showResult("success", "Action Completed", "Profile photo updated successfully.");
    } catch (error) {
      showResult("error", "Action Failed", error instanceof Error ? error.message : "Failed to update profile photo.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoDeleteConfirmOpen(false);
    try {
      setSaving(true);
      await saveProfileDetails({ ...form, profile_image: null });
      setAvatarViewerOpen(false);
      showResult("success", "Action Completed", "Profile photo removed.");
    } catch (error) {
      showResult("error", "Action Failed", error instanceof Error ? error.message : "Failed to remove profile photo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MemberShell
      title="Profile"
      subtitle="View your account and update your details."
      active="profile"
      onNavigate={(key) => router.push(`/(member)/${key}` as never)}
    >
      <View style={styles.pageGrid}>
        <View style={styles.summaryCard}>
          <ProfileCard
            isCompact={false}
            profileImage={profile?.profile_image}
            onOpenAvatarViewer={handleOpenAvatarViewer}
            displayName={displayName}
            roleLabel="MEMBER"
            emailValue={profile?.email || session?.user.email || "-"}
            phoneValue={profile?.phone_number || "-"}
            addressValue={profile?.address || "-"}
          />
        </View>

        <View style={styles.actionRow}>
          <Pressable style={[styles.editButton, loading ? styles.editButtonDisabled : null]} onPress={() => setEditOpen(true)} disabled={loading}>
            <Feather name="edit-3" size={14} color="#fff" />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </Pressable>
          <Pressable
            style={[styles.passwordButton, loading ? styles.editButtonDisabled : null]}
            onPress={() => setPasswordOpen(true)}
            disabled={loading}
          >
            <Feather name="lock" size={14} color="#1d4ed8" />
            <Text style={styles.passwordButtonText}>Change Password</Text>
          </Pressable>
        </View>
      </View>

      {/* MODAL: AVATAR VIEWER / UPDATE PHOTO */}
      <ResponsiveModal
        visible={avatarViewerOpen}
        onClose={() => setAvatarViewerOpen(false)}
        maxWidthDesktop={480}
        maxWidthPhoneRatio={0.94}
        maxHeightDesktopRatio={0.85}
        maxHeightPhoneRatio={0.9}
        cardStyle={[styles.avatarViewerCard, { maxWidth: isTablet ? 480 : vw * 0.94 }]}
      >
        <ScrollView 
          style={styles.modalScroll} 
          contentContainerStyle={[styles.modalScrollContent, { padding: modalPadding, gap: elementGap }]} 
          showsVerticalScrollIndicator={false} 
          bounces={false}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { fontSize: Math.max(16, 20 * scale) }]}>Update Profile Photo</Text>
            <Text style={[styles.modalSubtitle, { fontSize: Math.max(11, 13 * scale) }]}>Change or remove your profile avatar.</Text>
          </View>

          <View style={[styles.avatarViewerPreview, { marginVertical: 8 * scale }]}>
            <View style={[styles.avatarSquareFrame, { width: avatarSize, height: avatarSize, borderRadius: 28 * scale, borderWidth: Math.max(3, 5 * scale) }]}>
              {profile?.profile_image && !profileImageFailed ? (
                <Image source={{ uri: profile.profile_image }} style={styles.avatarViewerImage} contentFit="cover" onError={() => setProfileImageFailed(true)} />
              ) : (
                <Image source={PROFILE_PLACEHOLDER} style={styles.avatarViewerImage} contentFit="cover" />
              )}
            </View>
          </View>

          <View style={[styles.avatarViewerActions, { gap: 10 * scale }]}>
            <Pressable 
              style={[styles.avatarPrimaryButton, { minHeight: 42 * scale, borderRadius: 12 * scale }, saving && styles.saveButtonDisabled]} 
              onPress={handlePickPhoto} 
              disabled={saving}
            >
              <Feather name="upload" size={16 * scale} color="#ffffff" />
              <Text style={[styles.avatarPrimaryButtonText, { fontSize: Math.max(11, 13 * scale) }]}>{saving ? "Working..." : "Choose Photo"}</Text>
            </Pressable>

            {profile?.profile_image ? (
              <Pressable 
                style={[styles.avatarDangerButton, { minHeight: 42 * scale, borderRadius: 12 * scale }]} 
                onPress={() => setPhotoDeleteConfirmOpen(true)} 
                disabled={saving}
              >
                <Feather name="trash-2" size={16 * scale} color="#dc2626" />
                <Text style={[styles.avatarDangerButtonText, { fontSize: Math.max(11, 13 * scale) }]}>Remove</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={[styles.modalFooter, { marginTop: 8 * scale }]}>
            <Pressable 
              style={[styles.cancelButton, { minHeight: 38 * scale, borderRadius: 10 * scale, paddingHorizontal: 20 * scale }]} 
              onPress={() => setAvatarViewerOpen(false)} 
              disabled={saving}
            >
              <Text style={[styles.cancelButtonText, { fontSize: Math.max(11, 13 * scale) }]}>Close</Text>
            </Pressable>
          </View>
        </ScrollView>
      </ResponsiveModal>

      {/* MODAL: WEB CROPPER */}
      {webCrop ? (
        <View style={styles.cropOverlayRoot}>
          <View style={styles.cropOverlayBackdrop} />
          <View style={[styles.cropOverlayCard, { width: cropModalWidth, maxHeight: Math.max(320, vh - 32) }]}>
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
              {(() => {
                const fitScale = Math.min(cropViewportSize / Math.max(1, webCrop.naturalWidth || cropViewportSize), cropViewportSize / Math.max(1, webCrop.naturalHeight || cropViewportSize));
                const displayWidth = Math.max(1, (webCrop.naturalWidth || cropViewportSize) * fitScale * cropTransform.scale);
                const displayHeight = Math.max(1, (webCrop.naturalHeight || cropViewportSize) * fitScale * cropTransform.scale);
                const edgeSize = Math.max(0, (cropViewportSize - cropBoxSize) / 2);
                return (
                  <View
                    style={styles.cropCanvas}
                    onMouseDown={(event) => { if (Platform.OS === "web") { event.preventDefault(); beginCropDrag(event.nativeEvent.clientX, event.nativeEvent.clientY); } }}
                    onWheel={(event: any) => {
                      if (!webCrop) return;
                      event.preventDefault();
                      const delta = event.nativeEvent?.deltaY ?? event.deltaY ?? 0;
                      setCropScale(delta > 0 ? Math.max(0.2, Number((cropTransformRef.current.scale - 0.08).toFixed(2))) : Math.min(3, Number((cropTransformRef.current.scale + 0.08).toFixed(2))));
                    }}
                  >
                    <Image
                      source={{ uri: webCrop.sourceUri }}
                      style={[styles.cropImage, { width: displayWidth, height: displayHeight, left: (cropViewportSize - displayWidth) / 2 + cropTransform.translateX, top: (cropViewportSize - displayHeight) / 2 + cropTransform.translateY }]}
                      contentFit="contain"
                      pointerEvents="none"
                    />
                    <View pointerEvents="none" style={[styles.cropShadeTop, { height: edgeSize }]} />
                    <View pointerEvents="none" style={[styles.cropShadeBottom, { height: edgeSize }]} />
                    <View pointerEvents="none" style={[styles.cropShadeLeft, { width: edgeSize, top: edgeSize, height: cropBoxSize }]} />
                    <View pointerEvents="none" style={[styles.cropShadeRight, { width: edgeSize, top: edgeSize, height: cropBoxSize }]} />
                    <View pointerEvents="none" style={[styles.cropBoxFrame, { width: cropBoxSize, height: cropBoxSize, left: edgeSize, top: edgeSize }]} />
                  </View>
                );
              })()}
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

      {/* MODAL: EDIT DETAILS */}
      <ResponsiveModal
        visible={editOpen}
        onClose={() => (saving ? null : setEditOpen(false))}
        maxWidthDesktop={660}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.86}
        maxHeightPhoneRatio={0.78}
        cardStyle={[styles.modalCard, isPhoneLandscape && styles.modalCardLandscape]}
      >
        <View style={styles.modalInner}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isPhoneLandscape && styles.modalTitleLandscape]}>Edit Profile</Text>
            <Text style={[styles.modalSubtitle, isPhoneLandscape && styles.modalSubtitleLandscape]}>Update your personal details.</Text>
          </View>

          <ScrollView
            style={{ maxHeight: isPhoneLandscape ? Math.max(220, vh * 0.58) : Math.max(300, vh * 0.7) }}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            <Field compact={isPhoneLandscape} label="First Name" value={form.first_name} onChangeText={(value) => setForm((prev) => ({ ...prev, first_name: value }))} />
            <Field compact={isPhoneLandscape} label="Last Name" value={form.last_name} onChangeText={(value) => setForm((prev) => ({ ...prev, last_name: value }))} />
            <Field compact={isPhoneLandscape} label="Phone Number" value={form.phone_number} onChangeText={(value) => setForm((prev) => ({ ...prev, phone_number: value }))} />
            <Field compact={isPhoneLandscape} label="Address" value={form.address} onChangeText={(value) => setForm((prev) => ({ ...prev, address: value }))} multiline />
            <View style={styles.modalActions}>
              <Pressable style={styles.ghostButton} onPress={() => setEditOpen(false)} disabled={saving}>
                <Text style={styles.ghostButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleSaveDetails} disabled={saving}>
                <Feather name="save" size={14} color="#fff" />
                <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Changes"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </ResponsiveModal>

      {/* MODAL: CHANGE PASSWORD */}
      <ResponsiveModal
        visible={passwordOpen}
        onClose={() => (saving ? null : setPasswordOpen(false))}
        maxWidthDesktop={560}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.86}
        maxHeightPhoneRatio={0.78}
        cardStyle={[styles.modalCard, isPhoneLandscape && styles.modalCardLandscape]}
      >
        <View style={styles.modalInner}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isPhoneLandscape && styles.modalTitleLandscape]}>Change Password</Text>
            <Text style={[styles.modalSubtitle, isPhoneLandscape && styles.modalSubtitleLandscape]}>Verify your current password before setting a new one.</Text>
          </View>

          <ScrollView
            style={{ maxHeight: isPhoneLandscape ? Math.max(220, vh * 0.58) : Math.max(280, vh * 0.64) }}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            <Field compact={isPhoneLandscape} label="Current Password" value={passwordForm.current_password} onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, current_password: value }))} secure />
            <Field compact={isPhoneLandscape} label="New Password" value={passwordForm.new_password} onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, new_password: value }))} secure />
            <Field compact={isPhoneLandscape} label="Confirm New Password" value={passwordForm.confirm_password} onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, confirm_password: value }))} secure />
            <View style={styles.modalActions}>
              <Pressable style={styles.ghostButton} onPress={() => setPasswordOpen(false)} disabled={saving}>
                <Text style={styles.ghostButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleChangePassword} disabled={saving}>
                <Feather name="save" size={14} color="#fff" />
                <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Password"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </ResponsiveModal>

      <InventoryConfirmModal
        visible={photoDeleteConfirmOpen}
        title="Remove Profile Photo?"
        message="This will delete the current profile photo."
        confirmLabel="Remove Photo"
        tone="danger"
        loading={saving}
        onCancel={() => (saving ? null : setPhotoDeleteConfirmOpen(false))}
        onConfirm={handleRemovePhoto}
      />

      <InventoryResultModal
        visible={resultModalOpen}
        status={resultStatus}
        title={resultTitle}
        message={resultMessage}
        onClose={() => setResultModalOpen(false)}
      />
    </MemberShell>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline = false,
  secure = false,
  compact = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  secure?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, compact && styles.fieldLabelCompact]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="#94a3b8"
        multiline={multiline}
        secureTextEntry={secure}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.input, compact && styles.inputCompact, multiline && styles.inputMultiline, multiline && compact && styles.inputMultilineCompact]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pageGrid: { gap: 14 },
  summaryCard: { borderRadius: 14, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", overflow: "hidden" },
  actionRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 4 },
  editButton: { minHeight: 42, borderRadius: 10, backgroundColor: "#1d4ed8", paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  editButtonDisabled: { opacity: 0.7 },
  editButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  passwordButton: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  passwordButtonText: { color: "#1d4ed8", fontSize: 13, fontWeight: "700" },
  modalCard: { width: "100%", maxWidth: 660, backgroundColor: "#fff", borderRadius: 24, padding: 16, gap: 12 },
  modalCardLandscape: { borderRadius: 18, padding: 10, gap: 8 },
  avatarViewerCard: { width: "100%", backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#d8e2f0", borderRadius: 28, overflow: "hidden" },
  modalScroll: { width: "100%" },
  modalScrollContent: { minHeight: 0 },
  modalInner: { gap: 12 },
  modalHeader: { gap: 4, alignItems: "center" },
  modalTitle: { color: "#0f172a", fontWeight: "800" },
  modalSubtitle: { color: "#64748b", fontWeight: "600" },
  modalTitleLandscape: { fontSize: 16 },
  modalSubtitleLandscape: { fontSize: 12 },
  modalContent: { gap: 10, paddingBottom: 4 },
  avatarViewerPreview: { width: "100%", alignItems: "center", justifyContent: "center" },
  avatarSquareFrame: {
    aspectRatio: 1,
    overflow: "hidden",
    backgroundColor: "#f1f5f9",
    borderColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  avatarViewerImage: { width: "100%", height: "100%" },
  avatarViewerActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  avatarPrimaryButton: { flex: 1, backgroundColor: "#1d4ed8", paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  avatarPrimaryButtonText: { color: "#ffffff", fontWeight: "800" },
  avatarDangerButton: { flex: 1, borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fff5f5", paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  avatarDangerButtonText: { color: "#dc2626", fontWeight: "800" },
  modalFooter: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 4 },
  cancelButton: { minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  cancelButtonText: { color: "#334155", fontSize: 13, fontWeight: "700" },
  field: { gap: 6 },
  fieldLabel: { color: "#334155", fontSize: 12, fontWeight: "700" },
  fieldLabelCompact: { fontSize: 11 },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 12, color: "#0f172a" },
  inputCompact: { minHeight: 36, borderRadius: 10, paddingHorizontal: 10, fontSize: 12 },
  inputMultiline: { minHeight: 96, paddingTop: 12, paddingBottom: 12 },
  inputMultilineCompact: { minHeight: 56, paddingTop: 8, paddingBottom: 8 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  ghostButton: { minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  ghostButtonText: { color: "#334155", fontSize: 13, fontWeight: "700" },
  saveButton: { minHeight: 40, borderRadius: 10, backgroundColor: "#1d4ed8", paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  saveButtonDisabled: { opacity: 0.65 },
  saveButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  cropOverlayRoot: { ...StyleSheet.absoluteFillObject, zIndex: 200, elevation: 20, alignItems: "center", justifyContent: "center", padding: 16 },
  cropOverlayBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.58)" },
  cropOverlayCard: { width: "100%", maxWidth: 560, borderRadius: 22, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#d8e2f0", padding: 16, gap: 12, shadowColor: "#0f172a", shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  cropViewport: { width: "100%", aspectRatio: 1, borderRadius: 18, overflow: "hidden", backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#dbe5f3" },
  cropCanvas: { flex: 1, overflow: "hidden", backgroundColor: "#0f172a", cursor: "grab", touchAction: "none" },
  cropImage: { position: "absolute" },
  cropShadeTop: { position: "absolute", left: 0, right: 0, top: 0, backgroundColor: "rgba(15, 23, 42, 0.34)" },
  cropShadeBottom: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.34)" },
  cropShadeLeft: { position: "absolute", left: 0, backgroundColor: "rgba(15, 23, 42, 0.34)" },
  cropShadeRight: { position: "absolute", right: 0, backgroundColor: "rgba(15, 23, 42, 0.34)" },
  cropBoxFrame: { position: "absolute", borderWidth: 2, borderColor: "rgba(255,255,255,0.88)", borderStyle: "solid", borderRadius: 16, backgroundColor: "transparent" },
});
