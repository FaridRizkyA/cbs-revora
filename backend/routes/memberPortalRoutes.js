const express = require("express");
const {
  getMemberAccess,
  getMemberOverview,
  listMemberTransactions,
  getMemberTransactionDetail,
  listMemberSavings,
  listMemberShuHistory,
} = require("../modules/memberPortal/memberPortalController");

const router = express.Router();

router.get("/member/access", getMemberAccess);
router.get("/member/overview", getMemberOverview);
router.get("/member/transactions", listMemberTransactions);
router.get("/member/transactions/:idSale", getMemberTransactionDetail);
router.get("/member/shu-history", listMemberShuHistory);

module.exports = router;
