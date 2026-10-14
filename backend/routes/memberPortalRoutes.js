const express = require("express");
const {
  getMemberAccess,
  getMemberOverview,
  listMemberTransactions,
  getMemberTransactionDetail,
  listMemberSavings,
  listMemberShuHistory,
} = require("../modules/memberPortal/memberPortalController");

const { requireAccess } = require("../utils/accessPolicy");

const router = express.Router();

router.get("/member/access", requireAccess("authenticated"), getMemberAccess);
router.get("/member/overview", requireAccess("authenticated"), getMemberOverview);
router.get("/member/transactions", requireAccess("authenticated"), listMemberTransactions);
router.get("/member/transactions/:idSale", requireAccess("authenticated"), getMemberTransactionDetail);
router.get("/member/shu-history", requireAccess("authenticated"), listMemberShuHistory);

module.exports = router;
