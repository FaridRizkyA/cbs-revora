import Constants from "expo-constants";
import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TextInput,
  View,
} from "react-native";

const PRODUCT_PLACEHOLDER = require("../../assets/images/placeholders/default-product.png");
const CASHIER_ID = "2b8c7d6e-5f4a-43b2-a1c0-e9f8a7b6c512";
const CASHIER_NAME = "Rizky Pratama";

const CATEGORY_TABS = ["Semua", "Minuman", "Makanan", "Snack"] as const;
type ProductCategory = (typeof CATEGORY_TABS)[number];

type AppIconName =
  | "monitor"
  | "grid"
  | "package"
  | "activity"
  | "file-text"
  | "users"
  | "dollar-sign"
  | "chevron-down"
  | "search"
  | "hash"
  | "shopping-bag"
  | "gift";

const ICON_GLYPHS: Record<AppIconName, string> = {
  monitor: "◫",
  grid: "▦",
  package: "⬡",
  activity: "〽",
  "file-text": "☰",
  users: "◎",
  "dollar-sign": "$",
  "chevron-down": "▾",
  search: "⌕",
  hash: "#",
  "shopping-bag": "🛍",
  gift: "🎁",
};

const AppIcon = ({
  name,
  size = 16,
  color = "#475569",
  style,
}: {
  name: AppIconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) => (
  <Text style={[{ fontSize: size, color, lineHeight: size + 2, fontWeight: "600" }, style]}>
    {ICON_GLYPHS[name]}
  </Text>
);

const NAV_ITEMS: {
  label: string;
  icon: AppIconName;
  active?: boolean;
  chevron?: boolean;
}[] = [
  { label: "Kasir", icon: "monitor", active: true },
  { label: "Dashboard", icon: "grid" },
  { label: "Inventori", icon: "package", chevron: true },
  { label: "Movement Product", icon: "activity", chevron: true },
  { label: "Laporan & Riwayat", icon: "file-text" },
  { label: "Member", icon: "users" },
  { label: "Pendapatan", icon: "dollar-sign" },
];

type Product = {
  id_product: string;
  product_code: string;
  product_name: string;
  description: string | null;
  selling_price: number;
  minimum_stock: number;
  product_image: string | null;
  has_inventory_units: boolean;
  available_stock: number;
  nearest_expired_date: string | null;
};

type Member = {
  id_member: string;
  member_code: string;
  full_name: string;
  shopping_balance: number;
};

type CartItem = Product & {
  quantity: number;
};

type PaymentMethod = "CASH" | "QRIS";

const getApiBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:3000";
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

const getProductCategory = (product: Product): ProductCategory => {
  const source = `${product.product_name} ${product.description ?? ""}`.toLowerCase();

  if (
    source.includes("air") ||
    source.includes("teh") ||
    source.includes("kopi") ||
    source.includes("jus") ||
    source.includes("drink") ||
    source.includes("susu")
  ) {
    return "Minuman";
  }

  if (
    source.includes("mie") ||
    source.includes("nasi") ||
    source.includes("ayam") ||
    source.includes("dimsum") ||
    source.includes("goreng")
  ) {
    return "Makanan";
  }

  return "Snack";
};

export default function Index() {
  const [products, setProducts] = useState<Product[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [activeCategory, setActiveCategory] = useState<ProductCategory>("Semua");
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedMember = useMemo(
    () => members.find((member) => member.id_member === selectedMemberId) ?? null,
    [members, selectedMemberId]
  );

  const subtotal = useMemo(
    () => cart.reduce((total, item) => total + item.selling_price * item.quantity, 0),
    [cart]
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const searchable = [product.product_name, product.product_code, product.description ?? ""]
        .join(" ")
        .toLowerCase();
      const searchMatch = !query || searchable.includes(query);
      const categoryMatch =
        activeCategory === "Semua" || getProductCategory(product) === activeCategory;

      return searchMatch && categoryMatch;
    });
  }, [activeCategory, products, search]);

  const fetchProducts = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/api/products`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || "Gagal mengambil produk.");
    }

    setProducts(payload.data ?? []);
  }, []);

  const fetchMembers = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/api/members`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || "Gagal mengambil member.");
    }

    setMembers(payload.data ?? []);
  }, []);

  const loadCashierData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      await Promise.all([fetchProducts(), fetchMembers()]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal memuat data kasir.");
    } finally {
      setLoading(false);
    }
  }, [fetchMembers, fetchProducts]);

  useEffect(() => {
    loadCashierData();
  }, [loadCashierData]);

  const getProductSource = (product: Product) => {
    if (product.product_image) {
      return product.product_image;
    }

    return PRODUCT_PLACEHOLDER;
  };

  const addToCart = (product: Product) => {
    if (product.has_inventory_units && product.available_stock <= 0) {
      Alert.alert("Stok kosong", `${product.product_name} tidak punya stok tersedia.`);
      return;
    }

    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item.id_product === product.id_product);

      if (!existingItem) {
        return [...currentCart, { ...product, quantity: 1 }];
      }

      if (product.has_inventory_units && existingItem.quantity >= product.available_stock) {
        Alert.alert("Stok tidak cukup", `Stok tersedia hanya ${product.available_stock}.`);
        return currentCart;
      }

      return currentCart.map((item) =>
        item.id_product === product.id_product
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    });
  };

  const updateQuantity = (idProduct: string, change: number) => {
    setCart((currentCart) =>
      currentCart.flatMap((item) => {
        if (item.id_product !== idProduct) {
          return [item];
        }

        const nextQuantity = item.quantity + change;

        if (nextQuantity <= 0) {
          return [];
        }

        if (item.has_inventory_units && nextQuantity > item.available_stock) {
          Alert.alert("Stok tidak cukup", `Stok tersedia hanya ${item.available_stock}.`);
          return [item];
        }

        return [{ ...item, quantity: nextQuantity }];
      })
    );
  };

  const handleBarcodeSubmit = async () => {
    const query = barcode.trim();

    if (!query) {
      return;
    }

    const localMatch = products.find(
      (product) => product.product_code.toLowerCase() === query.toLowerCase()
    );

    if (localMatch) {
      addToCart(localMatch);
      setBarcode("");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/products?search=${encodeURIComponent(query)}`
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Produk tidak ditemukan.");
      }

      const apiMatch = (payload.data ?? []).find(
        (product: Product) => product.product_code.toLowerCase() === query.toLowerCase()
      );

      if (!apiMatch) {
        Alert.alert("Produk tidak ditemukan", "Kode barcode tidak cocok dengan produk aktif.");
        return;
      }

      addToCart(apiMatch);
      setBarcode("");
    } catch (error) {
      Alert.alert(
        "Gagal mencari barcode",
        error instanceof Error ? error.message : "Terjadi kesalahan saat mencari produk."
      );
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || checkoutLoading) {
      return;
    }

    setCheckoutLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/sales/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_cashier: CASHIER_ID,
          id_member: selectedMemberId,
          payment_method: paymentMethod,
          amount_paid: subtotal,
          discount_amount: 0,
          notes: null,
          items: cart.map((item) => ({
            id_product: item.id_product,
            quantity: item.quantity,
            unit_price: item.selling_price,
          })),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || payload.message || "Checkout gagal.");
      }

      Alert.alert("Transaksi berhasil", `Nomor transaksi: ${payload.data.sale_number}`);
      setCart([]);
      await fetchProducts();
    } catch (error) {
      Alert.alert(
        "Checkout gagal",
        error instanceof Error ? error.message : "Terjadi kesalahan saat checkout."
      );
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <View style={styles.appShell}>
      <View style={styles.sidebar}>
        <View style={styles.brandRow}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>K</Text>
          </View>
          <View>
            <Text style={styles.brandName}>Kopkampus</Text>
            <Text style={styles.brandSubtitle}>POS System</Text>
          </View>
        </View>

        <View style={styles.navList}>
          {NAV_ITEMS.map((item) => (
            <View key={item.label} style={[styles.navItem, item.active && styles.navItemActive]}>
              <AppIcon
                name={item.icon}
                size={18}
                color={item.active ? "#2563eb" : "#475569"}
                style={styles.navIcon}
              />
              <Text style={[styles.navText, item.active && styles.navTextActive]}>{item.label}</Text>
              {item.chevron ? (
                <AppIcon
                  name="chevron-down"
                  size={14}
                  color="#64748b"
                  style={styles.navChevron}
                />
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.cashierProfile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>RP</Text>
          </View>
          <View>
            <Text style={styles.profileName}>{CASHIER_NAME}</Text>
            <Text style={styles.profileRole}>Kasir</Text>
          </View>
        </View>
      </View>

      <View style={styles.mainArea}>
        <View style={styles.productsPanel}>
          <View style={styles.productsHeader}>
            <Text style={styles.sectionTitle}>Produk</Text>
            <View style={styles.searchBox}>
              <AppIcon name="search" size={16} color="#64748b" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Cari produk..."
                placeholderTextColor="#64748b"
                style={styles.searchInput}
              />
            </View>
            <View style={styles.barcodeBox}>
              <AppIcon name="hash" size={16} color="#64748b" />
              <TextInput
                value={barcode}
                onChangeText={setBarcode}
                onSubmitEditing={handleBarcodeSubmit}
                placeholder="Scan barcode..."
                placeholderTextColor="#64748b"
                style={styles.searchInput}
              />
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {CATEGORY_TABS.map((category) => (
              <Pressable
                key={category}
                style={[
                  styles.categoryChip,
                  activeCategory === category && styles.categoryChipActive,
                ]}
                onPress={() => setActiveCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    activeCategory === category && styles.categoryChipTextActive,
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#2563eb" />
              <Text style={styles.stateText}>Memuat produk...</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.centerState}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <Pressable style={styles.retryButton} onPress={loadCashierData}>
                <Text style={styles.retryText}>Muat Ulang</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.productGrid}>
              {filteredProducts.map((product) => {
                const inCartQuantity =
                  cart.find((item) => item.id_product === product.id_product)?.quantity ?? 0;

                return (
                  <Pressable
                    key={product.id_product}
                    style={({ pressed }) => [
                      styles.productCard,
                      (pressed || inCartQuantity > 0) && styles.productCardActive,
                      product.has_inventory_units &&
                        product.available_stock <= 0 &&
                        styles.productCardDisabled,
                    ]}
                    onPress={() => addToCart(product)}
                  >
                    {inCartQuantity > 0 ? (
                      <View style={styles.quantityBadge}>
                        <Text style={styles.quantityBadgeText}>{inCartQuantity}</Text>
                      </View>
                    ) : null}
                    <View style={styles.productImageWrap}>
                      <Image
                        source={getProductSource(product)}
                        style={styles.productImage}
                        contentFit="contain"
                      />
                    </View>
                    <Text style={styles.productName} numberOfLines={2}>
                      {product.product_name}
                    </Text>
                    <Text style={styles.productPrice}>{formatRupiah(product.selling_price)}</Text>
                    <Text style={styles.stockText}>
                      Stok: {product.has_inventory_units ? product.available_stock : "Non-unit"}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={styles.cartPanel}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>Keranjang</Text>
            <Pressable onPress={() => setCart([])}>
              <Text style={styles.clearText}>Hapus Semua</Text>
            </Pressable>
          </View>

          <View style={styles.contextCard}>
            <Text style={styles.metaLabel}>KASIR BERTUGAS</Text>
            <View style={styles.cashierInput}>
              <View style={styles.onlineDot} />
              <Text style={styles.cashierInputText}>{CASHIER_NAME}</Text>
            </View>

            <Text style={styles.metaLabel}>MEMBER</Text>
            <Pressable
              style={styles.memberSelect}
              onPress={() => setMemberPickerOpen((current) => !current)}
            >
              <Text style={styles.memberSelectText} numberOfLines={1}>
                {selectedMember ? selectedMember.full_name : "Umum (Non-member)"}
              </Text>
              <AppIcon name="chevron-down" size={16} color="#475569" />
            </Pressable>

            {memberPickerOpen ? (
              <ScrollView
                style={styles.memberDropdown}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                <Pressable
                  style={styles.memberDropdownOption}
                  onPress={() => {
                    setSelectedMemberId(null);
                    setMemberPickerOpen(false);
                  }}
                >
                  <Text style={styles.memberDropdownText}>Umum (Non-member)</Text>
                </Pressable>
                {members.map((member) => (
                  <Pressable
                    key={member.id_member}
                    style={styles.memberDropdownOption}
                    onPress={() => {
                      setSelectedMemberId(member.id_member);
                      setMemberPickerOpen(false);
                    }}
                  >
                    <Text style={styles.memberDropdownText}>{member.full_name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {selectedMember ? (
              <Text style={styles.memberHint}>
                {selectedMember.member_code} - Saldo {formatRupiah(selectedMember.shopping_balance)}
              </Text>
            ) : null}
          </View>

          <ScrollView style={styles.cartList} contentContainerStyle={styles.cartListContent}>
            {cart.length === 0 ? (
              <View style={styles.emptyCart}>
                <AppIcon name="shopping-bag" size={28} color="#94a3b8" />
                <Text style={styles.emptyText}>Belum ada produk</Text>
              </View>
            ) : (
              cart.map((item) => (
                <View key={item.id_product} style={styles.cartItem}>
                  <View style={styles.cartItemMain}>
                    <Text style={styles.cartItemName} numberOfLines={1}>
                      {item.product_name}
                    </Text>
                    <Text style={styles.cartItemPrice}>{formatRupiah(item.selling_price)}</Text>
                  </View>
                  <View style={styles.cartItemBottom}>
                    <View style={styles.quantityControl}>
                      <Pressable
                        style={styles.qtyButton}
                        onPress={() => updateQuantity(item.id_product, -1)}
                      >
                        <Text style={styles.qtyButtonText}>-</Text>
                      </Pressable>
                      <Text style={styles.qtyText}>{item.quantity}</Text>
                      <Pressable
                        style={styles.qtyButton}
                        onPress={() => updateQuantity(item.id_product, 1)}
                      >
                        <Text style={styles.qtyButtonText}>+</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.cartItemTotal}>
                      {formatRupiah(item.selling_price * item.quantity)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatRupiah(subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatRupiah(subtotal)}</Text>
            </View>

            <Text style={styles.payLabel}>Metode Bayar</Text>
            <View style={styles.paymentRow}>
              <Pressable
                style={[styles.paymentButton, paymentMethod === "CASH" && styles.paymentButtonActive]}
                onPress={() => setPaymentMethod("CASH")}
              >
                <Text
                  style={[
                    styles.paymentText,
                    paymentMethod === "CASH" && styles.paymentTextActive,
                  ]}
                >
                  Tunai
                </Text>
              </Pressable>
              <View style={[styles.paymentButton, styles.paymentButtonDisabled]}>
                <Text style={styles.paymentTextDisabled}>Saldo</Text>
              </View>
              <Pressable
                style={[styles.paymentButton, paymentMethod === "QRIS" && styles.paymentButtonActive]}
                onPress={() => setPaymentMethod("QRIS")}
              >
                <Text
                  style={[
                    styles.paymentText,
                    paymentMethod === "QRIS" && styles.paymentTextActive,
                  ]}
                >
                  QRIS
                </Text>
              </Pressable>
            </View>

            <Pressable
              style={[
                styles.checkoutButton,
                (cart.length === 0 || checkoutLoading) && styles.checkoutButtonDisabled,
              ]}
              onPress={handleCheckout}
              disabled={cart.length === 0 || checkoutLoading}
            >
              <AppIcon name="gift" size={18} color="#ffffff" />
              <Text style={styles.checkoutText}>{checkoutLoading ? "Memproses..." : "Bayar"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#f8fafc",
  },
  sidebar: {
    width: 220,
    backgroundColor: "#ffffff",
    borderRightColor: "#e2e8f0",
    borderRightWidth: 1,
  },
  brandRow: {
    height: 84,
    borderBottomColor: "#f1f5f9",
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  logoBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  brandName: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  brandSubtitle: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  navList: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 2,
  },
  navItem: {
    height: 44,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
  },
  navItemActive: {
    backgroundColor: "#eff6ff",
  },
  navIcon: {
    width: 20,
  },
  navText: {
    flex: 1,
    color: "#475569",
    fontSize: 15,
    fontWeight: "500",
  },
  navTextActive: {
    color: "#2563eb",
    fontWeight: "600",
  },
  navChevron: {
    marginLeft: "auto",
  },
  cashierProfile: {
    height: 66,
    borderTopColor: "#f1f5f9",
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  profileName: {
    color: "#1e293b",
    fontWeight: "600",
    fontSize: 14,
    lineHeight: 18,
  },
  profileRole: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
  mainArea: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  productsPanel: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 16,
  },
  productsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 33,
    fontWeight: "700",
    marginRight: 6,
  },
  searchBox: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  barcodeBox: {
    width: 200,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: "#334155",
    fontSize: 14,
    paddingVertical: 0,
  },
  categoryRow: {
    gap: 8,
    paddingBottom: 10,
  },
  categoryChip: {
    height: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  categoryChipActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  categoryChipText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "500",
  },
  categoryChipTextActive: {
    color: "#ffffff",
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  stateText: {
    color: "#64748b",
    fontSize: 14,
  },
  errorText: {
    color: "#dc2626",
    fontWeight: "600",
    textAlign: "center",
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 12,
    columnGap: 12,
    paddingBottom: 16,
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  productCard: {
    width: "18.4%",
    minWidth: 150,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    position: "relative",
  },
  productCardActive: {
    borderColor: "#3b82f6",
    backgroundColor: "#eff6ff",
  },
  productCardDisabled: {
    opacity: 0.5,
  },
  quantityBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  quantityBadgeText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  productImageWrap: {
    width: 70,
    height: 70,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  productImage: {
    width: 52,
    height: 52,
  },
  productName: {
    color: "#1e293b",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
    textAlign: "center",
    minHeight: 44,
  },
  productPrice: {
    color: "#2563eb",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 6,
  },
  stockText: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  cartPanel: {
    width: 300,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 16,
  },
  cartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cartTitle: {
    color: "#0f172a",
    fontSize: 34,
    fontWeight: "700",
  },
  clearText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "500",
  },
  contextCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    padding: 12,
    gap: 6,
  },
  metaLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  cashierInput: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16a34a",
  },
  cashierInputText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
  },
  memberSelect: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  memberSelectText: {
    color: "#1e293b",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
    marginRight: 8,
  },
  memberDropdown: {
    maxHeight: 160,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  memberDropdownOption: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  memberDropdownText: {
    color: "#1e293b",
    fontSize: 13,
  },
  memberHint: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
  cartList: {
    flex: 1,
    marginTop: 8,
  },
  cartListContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  emptyCart: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 180,
  },
  emptyText: {
    color: "#334155",
    fontSize: 13,
  },
  cartItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 8,
  },
  cartItemMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
  },
  cartItemName: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  cartItemPrice: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "700",
  },
  cartItemBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  qtyButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyButtonText: {
    color: "#334155",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 20,
  },
  qtyText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
    minWidth: 24,
    textAlign: "center",
  },
  cartItemTotal: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
  },
  summary: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    gap: 6,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 10,
  },
  summaryLabel: {
    color: "#1e293b",
    fontSize: 15,
  },
  summaryValue: {
    color: "#0f172a",
    fontSize: 15,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  totalLabel: {
    color: "#0f172a",
    fontSize: 19,
    fontWeight: "800",
  },
  totalValue: {
    color: "#0f172a",
    fontSize: 19,
    fontWeight: "800",
  },
  payLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "500",
  },
  paymentRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  paymentButton: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  paymentButtonActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  paymentButtonDisabled: {
    backgroundColor: "#f8fafc",
  },
  paymentText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "500",
  },
  paymentTextActive: {
    color: "#ffffff",
  },
  paymentTextDisabled: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "500",
  },
  checkoutButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  checkoutButtonDisabled: {
    opacity: 0.55,
  },
  checkoutText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
});
