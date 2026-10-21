const express = require("express");

const router = express.Router();

const {
    getBengkel,
    getKendaraanUser,
    getLayanan,
    getJadwal,
    createBooking,
    getBookingUser,
    getBookingDetail,
    cancelBooking,
    updateBooking,
    deleteBooking,
} = require("../controllers/bookingController");


// ==========================================
// BENGKEL
// ==========================================
router.get("/bengkel", getBengkel);


// ==========================================
// KENDARAAN USER
// ==========================================
router.get("/kendaraan/:userId", getKendaraanUser);


// ==========================================
// LAYANAN
// ==========================================
router.get("/layanan", getLayanan);


// ==========================================
// JADWAL
// ==========================================
router.get("/jadwal/:bengkelId/:tanggal", getJadwal);


// ==========================================
// BUAT BOOKING
// ==========================================
router.post("/", createBooking);


// ==========================================
// RIWAYAT BOOKING USER
// ==========================================
router.get("/user/:userId", getBookingUser);


// ==========================================
// BATALKAN BOOKING (CANCEL)
// ==========================================
router.put("/:id/cancel", cancelBooking);
router.put("/cancel/:id", cancelBooking);


// ==========================================
// UPDATE BOOKING (Catatan/Keluhan)
// ==========================================
router.put("/:id", updateBooking);


// ==========================================
// HAPUS BOOKING (DELETE)
// ==========================================
router.delete("/:id", deleteBooking);


// ==========================================
// DETAIL BOOKING
// ==========================================
router.get("/:id", getBookingDetail);


module.exports = router;