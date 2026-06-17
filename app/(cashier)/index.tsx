import { Image } from "expo-image";
import * as Print from "expo-print";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import ResponsiveModal from "../../components/common/ResponsiveModal";
import { InventoryConfirmModal, InventoryResultModal } from "../../components/inventory/ActionModals";
import { buildReceiptPrintHtml, formatReceiptProductLabel, ReceiptData, ReceiptItem } from "../../components/cashier/ReceiptPrintTemplate";
import { AuthUser, getAuthSession, logoutAuthSession, subscribeAuthSession } from "../../utils/authSession";
import { fetchWithAuth } from "../../utils/fetchWithAuth";
import { logClientActivity } from "../../utils/activityLog";

const PRODUCT_PLACEHOLDER = require("../../assets/images/placeholders/default-product.png");
const SIDEBAR_LOGO = require("../../assets/images/ui/logo_horizontal.png");

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
  id_sale: string;
  sale_number: string;
  sale_date: string;
  total_amount: number;
  payment_method: PaymentMethod;
  amount_paid: number;
  change_amount: number;
  receipt_email_status?: "queued" | "skipped" | "failed";
  receipt_email_error?: string | null;
};

const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace(/\s/g, " ");

export default function Index() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const BASE_WIDTH = 1366;
  const BASE_HEIGHT = 768;
  const appScale = Math.min(1, Math.min(width / BASE_WIDTH, height / BASE_HEIGHT));
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [cashAmountInput, setCashAmountInput] = useState("");
  const [submittedCashAmount, setSubmittedCashAmount] = useState(0);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);
  const [receiptItemsSnapshot, setReceiptItemsSnapshot] = useState<ReceiptItem[]>([]);
  const [receiptMemberSnapshot, setReceiptMemberSnapshot] = useState<{ code?: string | null; name?: string | null } | null>(null);
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState<PaymentMethod>("CASH");
  const [receiptEmailTracking, setReceiptEmailTracking] = useState<{ saleId: string; saleNumber: string } | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [clearCartConfirmOpen, setClearCartConfirmOpen] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultTitle, setResultTitle] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const ignoreNextProductCardPressRef = useRef(false);
  const successScale = useRef(new Animated.Value(0.7)).current;
  const barcodeInputRef = useRef<TextInput | null>(null);
  const barcodeAutoSubmitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchFocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cashierId = sessionUser?.id_user ?? null;
  const cashierName = sessionUser?.full_name?.trim() || "Cashier";

  const showError = useCallback((title: string, message: string) => {
    setResultTitle(title);
    setResultMessage(message);
    setResultModalOpen(true);
  }, []);

  const selectedMember = useMemo(
    () => members.find((member) => member.id_member === selectedMemberId) ?? null,
    [members, selectedMemberId]
  );

  const subtotal = useMemo(
    () => cart.reduce((total, item) => total + item.selling_price * Math.max(item.quantity, 0), 0),
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

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => {
      const searchable = `${member.member_code} ${member.full_name}`.toLowerCase();
      return searchable.includes(query);
    });
  }, [members, memberSearch]);

  const fetchProducts = useCallback(async () => {
    const response = await fetchWithAuth("/api/products");
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || "Failed to fetch products.");
    }

    setProducts(payload.data ?? []);
  }, []);

  const fetchMembers = useCallback(async () => {
    const response = await fetchWithAuth("/api/members");
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
    let active = true;

    getAuthSession()
      .then((session) => {
        if (!active) {
          return;
        }

        if (!session?.token || !session?.user) {
          router.replace("/login");
          return;
        }

        setSessionUser(session.user);
      })
      .catch(() => {
        router.replace("/login");
      });

    const unsubscribe = subscribeAuthSession((session) => {
      if (!active || !session?.user) return;
      setSessionUser(session.user);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

    useEffect(() => {
    const focusTimer = setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 300);

    return () => {
      clearTimeout(focusTimer);
      if (searchFocusTimeoutRef.current) {
        clearTimeout(searchFocusTimeoutRef.current);
      }
      if (barcodeAutoSubmitTimeoutRef.current) {
        clearTimeout(barcodeAutoSubmitTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadCashierData();

    // Poll for real-time stock updates every 5 seconds
    const interval = setInterval(async () => {
      try {
        const response = await fetchWithAuth("/api/products");
        if (response.ok) {
          const payload = await response.json();
          setProducts(payload.data ?? []);
        }
      } catch (error) {
        // Silently ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
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
      return { uri: product.product_image };
    }

    return PRODUCT_PLACEHOLDER;
  };

  const addToCart = (product: Product) => {
    if (product.available_stock <= 0) {
      showError("Out of Stock", `${product.product_name} has no available stock.`);
      return;
    }

    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item.id_product === product.id_product);

      if (!existingItem) {
        return [...currentCart, { ...product, quantity: 1 }];
      }

      if (existingItem.quantity >= product.available_stock) {
        showError("Insufficient Stock", `Only ${product.available_stock} item(s) available.`);
        return currentCart;
      }

      return currentCart.map((item) =>
        item.id_product === product.id_product
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    });
  };

  const setItemQuantity = (idProduct: string, nextQuantity: number) => {
    if (nextQuantity <= 0) {
      setCart((currentCart) =>
        currentCart.filter((item) => item.id_product !== idProduct)
      );
      return;
    }

    setCart((currentCart) =>
      currentCart.map((item) => {
        if (item.id_product !== idProduct) {
          return item;
        }

        const clampedQuantity = Math.min(nextQuantity, item.available_stock);
        if (nextQuantity > item.available_stock) {
          showError("Insufficient Stock", `Only ${item.available_stock} item(s) available.`);
        }

        return { ...item, quantity: clampedQuantity };
      })
    );
  };

  const findProductByBarcodeQuery = (query: string) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return null;

    return products.find((product) => (
      product.product_code.toLowerCase() === normalized ||
      (product.barcode ? product.barcode.toLowerCase() === normalized : false)
    )) ?? null;
  };

  const clearBarcodeAutoSubmit = () => {
    if (barcodeAutoSubmitTimeoutRef.current) {
      clearTimeout(barcodeAutoSubmitTimeoutRef.current);
      barcodeAutoSubmitTimeoutRef.current = null;
    }
  };

  const submitBarcodeProduct = (product: Product) => {
    clearBarcodeAutoSubmit();
    addToCart(product);
    setBarcode("");
    barcodeInputRef.current?.focus();
  };

  const handleBarcodeChange = (value: string) => {
    setBarcode(value);
    clearBarcodeAutoSubmit();

    const query = value.trim();
    const localMatch = findProductByBarcodeQuery(query);
    if (!localMatch) {
      return;
    }

    barcodeAutoSubmitTimeoutRef.current = setTimeout(() => {
      submitBarcodeProduct(localMatch);
    }, 180);
  };

  const handleBarcodeSubmit = async () => {
    clearBarcodeAutoSubmit();
    const query = barcode.trim();

    if (!query) {
      return;
    }

    const localMatch = findProductByBarcodeQuery(query);

    if (localMatch) {
      submitBarcodeProduct(localMatch);
      return;
    }

    try {
      const response = await fetchWithAuth(
        `/api/products?search=${encodeURIComponent(query)}`
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
        showError("Product Not Found", "Barcode does not match any active product.");
        return;
      }

      submitBarcodeProduct(apiMatch);
    } catch (error) {
      showError("Barcode Search Failed", error instanceof Error ? error.message : "An error occurred while searching product.");
    }
  };

  const scheduleBackToBarcodeFocus = () => {
    if (searchFocusTimeoutRef.current) {
      clearTimeout(searchFocusTimeoutRef.current);
    }

    searchFocusTimeoutRef.current = setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 2500);
  };

  const submitCheckout = async (amountPaid: number, method: PaymentMethod) => {
    if (!cashierId) {
      showError("Session Expired", "Please sign in again.");
      return false;
    }

    setCheckoutLoading(true);

    try {
      const response = await fetchWithAuth("/api/sales/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_cashier: cashierId,
          id_member: selectedMemberId,
          payment_method: method,
          amount_paid: amountPaid,
          discount_amount: 0,
          notes: null,
          items: cart.map((item) => ({
            quantity: Math.max(item.quantity, 0),
            id_product: item.id_product,
            unit_price: item.selling_price,
          })).filter((item) => item.quantity > 0),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || payload.message || "Checkout failed.");
      }

      setCheckoutResult({
        id_sale: payload.data.id_sale,
        sale_number: payload.data.sale_number,
        sale_date: payload.data.sale_date,
        total_amount: payload.data.total_amount,
        payment_method: method,
        amount_paid: payload.data.amount_paid,
        change_amount: payload.data.change_amount,
        receipt_email_status: payload.data.receipt_email_status,
        receipt_email_error: payload.data.receipt_email_error || null,
      });

      if (payload.data.receipt_email_status === "queued" && payload.data.id_sale) {
        setReceiptEmailTracking({
          saleId: payload.data.id_sale,
          saleNumber: payload.data.sale_number,
        });
      }

      setCart([]);
      setSelectedMemberId(null);
      await Promise.all([fetchProducts(), fetchMembers()]);
      return true;
    } catch (error) {
      showError("Checkout Failed", error instanceof Error ? error.message : "Checkout failed.");
      return false;
    } finally {
      setCheckoutLoading(false);
    }
  };

  const captureReceiptSnapshot = () => {
    setReceiptItemsSnapshot(cart.map((item) => ({
      productCode: item.product_code,
      productName: item.product_name,
      quantity: Math.max(item.quantity, 0),
      unitPrice: item.selling_price,
      lineTotal: item.selling_price * Math.max(item.quantity, 0),
    })).filter((item) => item.quantity > 0));
    setReceiptMemberSnapshot(selectedMember ? { code: selectedMember.member_code, name: selectedMember.full_name } : null);
  };

  const handleCheckoutPress = async () => {
    if (cart.length === 0 || checkoutLoading) {
      return;
    }
    setIsCheckoutModalOpen(true);
  };

  const handleProceedPayment = async () => {
    if (cart.length === 0 || checkoutLoading) {
      return;
    }

    setIsCheckoutModalOpen(false);

    if (paymentMethod === "CASH") {
      captureReceiptSnapshot();
      setCashAmountInput("");
      setSubmittedCashAmount(0);
      setReceiptPaymentMethod("CASH");
      setCheckoutResult(null);
      setIsCashModalOpen(true);
      return;
    }

    setSubmittedCashAmount(subtotal);
    captureReceiptSnapshot();
    setReceiptPaymentMethod("QRIS");
    setCheckoutResult(null);
    setIsReceiptModalOpen(true);
  };

  const handleCashContinue = () => {
    if (parsedCashAmount < subtotal) {
      showError("Insufficient Cash", "Cash amount must be greater than or equal to total.");
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

  const buildCurrentReceiptData = (): ReceiptData | null => {
    if (!checkoutResult) return null;

    return {
      saleNumber: checkoutResult.sale_number,
      saleDate: checkoutResult.sale_date,
      cashierName,
      member: receiptMemberSnapshot,
      paymentMethod: checkoutResult.payment_method,
      amountPaid: checkoutResult.amount_paid,
      changeAmount: checkoutResult.change_amount,
      discountAmount: 0,
      items: receiptItemsSnapshot,
    };
  };

  const handlePrintReceipt = async () => {
    const receiptData = buildCurrentReceiptData();
    if (!receiptData) return;

    const html = buildReceiptPrintHtml(receiptData);
    await logClientActivity({
      activityType: "PRINT_RECEIPT",
      tableName: "tbl_sales",
      description: `Printed sale receipt ${checkoutResult?.sale_number || ""}`.trim(),
    });

    if (Platform.OS !== "web") {
      try {
        await Print.printAsync({ html });
      } catch (error) {
        showError("Print Failed", error instanceof Error ? error.message : "Failed to print receipt.");
      }
      return;
    }

    if (typeof window === "undefined") return;

    const printWindow = window.open("", "_blank", "width=420,height=720");
    if (!printWindow) {
      showError("Print Blocked", "Please allow pop-ups to print the receipt.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleLogout = async () => {
    setLogoutConfirmOpen(false);
    await logoutAuthSession();
    router.replace("/login");
  };

  const handleClearCart = () => {
    setClearCartConfirmOpen(false);
    setCart([]);
    setSelectedMemberId(null);
    setCashAmountInput("");
    setSubmittedCashAmount(0);
  };

  return (
    <View style={styles.viewportShell}>
      <View
        style={[
          styles.scaledCanvas,
          {
            width: BASE_WIDTH,
            height: BASE_HEIGHT,
            transform: [{ scale: appScale }],
          },
        ]}
      >
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Math.max(insets.top, 16),
            minHeight: 88 + Math.max(insets.top, 16),
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Image source={require("../../assets/images/ui/logo_koperasi_cbs.png")} style={{ width: 44, height: 44 }} contentFit="contain" />
          <Image source={SIDEBAR_LOGO} style={styles.topBarLogo} contentFit="contain" />
        </View>
        <View style={styles.topBarRight}>
          <View style={styles.profileMenuWrap}>
            <Pressable style={styles.profileTrigger} onPress={() => setProfileMenuOpen((prev) => !prev)}>
              <View style={styles.topAvatar}>
                {sessionUser?.profile_image ? (
                  <Image source={{ uri: sessionUser.profile_image }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <Text style={styles.topAvatarText}>{cashierName.slice(0, 2).toUpperCase()}</Text>
                )}
              </View>
              <Text style={styles.profileTriggerText} numberOfLines={1}>
                {cashierName}
              </Text>
              <Feather name="chevron-down" size={16} color="#475569" />
            </Pressable>
            {profileMenuOpen ? (
              <View style={styles.profileDropdown}>
                <Pressable
                  style={styles.dropdownItem}
                  onPress={() => {
                    setProfileMenuOpen(false);
                    router.push("/(main)/dashboard");
                  }}
                >
                  <Feather name="arrow-right-circle" size={14} color="#2563eb" />
                  <Text style={styles.dropdownItemTextBlue}>Enter Main App</Text>
                </Pressable>
                <Pressable
                  style={styles.dropdownItem}
                  onPress={() => {
                    setProfileMenuOpen(false);
                    setLogoutConfirmOpen(true);
                  }}
                >
                  <Feather name="log-out" size={14} color="#dc2626" />
                  <Text style={styles.dropdownItemText}>Logout</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.mainArea}>
        <View style={styles.productsPanel}>
          <View style={styles.productsHeader}>
            <Text style={styles.sectionTitle}>Cashier Mode</Text>
            <View style={styles.searchBox}>
              <AppIcon name="search" size={16} color="#64748b" />
              <TextInput
                value={search}
                onChangeText={(value) => {
                  setSearch(value);
                  scheduleBackToBarcodeFocus();
                }}
                onBlur={scheduleBackToBarcodeFocus}
                placeholder="Search products..."
                placeholderTextColor="#64748b"
                style={styles.searchInput}
              />
            </View>
            <View style={styles.barcodeBox}>
              <AppIcon name="hash" size={16} color="#64748b" />
              <TextInput
                ref={barcodeInputRef}
                value={barcode}
                onChangeText={handleBarcodeChange}
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
            <ScrollView style={styles.productListScroll} contentContainerStyle={styles.productGrid} keyboardShouldPersistTaps="handled">
              {filteredProducts.map((product) => {
                const inCartItem = cart.find((item) => item.id_product === product.id_product) ?? null;
                const inCartQuantity = inCartItem?.quantity ?? 0;
                const hasCartItem = Boolean(inCartItem);

                return (
                  <Pressable
                    key={product.id_product}
                    style={({ pressed }) => [
                      styles.productCard,
                      (pressed || hasCartItem) && styles.productCardActive,
                      product.available_stock <= 0 && styles.productCardDisabled,
                    ]}
                    onPress={() => {
                      if (ignoreNextProductCardPressRef.current) {
                        ignoreNextProductCardPressRef.current = false;
                        return;
                      }
                      addToCart(product);
                      setSearch("");
                    }}
                    disabled={product.available_stock <= 0}
                  >
                    <View style={styles.cardContent}>
                      <View style={styles.productImageWrap}>
                        <Image
                          source={getProductSource(product)}
                          style={styles.productImage}
                          contentFit="cover"
                        />
                      </View>
                      <Text style={styles.productName} numberOfLines={2}>
                        {product.product_name}
                      </Text>
                      <Text style={styles.productPrice}>{formatRupiah(product.selling_price)}</Text>
                      <Text style={styles.stockText}>
                        Stock: {product.available_stock}
                      </Text>
                      {hasCartItem ? (
                        <View
                          style={styles.quantityBadge}
                          onStartShouldSetResponderCapture={() => {
                            ignoreNextProductCardPressRef.current = true;
                            return true;
                          }}
                        >
                          <Pressable
                            style={styles.quantityStepButton}
                            onPressIn={(event) => {
                              event.stopPropagation();
                              ignoreNextProductCardPressRef.current = true;
                            }}
                            onPress={() => setItemQuantity(product.id_product, inCartQuantity - 1)}
                          >
                            <Text style={styles.quantityStepButtonText}>-</Text>
                          </Pressable>
                          <TextInput
                            value={String(inCartQuantity)}
                            onChangeText={(text) => {
                              const digits = text.replace(/[^0-9]/g, "");
                              setItemQuantity(product.id_product, digits ? Number(digits) : 0);
                            }}
                            onPressIn={(event) => {
                              event.stopPropagation();
                              ignoreNextProductCardPressRef.current = true;
                            }}
                            onFocus={() => {
                              ignoreNextProductCardPressRef.current = true;
                            }}
                            selectTextOnFocus
                            keyboardType="number-pad"
                            returnKeyType="done"
                            style={[styles.quantityBadgeInput, styles.qtyInputCentered]}
                            textAlignVertical="center"
                            textAlign="center"
                          />
                          <Pressable
                            style={styles.quantityStepButton}
                            onPressIn={(event) => {
                              event.stopPropagation();
                              ignoreNextProductCardPressRef.current = true;
                            }}
                            onPress={() => setItemQuantity(product.id_product, inCartQuantity + 1)}
                          >
                            <Text style={styles.quantityStepButtonText}>+</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
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
            <Pressable
              style={[styles.clearButton, cart.length === 0 && styles.checkoutButtonDisabled]}
              onPress={() => setClearCartConfirmOpen(true)}
              disabled={cart.length === 0}
            >
                <AppIcon name="trash" size={14} color="#ef4444" />
              </Pressable>
          </View>

          <View style={styles.contextCard}>
            <Text style={styles.cashierLabel}>Cashier: {cashierName}</Text>

            

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
                    <View
                      style={styles.quantityControl}
                      onStartShouldSetResponderCapture={() => true}
                    >
                      <Pressable
                        style={styles.quantityStepButtonSmall}
                        onPressIn={(event) => event.stopPropagation()}
                        onPress={() => setItemQuantity(item.id_product, item.quantity - 1)}
                      >
                        <Text style={styles.quantityStepButtonText}>-</Text>
                      </Pressable>
                      <TextInput
                        value={String(item.quantity)}
                        onChangeText={(text) => {
                          const digits = text.replace(/[^0-9]/g, "");
                          setItemQuantity(item.id_product, digits ? Number(digits) : 0);
                        }}
                        onPressIn={(event) => event.stopPropagation()}
                        onFocus={() => {}}
                        selectTextOnFocus
                        keyboardType="number-pad"
                        returnKeyType="done"
                        style={[styles.qtyInput, styles.qtyInputCentered]}
                        textAlignVertical="center"
                        textAlign="center"
                      />
                      <Pressable
                        style={styles.quantityStepButtonSmall}
                        onPressIn={(event) => event.stopPropagation()}
                        onPress={() => setItemQuantity(item.id_product, item.quantity + 1)}
                      >
                        <Text style={styles.quantityStepButtonText}>+</Text>
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

            <Pressable
              style={[
                styles.checkoutButton,
                (cart.length === 0 || checkoutLoading) && styles.checkoutButtonDisabled,
              ]}
              onPress={handleCheckoutPress}
              disabled={cart.length === 0 || checkoutLoading}
            >
              <Text style={styles.checkoutText}>{checkoutLoading ? "Processing..." : "Checkout"}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ResponsiveModal
        visible={isCashModalOpen}
        onClose={() => setIsCashModalOpen(false)}
        maxWidthDesktop={420}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.88}
        maxHeightPhoneRatio={0.9}
        cardStyle={styles.modalCard}
      >
        <Text style={styles.modalTitle}>Cash Payment</Text>
        <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
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
        </ScrollView>
        <View style={styles.modalActions}>
          <Pressable style={styles.modalSecondaryButton} onPress={() => setIsCashModalOpen(false)}>
            <Text style={styles.modalSecondaryText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.modalPrimaryButton} onPress={handleCashContinue}>
            <Text style={styles.modalPrimaryText}>Continue</Text>
          </Pressable>
        </View>
      </ResponsiveModal>

      <ResponsiveModal
        visible={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        maxWidthDesktop={520}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.9}
        maxHeightPhoneRatio={0.9}
        cardStyle={[styles.modalCard, styles.receiptCard]}
      >
        {checkoutResult ? (
          <Animated.View style={[styles.sweetAlertCard, { transform: [{ scale: successScale }] }]}>
            <View style={styles.sweetIconCircle}>
              <MaterialCommunityIcons name="check" size={42} color="#84cc16" />
            </View>
            <Text style={styles.sweetTitle}>Payment Successful!</Text>
            <Text style={styles.sweetMeta}>Transaction No.: {checkoutResult.sale_number}</Text>
            {checkoutResult.receipt_email_status === "queued" ? (
              <Text style={styles.sweetMeta}>Receipt email queued for delivery.</Text>
            ) : null}
            {checkoutResult.receipt_email_status === "failed" ? (
              <Text style={styles.sweetMeta}>Receipt email could not be queued.</Text>
            ) : null}
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
                onPress={handlePrintReceipt}
              >
                <Text style={[styles.modalPrimaryText, styles.successButtonText]}>Print Receipt</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : (
          <>
            <Text style={styles.modalTitle}>Receipt Preview</Text>
            <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
              <View style={[styles.receiptLogoWrap, { flexDirection: "row", alignItems: "center" }]}>
                <Image source={require("../../assets/images/ui/logo_koperasi_cbs.png")} style={{ width: 58, height: 58 }} contentFit="contain" />
                <Image source={SIDEBAR_LOGO} style={[styles.receiptLogo, { marginLeft: -16 }]} contentFit="contain" />
              </View>
              <Text style={styles.receiptMeta}>Cashier: {cashierName}</Text>
              <Text style={styles.receiptMeta}>Time: {new Date().toLocaleString("id-ID")}</Text>
              <Text style={styles.receiptMeta}>
                Payment: {receiptPaymentMethod === "CASH" ? "Cash" : "QRIS"}
              </Text>

              <View style={styles.receiptItems}>
                {cart.map((item) => (
                  <View key={item.id_product} style={styles.receiptRow}>
                    <Text style={styles.receiptItemName}>
                      {formatReceiptProductLabel({ productCode: item.product_code, productName: item.product_name })} x{item.quantity}
                    </Text>
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
            </ScrollView>
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
      </ResponsiveModal>
      <InventoryConfirmModal
        visible={logoutConfirmOpen}
        title="Logout?"
        message="Are you sure you want to end this cashier session?"
        confirmLabel="Logout"
        tone="danger"
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={handleLogout}
      />
      <InventoryConfirmModal
        visible={clearCartConfirmOpen}
        title="Clear Cart?"
        message="Remove all selected items from the current transaction?"
        confirmLabel="Clear Cart"
        tone="danger"
        onCancel={() => setClearCartConfirmOpen(false)}
        onConfirm={handleClearCart}
      />
      <InventoryResultModal
        visible={resultModalOpen}
        status="error"
        title={resultTitle}
        message={resultMessage}
        onClose={() => setResultModalOpen(false)}
      />
      {/* Checkout Modal */}
      <ResponsiveModal
        visible={isCheckoutModalOpen}
        onClose={() => {
          setIsCheckoutModalOpen(false);
          setMemberPickerOpen(false);
        }}
        maxWidthDesktop={460}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.88}
        maxHeightPhoneRatio={0.9}
        cardStyle={styles.modalCard}
      >
        <Text style={styles.modalTitle}>Checkout Details</Text>
        <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.modalLabel}>Customer</Text>
          <Pressable
            style={styles.memberSelect}
            onPress={() => {
              setMemberPickerOpen((current) => !current);
              setMemberSearch("");
            }}
          >
            <Text style={styles.memberSelectText} numberOfLines={1}>
              {selectedMember ? selectedMember.full_name : "General (Non-member)"}
            </Text>
            <AppIcon name="chevron-down" size={16} color="#475569" />
          </Pressable>

          {memberPickerOpen ? (
            <ScrollView
              style={[styles.memberDropdown, { maxHeight: 200 }]}
              nestedScrollEnabled
              showsVerticalScrollIndicator={true}
            >
              <View style={styles.memberSearchWrap}>
                <AppIcon name="search" size={14} color="#64748b" />
                <TextInput
                  value={memberSearch}
                  onChangeText={setMemberSearch}
                  placeholder="Search member..."
                  placeholderTextColor="#94a3b8"
                  style={styles.memberSearchInput}
                />
              </View>
              <Pressable
                style={styles.memberDropdownOption}
                onPress={() => {
                  setSelectedMemberId(null);
                  setMemberPickerOpen(false);
                  setMemberSearch("");
                }}
              >
                <Text style={styles.memberDropdownText}>General (Non-member)</Text>
              </Pressable>
              {filteredMembers.map((member) => (
                <Pressable
                  key={member.id_member}
                  style={styles.memberDropdownOption}
                  onPress={() => {
                    setSelectedMemberId(member.id_member);
                    setMemberPickerOpen(false);
                    setMemberSearch("");
                  }}
                >
                  <Text style={styles.memberDropdownText}>{member.full_name} ({member.member_code})</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <Text style={[styles.modalLabel, { marginTop: 16 }]}>Payment Method</Text>
          <View style={styles.paymentRow}>
            <Pressable
              style={[styles.paymentButton, paymentMethod === "CASH" && styles.paymentButtonActive]}
              onPress={() => setPaymentMethod("CASH")}
            >
              <AppIcon name="cash" size={11} color={paymentMethod === "CASH" ? "#ffffff" : "#475569"} />
              <Text style={[styles.paymentText, paymentMethod === "CASH" && styles.paymentTextActive]}>Cash</Text>
            </Pressable>
            <Pressable
              style={[styles.paymentButton, paymentMethod === "QRIS" && styles.paymentButtonActive]}
              onPress={() => setPaymentMethod("QRIS")}
            >
              <AppIcon name="qr" size={11} color={paymentMethod === "QRIS" ? "#ffffff" : "#475569"} />
              <Text style={[styles.paymentText, paymentMethod === "QRIS" && styles.paymentTextActive]}>QRIS</Text>
            </Pressable>
          </View>

          <Text style={[styles.modalLabel, { marginTop: 16 }]}>Total Amount</Text>
          <Text style={styles.modalValue}>{formatRupiah(subtotal)}</Text>
        </ScrollView>
        <View style={styles.modalActions}>
          <Pressable
            style={styles.modalSecondaryButton}
            onPress={() => {
              setIsCheckoutModalOpen(false);
              setMemberPickerOpen(false);
            }}
          >
            <Text style={styles.modalSecondaryText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={styles.modalPrimaryButton}
            onPress={handleProceedPayment}
          >
            <Text style={styles.modalPrimaryText}>Proceed</Text>
          </Pressable>
        </View>
      </ResponsiveModal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewportShell: {
    flex: 1,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  scaledCanvas: {
    backgroundColor: "#f8fafc",
  },

  topBar: {
    minHeight: 72,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    zIndex: 30,
  },
  topBarLogo: {
    width: 190,
    height: 44,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 40,
  },
  profileMenuWrap: {
    position: "relative",
    zIndex: 60,
  },
  profileTrigger: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 10,
    paddingRight: 12,
    minWidth: 180,
  },
  topAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  topAvatarText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  profileTriggerText: {
    color: "#1e293b",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  profileDropdown: {
    position: "absolute",
    top: 46,
    right: 0,
    width: 180,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    padding: 6,
    zIndex: 120,
  },
  dropdownItem: {
    height: 34,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  dropdownItemText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "700",
  },
  dropdownItemTextBlue: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "700",
  },
  mainArea: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
    zIndex: 1,
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
  productListScroll: {
    flex: 1,
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
    justifyContent: "center",
    position: "relative",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 0,
    marginTop: 8,
  },
  quantityBadgeInput: {
    width: 40,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#ffffff",
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: "800",
    padding: 0,
    includeFontPadding: false,
  },
  quantityStepButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3b82f6",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityStepButtonSmall: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityStepButtonText: {
    color: "#1d4ed8",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18,
  },
  productImageWrap: {
    width: 84,
    height: 84,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#dbe3ee",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  productImage: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
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
  memberSearchWrap: {
    minHeight: 38,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    backgroundColor: "#f8fafc",
  },
  memberSearchInput: {
    flex: 1,
    color: "#1e293b",
    fontSize: 12,
    paddingVertical: 0,
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
    paddingHorizontal: 0,
  },
  qtyInput: {
    width: 52,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "800",
    padding: 0,
    includeFontPadding: false,
  },
  qtyInputCentered: {
    textAlign: "center",
    textAlignVertical: "center",
    paddingHorizontal: 0,
    paddingVertical: 0,
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
  detailScroll: {
    maxHeight: "84%",
  },
  detailScrollContent: {
    gap: 8,
    paddingBottom: 6,
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
  receiptLogoWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  receiptLogo: {
    width: 260,
    height: 58,
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
