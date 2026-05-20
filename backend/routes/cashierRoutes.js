const express = require("express");
const {
  checkoutSale,
  getMembers,
  getProducts,
} = require("../modules/cashier/cashierController");

const router = express.Router();

router.get("/products", getProducts);
router.get("/members", getMembers);
router.post("/sales/checkout", checkoutSale);

module.exports = router;
