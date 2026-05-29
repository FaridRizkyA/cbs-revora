import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker/build/index";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import FilterSheetModal from "../../../components/inventory/FilterSheetModal";
import FilterSelectField from "../../../components/inventory/FilterSelectField";
import IconFilterButton from "../../../components/inventory/IconFilterButton";
import ActiveFilterBadges from "../../../components/inventory/ActiveFilterBadges";
import PrimaryActionButton from "../../../components/inventory/PrimaryActionButton";
import InventoryPageHeader from "../../../components/inventory/InventoryPageHeader";
import InventoryRowActionsMenu from "../../../components/inventory/InventoryRowActionsMenu";
import InventoryDataTable, { InventoryDataTableColumn } from "../../../components/inventory/InventoryDataTable";
import ResponsiveModal from "../../../components/common/ResponsiveModal";
import { canManageInventoryMaster, getAuthSession, normalizeRole } from "../../../utils/authSession";
import { API_BASE_URL } from "../../../utils/api";

type Product = {
  id_product: string;
  is_active?: string;
  id_supplier: string | null;
  supplier_name?: string | null;
  supplier_code?: string | null;
  product_code: string;
  barcode: string | null;
  product_name: string;
  product_image?: string | null;
  selling_price: number;
  minimum_stock: number;
  available_stock: number;
};
type ProductBatchSummary = {
  id_product_batch: string;
  batch_code: string;
  expired_date: string;
  batch_qty: number;
};
type SupplierOption = {
  id_supplier: string;
  supplier_name: string;
};
type ProductFormState = {
  id_supplier: string;
  barcode: string;
  product_name: string;
  description: string;
  selling_price: string;
  minimum_stock: string;
  product_image: string;
};
type SelectedProductImage = {
  uri: string;
  name: string;
  mimeType?: string | null;
  file?: File;
};
type PendingActionType = "create" | "edit" | "deactivate" | "activate";
const PRODUCT_PLACEHOLDER = require("../../../assets/images/placeholders/default-product.png");
const DETAIL_ROW_HEIGHT = 44;
const DETAIL_ROW_GAP = 8;
const EMPTY_PRODUCT_FORM: ProductFormState = {
  id_supplier: "",
  barcode: "",
  product_name: "",
  description: "",
  selling_price: "",
  minimum_stock: "",
  product_image: "",
};

const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace(/\s/g, " ");

