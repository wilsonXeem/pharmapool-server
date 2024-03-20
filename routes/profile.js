const express = require("express")
const router = express.Router()
const multer = require("multer")

const upload = multer({ dest: "./util/images" });

const profileController = require("../controller/profile")

router.get("/timeline/:userId", profileController.getUserTImeline)

router.get("/details/:userId", profileController.getProfileDetails)
router.patch("/details/update/:userId", profileController.updateProfileDetails)
router.patch("/details/:userId/fullname", profileController.updateUserFullname)

router.post("/details/:userId/image",upload.single("file"), profileController.changeImage)

module.exports = router
