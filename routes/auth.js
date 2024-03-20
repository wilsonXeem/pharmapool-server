const express = require("express");
const router = express.Router();
const { body } = require("express-validator");

const authController = require("../controller/auth");

router.post(
  "/signup",
  authController.userSignup
);
router.post(
  "/signin",
  authController.userLogin
);
router.post(
  "/password-reset",
  authController.passwordReset
);
router.get("/password-reset/:email", authController.getPasswordToken);
router.post("/password-reset/:resetToken", authController.passwordChange);

module.exports = router;