export default function ProductsScreen() {
  const [roleName, setRoleName] = useState("CASHIER");
  const [userId, setUserId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [openActionProductId, setOpenActionProductId] = useState<string | null>(null);
  const [selectedProductBatches, setSelectedProductBatches] = useState<ProductBatchSummary[]>([]);
  const [inactiveModalOpen, setInactiveModalOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingProductId, setEditingProductId] = useState("");
  const [productForm, setProductForm] = useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  const [selectedProductImage, setSelectedProductImage] = useState<SelectedProductImage | null>(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [stockFilter, setStockFilter] = useState<"ALL" | "OUT_OF_STOCK" | "LOW_STOCK" | "SAFE_STOCK">("ALL");
  const [SupplierFilter, setSupplierFilter] = useState<string>("ALL");
  const [minPriceFilter, setMinPriceFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");
  const [draftStockFilter, setDraftStockFilter] = useState<"ALL" | "OUT_OF_STOCK" | "LOW_STOCK" | "SAFE_STOCK">("ALL");
  const [draftSupplierFilter, setDraftSupplierFilter] = useState<string>("ALL");
  const [draftMinPriceFilter, setDraftMinPriceFilter] = useState("");
  const [draftMaxPriceFilter, setDraftMaxPriceFilter] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingActionType | null>(null);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultStatus, setResultStatus] = useState<"success" | "error">("success");
  const [resultTitle, setResultTitle] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [detailImageLoadError, setDetailImageLoadError] = useState(false);
  const canManage = canManageInventoryMaster(roleName);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/products${roleName === "ADMIN" ? "?include_inactive=1" : ""}`
      );
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
  }, [roleName]);

  const fetchSuppliers = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/suppliers`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message || "Failed to fetch suppliers.");
      }

      const safeRows = Array.isArray(payload?.data) ? payload.data : [];
      setSuppliers(
        safeRows
          .filter((item) => item?.is_active === "Y")
          .map((item) => ({
            id_supplier: String(item.id_supplier || ""),
            supplier_name: String(item.supplier_name || ""),
          }))
          .filter((item) => item.id_supplier && item.supplier_name)
      );
    } catch {
      setSuppliers([]);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  useEffect(() => {
    getAuthSession()
      .then((session) => {
        setRoleName(normalizeRole(session?.user?.role_name) || "CASHIER");
        setUserId(session?.user?.id_user || "");
      })
      .catch(() => setRoleName("CASHIER"));
  }, []);

  const supplierOptions = useMemo(() => {
    return suppliers.map((item) => ({ label: item.supplier_name, value: item.id_supplier }));
  }, [suppliers]);

  const supplierNameOptions = useMemo(() => {
    const names = products
      .map((product) => (product.supplier_name || "").trim())
      .filter((name): name is string => Boolean(name));
    return ["ALL", ...Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const source = products.filter((product) => product.is_active !== "N");
    const base = query
      ? source.filter((product) => {
          const text = [product.product_code, product.product_name, product.barcode ?? ""].join(" ").toLowerCase();
          return text.includes(query);
        })
      : source;

    const minPrice = Number(minPriceFilter || "0");
    const maxPrice = Number(maxPriceFilter || "0");

    return base.filter((product) => {
      const stockStatusMatch =
        stockFilter === "ALL"
          ? true
          : stockFilter === "OUT_OF_STOCK"
            ? product.available_stock <= 0
            : stockFilter === "LOW_STOCK"
              ? product.available_stock > 0 && product.available_stock <= product.minimum_stock
              : product.available_stock > product.minimum_stock;

      const SupplierMatch =
        SupplierFilter === "ALL"
          ? true
          : (product.supplier_name || "").trim() === SupplierFilter;

      const minPriceMatch = minPriceFilter.trim() ? product.selling_price >= minPrice : true;
      const maxPriceMatch = maxPriceFilter.trim() ? product.selling_price <= maxPrice : true;

      return stockStatusMatch && SupplierMatch && minPriceMatch && maxPriceMatch;
    });
  }, [products, search, stockFilter, SupplierFilter, minPriceFilter, maxPriceFilter]);
  const inactiveProducts = useMemo(
    () => products.filter((product) => product.is_active === "N"),
    [products]
  );

  const openCreateForm = () => {
    setIsEdit(false);
    setEditingProductId("");
    setProductForm(EMPTY_PRODUCT_FORM);
    setSelectedProductImage(null);
    setFormOpen(true);
  };

  const openEditForm = (product: Product) => {
    setIsEdit(true);
    setEditingProductId(product.id_product);
    setProductForm({
      id_supplier: product.id_supplier || "",
      barcode: product.barcode || "",
      product_name: product.product_name || "",
      description: (product as Product & { description?: string | null }).description || "",
      selling_price: String(product.selling_price ?? ""),
      minimum_stock: String(product.minimum_stock ?? ""),
      product_image: product.product_image || "",
    });
    setSelectedProductImage(null);
    setFormOpen(true);
  };

  const loadProductDetailBatches = useCallback((idProduct: string) => {
    fetch(`${API_BASE_URL}/api/products/${idProduct}/batches`)
      .then((response) => response.json())
      .then((payload) => {
        const source = Array.isArray(payload?.data) ? payload.data : [];
        setSelectedProductBatches(source.filter((item) => Number(item?.batch_qty || 0) > 0));
      })
      .catch(() => setSelectedProductBatches([]));
  }, []);

  const openProductDetail = useCallback((product: Product) => {
    setDetailImageLoadError(false);
    setSelectedProduct(product);
    loadProductDetailBatches(product.id_product);
  }, [loadProductDetailBatches]);

  const closeProductForm = () => {
    if (saving) return;
    setFormOpen(false);
  };

  const pickProductImage = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setSelectedProductImage({
        uri: asset.uri,
        name: asset.name || `product-${Date.now()}.jpg`,
        mimeType: asset.mimeType || null,
        file: asset.file,
      });
    } catch {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage("Failed to pick image file.");
      setResultModalOpen(true);
    }
  };

  const submitProductForm = async () => {
    let actorId = userId;
    if (!actorId) {
      const session = await getAuthSession().catch(() => null);
      actorId = session?.user?.id_user || "";
      if (actorId) {
        setUserId(actorId);
      }
    }

    const supplierId = productForm.id_supplier.trim();
    const barcode = productForm.barcode.trim();
    const name = productForm.product_name.trim();
    const description = productForm.description.trim();
    const price = Number(productForm.selling_price);
    const minStock = Number(productForm.minimum_stock);
    const productImage = productForm.product_image.trim();

    if (!actorId) {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage("Session user not found. Please re-login.");
      setResultModalOpen(true);
      return;
    }
    if (!supplierId) {
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage("Supplier is required.");
      setResultModalOpen(true);
      return;
    }
    if (!name) {
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage("Product name is required.");
      setResultModalOpen(true);
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage("Selling price must be greater than or equal to 0.");
      setResultModalOpen(true);
      return;
    }
    if (!Number.isInteger(minStock) || minStock < 0) {
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage("Minimum stock must be an integer greater than or equal to 0.");
      setResultModalOpen(true);
      return;
    }

    setSaving(true);
    try {
      let uploadedProductImageUrl = productImage || null;
      if (selectedProductImage) {
        const formData = new FormData();
        formData.append("id_user", actorId);
        if (selectedProductImage.file) {
          formData.append("image", selectedProductImage.file, selectedProductImage.name);
        } else {
          formData.append("image", {
            uri: selectedProductImage.uri,
            name: selectedProductImage.name,
            type: selectedProductImage.mimeType || "image/jpeg",
          } as unknown as Blob);
        }

        const uploadResponse = await fetch(`${API_BASE_URL}/api/products/upload-image`, {
          method: "POST",
          body: formData,
        });
        const uploadPayload = await uploadResponse.json();
        if (!uploadResponse.ok) {
          throw new Error(uploadPayload?.error || uploadPayload?.message || "Failed to upload product image.");
        }
        uploadedProductImageUrl = String(uploadPayload?.data?.image_url || "").trim() || null;
      }

      const response = await fetch(
        isEdit ? `${API_BASE_URL}/api/products/${editingProductId}` : `${API_BASE_URL}/api/products`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEdit
              ? {
                  id_user: actorId,
                  id_supplier: supplierId,
                  barcode: barcode || null,
                  product_name: name,
                  description: description || null,
                  selling_price: price,
                  minimum_stock: minStock,
                  product_image: uploadedProductImageUrl,
                }
              : {
                  id_user: actorId,
                  id_supplier: supplierId,
                  barcode: barcode || null,
                  product_name: name,
                  description: description || null,
                  selling_price: price,
                  minimum_stock: minStock,
                  product_image: uploadedProductImageUrl,
                }
          ),
        }
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "Failed to save product.");
      }

      setFormOpen(false);
      setProductForm(EMPTY_PRODUCT_FORM);
      setSelectedProductImage(null);
      setEditingProductId("");
      setIsEdit(false);
      await fetchProducts();
      setResultStatus("success");
      setResultTitle("Action Completed");
      setResultMessage(isEdit ? "Product updated successfully." : "Product created successfully.");
      setResultModalOpen(true);
    } catch (error) {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage(error instanceof Error ? error.message : "Failed to save product.");
      setResultModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const updateProductStatus = async (product: Product, nextState: "Y" | "N") => {
    let actorId = userId;
    if (!actorId) {
      const session = await getAuthSession().catch(() => null);
      actorId = session?.user?.id_user || "";
      if (actorId) {
        setUserId(actorId);
      }
    }
    if (!actorId) {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage("Session user not found. Please re-login.");
      setResultModalOpen(true);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/products/${product.id_product}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_user: actorId, is_active: nextState }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "Failed to update product status.");
      }
      setSelectedProduct(null);
      setOpenActionProductId(null);
      setInactiveModalOpen(false);
      await fetchProducts();
      setResultStatus("success");
      setResultTitle("Action Completed");
      setResultMessage(nextState === "N" ? "Product deactivated successfully." : "Product activated successfully.");
      setResultModalOpen(true);
    } catch (error) {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage(error instanceof Error ? error.message : "Failed to update product status.");
      setResultModalOpen(true);
    }
  };

  const openConfirm = (type: PendingActionType, product?: Product) => {
    setPendingAction(type);
    setPendingProduct(product || null);
    setConfirmOpen(true);
  };

  const getConfirmMessage = () => {
    if (pendingAction === "create") return "Create this product data?";
    if (pendingAction === "edit") return "Save changes to this product?";
    if (pendingAction === "deactivate") return "Deactivate this product?";
    if (pendingAction === "activate") return "Activate this product?";
    return "Are you sure?";
  };

  const executePendingAction = async () => {
    const action = pendingAction;
    const product = pendingProduct;
    setConfirmOpen(false);
    if (!action) return;

    if (action === "create" || action === "edit") {
      await submitProductForm();
      return;
    }
    if (action === "deactivate" && product) {
      await updateProductStatus(product, "N");
      return;
    }
    if (action === "activate" && product) {
      await updateProductStatus(product, "Y");
    }
  };
  const activeFilters = useMemo(() => {
    const items: { key: string; label: string; value: string; onClear: () => void }[] = [];
    if (SupplierFilter !== "ALL") items.push({ key: "supplier", label: "Supplier", value: SupplierFilter, onClear: () => setSupplierFilter("ALL") });
    if (stockFilter !== "ALL") items.push({ key: "stock", label: "Stock", value: stockFilter, onClear: () => setStockFilter("ALL") });
    if (minPriceFilter) items.push({ key: "minPrice", label: "Min Price", value: minPriceFilter, onClear: () => setMinPriceFilter("") });
    if (maxPriceFilter) items.push({ key: "maxPrice", label: "Max Price", value: maxPriceFilter, onClear: () => setMaxPriceFilter("") });
    return items;
  }, [SupplierFilter, stockFilter, minPriceFilter, maxPriceFilter]);

  const getStockStatus = (product: Product): "OUT_OF_STOCK" | "LOW_STOCK" | "SAFE_STOCK" => {
    const available = Number(product.available_stock || 0);
    const minimum = Number(product.minimum_stock || 0);
    if (available <= 0) return "OUT_OF_STOCK";
    if (available <= minimum) return "LOW_STOCK";
    return "SAFE_STOCK";
  };

  const formatDateOnly = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toISOString().slice(0, 10);
  };

  const batchDetailColumns = useMemo<InventoryDataTableColumn<ProductBatchSummary>[]>(() => [
    {
      key: "batch_code",
      title: "Batch Code",
      weight: 52,
      sortable: true,
      sortValue: (row) => row.batch_code || "",
      render: (row) => <Text style={styles.batchCell}>{row.batch_code}</Text>,
    },
    {
      key: "batch_qty",
      title: "Qty",
      weight: 12,
      align: "center",
      sortable: true,
      sortValue: (row) => Number(row.batch_qty || 0),
      render: (row) => <Text style={styles.batchCell}>{row.batch_qty}</Text>,
    },
    {
      key: "expired_date",
      title: "Expired",
      weight: 36,
      sortable: true,
      sortValue: (row) => new Date(row.expired_date).getTime(),
      render: (row) => <Text style={styles.batchCell}>{formatDateOnly(row.expired_date)}</Text>,
    },
  ], []);

  const productColumns = useMemo<InventoryDataTableColumn<Product>[]>(() => [
    {
      key: "product_code",
      title: "Code",
      weight: 15,
      sortable: true,
      sortValue: (row) => row.product_code || "",
      render: (item) => <Text style={styles.rowCell} numberOfLines={1}>{item.product_code}</Text>,
    },
    {
      key: "product_name",
      title: "Product",
      weight: 29,
      sortable: true,
      sortValue: (row) => row.product_name || "",
      render: (item) => <Text style={styles.rowCell} numberOfLines={1}>{item.product_name}</Text>,
    },
    {
      key: "barcode",
      title: "Barcode",
      weight: 17,
      sortable: true,
      sortValue: (row) => row.barcode || "",
      render: (item) => <Text style={styles.rowCell} numberOfLines={1}>{item.barcode || "-"}</Text>,
    },
    {
      key: "selling_price",
      title: "Price",
      weight: 16,
      sortable: true,
      sortValue: (row) => Number(row.selling_price || 0),
      render: (item) => <Text style={styles.rowCell} numberOfLines={1}>{formatRupiah(item.selling_price)}</Text>,
    },
    {
      key: "available_stock",
      title: "Stock",
      weight: 9,
      align: "center",
      sortable: true,
      sortValue: (row) => Number(row.available_stock || 0),
      render: (item) => (
        <View style={styles.stockCellWrap}>
          <View
            style={[
              styles.stockBadge,
              getStockStatus(item) === "OUT_OF_STOCK"
                ? styles.stockBadgeOut
                : getStockStatus(item) === "LOW_STOCK"
                  ? styles.stockBadgeLow
                  : styles.stockBadgeSafe,
            ]}
          >
            <Text
              style={[
                styles.stockBadgeText,
                getStockStatus(item) === "OUT_OF_STOCK"
                  ? styles.stockTextOut
                  : getStockStatus(item) === "LOW_STOCK"
                    ? styles.stockTextLow
                    : styles.stockTextSafe,
              ]}
            >
              {item.available_stock}
            </Text>
          </View>
        </View>
      ),
    },
    {
      key: "action",
      title: "Action",
      weight: 14,
      align: "center",
      render: (item, meta) => (
        <View style={[styles.actionWrap, openActionProductId === item.id_product ? styles.actionWrapOpen : null]}>
          <InventoryRowActionsMenu
            open={openActionProductId === item.id_product}
            onToggle={() => setOpenActionProductId((prev) => (prev === item.id_product ? null : item.id_product))}
            direction={meta.rowIndex >= meta.totalRows - 2 ? "up" : "down"}
          >
            <Pressable style={[styles.actionOutlineBtn, styles.actionOutlineInfo]} onPress={() => { setOpenActionProductId(null); openProductDetail(item); }}>
              <Text style={[styles.actionOutlineBtnText, styles.actionOutlineInfoText]}>See Details</Text>
            </Pressable>
            {canManage ? (
              <>
                <Pressable style={[styles.actionOutlineBtn, styles.actionOutlineEdit]} onPress={() => { setOpenActionProductId(null); openEditForm(item); }}>
                  <Text style={[styles.actionOutlineBtnText, styles.actionOutlineEditText]}>Edit</Text>
                </Pressable>
                <Pressable style={[styles.actionOutlineBtn, styles.actionOutlineDanger]} onPress={() => { setOpenActionProductId(null); openConfirm("deactivate", item); }}>
                  <Text style={[styles.actionOutlineBtnText, styles.actionOutlineDangerText]}>Deactivate</Text>
                </Pressable>
              </>
            ) : null}
          </InventoryRowActionsMenu>
        </View>
      ),
    },
  ], [canManage, openActionProductId, openProductDetail]);

  const inactiveProductColumns = useMemo<InventoryDataTableColumn<Product>[]>(() => [
    {
      key: "product_code",
      title: "Code",
      weight: 15,
      sortable: true,
      sortValue: (row) => row.product_code || "",
      render: (item) => <Text style={styles.rowCell} numberOfLines={1}>{item.product_code}</Text>,
    },
    {
      key: "product_name",
      title: "Product",
      weight: 29,
      sortable: true,
      sortValue: (row) => row.product_name || "",
      render: (item) => <Text style={styles.rowCell} numberOfLines={1}>{item.product_name}</Text>,
    },
    {
      key: "barcode",
      title: "Barcode",
      weight: 17,
      sortable: true,
      sortValue: (row) => row.barcode || "",
      render: (item) => <Text style={styles.rowCell} numberOfLines={1}>{item.barcode || "-"}</Text>,
    },
    {
      key: "selling_price",
      title: "Price",
      weight: 16,
      sortable: true,
      sortValue: (row) => Number(row.selling_price || 0),
      render: (item) => <Text style={styles.rowCell} numberOfLines={1}>{formatRupiah(item.selling_price)}</Text>,
    },
    {
      key: "available_stock",
      title: "Stock",
      weight: 9,
      align: "center",
      sortable: true,
      sortValue: (row) => Number(row.available_stock || 0),
      render: (item) => (
        <View style={styles.stockCellWrap}>
          <View
            style={[
              styles.stockBadge,
              getStockStatus(item) === "OUT_OF_STOCK"
                ? styles.stockBadgeOut
                : getStockStatus(item) === "LOW_STOCK"
                  ? styles.stockBadgeLow
                  : styles.stockBadgeSafe,
            ]}
          >
            <Text
              style={[
                styles.stockBadgeText,
                getStockStatus(item) === "OUT_OF_STOCK"
                  ? styles.stockTextOut
                  : getStockStatus(item) === "LOW_STOCK"
                    ? styles.stockTextLow
                    : styles.stockTextSafe,
              ]}
            >
              {item.available_stock}
            </Text>
          </View>
        </View>
      ),
    },
    {
      key: "action",
      title: "Action",
      weight: 14,
      align: "center",
      render: (item) =>
        canManage ? (
          <Pressable style={styles.activateButton} onPress={() => openConfirm("activate", item)}>
            <Text style={styles.activateButtonText}>Activate</Text>
          </Pressable>
        ) : null,
    },
  ], [canManage]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <InventoryPageHeader
        title="Products"
        subtitle="Manage product master data for inventory and sales operations."
        action={
          canManage ? (
            <View style={styles.headerActionRow}>
              <Pressable style={styles.secondaryButton} onPress={() => setInactiveModalOpen(true)}>
                <Text style={styles.secondaryButtonText}>Show Inactive</Text>
              </Pressable>
              <PrimaryActionButton label="Add Product" onPress={openCreateForm} />
            </View>
          ) : undefined
        }
      />

      <View style={styles.filterCard}>
        <View style={styles.searchRow}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search code / name / barcode / supplier"
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
          />
          <IconFilterButton
            onPress={() => {
              setDraftStockFilter(stockFilter);
              setDraftSupplierFilter(SupplierFilter);
              setDraftMinPriceFilter(minPriceFilter);
              setDraftMaxPriceFilter(maxPriceFilter);
              setFilterModalOpen(true);
            }}
          />
        </View>
        <ActiveFilterBadges
          items={activeFilters}
          onClearAll={() => {
            setDraftStockFilter("ALL");
            setDraftSupplierFilter("ALL");
            setDraftMinPriceFilter("");
            setDraftMaxPriceFilter("");
            setStockFilter("ALL");
            setSupplierFilter("ALL");
            setMinPriceFilter("");
            setMaxPriceFilter("");
          }}
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
        <InventoryDataTable
          columns={productColumns}
          rows={filteredProducts}
          rowKey={(item) => item.id_product}
          isRowActive={(item) => openActionProductId === item.id_product}
          emptyText="No product data found."
        />
      )}

      <Text style={styles.footnote}>Stock is read-only and calculated automatically from Stock Movements.</Text>

      <ResponsiveModal
        visible={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        maxWidthDesktop={980}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.9}
        maxHeightPhoneRatio={0.9}
        cardStyle={styles.detailModalCard}
      >
            <Text style={styles.modalTitle}>Product Detail</Text>
            <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.metaGrid}>
              <View style={[styles.productImageWrap, styles.productImageWrapDesktop]}>
                {selectedProduct?.product_image && !detailImageLoadError ? (
                  <Image source={{ uri: selectedProduct.product_image }} style={styles.productImage} onError={() => setDetailImageLoadError(true)} />
                ) : (
                  <Image source={PRODUCT_PLACEHOLDER} style={styles.productImage} />
                )}
              </View>
              <View style={styles.metaStack}>
                <View style={styles.metaCard}>
                  <Text style={styles.metaLabel}>Product Code</Text>
                  <Text style={styles.metaValue}>{selectedProduct?.product_code || "-"}</Text>
                </View>
                <View style={styles.metaCard}>
                  <Text style={styles.metaLabel}>Product Name</Text>
                  <Text style={styles.metaValue}>{selectedProduct?.product_name || "-"}</Text>
                </View>
                <View style={styles.metaCard}>
                  <Text style={styles.metaLabel}>Supplier</Text>
                  <Text style={styles.metaValue}>{selectedProduct?.supplier_name || "-"}</Text>
                </View>
                <View style={styles.metaCard}>
                  <Text style={styles.metaLabel}>Status</Text>
                  <Text style={styles.metaValue}>{selectedProduct?.is_active === "N" ? "Inactive" : "Active"}</Text>
                </View>
                <View style={styles.metaCard}>
                  <Text style={styles.metaLabel}>Barcode</Text>
                  <Text style={styles.metaValue}>{selectedProduct?.barcode || "-"}</Text>
                </View>
                <View style={styles.metaRow}>
                  <View style={styles.metaCardHalf}>
                    <Text style={styles.metaLabel}>Price</Text>
                    <Text style={styles.metaValue}>{formatRupiah(selectedProduct?.selling_price || 0)}</Text>
                  </View>
                  <View style={styles.metaCardHalf}>
                    <Text style={styles.metaLabel}>Stock</Text>
                    <Text style={styles.metaValue}>{selectedProduct?.available_stock ?? 0}</Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.notesCard}>
              <Text style={styles.metaLabel}>Notes / Description</Text>
              <Text style={styles.metaValue}>
                {(selectedProduct as Product & { description?: string | null })?.description || "-"}
              </Text>
            </View>

            <InventoryDataTable
              columns={batchDetailColumns}
              rows={selectedProductBatches}
              rowKey={(batch) => batch.id_product_batch}
              emptyText="No batch data for this product."
              enablePagination={false}
            />
            </ScrollView>
            <Pressable style={styles.closeButton} onPress={() => setSelectedProduct(null)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
      </ResponsiveModal>

      <ResponsiveModal
        visible={formOpen}
        onClose={closeProductForm}
        maxWidthDesktop={760}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.9}
        maxHeightPhoneRatio={0.84}
        cardStyle={styles.formModalCard}
      >
            <Text style={styles.modalTitle}>{isEdit ? "Edit Product" : "Add Product"}</Text>
            <ScrollView contentContainerStyle={styles.formBody}>
              <FilterSelectField
                label="Supplier"
                value={productForm.id_supplier}
                options={supplierOptions}
                onChange={(value) => setProductForm((prev) => ({ ...prev, id_supplier: value }))}
              />
              <View style={styles.formGrid}>
                <View style={styles.formFieldHalf}>
                  <Text style={styles.formLabel}>Barcode</Text>
                  <TextInput
                    value={productForm.barcode}
                    onChangeText={(value) => setProductForm((prev) => ({ ...prev, barcode: value }))}
                    placeholder="Optional"
                    placeholderTextColor="#94a3b8"
                    style={styles.formInput}
                  />
                </View>
              </View>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Product Name</Text>
                <TextInput
                  value={productForm.product_name}
                  onChangeText={(value) => setProductForm((prev) => ({ ...prev, product_name: value }))}
                  placeholder="Product name"
                  placeholderTextColor="#94a3b8"
                  style={styles.formInput}
                />
              </View>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  value={productForm.description}
                  onChangeText={(value) => setProductForm((prev) => ({ ...prev, description: value }))}
                  placeholder="Optional description"
                  placeholderTextColor="#94a3b8"
                  style={[styles.formInput, styles.formTextArea]}
                  multiline
                />
              </View>
              <View style={styles.formGrid}>
                <View style={styles.formFieldHalf}>
                  <Text style={styles.formLabel}>Selling Price</Text>
                  <TextInput
                    value={productForm.selling_price}
                    onChangeText={(value) =>
                      setProductForm((prev) => ({ ...prev, selling_price: value.replace(/[^0-9]/g, "") }))
                    }
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    style={styles.formInput}
                  />
                </View>
                <View style={styles.formFieldHalf}>
                  <Text style={styles.formLabel}>Minimum Stock</Text>
                  <TextInput
                    value={productForm.minimum_stock}
                    onChangeText={(value) =>
                      setProductForm((prev) => ({ ...prev, minimum_stock: value.replace(/[^0-9]/g, "") }))
                    }
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    style={styles.formInput}
                  />
                </View>
              </View>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Product Image</Text>
                <Pressable style={styles.filePickerBtn} onPress={pickProductImage}>
                  <Text style={styles.filePickerBtnText}>{selectedProductImage ? "Change Image File" : "Select Image File"}</Text>
                </Pressable>
                <Text style={styles.filePickerHint}>
                  {selectedProductImage?.name || "No file selected."}
                </Text>
                {isEdit && productForm.product_image && !selectedProductImage ? (
                  <Text style={styles.formHint}>Current image will be kept if no new file is selected.</Text>
                ) : null}
              </View>
            </ScrollView>
            <View style={styles.formActionRow}>
              <Pressable style={styles.formCancelBtn} onPress={closeProductForm}>
                <Text style={styles.formCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.formSaveBtn} onPress={() => openConfirm(isEdit ? "edit" : "create")} disabled={saving}>
                <Text style={styles.formSaveText}>{saving ? "Saving..." : "Save"}</Text>
              </Pressable>
            </View>
      </ResponsiveModal>

      <FilterSheetModal
        title="Filter Products"
        visible={filterModalOpen}
        onApply={() => {
          setStockFilter(draftStockFilter);
          setSupplierFilter(draftSupplierFilter);
          setMinPriceFilter(draftMinPriceFilter);
          setMaxPriceFilter(draftMaxPriceFilter);
          setFilterModalOpen(false);
        }}
        onReset={() => {
          setDraftStockFilter("ALL");
          setDraftSupplierFilter("ALL");
          setDraftMinPriceFilter("");
          setDraftMaxPriceFilter("");
          setStockFilter("ALL");
          setSupplierFilter("ALL");
          setMinPriceFilter("");
          setMaxPriceFilter("");
        }}
        onClose={() => setFilterModalOpen(false)}
      >
        <FilterSelectField
          label="Supplier"
          value={draftSupplierFilter}
          options={supplierNameOptions.map((Supplier) => ({ label: Supplier, value: Supplier }))}
          onChange={setDraftSupplierFilter}
        />

        <Text style={styles.filterLabel}>Stock Status</Text>
        <View style={styles.filterOptionsWrap}>
          {[
            { key: "ALL", label: "All" },
            { key: "OUT_OF_STOCK", label: "Out" },
            { key: "LOW_STOCK", label: "Low" },
            { key: "SAFE_STOCK", label: "Safe" },
          ].map((item) => (
            <Pressable
              key={item.key}
              style={[styles.filterOption, draftStockFilter === item.key && styles.filterOptionActive]}
              onPress={() =>
                setDraftStockFilter(item.key as "ALL" | "OUT_OF_STOCK" | "LOW_STOCK" | "SAFE_STOCK")
              }
            >
              <Text style={[styles.filterOptionText, draftStockFilter === item.key && styles.filterOptionTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.filterLabel}>Price Range</Text>
        <View style={styles.priceRow}>
          <TextInput
            value={draftMinPriceFilter}
            onChangeText={setDraftMinPriceFilter}
            keyboardType="numeric"
            placeholder="Min"
            placeholderTextColor="#94a3b8"
            style={styles.priceInput}
          />
          <TextInput
            value={draftMaxPriceFilter}
            onChangeText={setDraftMaxPriceFilter}
            keyboardType="numeric"
            placeholder="Max"
            placeholderTextColor="#94a3b8"
            style={styles.priceInput}
          />
        </View>
      </FilterSheetModal>

      <ResponsiveModal
        visible={inactiveModalOpen}
        onClose={() => setInactiveModalOpen(false)}
        maxWidthDesktop={900}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.9}
        maxHeightPhoneRatio={0.9}
        cardStyle={styles.inactiveModalCard}
      >
            <Text style={styles.modalTitle}>Inactive Products</Text>
            <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
              {inactiveProducts.length === 0 ? (
                <Text style={styles.modalEmpty}>No inactive product data.</Text>
              ) : (
                <InventoryDataTable
                  columns={inactiveProductColumns}
                  rows={inactiveProducts}
                  rowKey={(item) => item.id_product}
                  emptyText="No inactive product data."
                />
              )}
            </ScrollView>
            <Pressable style={styles.closeButton} onPress={() => setInactiveModalOpen(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
      </ResponsiveModal>

      <ResponsiveModal
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        maxWidthDesktop={420}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.84}
        maxHeightPhoneRatio={0.9}
        cardStyle={styles.confirmModalCard}
      >
        <Text style={styles.modalTitle}>Please Confirm</Text>
        <Text style={styles.confirmText}>{getConfirmMessage()}</Text>
        <View style={styles.confirmActionRow}>
          <Pressable style={styles.formCancelBtn} onPress={() => setConfirmOpen(false)}>
            <Text style={styles.formCancelText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.formSaveBtn} onPress={executePendingAction}>
            <Text style={styles.formSaveText}>Yes, Continue</Text>
          </Pressable>
        </View>
      </ResponsiveModal>

      <ResponsiveModal
        visible={resultModalOpen}
        onClose={() => setResultModalOpen(false)}
        maxWidthDesktop={380}
        maxWidthPhoneRatio={0.94}
        maxHeightDesktopRatio={0.82}
        maxHeightPhoneRatio={0.9}
        cardStyle={styles.resultModalCard}
      >
        <Feather
          name={resultStatus === "success" ? "check-circle" : "x-circle"}
          size={42}
          color={resultStatus === "success" ? "#16a34a" : "#dc2626"}
        />
        <Text style={styles.resultTitle}>{resultTitle}</Text>
        <Text style={styles.resultMessage}>{resultMessage}</Text>
        <Pressable style={styles.resultCloseBtn} onPress={() => setResultModalOpen(false)}>
          <Text style={styles.resultCloseBtnText}>OK</Text>
        </Pressable>
      </ResponsiveModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f6fb" },
  content: { padding: 14, gap: 14 },
  headerActionRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  secondaryButton: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { color: "#1d4ed8", fontWeight: "700", fontSize: 12 },
  filterCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    backgroundColor: "#fff",
    padding: 12,
  },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    color: "#0f172a",
  },
  centerState: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: 8 },
  stateText: { color: "#64748b" },
  errorText: { color: "#dc2626", fontWeight: "600", textAlign: "center" },
  retryButton: {
    height: 38,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  retryText: { color: "#ffffff", fontWeight: "700" },
  tableWrap: {
    borderWidth: 1,
    borderColor: "#dbe3ee",
    borderRadius: 12,
    overflow: "visible",
    backgroundColor: "#ffffff",
  },
  tableInner: { width: "100%" },
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
    position: "relative",
    zIndex: 1,
    overflow: "visible",
  },
  tableRowActiveLayer: { zIndex: 40 },
  headCell: { fontSize: 12, fontWeight: "700", color: "#334155", paddingHorizontal: 10, textAlign: "left" },
  rowCell: { fontSize: 13, color: "#0f172a", paddingHorizontal: 10, textAlign: "left" },
  codeCol: { width: "15%" },
  nameCol: { width: "29%" },
  barcodeCol: { width: "17%" },
  priceCol: { width: "16%" },
  stockCol: { width: "9%" },
  actionCol: { width: "14%", textAlign: "center" },
  stockCellWrap: { justifyContent: "center", alignItems: "flex-start", paddingHorizontal: 10 },
  stockBadge: {
    minWidth: 44,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  stockBadgeText: { fontWeight: "700", fontSize: 12 },
  stockBadgeOut: { borderColor: "#ef4444" },
  stockTextOut: { color: "#b91c1c" },
  stockBadgeLow: { borderColor: "#f59e0b" },
  stockTextLow: { color: "#92400e" },
  stockBadgeSafe: { borderColor: "#22c55e" },
  stockTextSafe: { color: "#166534" },
  footnote: { color: "#64748b", fontSize: 12 },
  actionWrap: { alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  actionWrapOpen: { position: "relative", zIndex: 4000 },
  actionCellWrap: { alignItems: "center", justifyContent: "center" },
  actionOutlineBtn: { minHeight: 30, borderRadius: 7, borderWidth: 1, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  actionOutlineBtnText: { fontSize: 11, fontWeight: "700" },
  actionOutlineInfo: { borderColor: "#93c5fd", backgroundColor: "#eff6ff" },
  actionOutlineInfoText: { color: "#1d4ed8" },
  actionOutlineEdit: { borderColor: "#fdba74", backgroundColor: "#fff7ed" },
  actionOutlineEditText: { color: "#c2410c" },
  actionOutlineDanger: { borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  actionOutlineDangerText: { color: "#b91c1c" },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  modalTitle: { color: "#0f172a", fontSize: 18, fontWeight: "800", marginBottom: 4 },
  formModalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  formBody: {
    gap: 10,
    paddingBottom: 4,
  },
  formGrid: {
    flexDirection: "row",
    gap: 10,
  },
  formField: {
    gap: 6,
  },
  formFieldHalf: {
    flex: 1,
    gap: 6,
  },
  formLabel: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  formHint: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
  },
  filePickerBtn: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  filePickerBtnText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "700",
  },
  filePickerHint: {
    color: "#475569",
    fontSize: 12,
  },
  formInput: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0f172a",
  },
  formInputDisabled: {
    backgroundColor: "#e2e8f0",
    color: "#64748b",
  },
  formTextArea: {
    minHeight: 82,
    textAlignVertical: "top",
  },
  formActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 2,
  },
  formCancelBtn: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  formCancelText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  formSaveBtn: {
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: "#1d4ed8",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  formSaveText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  detailModalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  detailScroll: {
    maxHeight: "84%",
  },
  detailScrollContent: {
    gap: 10,
    paddingBottom: 6,
  },
  notesCard: { borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", padding: 10, gap: 4 },
  metaGrid: { flexDirection: "row", gap: 12, alignItems: "flex-start", justifyContent: "space-between", width: "100%" },
  metaStack: { flex: 1, gap: DETAIL_ROW_GAP, width: "100%" },
  productImageWrap: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#dbe3ee",
    flexShrink: 0,
  },
  productImageWrapDesktop: { width: "28%", aspectRatio: 1 },
  productImage: { width: "100%", height: "100%" },
  metaCard: { borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", padding: 8, gap: 2, height: DETAIL_ROW_HEIGHT, justifyContent: "center" },
  metaLabel: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  metaValue: { color: "#0f172a", fontSize: 13, fontWeight: "700" },
  metaRow: { flexDirection: "row", gap: 8 },
  metaCardHalf: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", padding: 8, gap: 2, height: DETAIL_ROW_HEIGHT, justifyContent: "center" },
  batchTableCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  batchTableHeader: {
    minHeight: 38,
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
  },
  batchHeadPressable: { justifyContent: "center" },
  batchTableRow: {
    minHeight: 36,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    flexDirection: "row",
    alignItems: "center",
  },
  batchHeadCell: { color: "#334155", fontSize: 11, fontWeight: "800", paddingHorizontal: 10 },
  batchCell: { color: "#0f172a", fontSize: 12, paddingHorizontal: 10 },
  batchColCode: { width: "52%" },
  batchColQty: { width: "12%" },
  batchColExp: { width: "36%" },
  batchEmpty: { color: "#64748b", fontSize: 12, padding: 10 },
  inactiveModalCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 8 },
  inactiveTableCard: { borderRadius: 10, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff", overflow: "hidden" },
  activateButton: { alignSelf: "center", minHeight: 30, borderRadius: 8, borderWidth: 1, borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  activateButtonText: { color: "#166534", fontSize: 11, fontWeight: "700" },
  modalEmpty: { color: "#64748b", fontSize: 13, padding: 10 },
  closeButton: {
    marginTop: 6,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#1d4ed8",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  filterLabel: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  filterOptionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterOption: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  filterOptionActive: {
    borderColor: "#1d4ed8",
    backgroundColor: "#eff6ff",
  },
  filterOptionText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  filterOptionTextActive: {
    color: "#1d4ed8",
  },
  priceRow: {
    flexDirection: "row",
    gap: 8,
  },
  priceInput: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    color: "#0f172a",
  },
  confirmModalCard: { width: "100%", maxWidth: 420, backgroundColor: "#fff", borderRadius: 12, padding: 16, gap: 12 },
  confirmText: { color: "#334155", fontSize: 13, lineHeight: 20 },
  confirmActionRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  resultModalCard: { width: "100%", maxWidth: 380, backgroundColor: "#fff", borderRadius: 14, padding: 18, alignItems: "center", gap: 10 },
  resultTitle: { color: "#0f172a", fontSize: 18, fontWeight: "800" },
  resultMessage: { color: "#475569", fontSize: 13, textAlign: "center", lineHeight: 20 },
  resultCloseBtn: { marginTop: 4, width: "100%", height: 38, borderRadius: 10, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  resultCloseBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});

