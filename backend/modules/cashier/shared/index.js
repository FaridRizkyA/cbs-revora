const auth = require("./auth");
const validators = require("./validators");
const numbering = require("./numbering");
const codes = require("./codes");

module.exports = {
  ...auth,
  ...validators,
  ...numbering,
  ...codes,
};
