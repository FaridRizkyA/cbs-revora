import { TextInput, View, StyleSheet } from "react-native";
import ActiveFilterBadges from "./ActiveFilterBadges";
import IconFilterButton from "./IconFilterButton";

type FilterBadgeItem = {
  key: string;
  label: string;
  value: string;
  onClear: () => void;
};

type InventoryFilterSectionProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  onOpenFilter: () => void;
  activeFilters: FilterBadgeItem[];
  onClearAllFilters: () => void;
};

export default function InventoryFilterSection({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  onOpenFilter,
  activeFilters,
  onClearAllFilters,
}: InventoryFilterSectionProps) {
  return (
    <View style={styles.filterCard}>
      <View style={styles.searchRow}>
        <TextInput
          value={searchValue}
          onChangeText={onSearchChange}
          placeholder={searchPlaceholder}
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
        />
        <IconFilterButton onPress={onOpenFilter} />
      </View>
      <ActiveFilterBadges items={activeFilters} onClearAll={onClearAllFilters} />
    </View>
  );
}

const styles = StyleSheet.create({
  filterCard: { borderRadius: 12, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", padding: 12 },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  searchInput: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#f8fafc", paddingHorizontal: 12, color: "#0f172a" },
});
