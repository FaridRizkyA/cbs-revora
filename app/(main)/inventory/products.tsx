import { Feather } from "@expo/vector-icons";
import * as Print from "expo-print";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import FilterSheetModal from "../../../components/inventory/FilterSheetModal";
import FilterSelectField from "../../../components/inventory/FilterSelectField";
import IconFilterButton from "../../../components/inventory/IconFilterButton";
import ActiveFilterBadges from "../../../components/inventory/ActiveFilterBadges";
import PrimaryActionButton from "../../../components/inventory/PrimaryActionButton";
import InventoryPageHeader from "../../../components/inventory/InventoryPageHeader";
import InventoryRowActionsMenu from "../../../components/inventory/InventoryRowActionsMenu";
import ExportDropdownMenu from "../../../components/inventory/ExportDropdownMenu";
import InventoryDataTable, { InventoryDataTableColumn } from "../../../components/inventory/InventoryDataTable";
import ResponsiveModal from "../../../components/common/ResponsiveModal";
import SendEmailModal from "../../../components/modals/SendEmailModal";
import { fetchWithAuth } from "../../../utils/fetchWithAuth";
import {
  buildProductDetailReportPrintHtml,
  buildProductTableReportPrintHtml,
  downloadProductTableReportExcel,
  productTableColumns,
} from "../../../components/reports/products/ProductReportPrintTemplate";
import { buildReportPdfFileName } from "../../../components/reports/shared/ReportPrintTemplate";
import { canManageInventoryMaster, getAuthSession, normalizeRole } from "../../../utils/authSession";
import { logClientActivity } from "../../../utils/activityLog";
import { printReportHtml } from "../../../utils/printUtils";
import { pickSquareImageAsync } from "../../../utils/imageUpload";
import { withEmailPdfAttachment } from "../../../utils/reportEmail";

