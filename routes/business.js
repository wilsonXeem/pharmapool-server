const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "./util/images" });

const businessController = require("../controller/business");

router.post(
  "/demand/:_id",
  upload.single("file"),
  businessController.createProductDemand
);
router.post("/demand/user/:_id", businessController.addInterestedPartners);
router.delete("/demand/user/:_id", businessController.removeInterestedPartner);
router.patch("/demand/status/:_id", businessController.changeDemandStatus);

router.post(
  "/jointpurchase/:_id",
  upload.single("file"),
  businessController.createJointPurchase
);
router.post(
  "/jointpurchase/user/:_id",
  businessController.addJointPurchasePartner
);
router.delete(
  "/jointpurchase/user/:_id",
  businessController.removeJointPurchasePartner
);
router.patch(
  "/jointpurchase/status/:_id",
  businessController.changeJointPurchaseStatus
);
router.post(
  "/jointPurchase/group/:_id",
  businessController.createJointPurchaseGroup
);

router.post(
  "/saleondiscount/create/:_id",
  businessController.createSaleAtDiscount
);
router.post(
  "/saleondiscount/:_id",
  businessController.addPartnerToSaleAtDiscount
);
router.delete(
  "/saleondiscount/:_id",
  businessController.removeInterestedPartnerFromSaleAtDiscount
);
router.patch(
  "/saleondiscount/:_id",
  businessController.changeSaleAtDiscountStatus
);

router.post(
  "/pharmacy/:_id",
  upload.single("file"),
  businessController.registerPharmacy
);
router.patch(
  "/pharmacy/:_id",
  upload.array("file"),
  businessController.addPharmacyImages
);
router.delete("/pharmacy/:_id", businessController.deletePharmacy);

module.exports = router;
