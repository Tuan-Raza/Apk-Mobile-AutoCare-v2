const { db } = require("../config/database");

// =========================
// GET KENDARAAN USER
// =========================
const getKendaraan = async (req, res) => {
    try {
        const { userId } = req.params;

        const [rows] = await db.query(
            `SELECT 
                id,
                user_id,
                merek,
                model,
                tahun,
                nomor_polisi,
                kilometer,
                created_at
             FROM kendaraan
             WHERE user_id = ?
             ORDER BY id DESC`,
            [userId]
        );

        res.json({
            success: true,
            data: rows,
        });
    } catch (error) {
        console.error("Get Kendaraan Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data kendaraan",
        });
    }
};


// =========================
// TAMBAH KENDARAAN
// =========================
const tambahKendaraan = async (req, res) => {
    try {
        const {
            userId,
            merek,
            model,
            tahun,
            nomorPolisi,
            kilometer,
        } = req.body;

        if (
            !userId ||
            !merek ||
            !model ||
            !nomorPolisi
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "User ID, merek, model, dan nomor polisi wajib diisi",
            });
        }

        const [result] = await db.query(
            `INSERT INTO kendaraan
            (
                user_id,
                merek,
                model,
                tahun,
                nomor_polisi,
                kilometer
            )
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                userId,
                merek,
                model,
                tahun || null,
                nomorPolisi,
                kilometer || 0,
            ]
        );

        res.status(201).json({
            success: true,
            message: "Kendaraan berhasil ditambahkan",
            kendaraanId: result.insertId,
        });
    } catch (error) {
        console.error("Tambah Kendaraan Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menambahkan kendaraan",
        });
    }
};


// =========================
// UPDATE KENDARAAN
// =========================
const updateKendaraan = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            merek,
            model,
            tahun,
            nomorPolisi,
            nomor_polisi,
            kilometer,
        } = req.body;

        const nopol = (nomorPolisi || nomor_polisi || "").trim();

        if (!merek || !model || !nopol) {
            return res.status(400).json({
                success: false,
                message: "Merek, model, dan nomor polisi wajib diisi",
            });
        }

        const [result] = await db.query(
            `UPDATE kendaraan
             SET
                merek = ?,
                model = ?,
                tahun = ?,
                nomor_polisi = ?,
                kilometer = ?,
                updated_at = NOW()
             WHERE id = ?`,
            [
                merek.trim(),
                model.trim(),
                tahun ? String(tahun).trim() : null,
                nopol,
                kilometer !== undefined && kilometer !== null ? Number(kilometer) : 0,
                id,
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Kendaraan tidak ditemukan",
            });
        }

        res.json({
            success: true,
            message: "Kendaraan berhasil diperbarui",
        });
    } catch (error) {
        console.error("Update Kendaraan Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal memperbarui kendaraan",
        });
    }
};


// =========================
// HAPUS KENDARAAN
// =========================
const hapusKendaraan = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query(
            "DELETE FROM kendaraan WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Kendaraan tidak ditemukan",
            });
        }

        res.json({
            success: true,
            message: "Kendaraan berhasil dihapus",
        });
    } catch (error) {
        console.error("Hapus Kendaraan Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menghapus kendaraan",
        });
    }
};


module.exports = {
    getKendaraan,
    tambahKendaraan,
    updateKendaraan,
    hapusKendaraan,
};