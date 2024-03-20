const express = require("express");
const router = express.Router();
const { body } = require("express-validator");

const authController = require("../controller/auth");

router.post(
  "/signup",
  [
    body("lastName", "last name should not be empty").not().isEmpty(),
    body("email", "email is invalid").isEmail().not().isEmpty(),
    body("password", "password should not be less than 8 characters long")
      .isLength({ min: 8 })
      .not()
      .isEmpty(),
    body("phoneNumber", "number should not be empty").not().isEmpty(),
    body("gender", "select a gender").not().isEmpty(),
  ],
  authController.userSignup
);
router.post(
  "/signin",
  [
    body("email", "email is invalid").isEmail().not().isEmpty(),
    body("password", "password should not be less than 8 characters long")
      .isLength({ min: 8 })
      .not()
      .isEmpty(),
  ],
  authController.userLogin
);
router.post(
  "/password-reset",
  [body("email", "Please input a valid email").isEmail().not().isEmpty()],
  authController.passwordReset
);
router.get("/password-reset/:email", authController.getPasswordToken);
router.post("/password-reset/:resetToken", authController.passwordChange);

module.exports = router;
