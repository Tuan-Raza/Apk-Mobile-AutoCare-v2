const express = require("express");
const router = express.Router();
const {
    register,
    verifyEmail,
    resendVerification,
    login,
    forgotPassword,
    verifyResetOTP,
    resetPassword,
} = require("../controllers/authController");

router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOTP);
router.post("/reset-password", resetPassword);

module.exports = router;
