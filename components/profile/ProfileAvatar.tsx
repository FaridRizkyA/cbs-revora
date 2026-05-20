import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

type ProfileAvatarProps = {
  name: string;
  imageUrl?: string | null;
  size?: number;
};

export default function ProfileAvatar({ name, imageUrl, size = 48 }: ProfileAvatarProps) {
  const avatarStyle = { width: size, height: size, borderRadius: size / 2 };

  if (imageUrl) {
    return <Image source={imageUrl} style={[styles.avatar, avatarStyle]} contentFit="cover" />;
  }

  return (
    <View style={[styles.avatar, avatarStyle]}>
      <Text style={styles.initials}>{name.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  initials: { color: "#ffffff", fontWeight: "900" },
});
