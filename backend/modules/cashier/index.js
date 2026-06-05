const masterController = require("./controllers/masterController");
const movementController = require("./controllers/movementController");
const salesController = require("./controllers/salesController");

module.exports = {
  ...masterController,
  ...movementController,
  ...salesController,
};
