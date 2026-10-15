// Stock is derived from movements: OUT reduces it, IN (stock in, adjustment increase) adds to it.
// Use as SUM(${SIGNED_QUANTITY_SQL}) with tbl_stock_movements aliased as "sm".
const SIGNED_QUANTITY_SQL = "CASE WHEN sm.movement_type = 'OUT' THEN -sm.quantity ELSE sm.quantity END";

module.exports = {
  SIGNED_QUANTITY_SQL,
};
