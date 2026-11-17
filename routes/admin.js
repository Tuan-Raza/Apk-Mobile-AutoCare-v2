const express = require("express");
const router = express.Router();
const {
    getDashboardStats,
    getAllBookings,
    updateBookingStatus,
    getAllPelanggan,
    createPelanggan,
    getAllKendaraan,
    getAllLayanan,
    createLayanan,
    getAllBengkel,
    createBengkel,
    getLaporan,
} = require("../controllers/adminController");

// Dashboard
router.get("/dashboard", getDashboardStats);

// Bookings
router.get("/bookings", getAllBookings);
router.put("/bookings/:id/status", updateBookingStatus);

// Pelanggan (Customers)
router.get("/pelanggan", getAllPelanggan);
router.post("/pelanggan", createPelanggan);

// Kendaraan (Vehicles)
router.get("/kendaraan", getAllKendaraan);

// Layanan (Services)
router.get("/layanan", getAllLayanan);
router.post("/layanan", createLayanan);

// Bengkel (Workshops)
router.get("/bengkel", getAllBengkel);
router.post("/bengkel", createBengkel);

// Laporan (Reports)
router.get("/laporan", getLaporan);

module.exports = router;
