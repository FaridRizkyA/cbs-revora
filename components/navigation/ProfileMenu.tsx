import { Pressable, StyleSheet, Text, View } from "react-native";

type ProfileMenuProps = {
  name: string;
  role?: string;
  onPress?: () => void;
};

export default function ProfileMenu({ name, role, onPress }: ProfileMenuProps) {
  return (
    <Pressable style={styles.profile} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{name.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View>
        <Text style={styles.name}>{name}</Text>
        {role ? <Text style={styles.role}>{role}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    borderRadius: 20,
  },
  avatarText: { color: "#ffffff", fontWeight: "800" },
  name: { color: "#061329", fontSize: 15, fontWeight: "800" },
  role: { color: "#52617a", fontSize: 12, marginTop: 3 },
});
