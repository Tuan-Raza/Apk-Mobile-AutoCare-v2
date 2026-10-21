const express = require("express");
const router = express.Router();
const {
    getUserProfile,
    updateUserProfile,
    changePassword,
    deleteAccount,
} = require("../controllers/userController");

router.get("/profile/:id", getUserProfile);
router.put("/profile/:id", updateUserProfile);
router.put("/change-password/:id", changePassword);
router.post("/change-password/:id", changePassword);
router.delete("/:id", deleteAccount);

module.exports = router;
