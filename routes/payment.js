const express = require("express");
const router = express.Router();

const {
    createPayment,
    getPaymentStatus,
    paymentNotification,
    submitManualPayment,
    getPaymentByBookingId,
    verifyManualPayment,
} = require("../controllers/paymentController");

// Detail data pembayaran berdasarkan booking
router.get("/booking/:bookingId", getPaymentByBookingId);

// Upload bukti transfer & konfirmasi pembayaran manual (QRIS, DANA, SeaBank, Bayar di Tempat)
router.post("/manual", submitManualPayment);

// Verifikasi / ACC status pembayaran (Admin / Test ACC)
router.post("/:orderId/verify", verifyManualPayment);
router.post("/verify", verifyManualPayment);

// Membuat transaksi Midtrans
router.post("/create", createPayment);

// Cek status pembayaran
router.get("/:orderId/status", getPaymentStatus);

// Notification dari Midtrans
router.post("/notification", paymentNotification);

module.exports = router;
