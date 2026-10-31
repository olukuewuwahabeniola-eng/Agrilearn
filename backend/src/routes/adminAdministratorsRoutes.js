const express = require("express");
const {
  listAdministrators,
  createAdministrator,
  updateAdministrator,
  resetAdministratorAccess,
  deleteAdministrator,
} = require("../controllers/adminAdministratorsController");
const { requireSuperAdmin } = require("../utils/adminAccess");

const router = express.Router();

router.use(requireSuperAdmin);

router.get("/", listAdministrators);
router.post("/", createAdministrator);
router.patch("/:id", updateAdministrator);
router.post("/:id/reset-access", resetAdministratorAccess);
router.delete("/:id", deleteAdministrator);

module.exports = router;
