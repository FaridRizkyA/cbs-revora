import { Pressable, StyleSheet, Text, View } from "react-native";

type ActiveFilterItem = {
  key: string;
  label: string;
  value: string;
  onClear: () => void;
};

type ActiveFilterBadgesProps = {
  items: ActiveFilterItem[];
  onClearAll?: () => void;
};

export default function ActiveFilterBadges({ items, onClearAll }: ActiveFilterBadgesProps) {
  if (!items.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {items.map((item) => (
          <Pressable key={item.key} style={styles.badge} onPress={item.onClear}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {item.label}: {item.value} x
            </Text>
          </Pressable>
        ))}
      </View>
      {onClearAll ? (
        <Pressable style={styles.clearAllBtn} onPress={onClearAll}>
          <Text style={styles.clearAllText}>Clear All</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, gap: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  badgeText: { color: "#1d4ed8", fontSize: 12, fontWeight: "700" },
  clearAllBtn: {
    alignSelf: "flex-start",
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  clearAllText: { color: "#334155", fontSize: 12, fontWeight: "700" },
});
