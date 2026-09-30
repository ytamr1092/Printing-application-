// Compatibility shim for pdf-lib 1.x's tslib 1.x ESM bridge under Metro.
// It exposes the helper exports both as named properties and as `default`.
const tslib = require("tslib");
module.exports = { ...tslib, default: tslib };
