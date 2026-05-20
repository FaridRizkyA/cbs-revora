import Constants from "expo-constants";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

type Product = {
  id_product: string;
  product_code: string;
  barcode: string | null;
  product_name: string;
  selling_price: number;
  minimum_stock: number;
  available_stock: number;
};

const getApiBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(":")[0];
  return `http://${host || "localhost"}:3000`;
};

const API_BASE_URL = getApiBaseUrl();

const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace(/\s/g, " ");

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/products`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Failed to fetch products.");
      }

      setProducts(payload.data ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return products;
    }

    return products.filter((product) => {
      const text = [product.product_code, product.product_name, product.barcode ?? ""].join(" ").toLowerCase();
      return text.includes(query);
    });
  }, [products, search]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Products</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search code / name / barcode"
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#2563eb" />
          <Text style={styles.stateText}>Loading products...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable style={styles.retryButton} onPress={fetchProducts}>
            <Text style={styles.retryText}>Reload</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.tableWrap}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headCell, styles.codeCol]}>Code</Text>
            <Text style={[styles.headCell, styles.nameCol]}>Product</Text>
            <Text style={[styles.headCell, styles.barcodeCol]}>Barcode</Text>
            <Text style={[styles.headCell, styles.priceCol]}>Price</Text>
            <Text style={[styles.headCell, styles.stockCol]}>Stock</Text>
          </View>

          {filteredProducts.map((item) => (
            <View key={item.id_product} style={styles.tableRow}>
              <Text style={[styles.rowCell, styles.codeCol]} numberOfLines={1}>
                {item.product_code}
              </Text>
              <Text style={[styles.rowCell, styles.nameCol]} numberOfLines={1}>
                {item.product_name}
              </Text>
              <Text style={[styles.rowCell, styles.barcodeCol]} numberOfLines={1}>
                {item.barcode || "-"}
              </Text>
              <Text style={[styles.rowCell, styles.priceCol]} numberOfLines={1}>
                {formatRupiah(item.selling_price)}
              </Text>
              <View style={[styles.stockCol, styles.stockCellWrap]}>
                <View style={styles.stockBadge}>
                  <Text style={styles.stockBadgeText}>{item.available_stock}</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Text style={styles.footnote}>Stock is read-only and calculated automatically from Stock Movements.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 16,
    gap: 10,
  },
  header: {
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0f172a",
  },
  searchInput: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    color: "#0f172a",
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  stateText: {
    color: "#64748b",
  },
  errorText: {
    color: "#dc2626",
    fontWeight: "600",
    textAlign: "center",
  },
  retryButton: {
    height: 38,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  retryText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  tableWrap: {
    borderWidth: 1,
    borderColor: "#dbe3ee",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  tableHeader: {
    minHeight: 42,
    backgroundColor: "#f1f5f9",
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#dbe3ee",
  },
  tableRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
  },
  headCell: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    paddingHorizontal: 10,
  },
  rowCell: {
    fontSize: 13,
    color: "#0f172a",
    paddingHorizontal: 10,
  },
  codeCol: { width: "16%" },
  nameCol: { width: "30%" },
  barcodeCol: { width: "22%" },
  priceCol: { width: "20%" },
  stockCol: { width: "12%" },
  stockCellWrap: {
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: 10,
  },
  stockBadge: {
    minWidth: 44,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  stockBadgeText: {
    color: "#1d4ed8",
    fontWeight: "700",
    fontSize: 12,
  },
  footnote: {
    color: "#64748b",
    fontSize: 12,
  },
});
