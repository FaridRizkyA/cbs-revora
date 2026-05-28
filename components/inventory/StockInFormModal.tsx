import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import FilterSelectField from "./FilterSelectField";
import DatePickerField from "./DatePickerField";
import PrimaryActionButton from "./PrimaryActionButton";

type SupplierOption = {
  id_supplier: string;
  supplier_name: string;
};

type ProductOption = {
  id_product: string;
  product_name: string;
  product_code: string;
};

type DraftItem = {
  id_product: string;
  quantity: string;
  expired_date: string;
  purchase_price: string;
};

type StockInFormModalProps = {
  visible: boolean;
  suppliers: SupplierOption[];
  products: ProductOption[];
  selectedSupplierId: string;
  notes: string;
  items: DraftItem[];
  minimumExpiredDate?: Date;
  saving: boolean;
  onClose: () => void;
  onSupplierChange: (id: string) => void;
  onNotesChange: (value: string) => void;
  onItemChange: (index: number, patch: Partial<DraftItem>) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  onSubmit: () => void;
};

export default function StockInFormModal(props: StockInFormModalProps) {
  const { width, height } = useWindowDimensions();
  const shortSide = Math.min(width, height);
  const isPhone = shortSide < 768;

  const {
    visible,
    suppliers,
    products,
    selectedSupplierId,
    notes,
    items,
    minimumExpiredDate,
    saving,
    onClose,
    onSupplierChange,
    onNotesChange,
    onItemChange,
    onAddRow,
    onRemoveRow,
    onSubmit,
  } = props;

  const supplierOptions = suppliers.map((supplier) => ({
    label: supplier.supplier_name,
    value: supplier.id_supplier,
  }));

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              maxWidth: isPhone ? Math.max(shortSide * 0.94, 320) : 640,
              maxHeight: isPhone ? height * 0.8 : height * 0.88,
            },
          ]}
        >
          <Text style={styles.title}>Add Stock In</Text>
          <ScrollView contentContainerStyle={styles.body}>
            <FilterSelectField
              label="Supplier"
              value={selectedSupplierId}
              options={supplierOptions}
              onChange={onSupplierChange}
            />
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={onNotesChange}
                placeholder="Optional notes"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />
            </View>

            <Text style={styles.sectionTitle}>Items</Text>
            {items.map((item, index) => {
              const selectedByOthers = new Set(
                items.filter((_, i) => i !== index).map((it) => it.id_product).filter(Boolean)
              );
              const productOptions = products
                .filter((product) => !selectedByOthers.has(product.id_product) || product.id_product === item.id_product)
                .map((product) => ({
                  value: product.id_product,
                  label: `${product.product_name} (${product.product_code})`,
                }));

              return (
                <View key={`item-${index}`} style={styles.itemCard}>
                  <FilterSelectField
                    label={`Product #${index + 1}`}
                    value={item.id_product}
                    options={productOptions}
                    onChange={(value) => onItemChange(index, { id_product: value })}
                  />
                  <View style={styles.fieldWrap}>
                    <Text style={styles.label}>Qty</Text>
                    <TextInput
                      value={item.quantity}
                      onChangeText={(value) => onItemChange(index, { quantity: value.replace(/[^0-9]/g, "") })}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#94a3b8"
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.fieldWrap}>
                    <Text style={styles.label}>Purchase Price</Text>
                    <TextInput
                      value={item.purchase_price}
                      onChangeText={(value) => onItemChange(index, { purchase_price: value.replace(/[^0-9]/g, "") })}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#94a3b8"
                      style={styles.input}
                    />
                  </View>
                  <DatePickerField
                    label="Expired Date"
                    value={item.expired_date}
                    placeholder="Select expired date"
                    onChange={(value) => onItemChange(index, { expired_date: value })}
                    minimumDate={minimumExpiredDate}
                  />
                  {items.length > 1 ? (
                    <Pressable style={styles.removeBtn} onPress={() => onRemoveRow(index)}>
                      <Text style={styles.removeBtnText}>Remove Row</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}

            <PrimaryActionButton label="Add Product Row" onPress={onAddRow} fullWidth />
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.submitBtn} onPress={onSubmit} disabled={saving}>
              <Text style={styles.submitBtnText}>{saving ? "Saving..." : "Save Stock In"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { width: "100%", borderRadius: 14, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", overflow: "hidden" },
  title: { fontSize: 18, fontWeight: "800", color: "#0f172a", padding: 16, borderBottomWidth: 1, borderBottomColor: "#eef2f7" },
  body: { padding: 16, gap: 10 },
  fieldWrap: { gap: 6 },
  label: { color: "#334155", fontSize: 12, fontWeight: "700" },
  input: { height: 38, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 12, color: "#0f172a" },
  sectionTitle: { marginTop: 4, color: "#0f172a", fontSize: 13, fontWeight: "800" },
  itemCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 10, gap: 8, backgroundColor: "#f8fafc" },
  removeBtn: { minHeight: 34, borderRadius: 9, borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fef2f2", alignItems: "center", justifyContent: "center" },
  removeBtnText: { color: "#b91c1c", fontSize: 12, fontWeight: "700" },
  footer: { borderTopWidth: 1, borderTopColor: "#eef2f7", padding: 12, flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  cancelBtn: { minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { color: "#334155", fontSize: 12, fontWeight: "700" },
  submitBtn: { minHeight: 36, borderRadius: 10, backgroundColor: "#1d4ed8", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  submitBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
