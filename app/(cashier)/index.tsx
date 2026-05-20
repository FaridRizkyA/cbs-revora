import Constants from "expo-constants";
import { Image } from "expo-image";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
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
  | "cart"
  | "trash"
  | "cash"
  | "qr";

const AppIcon = ({
  name,
  size = 16,
  color = "#475569",
}: {
  name: AppIconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) => {
  if (name === "package" || name === "cash") {
    const iconName = name === "package" ? "package-variant-closed" : "cash";
    return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
  }

  const iconMap: Record<Exclude<AppIconName, "package" | "cash">, React.ComponentProps<typeof Feather>["name"]> = {
    monitor: "monitor",
    grid: "grid",
    activity: "activity",
    "file-text": "file-text",
    users: "users",
    "dollar-sign": "dollar-sign",
    "chevron-down": "chevron-down",
    search: "search",
    hash: "hash",
    "shopping-bag": "shopping-bag",
    cart: "shopping-cart",
    trash: "trash-2",
    qr: "maximize-2",
  };

  return <Feather name={iconMap[name as Exclude<AppIconName, "package" | "cash">]} size={size} color={color} />;
};

const NAV_ITEMS: {
  label: string;
  icon: AppIconName;
  active?: boolean;
  chevron?: boolean;
}[] = [
  { label: "Cashier", icon: "monitor", active: true },
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
  barcode: string | null;
  product_name: string;
  description: string | null;
  selling_price: number;
  minimum_stock: number;
  product_image: string | null;
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

type CheckoutResult = {
  sale_number: string;
  sale_date: string;
  total_amount: number;
  payment_method: PaymentMethod;
  amount_paid: number;
  change_amount: number;
};

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

export default function Index() {
  const [products, setProducts] = useState<Product[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [cashAmountInput, setCashAmountInput] = useState("");
  const [submittedCashAmount, setSubmittedCashAmount] = useState(0);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState<PaymentMethod>("CASH");
  const successScale = useRef(new Animated.Value(0.7)).current;

  const selectedMember = useMemo(
    () => members.find((member) => member.id_member === selectedMemberId) ?? null,
    [members, selectedMemberId]
  );

  const subtotal = useMemo(
    () => cart.reduce((total, item) => total + item.selling_price * item.quantity, 0),
    [cart]
  );

  const parsedCashAmount = useMemo(
    () => Number((cashAmountInput || "0").replace(/[^\d]/g, "")),
    [cashAmountInput]
  );

  const cashChangePreview = Math.max(parsedCashAmount - subtotal, 0);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const searchable = [product.product_name, product.product_code, product.description ?? ""]
        .join(" ")
        .toLowerCase();
      return !query || searchable.includes(query);
    });
  }, [products, search]);

  const fetchProducts = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/api/products`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || "Failed to fetch products.");
    }

    setProducts(payload.data ?? []);
  }, []);

  const fetchMembers = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/api/members`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || "Failed to fetch members.");
    }

    setMembers(payload.data ?? []);
  }, []);

  const loadCashierData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      await Promise.all([fetchProducts(), fetchMembers()]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load cashier data.");
    } finally {
      setLoading(false);
    }
  }, [fetchMembers, fetchProducts]);

  useEffect(() => {
    loadCashierData();
  }, [loadCashierData]);

  useEffect(() => {
    if (!checkoutResult || !isReceiptModalOpen) {
      return;
    }

    successScale.setValue(0.7);
    Animated.spring(successScale, {
      toValue: 1,
      tension: 65,
      friction: 6,
      useNativeDriver: true,
    }).start();
  }, [checkoutResult, isReceiptModalOpen, successScale]);

  const getProductSource = (product: Product) => {
    if (product.product_image) {
      return product.product_image;
    }

    return PRODUCT_PLACEHOLDER;
  };

  const addToCart = (product: Product) => {
    if (product.available_stock <= 0) {
      Alert.alert("Out of stock", `${product.product_name} has no available stock.`);
      return;
    }

    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item.id_product === product.id_product);

      if (!existingItem) {
        return [...currentCart, { ...product, quantity: 1 }];
      }

      if (existingItem.quantity >= product.available_stock) {
        Alert.alert("Insufficient stock", `Only ${product.available_stock} item(s) available.`);
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

        if (nextQuantity > item.available_stock) {
          Alert.alert("Insufficient stock", `Only ${item.available_stock} item(s) available.`);
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

    const localMatch = products.find((product) => {
      const normalized = query.toLowerCase();
      return (
        product.product_code.toLowerCase() === normalized ||
        (product.barcode ? product.barcode.toLowerCase() === normalized : false)
      );
    });

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
        throw new Error(payload.message || "Product not found.");
      }

      const apiMatch = (payload.data ?? []).find((product: Product) => {
        const normalized = query.toLowerCase();
        return (
          product.product_code.toLowerCase() === normalized ||
          (product.barcode ? product.barcode.toLowerCase() === normalized : false)
        );
      });

      if (!apiMatch) {
        Alert.alert("Product not found", "Barcode does not match any active product.");
        return;
      }

      addToCart(apiMatch);
      setBarcode("");
    } catch (error) {
      Alert.alert(
        "Barcode search failed",
        error instanceof Error ? error.message : "An error occurred while searching product."
      );
    }
  };

  const submitCheckout = async (amountPaid: number, method: PaymentMethod) => {
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
          payment_method: method,
          amount_paid: amountPaid,
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
        throw new Error(payload.error || payload.message || "Checkout failed.");
      }

      setCheckoutResult({
        sale_number: payload.data.sale_number,
        sale_date: payload.data.sale_date,
        total_amount: payload.data.total_amount,
        payment_method: method,
        amount_paid: payload.data.amount_paid,
        change_amount: payload.data.change_amount,
      });

      setCart([]);
      await fetchProducts();
      return true;
    } catch (error) {
      Alert.alert("Checkout failed", error instanceof Error ? error.message : "Checkout failed.");
      return false;
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCheckoutPress = async () => {
    if (cart.length === 0 || checkoutLoading) {
      return;
    }

    if (paymentMethod === "CASH") {
      setCashAmountInput("");
      setSubmittedCashAmount(0);
      setReceiptPaymentMethod("CASH");
      setCheckoutResult(null);
      setIsCashModalOpen(true);
      return;
    }

    setSubmittedCashAmount(subtotal);
    setReceiptPaymentMethod("QRIS");
    setCheckoutResult(null);
    setIsReceiptModalOpen(true);
  };

  const handleCashContinue = () => {
    if (parsedCashAmount < subtotal) {
      Alert.alert("Insufficient cash", "Cash amount must be greater than or equal to total.");
      return;
    }

    setSubmittedCashAmount(parsedCashAmount);
    setReceiptPaymentMethod("CASH");
    setIsCashModalOpen(false);
    setCheckoutResult(null);
    setIsReceiptModalOpen(true);
  };

  const handleSubmitCashTransaction = async () => {
    if (submittedCashAmount < subtotal || checkoutLoading) {
      return;
    }

    await submitCheckout(submittedCashAmount, receiptPaymentMethod);
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
            <Text style={styles.profileRole}>Cashier</Text>
          </View>
        </View>
      </View>

      <View style={styles.mainArea}>
        <View style={styles.productsPanel}>
          <View style={styles.productsHeader}>
            <Text style={styles.sectionTitle}>Products</Text>
            <View style={styles.searchBox}>
              <AppIcon name="search" size={16} color="#64748b" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search products..."
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

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#2563eb" />
              <Text style={styles.stateText}>Loading products...</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.centerState}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <Pressable style={styles.retryButton} onPress={loadCashierData}>
                <Text style={styles.retryText}>Reload</Text>
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
                      product.available_stock <= 0 && styles.productCardDisabled,
                    ]}
                    onPress={() => addToCart(product)}
                    disabled={product.available_stock <= 0}
                  >
                    <View style={styles.cardTopSpacer} />
                    <View style={styles.cardContent}>
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
                        Stock: {product.available_stock}
                      </Text>
                      {inCartQuantity > 0 ? (
                        <View style={styles.quantityBadge}>
                          <Pressable
                            style={styles.quantityBadgeButton}
                            onPress={() => updateQuantity(product.id_product, -1)}
                          >
                            <Text style={styles.quantityBadgeButtonText}>-</Text>
                          </Pressable>
                          <Text style={styles.quantityBadgeText}>{inCartQuantity}</Text>
                          <Pressable
                            style={styles.quantityBadgeButton}
                            onPress={() => updateQuantity(product.id_product, 1)}
                          >
                            <Text style={styles.quantityBadgeButtonText}>+</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.cardBottomSpacer} />
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={styles.cartPanel}>
          <View style={styles.cartHeader}>
            <View style={styles.cartTitleWrap}>
              <AppIcon name="cart" size={16} color="#0f172a" />
              <Text style={styles.cartTitle}>Cart</Text>
            </View>
            <Pressable style={styles.clearButton} onPress={() => setCart([])}>
              <AppIcon name="trash" size={14} color="#ef4444" />
            </Pressable>
          </View>

          <View style={styles.contextCard}>
            <Text style={styles.cashierLabel}>Cashier: {CASHIER_NAME}</Text>

            <Text style={styles.metaLabel}>MEMBER</Text>
            <Pressable
              style={styles.memberSelect}
              onPress={() => setMemberPickerOpen((current) => !current)}
            >
              <Text style={styles.memberSelectText} numberOfLines={1}>
                {selectedMember ? selectedMember.full_name : "General (Non-member)"}
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
                  <Text style={styles.memberDropdownText}>General (Non-member)</Text>
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

          </View>

          <ScrollView style={styles.cartList} contentContainerStyle={styles.cartListContent}>
            {cart.length === 0 ? (
              <View style={styles.emptyCart}>
                <AppIcon name="shopping-bag" size={28} color="#94a3b8" />
                <Text style={styles.emptyText}>No products yet</Text>
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

            <Text style={styles.payLabel}>Payment Method</Text>
            <View style={styles.paymentRow}>
              <Pressable
                style={[styles.paymentButton, paymentMethod === "CASH" && styles.paymentButtonActive]}
                onPress={() => setPaymentMethod("CASH")}
              >
                <AppIcon
                  name="cash"
                  size={11}
                  color={paymentMethod === "CASH" ? "#ffffff" : "#475569"}
                />
                <Text
                  style={[
                    styles.paymentText,
                    paymentMethod === "CASH" && styles.paymentTextActive,
                  ]}
                >
                  Cash
                </Text>
              </Pressable>
              <Pressable
                style={[styles.paymentButton, paymentMethod === "QRIS" && styles.paymentButtonActive]}
                onPress={() => setPaymentMethod("QRIS")}
              >
                <AppIcon
                  name="qr"
                  size={11}
                  color={paymentMethod === "QRIS" ? "#ffffff" : "#475569"}
                />
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
              onPress={handleCheckoutPress}
              disabled={cart.length === 0 || checkoutLoading}
            >
              <Text style={styles.checkoutText}>{checkoutLoading ? "Processing..." : "Pay"}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Modal visible={isCashModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cash Payment</Text>
            <Text style={styles.modalLabel}>Total Amount</Text>
            <Text style={styles.modalValue}>{formatRupiah(subtotal)}</Text>
            <Text style={styles.modalLabel}>Cash Amount</Text>
            <TextInput
              value={cashAmountInput}
              onChangeText={setCashAmountInput}
              keyboardType="numeric"
              style={styles.cashInput}
              placeholder="Enter cash amount"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.modalLabel}>Change</Text>
            <Text style={styles.modalValue}>{formatRupiah(cashChangePreview)}</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondaryButton} onPress={() => setIsCashModalOpen(false)}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalPrimaryButton} onPress={handleCashContinue}>
                <Text style={styles.modalPrimaryText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isReceiptModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.receiptCard]}>
            {checkoutResult ? (
              <Animated.View style={[styles.sweetAlertCard, { transform: [{ scale: successScale }] }]}>
                <View style={styles.sweetIconCircle}>
                  <MaterialCommunityIcons name="check" size={42} color="#84cc16" />
                </View>
                <Text style={styles.sweetTitle}>Payment Successful!</Text>
                <Text style={styles.sweetMeta}>Transaction No.: {checkoutResult.sale_number}</Text>
                <View style={styles.modalActions}>
                  <Pressable
                    style={[styles.modalSecondaryButton, styles.successSecondaryButton]}
                    onPress={() => {
                      setIsReceiptModalOpen(false);
                      setCheckoutResult(null);
                      setSubmittedCashAmount(0);
                    }}
                  >
                    <Text style={[styles.modalSecondaryText, styles.successButtonText]}>Done</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalPrimaryButton, styles.successPrimaryButton]}
                    onPress={() => Alert.alert("Print", "Receipt printing will be connected to printer.")}
                  >
                    <Text style={[styles.modalPrimaryText, styles.successButtonText]}>Print Receipt</Text>
                  </Pressable>
                </View>
              </Animated.View>
            ) : (
              <>
                <Text style={styles.modalTitle}>Receipt Preview</Text>
                <Text style={styles.receiptMeta}>Cashier: {CASHIER_NAME}</Text>
                <Text style={styles.receiptMeta}>Time: {new Date().toLocaleString("id-ID")}</Text>
                <Text style={styles.receiptMeta}>
                  Payment: {receiptPaymentMethod === "CASH" ? "Cash" : "QRIS"}
                </Text>

                <View style={styles.receiptItems}>
                  {cart.map((item) => (
                    <View key={item.id_product} style={styles.receiptRow}>
                      <Text style={styles.receiptItemName}>{item.product_name} x{item.quantity}</Text>
                      <Text style={styles.receiptItemPrice}>{formatRupiah(item.selling_price * item.quantity)}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.receiptTotals}>
                  <Text style={styles.receiptMeta}>Total: {formatRupiah(subtotal)}</Text>
                  {receiptPaymentMethod === "CASH" ? (
                    <>
                      <Text style={styles.receiptMeta}>Cash: {formatRupiah(submittedCashAmount)}</Text>
                      <Text style={styles.receiptMeta}>
                        Change: {formatRupiah(Math.max(submittedCashAmount - subtotal, 0))}
                      </Text>
                    </>
                  ) : null}
                </View>

                <View style={styles.modalActions}>
                  <Pressable
                    style={styles.modalSecondaryButton}
                    onPress={() => {
                      if (receiptPaymentMethod === "CASH") {
                        setIsReceiptModalOpen(false);
                        setIsCashModalOpen(true);
                      } else {
                        setIsReceiptModalOpen(false);
                      }
                    }}
                  >
                    <Text style={styles.modalSecondaryText}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalPrimaryButton, checkoutLoading && styles.checkoutButtonDisabled]}
                    onPress={handleSubmitCashTransaction}
                    disabled={checkoutLoading}
                  >
                    <Text style={styles.modalPrimaryText}>
                      {checkoutLoading ? "Processing..." : "Submit"}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
    height: 232,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    position: "relative",
  },
  cardTopSpacer: {
    flex: 1,
  },
  cardBottomSpacer: {
    flex: 1,
  },
  cardContent: {
    alignItems: "center",
  },
  productCardActive: {
    borderColor: "#3b82f6",
    backgroundColor: "#eff6ff",
  },
  productCardDisabled: {
    opacity: 0.5,
  },
  quantityBadge: {
    minWidth: 96,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 6,
    marginTop: 8,
  },
  quantityBadgeButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityBadgeButtonText: {
    color: "#3b82f6",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 18,
  },
  quantityBadgeText: {
    color: "#3b82f6",
    fontSize: 13,
    fontWeight: "700",
  },
  productImageWrap: {
    width: 70,
    height: 70,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#dbe3ee",
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
  cartTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cartTitle: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "700",
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    alignItems: "center",
    justifyContent: "center",
  },
  contextCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    padding: 12,
    gap: 6,
  },
  cashierLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  metaLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
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
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentButtonActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  paymentText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "500",
  },
  paymentTextActive: {
    color: "#ffffff",
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  receiptCard: {
    maxWidth: 520,
    maxHeight: "90%",
  },
  modalTitle: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  sweetAlertCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 10,
  },
  sweetIconCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 5,
    borderColor: "#d9f99d",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f7fee7",
  },
  sweetTitle: {
    color: "#1f2937",
    fontSize: 32,
    fontWeight: "700",
  },
  sweetMeta: {
    color: "#475569",
    fontSize: 13,
  },
  modalLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  modalValue: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  cashInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    color: "#0f172a",
    fontSize: 14,
    backgroundColor: "#ffffff",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  modalSecondaryButton: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  modalSecondaryText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 13,
  },
  modalPrimaryButton: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  modalPrimaryText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  successPrimaryButton: {
    minWidth: 178,
    height: 46,
    flex: 0,
    paddingHorizontal: 18,
  },
  successSecondaryButton: {
    minWidth: 110,
    height: 46,
    flex: 0,
    paddingHorizontal: 14,
  },
  successButtonText: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
  },
  receiptMeta: {
    color: "#334155",
    fontSize: 12,
  },
  receiptItems: {
    marginTop: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 8,
    gap: 6,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  receiptItemName: {
    color: "#1e293b",
    fontSize: 12,
    flex: 1,
  },
  receiptItemPrice: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "600",
  },
  receiptTotals: {
    marginTop: 6,
    gap: 3,
  },
});

