const express = require("express");
const {
  getBatches,
  getProductsBySupplier,
  getProductBatchesByProduct,
  getSuppliers,
  getProducts,
  createSupplier,
  updateSupplier,
  setSupplierActiveState,
  createProduct,
  uploadProductImage,
  updateProduct,
  setProductActiveState,
} = require("../modules/inventory");

const {
  getStockMovements,
  getStockAdjustments,
  createStockAdjustment,
  getStockOutManualDocuments,
  getStockOutManualDocumentById,
  createStockOutManual,
  createStockIn,
  getStockInDocuments,
  getStockInDocumentById,
  getStockOutDocuments,
  getStockOutDocumentById,
  getSalesItems,
  getSalesCosts,
} = require("../modules/stock_movements");

const {
  checkoutSale,
  getMembers,
  getReceiptEmailStatus,
} = require("../modules/sales");

const { requireAccess } = require("../utils/accessPolicy");

const router = express.Router();

router.get("/products", requireAccess("backOffice"), getProducts);
router.post("/products/upload-image", requireAccess("manageInventoryMaster"), uploadProductImage);
router.post("/products", requireAccess("manageInventoryMaster"), createProduct);
router.put("/products/:idProduct", requireAccess("manageInventoryMaster"), updateProduct);
router.patch("/products/:idProduct/status", requireAccess("manageInventoryMaster"), setProductActiveState);
router.get("/products/:idProduct/batches", requireAccess("backOffice"), getProductBatchesByProduct);
router.get("/batches", requireAccess("backOffice"), getBatches);
router.get("/stock-movements", requireAccess("backOffice"), getStockMovements);
router.get("/stock-adjustments", requireAccess("backOffice"), getStockAdjustments);
router.post("/stock-adjustments", requireAccess("insertStockMovement"), createStockAdjustment);
router.get("/stock-out-manual-documents", requireAccess("backOffice"), getStockOutManualDocuments);
router.get("/stock-out-manual-documents/:idStockOutManual", requireAccess("backOffice"), getStockOutManualDocumentById);
router.post("/stock-out-manual", requireAccess("insertStockMovement"), createStockOutManual);
router.post("/stock-in", requireAccess("insertStockMovement"), createStockIn);
router.get("/stock-in-documents", requireAccess("backOffice"), getStockInDocuments);
router.get("/stock-in-documents/:idStockIn", requireAccess("backOffice"), getStockInDocumentById);
router.get("/stock-out-documents", requireAccess("backOffice"), getStockOutDocuments);
router.get("/stock-out-documents/:idStockOut", requireAccess("backOffice"), getStockOutDocumentById);
router.get("/sales-items", requireAccess("backOffice"), getSalesItems);
router.get("/sales-costs", requireAccess("backOffice"), getSalesCosts);
router.get("/suppliers", requireAccess("backOffice"), getSuppliers);
router.post("/suppliers", requireAccess("manageInventoryMaster"), createSupplier);
router.put("/suppliers/:idSupplier", requireAccess("manageInventoryMaster"), updateSupplier);
router.patch("/suppliers/:idSupplier/status", requireAccess("manageInventoryMaster"), setSupplierActiveState);
router.get("/suppliers/:idSupplier/products", requireAccess("backOffice"), getProductsBySupplier);
router.get("/members", requireAccess("backOffice"), getMembers);
router.post("/sales/checkout", requireAccess("cashierMode"), checkoutSale);
router.get("/sales/:idSale/receipt-email-status", requireAccess("backOffice"), getReceiptEmailStatus);

module.exports = router;