type Product = {
  id_product: string;
  is_active?: string;
  id_supplier: string | null;
  supplier_name?: string | null;
  supplier_code?: string | null;
  product_code: string;
  barcode: string | null;
  product_name: string;
  description?: string | null;
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
type WebCropState = {
  sourceUri: string;
  fileName: string;
  mimeType: string;
  objectUrl?: string;
  naturalWidth: number;
  naturalHeight: number;
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
  const { width, height } = useWindowDimensions();
  const isDetailCompact = width < 1100 || height < 700;
  const productDetailScrollMaxHeight = Math.max(360, height * (isDetailCompact ? 0.7 : 0.78));
  const cropModalWidth = Math.min(440, Math.max(320, Math.floor(Math.min(width - 32, height - 300))));
  const [webCrop, setWebCrop] = useState<WebCropState | null>(null);
  const [cropViewportSize, setCropViewportSize] = useState(320);
  const [cropTransform, setCropTransform] = useState({ scale: 1, translateX: 0, translateY: 0 });
  const cropTransformRef = useRef(cropTransform);
  const cropGestureRef = useRef({ startScale: 1, startTranslateX: 0, startTranslateY: 0, startClientX: 0, startClientY: 0 });
  const cropDragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const [isCropDragging, setIsCropDragging] = useState(false);
  const cropBoxRatio = 0.82;
  const cropBoxSize = Math.max(1, Math.floor(cropViewportSize * cropBoxRatio));

  useEffect(() => {
    cropTransformRef.current = cropTransform;
  }, [cropTransform]);

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

  const showResult = (status: "success" | "error", title: string, message: string) => {
    setResultStatus(status);
    setResultTitle(title);
    setResultMessage(message);
    setResultModalOpen(true);
  };
  const [detailImageLoadError, setDetailImageLoadError] = useState(false);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailTarget, setEmailTarget] = useState<"table" | "detail">("table");

  const canManage = canManageInventoryMaster(roleName);

  const closeWebCropper = useCallback(() => {
    if (webCrop?.objectUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(webCrop.objectUrl);
    }
    setWebCrop(null);
    setCropTransform({ scale: 1, translateX: 0, translateY: 0 });
  }, [webCrop]);

  const clampCropTransform = useCallback(
    (nextScale: number, nextTranslateX: number, nextTranslateY: number, sourceWidth: number, sourceHeight: number) => {
      const fitScale = Math.min(
        cropViewportSize / Math.max(1, sourceWidth),
        cropViewportSize / Math.max(1, sourceHeight)
      );
      const minCoverScale = Math.max(
        cropBoxSize / Math.max(1, sourceWidth * fitScale),
        cropBoxSize / Math.max(1, sourceHeight * fitScale)
      );
      const needsSlack = Math.abs(sourceWidth - sourceHeight) > 2;
      const minInteractiveScale = needsSlack ? minCoverScale * 1.08 : minCoverScale;
      const safeScale = Math.max(minInteractiveScale, nextScale);
      const displayWidth = Math.max(1, sourceWidth * fitScale * safeScale);
      const displayHeight = Math.max(1, sourceHeight * fitScale * safeScale);
      const overflowX = Math.max(0, (displayWidth - cropBoxSize) / 2);
      const overflowY = Math.max(0, (displayHeight - cropBoxSize) / 2);
      return {
        scale: safeScale,
        translateX: Math.min(overflowX, Math.max(-overflowX, nextTranslateX)),
        translateY: Math.min(overflowY, Math.max(-overflowY, nextTranslateY)),
      };
    },
    [cropBoxSize, cropViewportSize]
  );

  const setCropScale = useCallback(
    (nextScale: number) => {
      if (!webCrop) return;
      setCropTransform((current) =>
        clampCropTransform(
          nextScale,
          current.translateX,
          current.translateY,
          webCrop.naturalWidth || cropViewportSize,
          webCrop.naturalHeight || cropViewportSize
        )
      );
    },
    [clampCropTransform, cropViewportSize, webCrop]
  );

  const updateCropTranslation = useCallback(
    (nextTranslateX: number, nextTranslateY: number) => {
      if (!webCrop) return;
      setCropTransform((current) =>
        clampCropTransform(
          current.scale,
          nextTranslateX,
          nextTranslateY,
          webCrop.naturalWidth || cropViewportSize,
          webCrop.naturalHeight || cropViewportSize
        )
      );
    },
    [clampCropTransform, cropViewportSize, webCrop]
  );

  const beginCropDrag = useCallback(
    (clientX: number, clientY: number) => {
      cropDragRef.current = {
        active: true,
        lastX: clientX,
        lastY: clientY,
      };
      cropGestureRef.current = {
        startScale: cropTransformRef.current.scale,
        startTranslateX: cropTransformRef.current.translateX,
        startTranslateY: cropTransformRef.current.translateY,
        startClientX: clientX,
        startClientY: clientY,
      };
      setIsCropDragging(true);
    },
    []
  );

  useEffect(() => {
    if (Platform.OS !== "web" || !isCropDragging || !webCrop) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (!cropDragRef.current.active) return;
      const nextX = event.clientX;
      const nextY = event.clientY;
      cropDragRef.current = {
        active: true,
        lastX: nextX,
        lastY: nextY,
      };
      updateCropTranslation(
        cropGestureRef.current.startTranslateX + (nextX - cropGestureRef.current.startClientX),
        cropGestureRef.current.startTranslateY + (nextY - cropGestureRef.current.startClientY)
      );
      event.preventDefault();
    };

    const handleMouseUp = () => {
      cropDragRef.current.active = false;
      setIsCropDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isCropDragging, updateCropTranslation, webCrop]);

  useEffect(() => {
    if (Platform.OS !== "web" || !webCrop) return;
    let cancelled = false;

    const image = new window.Image();
    image.onload = () => {
      if (cancelled) return;
      const naturalWidth = image.naturalWidth || 1;
      const naturalHeight = image.naturalHeight || 1;
      const fitScale = Math.min(
        cropViewportSize / Math.max(1, naturalWidth),
        cropViewportSize / Math.max(1, naturalHeight)
      );
      const minCoverScale = Math.max(
        cropBoxSize / Math.max(1, naturalWidth * fitScale),
        cropBoxSize / Math.max(1, naturalHeight * fitScale)
      );
      const needsSlack = Math.abs(naturalWidth - naturalHeight) > 2;
      const initialScale = needsSlack ? minCoverScale * 1.08 : minCoverScale;
      setWebCrop((current) =>
        current
          ? {
              ...current,
              naturalWidth,
              naturalHeight,
          }
          : current
      );
      setCropTransform((current) =>
        clampCropTransform(
          Math.max(current.scale, initialScale),
          current.translateX,
          current.translateY,
          naturalWidth,
          naturalHeight
        )
      );
    };
    image.onerror = () => {
      if (cancelled) return;
      showResult("error", "Error", "Failed to load image for cropping.");
      closeWebCropper();
    };
    image.src = webCrop.sourceUri;

    return () => {
      cancelled = true;
    };
  }, [webCrop, closeWebCropper, clampCropTransform, cropBoxSize, cropViewportSize]);

  const openWebCropperFromSource = (sourceUri: string, fileName: string, mimeType: string, objectUrl?: string) => {
    setCropTransform({ scale: 1, translateX: 0, translateY: 0 });
    setWebCrop({
      sourceUri,
      fileName,
      mimeType,
      objectUrl,
      naturalWidth: 0,
      naturalHeight: 0,
    });
  };

  const applyWebCrop = async () => {
    if (!webCrop || Platform.OS !== "web") return;
    const img = new window.Image();
    img.src = webCrop.sourceUri;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image for cropping."));
    });

    const cropSize = 1024;
    const exportScale = cropSize / Math.max(1, cropBoxSize);
    const naturalWidth = img.naturalWidth || webCrop.naturalWidth || 1;
    const naturalHeight = img.naturalHeight || webCrop.naturalHeight || 1;
    const fitScale = Math.min(cropViewportSize / naturalWidth, cropViewportSize / naturalHeight);
    const renderScale = fitScale * cropTransform.scale * exportScale;

    const canvas = document.createElement("canvas");
    canvas.width = cropSize;
    canvas.height = cropSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas is not supported in this browser.");
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cropSize, cropSize);
    ctx.translate(
      cropSize / 2 + cropTransform.translateX * exportScale,
      cropSize / 2 + cropTransform.translateY * exportScale
    );
    ctx.scale(renderScale, renderScale);
    ctx.translate(-naturalWidth / 2, -naturalHeight / 2);
    ctx.drawImage(img, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    
    setSelectedProductImage({
      uri: dataUrl,
      name: webCrop.fileName,
      mimeType: webCrop.mimeType,
      file: undefined,
    });
    closeWebCropper();
  };

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const response = await fetchWithAuth("/api/products");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Failed to fetch products.");
      }
      setProducts(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSuppliers = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/suppliers");
      const payload = await response.json();
      if (response.ok) {
        setSuppliers(Array.isArray(payload.data) ? payload.data : []);
      }
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    getAuthSession().then((session) => {
      setRoleName(normalizeRole(session?.user?.role_name) || "CASHIER");
      setUserId(session?.user?.id_user || "");
    });
    fetchProducts();
    fetchSuppliers();
  }, [fetchProducts, fetchSuppliers]);

  const pickProductImage = async () => {
    try {
      const image = await pickSquareImageAsync({
        webMode: Platform.OS === "web" ? "raw" : "auto",
      });
      if (!image) return;

      if (Platform.OS === "web" && image.file) {
        const objectUrl = URL.createObjectURL(image.file);
        openWebCropperFromSource(objectUrl, image.name, image.mimeType, objectUrl);
        return;
      }

      if (Platform.OS === "web") {
        openWebCropperFromSource(image.uri, image.name, image.mimeType, image.uri.startsWith("blob:") ? image.uri : undefined);
        return;
      }

      setSelectedProductImage({
        uri: image.uri,
        name: image.name || `product-${Date.now()}.jpg`,
        mimeType: image.mimeType || null,
        file: undefined,
      });
    } catch {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage("Failed to pick image file.");
      setResultModalOpen(true);
    }
  };

  const openCreate = () => {
    setIsEdit(false);
    setEditingProductId("");
    setProductForm(EMPTY_PRODUCT_FORM);
    setSelectedProductImage(null);
    setFormOpen(true);
  };

  const openEdit = (product: Product) => {
    setIsEdit(true);
    setEditingProductId(product.id_product);
    setProductForm({
      id_supplier: product.id_supplier || "",
      barcode: product.barcode || "",
      product_name: product.product_name,
      description: product.description || "",
      selling_price: String(product.selling_price),
      minimum_stock: String(product.minimum_stock),
      product_image: product.product_image || "",
    });
    setSelectedProductImage(null);
    setFormOpen(true);
  };

  const closeProductForm = () => {
    if (saving) return;
    setFormOpen(false);
  };

  const submitProductForm = async () => {
    let actorId = userId;
    if (!actorId) {
      const session = await getAuthSession().catch(() => null);
      actorId = session?.user?.id_user || "";
      if (actorId) setUserId(actorId);
    }

    if (!actorId) {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage("Session user not found. Please re-login.");
      setResultModalOpen(true);
      return;
    }

    const { product_name, selling_price, minimum_stock } = productForm;
    if (!product_name.trim() || !selling_price.trim() || !minimum_stock.trim()) {
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage("Product Name, Selling Price, and Minimum Stock are required.");
      setResultModalOpen(true);
      return;
    }

    const price = Number(selling_price);
    const minStock = Number(minimum_stock);

    if (Number.isNaN(price) || price < 0 || Number.isNaN(minStock) || minStock < 0) {
      setResultStatus("error");
      setResultTitle("Validation Error");
      setResultMessage("Invalid numeric values for price or stock.");
      setResultModalOpen(true);
      return;
    }

    setSaving(true);
    try {
      let uploadedProductImageUrl = productForm.product_image;

      if (selectedProductImage) {
        const formData = new FormData();
        formData.append("id_user", actorId);
        
        if (selectedProductImage.file) {
          formData.append("image", selectedProductImage.file, selectedProductImage.name);
        } else if (Platform.OS === "web" && selectedProductImage.uri.startsWith("data:")) {
          const blob = await (await fetch(selectedProductImage.uri)).blob();
          formData.append("image", blob, selectedProductImage.name);
        } else {
          formData.append("image", {
            uri: selectedProductImage.uri,
            name: selectedProductImage.name,
            type: selectedProductImage.mimeType || "image/jpeg",
          } as unknown as Blob);
        }

        const uploadResponse = await fetchWithAuth("/api/products/upload-image", {
          method: "POST",
          body: formData,
        });
        const uploadPayload = await uploadResponse.json();
        if (!uploadResponse.ok) {
          throw new Error(uploadPayload?.error || uploadPayload?.message || "Failed to upload image.");
        }
        uploadedProductImageUrl = uploadPayload.data.image_url;
      }

      const endpoint = isEdit ? `/api/products/${editingProductId}` : "/api/products";
      const response = await fetchWithAuth(endpoint, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? {
                id_user: actorId,
                id_supplier: productForm.id_supplier || null,
                barcode: productForm.barcode.trim() || null,
                product_name: productForm.product_name.trim(),
                description: productForm.description.trim() || null,
                selling_price: price,
                minimum_stock: minStock,
                product_image: uploadedProductImageUrl,
              }
            : {
                id_user: actorId,
                id_supplier: productForm.id_supplier || null,
                barcode: productForm.barcode.trim() || null,
                product_name: productForm.product_name.trim(),
                description: productForm.description.trim() || null,
                selling_price: price,
                minimum_stock: minStock,
                product_image: uploadedProductImageUrl,
              }
        ),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Failed to save product.");
      }

      setFormOpen(false);
      fetchProducts();
      setResultStatus("success");
      setResultTitle("Action Completed");
      setResultMessage(isEdit ? "Product updated successfully." : "Product created successfully.");
      setResultModalOpen(true);
    } catch (err) {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage(err instanceof Error ? err.message : "Something went wrong.");
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
      if (actorId) setUserId(actorId);
    }

    if (!actorId) {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage("Session user not found. Please re-login.");
      setResultModalOpen(true);
      return;
    }

    try {
      const response = await fetchWithAuth(`/api/products/${product.id_product}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_user: actorId, is_active: nextState }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Failed to update product status.");
      }
      fetchProducts();
      setResultStatus("success");
      setResultTitle("Action Completed");
      setResultMessage(nextState === "N" ? "Product deactivated successfully." : "Product activated successfully.");
      setResultModalOpen(true);
    } catch (err) {
      setResultStatus("error");
      setResultTitle("Action Failed");
      setResultMessage(err instanceof Error ? err.message : "Something went wrong.");
      setResultModalOpen(true);
    }
  };

  const openConfirm = (type: PendingActionType, product?: Product) => {
    setPendingAction(type);
    setPendingProduct(product || null);
    setConfirmOpen(true);
  };

  const getConfirmMessage = () => {
    if (pendingAction === "create") return "Create this product?";
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

  const supplierOptions = useMemo(
    () =>
      suppliers.map((s) => ({
        label: s.supplier_name,
        value: s.id_supplier,
      })),
    [suppliers]
  );

  const supplierNameOptions = useMemo(
    () => ["ALL", ...Array.from(new Set(products.map((p) => p.supplier_name || "-"))).sort()],
    [products]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const minPrice = Number(minPriceFilter) || 0;
    const maxPrice = Number(maxPriceFilter) || Infinity;

    return products.filter((p) => {
      const matchSearch =
        !query ||
        `${p.product_code} ${p.product_name} ${p.barcode || ""} ${p.supplier_name || ""}`
          .toLowerCase()
          .includes(query);
      
      const matchSupplier = SupplierFilter === "ALL" || (p.supplier_name || "-") === SupplierFilter;

      const matchPrice = p.selling_price >= minPrice && p.selling_price <= (maxPrice || Infinity);

      let matchStock = true;
      if (stockFilter === "OUT_OF_STOCK") matchStock = p.available_stock <= 0;
      else if (stockFilter === "LOW_STOCK") matchStock = p.available_stock > 0 && p.available_stock <= p.minimum_stock;
      else if (stockFilter === "SAFE_STOCK") matchStock = p.available_stock > p.minimum_stock;

      return matchSearch && matchSupplier && matchPrice && matchStock;
    });
  }, [products, search, stockFilter, SupplierFilter, minPriceFilter, maxPriceFilter]);

  const activeProducts = useMemo(() => filtered.filter((p) => (p.is_active || "Y") === "Y"), [filtered]);
  const inactiveProducts = useMemo(() => filtered.filter((p) => p.is_active === "N"), [filtered]);

  const activeFilters = useMemo(() => {
    const items: { key: string; label: string; value: string; onClear: () => void }[] = [];
    if (stockFilter !== "ALL") {
      const label = stockFilter === "OUT_OF_STOCK" ? "Out" : stockFilter === "LOW_STOCK" ? "Low" : "Safe";
      items.push({ key: "stock", label: "Stock", value: label, onClear: () => setStockFilter("ALL") });
    }
    if (SupplierFilter !== "ALL") items.push({ key: "Supplier", label: "Supplier", value: SupplierFilter, onClear: () => setSupplierFilter("ALL") });
    if (minPriceFilter) items.push({ key: "minPrice", label: "Min Price", value: formatRupiah(Number(minPriceFilter)), onClear: () => setMinPriceFilter("") });
    if (maxPriceFilter) items.push({ key: "maxPrice", label: "Max Price", value: formatRupiah(Number(maxPriceFilter)), onClear: () => setMaxPriceFilter("") });
    return items;
  }, [stockFilter, SupplierFilter, minPriceFilter, maxPriceFilter]);

  const buildCurrentProductReportMeta = () => {
    const items = [];
    const trimmedSearch = search.trim();
    if (trimmedSearch) items.push({ label: "Search", value: trimmedSearch });
    if (stockFilter !== "ALL") items.push({ label: "Stock Filter", value: stockFilter });
    if (SupplierFilter !== "ALL") items.push({ label: "Supplier Filter", value: SupplierFilter });
    if (minPriceFilter) items.push({ label: "Min Price", value: formatRupiah(Number(minPriceFilter)) });
    if (maxPriceFilter) items.push({ label: "Max Price", value: formatRupiah(Number(maxPriceFilter)) });
    return items;
  };

  const handleSendEmailReport = async (recipientEmail: string, message: string, fullName: string, includeExcel: boolean) => {
    try {
      const isTable = emailTarget === "table";
      const generatedAt = new Date();
      const printHtml = isTable
        ? buildProductTableReportPrintHtml({
            rows: activeProducts,
            generatedAt,
            generatedBy: roleName,
            meta: buildCurrentProductReportMeta(),
          })
        : selectedProduct
          ? buildProductDetailReportPrintHtml({
              product: selectedProduct,
              batches: selectedProductBatches,
              generatedAt,
              generatedBy: roleName,
              meta: [{ label: "Active Batches", value: selectedProductBatches.length }],
            })
          : "";
      const payload = {
        recipient_email: recipientEmail,
        recipient_name: fullName,
        subject: isTable ? "Product List Report" : `Product Detail - ${selectedProduct?.product_name}`,
        message,
        format: "PDF",
        include_excel: includeExcel,
        title: isTable ? "Product Report" : "Product Detail",
        subtitle: isTable ? "Inventory product master data" : "",
        generated_by: roleName,
        print_html: printHtml,
        meta: isTable ? buildCurrentProductReportMeta() : [
          { label: "Product", value: selectedProduct?.product_name },
          { label: "Code", value: selectedProduct?.product_code },
          { label: "Barcode", value: selectedProduct?.barcode },
          { label: "Price", value: formatRupiah(selectedProduct?.selling_price || 0) },
        ],
        columns: isTable 
          ? productTableColumns.map(c => ({ key: c.key, title: c.title, align: c.align }))
          : [
            { key: "batch_code", title: "Batch" },
            { key: "batch_qty", title: "Qty" },
            { key: "expired_date", title: "Expired" },
          ],
        rows: isTable 
          ? activeProducts.map((row, idx) => {
              const rowData: any = {};
              productTableColumns.forEach(c => {
                rowData[c.key] = c.getValue(row, idx);
              });
              return rowData;
            })
          : selectedProductBatches.map(b => ({
              batch_code: b.batch_code,
              batch_qty: b.batch_qty,
              expired_date: b.expired_date ? new Date(b.expired_date).toISOString().slice(0, 10) : "-",
            })),
      };

      const response = await fetchWithAuth("/api/reports/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await withEmailPdfAttachment(payload)),
      });

      if (!response.ok) throw new Error("Failed to send email.");

      await logClientActivity({
        activityType: "SEND_REPORT_EMAIL",
        tableName: "tbl_products",
        description: "Sent product report via email.",
      });

      setResultStatus("success");
      setResultTitle("Email Sent");
      setResultMessage("Report has been sent successfully.");
      setResultModalOpen(true);
    } catch (error) {
      setResultStatus("error");
      setResultTitle("Send Failed");
      setResultMessage(error instanceof Error ? error.message : "An error occurred.");
      setResultModalOpen(true);
    }
  };

  const handlePrintProductTable = async () => {
    try {
      const html = buildProductTableReportPrintHtml({
        rows: activeProducts,
        generatedAt: new Date(),
        generatedBy: roleName,
        meta: buildCurrentProductReportMeta(),
      });
      await printReportHtml(html, {
        tableName: "tbl_products",
        description: "Printed product report.",
        fileName: buildReportPdfFileName({ reportKey: "products", variant: "table" }),
      });
    } catch (error) {
      showResult("error", "Print Failed", error instanceof Error ? error.message : "Failed to print product report.");
    }
  };

  const handleExportProductExcel = async () => {
    try {
      await downloadProductTableReportExcel({
        rows: activeProducts,
        generatedAt: new Date(),
        generatedBy: roleName,
        meta: buildCurrentProductReportMeta(),
      });
      await logClientActivity({
        activityType: "EXPORT_EXCEL",
        tableName: "tbl_products",
        description: "Exported product report as Excel.",
      });
    } catch (error) {
      showResult("error", "Export Failed", error instanceof Error ? error.message : "Failed to export product report.");
    }
  };

  const openProductDetail = async (product: Product) => {
    setDetailImageLoadError(false);
    try {
      const response = await fetchWithAuth(`/api/products/${product.id_product}/batches`);
      const payload = await response.json();
      if (response.ok) {
        setSelectedProductBatches(Array.isArray(payload.data) ? payload.data : []);
      }
      setSelectedProduct(product);
    } catch {
      setSelectedProductBatches([]);
      setSelectedProduct(product);
    }
  };

  const handlePrintProductDetail = async () => {
    if (!selectedProduct) return;
    try {
      const html = buildProductDetailReportPrintHtml({
        product: selectedProduct,
        batches: selectedProductBatches,
        generatedAt: new Date(),
        generatedBy: roleName,
        meta: [{ label: "Active Batches", value: selectedProductBatches.length }],
      });
      await printReportHtml(html, {
        tableName: "tbl_products",
        description: `Printed product detail: ${selectedProduct.product_name}`,
        fileName: buildReportPdfFileName({
          reportKey: "products",
          variant: "detail",
          documentNumber: selectedProduct.product_code,
        }),
      });
    } catch (error) {
      showResult("error", "Print Failed", error instanceof Error ? error.message : "Failed to print product detail.");
    }
  };

  const productColumns = useMemo<InventoryDataTableColumn<Product>[]>(
    () => [
      {
        key: "product_code",
        title: "Code",
        weight: 15,
        sortable: true,
        sortValue: (row) => row.product_code,
        render: (item) => <Text style={styles.rowCell}>{item.product_code}</Text>,
      },
      {
        key: "product_name",
        title: "Product Name",
        weight: 29,
        sortable: true,
        sortValue: (row) => row.product_name,
        render: (item) => (
          <Text style={styles.rowCell} numberOfLines={1}>
            {item.product_name}
          </Text>
        ),
      },
      {
        key: "barcode",
        title: "Barcode",
        weight: 17,
        sortable: true,
        sortValue: (row) => row.barcode || "",
        render: (item) => (
          <Text style={styles.rowCell} numberOfLines={1}>
            {item.barcode || "-"}
          </Text>
        ),
      },
      {
        key: "selling_price",
        title: "Selling Price",
        weight: 16,
        sortable: true,
        sortValue: (row) => row.selling_price,
        render: (item) => (
          <Text style={styles.rowCell}>{formatRupiah(item.selling_price)}</Text>
        ),
      },
      {
        key: "available_stock",
        title: "Stock",
        weight: 9,
        align: "center",
        sortable: true,
        sortValue: (row) => row.available_stock,
        render: (item) => {
          const isOut = item.available_stock <= 0;
          const isLow = !isOut && item.available_stock <= item.minimum_stock;
          return (
            <View style={styles.stockCellWrap}>
              <View
                style={[
                  styles.stockBadge,
                  isOut ? styles.stockBadgeOut : isLow ? styles.stockBadgeLow : styles.stockBadgeSafe,
                ]}
              >
                <Text
                  style={[
                    styles.stockBadgeText,
                    isOut ? styles.stockTextOut : isLow ? styles.stockTextLow : styles.stockTextSafe,
                  ]}
                >
                  {item.available_stock}
                </Text>
              </View>
            </View>
          );
        },
      },
      {
        key: "action",
        title: "Action",
        weight: 14,
        align: "center",
        render: (item, meta) => (
          <View style={[styles.actionWrap, openActionProductId === item.id_product && styles.actionWrapOpen]}>
            <InventoryRowActionsMenu
              open={openActionProductId === item.id_product}
              onToggle={() =>
                setOpenActionProductId((prev) => (prev === item.id_product ? null : item.id_product))
              }
              direction={meta.rowIndex >= meta.totalRows - 2 ? "up" : "down"}
            >
              <Pressable
                style={[styles.actionOutlineBtn, styles.actionOutlineInfo]}
                onPress={() => {
                  setOpenActionProductId(null);
                  openProductDetail(item);
                }}
              >
                <Text style={[styles.actionOutlineBtnText, styles.actionOutlineInfoText]}>Details</Text>
              </Pressable>
              {canManage ? (
                <>
                  <Pressable
                    style={[styles.actionOutlineBtn, styles.actionOutlineEdit]}
                    onPress={() => {
                      setOpenActionProductId(null);
                      openEdit(item);
                    }}
                  >
                    <Text style={[styles.actionOutlineBtnText, styles.actionOutlineEditText]}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionOutlineBtn, styles.actionOutlineDanger]}
                    onPress={() => {
                      setOpenActionProductId(null);
                      openConfirm("deactivate", item);
                    }}
                  >
                    <Text style={[styles.actionOutlineBtnText, styles.actionOutlineDangerText]}>Deactivate</Text>
                  </Pressable>
                </>
              ) : null}
            </InventoryRowActionsMenu>
          </View>
        ),
      },
    ],
    [canManage, openActionProductId]
  );

  const inactiveProductColumns = useMemo<InventoryDataTableColumn<Product>[]>(
    () => [
      {
        key: "product_code",
        title: "Code",
        weight: 15,
        render: (item) => <Text style={styles.rowCell}>{item.product_code}</Text>,
      },
      {
        key: "product_name",
        title: "Product Name",
        weight: 35,
        render: (item) => (
          <Text style={styles.rowCell} numberOfLines={1}>
            {item.product_name}
          </Text>
        ),
      },
      {
        key: "barcode",
        title: "Barcode",
        weight: 20,
        render: (item) => (
          <Text style={styles.rowCell} numberOfLines={1}>
            {item.barcode || "-"}
          </Text>
        ),
      },
      {
        key: "available_stock",
        title: "Stock",
        weight: 12,
        align: "center",
        render: (item) => <Text style={styles.rowCell}>{item.available_stock}</Text>,
      },
      {
        key: "action",
        title: "Action",
        weight: 18,
        align: "center",
        render: (item) =>
          canManage ? (
            <Pressable style={styles.activateButton} onPress={() => openConfirm("activate", item)}>
              <Text style={styles.activateButtonText}>Activate</Text>
            </Pressable>
          ) : null,
      },
    ],
    [canManage]
  );

  const batchDetailColumns = useMemo<InventoryDataTableColumn<ProductBatchSummary>[]>(
    () => [
      {
        key: "batch_code",
        title: "Batch Code",
        weight: 52,
        render: (row) => <Text style={styles.batchCell}>{row.batch_code}</Text>,
      },
      {
        key: "batch_qty",
        title: "Qty",
        weight: 12,
        align: "center",
        render: (row) => <Text style={styles.batchCell}>{row.batch_qty}</Text>,
      },
      {
        key: "expired_date",
        title: "Exp. Date",
        weight: 36,
        render: (row) => (
          <Text style={styles.batchCell}>
            {row.expired_date ? new Date(row.expired_date).toISOString().slice(0, 10) : "-"}
          </Text>
        ),
      },
    ],
    []
  );

  if (loading && products.length === 0) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#1d4ed8" />
        <Text style={styles.stateText}>Loading products...</Text>
      </View>
    );
  }

  if (errorMessage && products.length === 0) {
    return (
      <View style={styles.centerState}>
        <Feather name="alert-circle" size={48} color="#dc2626" />
        <Text style={styles.errorText}>{errorMessage}</Text>
        <Pressable style={styles.retryButton} onPress={fetchProducts}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <InventoryPageHeader
        title="Products"
        subtitle="Manage product master data, pricing, and minimum stock levels."
        action={
          <View style={styles.headerActionRow}>
            <ExportDropdownMenu
              onExportPdf={handlePrintProductTable}
              onExportExcel={handleExportProductExcel}
              onSendEmail={() => {
                setEmailTarget("table");
                setEmailModalOpen(true);
              }}       
            />
            {canManage ? (
              <>
                <Pressable style={styles.secondaryButton} onPress={() => setInactiveModalOpen(true)}>
                  <Text style={styles.secondaryButtonText}>Show Inactive</Text>
                </Pressable>
                <PrimaryActionButton label="Add Product" onPress={openCreate} />
              </>
            ) : null}
          </View>
        }
      />

      <View style={styles.filterCard}>
        <View style={styles.searchRow}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search product code, name, barcode, or supplier"
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
            setStockFilter("ALL");
            setSupplierFilter("ALL");
            setMinPriceFilter("");
            setMaxPriceFilter("");
            setDraftStockFilter("ALL");
            setDraftSupplierFilter("ALL");
            setDraftMinPriceFilter("");
            setDraftMaxPriceFilter("");
          }}
        />
      </View>

      <InventoryDataTable
        columns={productColumns}
        rows={activeProducts}
        rowKey={(item) => item.id_product}
        isRowActive={(item) => openActionProductId === item.id_product}
        emptyText="No products found."
      />

      <ResponsiveModal
        visible={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        maxWidthDesktop={980}
        maxWidthPhoneRatio={0.96}
        maxHeightDesktopRatio={0.9}
        maxHeightPhoneRatio={0.9}
        cardStyle={styles.detailModalCard}
      >
            <View style={styles.detailModalHeader}>
              <Text style={styles.modalTitle}>Product Detail</Text>
              <ExportDropdownMenu
                variant="detail"
                onExportPdf={handlePrintProductDetail}
                onSendEmail={() => {
                  setEmailTarget("detail");
                  setEmailModalOpen(true);
                }}
              />
            </View>
            <ScrollView
              style={[styles.productDetailScroll, { maxHeight: productDetailScrollMaxHeight }]}
              contentContainerStyle={styles.detailScrollContent}
              showsVerticalScrollIndicator={false}
            >
            <View style={[styles.metaGrid, isDetailCompact && styles.metaGridCompact]}>
              <View style={[styles.productImageWrap, isDetailCompact ? styles.productImageWrapCompact : styles.productImageWrapDesktop, isDetailCompact ? { maxHeight: Math.min(180, height * 0.26) } : null]}>
                {selectedProduct?.product_image && !detailImageLoadError ? (
                  <Image source={{ uri: selectedProduct.product_image }} style={styles.productImage} contentFit="cover" onError={() => setDetailImageLoadError(true)} />
                ) : (
                  <Image source={PRODUCT_PLACEHOLDER} style={styles.productImage} contentFit="cover" />
                )}
              </View>

              <View style={[styles.metaStack, isDetailCompact && styles.metaStackCompact]}>
                <View style={[styles.metaCard, isDetailCompact && styles.metaCardCompact]}>
                  <Text style={styles.metaLabel}>Product Code</Text>
                  <Text style={styles.metaValue}>{selectedProduct?.product_code || "-"}</Text>
                </View>
                <View style={[styles.metaCard, isDetailCompact && styles.metaCardCompact]}>
                  <Text style={styles.metaLabel}>Product Name</Text>
                  <Text style={styles.metaValue}>{selectedProduct?.product_name || "-"}</Text>
                </View>
                <View style={[styles.metaCard, isDetailCompact && styles.metaCardCompact]}>
                  <Text style={styles.metaLabel}>Supplier</Text>
                  <Text style={styles.metaValue}>{selectedProduct?.supplier_name || "-"}</Text>
                </View>
                <View style={[styles.metaCard, isDetailCompact && styles.metaCardCompact]}>
                  <Text style={styles.metaLabel}>Status</Text>
                  <Text style={styles.metaValue}>{selectedProduct?.is_active === "N" ? "Inactive" : "Active"}</Text>
                </View>
                <View style={[styles.metaCard, isDetailCompact && styles.metaCardCompact]}>
                  <Text style={styles.metaLabel}>Barcode</Text>
                  <Text style={styles.metaValue}>{selectedProduct?.barcode || "-"}</Text>
                </View>
                <View style={[styles.metaRow, isDetailCompact && styles.metaRowCompact]}>
                  <View style={[styles.metaCardHalf, isDetailCompact && styles.metaCardCompact]}>
                    <Text style={styles.metaLabel}>Price</Text>
                    <Text style={styles.metaValue}>{formatRupiah(selectedProduct?.selling_price || 0)}</Text>   
                  </View>
                  <View style={[styles.metaCardHalf, isDetailCompact && styles.metaCardCompact]}>
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

            <View style={styles.batchTableWrap}>
              <InventoryDataTable
                columns={batchDetailColumns}
                rows={selectedProductBatches}
                rowKey={(batch) => batch.id_product_batch}
                emptyText="No batch data for this product."
                enablePagination={false}
                minWidth={520}
              />
            </View>
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
                    onChangeText={(value) => setProductForm((prev) => ({ ...prev, barcode: value.replace(/[^0-9]/g, "") }))}
                    keyboardType="numeric"
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

      <SendEmailModal
        visible={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        reportTitle={emailTarget === "table" ? "Product List" : "Product Detail"}
        onSend={handleSendEmailReport}
      />

      {webCrop ? (
        <Modal visible={!!webCrop} transparent animationType="fade" onRequestClose={closeWebCropper}>
          <View style={styles.cropOverlayRoot}>
            <View style={styles.cropOverlayBackdrop} />
            <View style={[styles.cropOverlayCard, { width: cropModalWidth, maxHeight: Math.max(320, height - 32) }]}>
              <View style={styles.cropModalHeader}>
                <Text style={styles.modalTitle}>Crop Product Photo</Text>
                <Text style={styles.cropModalSubtitle}>Drag the image, zoom in or out, then save the square crop.</Text>
              </View>

              <View
                style={styles.cropViewport}
                onLayout={(event) => {
                  const nextSize = Math.floor(event.nativeEvent.layout.width);
                  if (nextSize > 0) setCropViewportSize(nextSize);
                }}
              >
                {webCrop
                    ? (() => {
                      const fitScale = Math.min(
                        cropViewportSize / Math.max(1, webCrop.naturalWidth || cropViewportSize),
                        cropViewportSize / Math.max(1, webCrop.naturalHeight || cropViewportSize)
                      );
                      const displayWidth = Math.max(1, (webCrop.naturalWidth || cropViewportSize) * fitScale * cropTransform.scale);
                      const displayHeight = Math.max(1, (webCrop.naturalHeight || cropViewportSize) * fitScale * cropTransform.scale);
                      const edgeSize = Math.max(0, (cropViewportSize - cropBoxSize) / 2);
                      return (
                        <View
                          style={styles.cropCanvas}
                          // @ts-expect-error - web specific
                          onMouseDown={(event: any) => {
                            if (Platform.OS !== "web") return;
                            event.preventDefault?.();
                            beginCropDrag(event.nativeEvent.clientX, event.nativeEvent.clientY);
                          }}
                          onTouchStart={(event) => {
                            const touch = event.nativeEvent.touches?.[0] as any;
                            if (!touch) return;
                            beginCropDrag(touch.clientX, touch.clientY);
                          }}
                          onTouchMove={(event) => {
                            const touch = event.nativeEvent.touches?.[0] as any;
                            if (!touch || !cropDragRef.current.active) return;
                            cropDragRef.current = {
                              active: true,
                              lastX: touch.clientX,
                              lastY: touch.clientY,
                            };
                            updateCropTranslation(
                              cropGestureRef.current.startTranslateX + (touch.clientX - cropGestureRef.current.startClientX),
                              cropGestureRef.current.startTranslateY + (touch.clientY - cropGestureRef.current.startClientY)
                            );
                          }}
                          onTouchEnd={() => {
                            cropDragRef.current.active = false;
                            setIsCropDragging(false);
                          }}
                          onWheel={(event: any) => {
                            if (!webCrop) return;
                            event.preventDefault?.();
                            const delta = event.nativeEvent?.deltaY ?? event.deltaY ?? 0;
                            const nextScale = delta > 0
                              ? Math.max(0.2, Number((cropTransformRef.current.scale - 0.08).toFixed(2)))       
                              : Math.min(3, Number((cropTransformRef.current.scale + 0.08).toFixed(2)));        
                            setCropScale(nextScale);
                          }}
                        >
                          <Image
                            source={{ uri: webCrop.sourceUri }}
                            style={[
                              styles.cropImage,
                              {
                                width: displayWidth,
                                height: displayHeight,
                                left: (cropViewportSize - displayWidth) / 2 + cropTransform.translateX,
                                top: (cropViewportSize - displayHeight) / 2 + cropTransform.translateY,
                              },
                            ]}
                            resizeMode="contain"
                          />

                          <View pointerEvents="none" style={[styles.cropShadeTop, { height: edgeSize }]} />     
                          <View pointerEvents="none" style={[styles.cropShadeBottom, { height: edgeSize }]} />  
                          <View pointerEvents="none" style={[styles.cropShadeLeft, { width: edgeSize, top: edgeSize, height: cropBoxSize }]} />
                          <View pointerEvents="none" style={[styles.cropShadeRight, { width: edgeSize, top: edgeSize, height: cropBoxSize }]} />
                          <View
                            pointerEvents="none"
                            style={[
                              styles.cropBoxFrame,
                              {
                                width: cropBoxSize,
                                height: cropBoxSize,
                                left: edgeSize,
                                top: edgeSize,
                              },
                            ]}
                          />
                        </View>
                      );
                    })()
                  : null}
              </View>

              <View style={styles.cropModalFooter}>
                <Pressable style={styles.formCancelBtn} onPress={closeWebCropper} disabled={saving}>
                  <Text style={styles.formCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.formSaveBtn, saving && styles.saveButtonDisabled]} onPress={applyWebCrop} disabled={saving}>
                  <Text style={styles.formSaveText}>{saving ? "Saving..." : "Use Crop"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f6fb" },
  content: { padding: 14, gap: 14 },
  headerActionRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  exportIconButton: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center" },
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
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
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
  detailModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },  
  detailPrintButton: { minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  detailPrintButtonText: { color: "#1d4ed8", fontSize: 12, fontWeight: "700" },
  detailScroll: {
    width: "100%",
  },
  productDetailScroll: {
    width: "100%",
  },
  detailScrollContent: {
    gap: 10,
    paddingBottom: 6,
  },
  notesCard: { borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", padding: 10, gap: 4 },
  metaGrid: { flexDirection: "row", gap: 12, alignItems: "stretch", justifyContent: "space-between", width: "100%" },
  metaGridCompact: { flexDirection: "column", alignItems: "stretch" },
  metaStack: { flex: 1, gap: DETAIL_ROW_GAP, width: "100%" },
  metaStackCompact: { flex: 0 },
  productImageWrap: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#dbe3ee",
    flexShrink: 0,
  },
  productImageWrapDesktop: { width: "36%", aspectRatio: 4 / 3, alignSelf: "flex-start" },
  productImageWrapCompact: { width: "100%", aspectRatio: 16 / 9, alignSelf: "center" },
  productImage: { width: "100%", height: "100%", borderRadius: 10 },
  metaCard: { borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", padding: 8, gap: 2, height: DETAIL_ROW_HEIGHT, justifyContent: "center" },
  metaCardCompact: { minHeight: 40, height: "auto" },
  metaLabel: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  metaValue: { color: "#0f172a", fontSize: 13, fontWeight: "700" },
  metaRow: { flexDirection: "row", gap: 8 },
  metaRowCompact: { flexDirection: "row" },
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
  batchTableWrap: { minHeight: 120 },
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
  cropOverlayRoot: { position: "absolute", zIndex: 10000, top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  cropOverlayBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15,23,42,0.85)" },
  cropOverlayCard: { backgroundColor: "#ffffff", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" },
  cropModalHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  cropModalSubtitle: { color: "#64748b", fontSize: 13, marginTop: 4 },
  cropViewport: { width: "100%", aspectRatio: 1, backgroundColor: "#0f172a", position: "relative", overflow: "hidden" },
  cropCanvas: { flex: 1, position: "relative" },
  cropImage: { position: "absolute" },
  cropShadeTop: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)" },        
  cropShadeBottom: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)" },  
  cropShadeLeft: { position: "absolute", left: 0, backgroundColor: "rgba(0,0,0,0.5)" },
  cropShadeRight: { position: "absolute", right: 0, backgroundColor: "rgba(0,0,0,0.5)" },
  cropBoxFrame: { position: "absolute", borderWidth: 2, borderColor: "#ffffff" },
  cropModalFooter: { padding: 16, flexDirection: "row", justifyContent: "flex-end", gap: 10, borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  saveButtonDisabled: { opacity: 0.6 },
});
