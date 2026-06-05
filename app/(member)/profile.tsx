import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import ResponsiveModal from "../../components/common/ResponsiveModal";
import MemberShell from "../../components/member/MemberShell";
import ProfileCard from "../../components/profile/ProfileCard";
import { API_BASE_URL } from "../../utils/api";
import { getAuthSession, normalizeRole, type AuthSession } from "../../utils/authSession";
import { fetchWithAuth } from "../../utils/fetchWithAuth";
import { pickSquareImageAsync } from "../../utils/imageUpload";

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
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(emptyPasswordForm);
  const [profileImageFailed, setProfileImageFailed] = useState(false);

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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getAuthSession()
      .then(async (nextSession) => {
        if (!active) return;
        if (!nextSession?.token || !normalizeRole(nextSession.user.role_name)) {
          router.replace("/login");
          return;
        }

        const accessResponse = await fetchWithAuth("/api/member/access");
        const accessPayload = await accessResponse.json();
        if (!accessResponse.ok || !accessPayload?.data?.is_member) {
          router.replace("/login");
          return;
        }

        setSession(nextSession);
        loadProfile(nextSession).catch((error) => {
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

  const displayName = useMemo(
    () => `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || profile?.full_name || session?.user.full_name || "Member",
    [profile?.first_name, profile?.last_name, profile?.full_name, session?.user.full_name]
  );

  const uploadProfileImage = async (imageUri: string, fileName: string, mimeType: string) => {
    if (!session?.token) throw new Error("Session expired. Please sign in again.");

    const formData = new FormData();
    if (Platform.OS === "web" && imageUri.startsWith("data:")) {
      const blob = await (await fetch(imageUri)).blob();
      formData.append("image", blob, fileName);
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

  const saveProfile = async (payload: FormState & { profile_image?: string | null }) => {
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

  const handleSave = async () => {
    if (!form.first_name.trim()) {
      Alert.alert("Validation", "First name is required.");
      return;
    }

    setSaving(true);
    try {
      await saveProfile({
        ...form,
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
    if (!session?.user?.id_user) {
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
      Alert.alert("Success", "Password changed successfully.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to change password.");
    } finally {
      setSaving(false);
    }
  };

  const handlePickPhoto = async () => {
    try {
      const image = await pickSquareImageAsync({ webMode: Platform.OS === "web" ? "raw" : "auto" });
      if (!image) return;

      setSaving(true);
      const uploadedUrl = await uploadProfileImage(image.uri, image.name || "profile.jpg", image.mimeType || "image/jpeg");
      await saveProfile({
        ...form,
        profile_image: uploadedUrl,
      });
      Alert.alert("Success", "Profile photo updated successfully.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to update profile photo.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePhoto = () => {
    Alert.alert("Remove Photo?", "This will delete the current profile photo.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            setSaving(true);
            await saveProfile({
              ...form,
              profile_image: null,
            });
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
            onOpenAvatarViewer={() => setEditOpen(true)}
            displayName={displayName}
            roleLabel="MEMBER"
            emailValue={profile?.email || session?.user.email || "-"}
            phoneValue={profile?.phone_number || "-"}
            addressValue={profile?.address || "-"}
          />
        </View>

        <Pressable style={[styles.editButton, loading ? styles.editButtonDisabled : null]} onPress={() => setEditOpen(true)} disabled={loading}>
          <Feather name="edit-3" size={14} color="#fff" />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </Pressable>

        <Pressable
          style={[styles.passwordButton, loading ? styles.editButtonDisabled : null]}
          onPress={() => setPasswordOpen(true)}
          disabled={loading}
        >
          <Feather name="key" size={14} color="#1d4ed8" />
          <Text style={styles.passwordButtonText}>Change Password</Text>
        </Pressable>
      </View>

      <ResponsiveModal
        visible={editOpen}
        onClose={() => (saving ? null : setEditOpen(false))}
        cardStyle={styles.modalCard}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Edit Profile</Text>
          <Text style={styles.modalSubtitle}>Update your personal details and profile photo.</Text>
        </View>

        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.photoSection}>
            <View style={styles.photoPreview}>
              {profile?.profile_image && !profileImageFailed ? (
                <Image
                  source={{ uri: profile.profile_image }}
                  style={styles.photoImage}
                  contentFit="cover"
                  onError={() => setProfileImageFailed(true)}
                />
              ) : (
                <Image source={PROFILE_PLACEHOLDER} style={styles.photoImage} contentFit="cover" />
              )}
            </View>
            <View style={styles.photoActions}>
              <Pressable style={styles.photoButton} onPress={handlePickPhoto} disabled={saving}>
                <Feather name="upload" size={14} color="#1d4ed8" />
                <Text style={styles.photoButtonText}>{saving ? "Saving..." : "Choose Photo"}</Text>
              </Pressable>
              <Pressable style={styles.photoDangerButton} onPress={handleRemovePhoto} disabled={saving || !profile?.profile_image}>
                <Feather name="trash-2" size={14} color="#dc2626" />
                <Text style={styles.photoDangerButtonText}>Remove Photo</Text>
              </Pressable>
            </View>
          </View>

          <Field label="First Name" value={form.first_name} onChangeText={(value) => setForm((prev) => ({ ...prev, first_name: value }))} />
          <Field label="Last Name" value={form.last_name} onChangeText={(value) => setForm((prev) => ({ ...prev, last_name: value }))} />
          <Field label="Phone Number" value={form.phone_number} onChangeText={(value) => setForm((prev) => ({ ...prev, phone_number: value }))} />
          <Field label="Address" value={form.address} onChangeText={(value) => setForm((prev) => ({ ...prev, address: value }))} multiline />
        </ScrollView>

        <View style={styles.modalActions}>
          <Pressable style={styles.ghostButton} onPress={() => setEditOpen(false)} disabled={saving}>
            <Text style={styles.ghostButtonText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
            <Feather name="save" size={14} color="#fff" />
            <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Changes"}</Text>
          </Pressable>
        </View>
      </ResponsiveModal>

      <ResponsiveModal
        visible={passwordOpen}
        onClose={() => (saving ? null : setPasswordOpen(false))}
        cardStyle={styles.modalCard}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Change Password</Text>
          <Text style={styles.modalSubtitle}>Verify your current password before setting a new one.</Text>
        </View>

        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <Field
            label="Current Password"
            value={passwordForm.current_password}
            onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, current_password: value }))}
            secure
          />
          <Field
            label="New Password"
            value={passwordForm.new_password}
            onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, new_password: value }))}
            secure
          />
          <Field
            label="Confirm New Password"
            value={passwordForm.confirm_password}
            onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, confirm_password: value }))}
            secure
          />
        </ScrollView>

        <View style={styles.modalActions}>
          <Pressable style={styles.ghostButton} onPress={() => setPasswordOpen(false)} disabled={saving}>
            <Text style={styles.ghostButtonText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.saveButton} onPress={handleChangePassword} disabled={saving}>
            <Feather name="save" size={14} color="#fff" />
            <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Password"}</Text>
          </Pressable>
        </View>
      </ResponsiveModal>
    </MemberShell>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline = false,
  secure = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  secure?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="#94a3b8"
        multiline={multiline}
        secureTextEntry={secure}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pageGrid: { gap: 14 },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  editButton: {
    minHeight: 42,
    alignSelf: "flex-start",
    borderRadius: 10,
    backgroundColor: "#1d4ed8",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  editButtonDisabled: {
    opacity: 0.7,
  },
  editButtonText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  passwordButton: {
    minHeight: 42,
    alignSelf: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  passwordButtonText: { color: "#1d4ed8", fontSize: 12, fontWeight: "800" },
  modalCard: {
    width: "100%",
    maxWidth: 660,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  modalHeader: { gap: 4 },
  modalTitle: { color: "#0f172a", fontSize: 20, fontWeight: "800" },
  modalSubtitle: { color: "#64748b", fontSize: 12, fontWeight: "600" },
  modalContent: { gap: 12, paddingBottom: 4 },
  photoSection: {
    gap: 12,
    alignItems: "center",
  },
  photoPreview: {
    width: 180,
    aspectRatio: 1,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#dbe3ee",
  },
  photoImage: { width: "100%", height: "100%" },
  photoActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  photoButton: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  photoButtonText: { color: "#1d4ed8", fontSize: 12, fontWeight: "800" },
  photoDangerButton: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff5f5",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  photoDangerButtonText: { color: "#dc2626", fontSize: 12, fontWeight: "800" },
  field: { gap: 6 },
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
  inputMultiline: { minHeight: 96, paddingTop: 12, paddingBottom: 12 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  ghostButton: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostButtonText: { color: "#334155", fontSize: 12, fontWeight: "800" },
  saveButton: {
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: "#1d4ed8",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveButtonText: { color: "#fff", fontSize: 12, fontWeight: "800" },
});
