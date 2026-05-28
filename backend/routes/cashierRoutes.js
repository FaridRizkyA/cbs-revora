const express = require("express");
const {
  getBatches,
  checkoutSale,
  getMembers,
  getProductsBySupplier,
  getProductBatchesByProduct,
  getSuppliers,
  getProducts,
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
  createSupplier,
  updateSupplier,
  setSupplierActiveState,
  createProduct,
  uploadProductImage,
  updateProduct,
  setProductActiveState,
} = require("../modules/cashier/cashierController");

const router = express.Router();

router.get("/products", getProducts);
router.post("/products/upload-image", uploadProductImage);
router.post("/products", createProduct);
router.put("/products/:idProduct", updateProduct);
router.patch("/products/:idProduct/status", setProductActiveState);
router.get("/products/:idProduct/batches", getProductBatchesByProduct);
router.get("/batches", getBatches);
router.get("/stock-movements", getStockMovements);
router.get("/stock-adjustments", getStockAdjustments);
router.post("/stock-adjustments", createStockAdjustment);
router.get("/stock-out-manual-documents", getStockOutManualDocuments);
router.get("/stock-out-manual-documents/:idStockOutManual", getStockOutManualDocumentById);
router.post("/stock-out-manual", createStockOutManual);
router.post("/stock-in", createStockIn);
router.get("/stock-in-documents", getStockInDocuments);
router.get("/stock-in-documents/:idStockIn", getStockInDocumentById);
router.get("/stock-out-documents", getStockOutDocuments);
router.get("/stock-out-documents/:idStockOut", getStockOutDocumentById);
router.get("/suppliers", getSuppliers);
router.post("/suppliers", createSupplier);
router.put("/suppliers/:idSupplier", updateSupplier);
router.patch("/suppliers/:idSupplier/status", setSupplierActiveState);
router.get("/suppliers/:idSupplier/products", getProductsBySupplier);
router.get("/members", getMembers);
router.post("/sales/checkout", checkoutSale);

module.exports = router;

