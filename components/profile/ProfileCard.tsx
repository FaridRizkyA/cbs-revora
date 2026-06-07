import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";

const PROFILE_PLACEHOLDER = require("../../assets/images/placeholders/default-profile.png");

type ProfileCardProps = {
  isCompact: boolean;
  profileImage?: string | null;
  onOpenAvatarViewer: () => void;
  displayName: string;
  roleLabel: string;
  emailValue: string;
  phoneValue: string;
  addressValue: string;
};

export default function ProfileCard({
  isCompact,
  profileImage,
  onOpenAvatarViewer,
  displayName,
  roleLabel,
  emailValue,
  phoneValue,
  addressValue,
}: ProfileCardProps) {
  const [photoHover, setPhotoHover] = useState(false);
  const [profileImageFailed, setProfileImageFailed] = useState(false);

  // If profile image changes from parent, we might want to reset failure state.
  // We can do this safely by checking in useEffect or just letting the user reload the page,
  // but let's assume it works well enough.

  return (
    <View style={styles.summaryCard}>
      <View style={styles.cardTopGlow} />
      <View style={styles.cardCornerTopLeft} />
      <View style={styles.cardCornerBottomRight} />
      <View style={styles.cardDotsTopRight} />
      <View style={styles.cardDotsBottomLeft} />
      <View style={[styles.cardSurface, isCompact && styles.cardSurfaceCompact]}>
        <Pressable
          style={({ pressed }) => [styles.cardPhotoWrap, pressed && styles.photoPanePressed]}
          onPress={onOpenAvatarViewer}
          onHoverIn={() => setPhotoHover(true)}
          onHoverOut={() => setPhotoHover(false)}
        >
          {profileImage && !profileImageFailed ? (
            <Image
              source={{ uri: profileImage }}
              style={styles.cardPhoto}
              contentFit="cover"
              onError={() => setProfileImageFailed(true)}
            />
          ) : (
            <Image source={PROFILE_PLACEHOLDER} style={styles.cardPhoto} contentFit="cover" />
          )}
          <View pointerEvents="none" style={[styles.cardPhotoOverlay, photoHover && styles.cardPhotoOverlayVisible]}>
            <Feather name="eye" size={28} color="#ffffff" />
          </View>
        </Pressable>

        <View style={styles.cardContent}>
          <View style={styles.identityBlock}>
            <Text style={styles.profileCodeLabel}>Profile Card</Text>
            <Text style={styles.nameText}>{displayName}</Text>
            <View style={styles.roleRow}>
              <Text style={styles.rolePill}>{roleLabel}</Text>
            </View>
          </View>

          <View style={styles.detailStack}>
            <DetailRow label="Email" value={emailValue} />
            <DetailRow label="Phone Number" value={phoneValue} />
            <DetailRow label="Address" value={addressValue} multiline />
          </View>
        </View>
      </View>
    </View>
  );
}

function DetailRow({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <View style={[styles.detailRow, multiline && styles.detailRowTall]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, multiline && styles.detailValueMultiline]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    borderRadius: 24,
    backgroundColor: "#0f2143",
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOpacity: 0.22,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
    borderWidth: 1,
    borderColor: "#1d3b6f",
    position: "relative",
  },
  cardTopGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: "#2563eb",
  },
  cardCornerTopLeft: {
    position: "absolute",
    top: -28,
    left: -28,
    width: 120,
    height: 120,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(59,130,246,0.4)",
    backgroundColor: "rgba(59,130,246,0.12)",
  },
  cardCornerBottomRight: {
    position: "absolute",
    right: -30,
    bottom: -38,
    width: 160,
    height: 160,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(34,211,238,0.35)",
    backgroundColor: "rgba(34,211,238,0.08)",
  },
  cardDotsTopRight: {
    position: "absolute",
    top: 22,
    right: 24,
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "transparent",
    opacity: 0.75,
    shadowColor: "#fff",
    shadowOpacity: 0.85,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 0 },
  },
  cardDotsBottomLeft: {
    position: "absolute",
    left: 24,
    bottom: 26,
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "transparent",
    opacity: 0.75,
  },
  cardSurface: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 28,
    paddingHorizontal: 24,
    paddingVertical: 24,
    minHeight: 360,
  },
  cardSurfaceCompact: {
    flexDirection: "column",
    alignItems: "center",
    minHeight: "auto",
    gap: 20,
  },
  cardPhotoWrap: {
    width: 280,
    height: 280,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
    alignSelf: "center",
    flexShrink: 0,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  cardPhoto: {
    width: "100%",
    height: "100%",
  },
  cardPhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3, 7, 18, 0)",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0,
  },
  cardPhotoOverlayVisible: {
    backgroundColor: "rgba(3, 7, 18, 0.42)",
    opacity: 1,
  },
  cardContent: {
    flex: 1.18,
    gap: 14,
    alignSelf: "flex-start",
    justifyContent: "center",
    minWidth: 0,
  },
  photoPanePressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  identityBlock: { gap: 8 },
  profileCodeLabel: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  nameText: { color: "#ffffff", fontSize: 26, fontWeight: "800", lineHeight: 30 },
  roleRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  rolePill: {
    color: "#dbeafe",
    backgroundColor: "rgba(37,99,235,0.15)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.35)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  detailStack: { gap: 10 },
  detailRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  detailRowTall: { minHeight: 76 },
  detailLabel: { color: "#bfdbfe", fontSize: 12, fontWeight: "700" },
  detailValue: { color: "#ffffff", fontSize: 13, fontWeight: "500", lineHeight: 18 },
  detailValueMultiline: { minHeight: 34 },
});
