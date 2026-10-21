const express = require("express");

const router = express.Router();

const {
    getKendaraan,
    tambahKendaraan,
    updateKendaraan,
    hapusKendaraan,
} = require("../controllers/kendaraanController");


// GET semua kendaraan milik user
router.get("/user/:userId", getKendaraan);

// POST tambah kendaraan
router.post("/", tambahKendaraan);

// PUT update kendaraan
router.put("/:id", updateKendaraan);

// DELETE kendaraan
router.delete("/:id", hapusKendaraan);


module.exports = router;