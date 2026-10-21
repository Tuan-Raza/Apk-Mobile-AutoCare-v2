const { db } = require("../config/database");
const fs = require("fs");
const path = require("path");
const midtransClient = require("midtrans-client");

// =====================================================
// MIDTRANS SNAP CONFIG
// =====================================================
const snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
    serverKey: process.env.MIDTRANS_SERVER_KEY || "dummy-server-key",
    clientKey: process.env.MIDTRANS_CLIENT_KEY || "dummy-client-key",
});

// =====================================================
// GET PAYMENT BY BOOKING ID
// GET /api/payment/booking/:bookingId
// =====================================================
const getPaymentByBookingId = async (req, res) => {
    try {
        const { bookingId } = req.params;

        if (!bookingId) {
            return res.status(400).json({
                success: false,
                message: "Booking ID wajib disertakan",
            });
        }

        const [bookingRows] = await db.query(
            `SELECT
                b.*,
                u.nama AS user_nama,
                u.email AS user_email,
                u.no_hp AS user_no_hp,
                CONCAT(COALESCE(k.merek, ''), ' ', COALESCE(k.model, '')) AS nama_kendaraan,
                k.merek,
                k.model,
                k.nomor_polisi,
                w.nama_bengkel,
                w.alamat AS alamat_bengkel,
                w.no_hp AS telp_bengkel
             FROM booking b
             LEFT JOIN users u ON b.user_id = u.id
             LEFT JOIN kendaraan k ON b.kendaraan_id = k.id
             LEFT JOIN bengkel w ON b.bengkel_id = w.id
             WHERE b.id = ?
             LIMIT 1`,
            [bookingId]
        );

        if (bookingRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Data booking tidak ditemukan",
            });
        }

        const booking = bookingRows[0];

        // Ambil item layanan
        const [detailRows] = await db.query(
            `SELECT
                bd.*,
                l.nama_layanan
             FROM booking_detail bd
             LEFT JOIN layanan l ON bd.layanan_id = l.id
             WHERE bd.booking_id = ?`,
            [bookingId]
        );

        // Ambil payment terbaru
        const [paymentRows] = await db.query(
            `SELECT *
             FROM payments
             WHERE booking_id = ?
             ORDER BY id DESC
             LIMIT 1`,
            [bookingId]
        );

        return res.json({
            success: true,
            data: {
                booking: {
                    ...booking,
                    layanan: detailRows,
                },
                payment: paymentRows.length > 0 ? paymentRows[0] : null,
            },
        });
    } catch (error) {
        console.error("Get Payment By Booking Error:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal mengambil data booking",
            error: error.message,
        });
    }
};

// =====================================================
// SUBMIT MANUAL PAYMENT (QRIS, DANA, SeaBank, Bayar di Tempat)
// POST /api/payment/manual
// =====================================================
const submitManualPayment = async (req, res) => {
    try {
        const {
            bookingId,
            userId,
            metodePembayaran,
            buktiTransfer,
            catatan,
        } = req.body;

        if (!bookingId || !userId || !metodePembayaran) {
            return res.status(400).json({
                success: false,
                message: "Booking ID, User ID, dan Metode Pembayaran wajib diisi",
            });
        }

        const [bookingRows] = await db.query(
            `SELECT b.id, b.kode_booking, b.total_harga, b.status
             FROM booking b
             WHERE b.id = ? AND b.user_id = ?
             LIMIT 1`,
            [bookingId, userId]
        );

        if (bookingRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Booking tidak ditemukan atau bukan milik akun Anda",
            });
        }

        const booking = bookingRows[0];
        const grossAmount = Number(booking.total_harga) || 0;
        const orderId = `AC-PAY-${booking.id}-${Date.now()}`;

        let savedBuktiUrl = null;

        // Simpan gambar bukti transfer jika dikirim dalam Base64
        if (buktiTransfer && typeof buktiTransfer === "string") {
            if (buktiTransfer.startsWith("data:image/")) {
                const uploadDir = path.join(__dirname, "../uploads/payments");
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                const matches = buktiTransfer.match(/^data:image\/([a-zA-Z0-9.+]+);base64,(.+)$/);
                let ext = "jpg";
                let base64Data = buktiTransfer;

                if (matches && matches.length === 3) {
                    ext = matches[1] === "jpeg" ? "jpg" : matches[1];
                    base64Data = matches[2];
                } else {
                    base64Data = buktiTransfer.replace(/^data:image\/\w+;base64,/, "");
                }

                const filename = `bukti-${bookingId}-${Date.now()}.${ext}`;
                const filePath = path.join(uploadDir, filename);

                fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
                savedBuktiUrl = `/uploads/payments/${filename}`;
            } else {
                savedBuktiUrl = buktiTransfer;
            }
        }

        // Tentukan status verifikasi
        let statusVerifikasi = "menunggu_verifikasi";
        let transactionStatus = "pending";

        if (metodePembayaran.toLowerCase() === "cod" || metodePembayaran.toLowerCase() === "bayar_di_tempat") {
            statusVerifikasi = "diterima";
            transactionStatus = "pending";
            // Update status booking langsung menjadi dikonfirmasi
            await db.query("UPDATE booking SET status = 'dikonfirmasi' WHERE id = ?", [bookingId]);
        }

        // Simpan record pembayaran
        const [insertResult] = await db.query(
            `INSERT INTO payments
            (
                booking_id,
                order_id,
                gross_amount,
                transaction_status,
                payment_type,
                metode_pembayaran,
                bukti_transfer,
                status_verifikasi,
                catatan
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                bookingId,
                orderId,
                grossAmount,
                transactionStatus,
                metodePembayaran,
                metodePembayaran,
                savedBuktiUrl,
                statusVerifikasi,
                catatan || null,
            ]
        );

        return res.status(201).json({
            success: true,
            message: (metodePembayaran.toLowerCase() === "cod" || metodePembayaran.toLowerCase() === "bayar_di_tempat")
                ? "Metode pembayaran Bayar di Tempat berhasil dipilih! Booking Anda telah dikonfirmasi."
                : "Bukti transfer berhasil dikirim! Menunggu verifikasi admin.",
            data: {
                paymentId: insertResult.insertId,
                orderId,
                bookingId,
                grossAmount,
                metodePembayaran,
                statusVerifikasi,
                transactionStatus,
                buktiTransfer: savedBuktiUrl,
            },
        });
    } catch (error) {
        console.error("Submit Manual Payment Error:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal memproses pembayaran",
            error: error.message,
        });
    }
};

// =====================================================
// VERIFY MANUAL PAYMENT (ACC / Tolak)
// POST /api/payment/:orderId/verify or POST /api/payment/verify
// =====================================================
const verifyManualPayment = async (req, res) => {
    try {
        const orderId = req.params.orderId || req.body.orderId;
        const { status, alasan } = req.body; // status: 'diterima' | 'ditolak'

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: "Order ID wajib disertakan",
            });
        }

        if (!status || !["diterima", "ditolak"].includes(status.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: "Status verifikasi harus 'diterima' atau 'ditolak'",
            });
        }

        const [paymentRows] = await db.query(
            "SELECT * FROM payments WHERE order_id = ? LIMIT 1",
            [orderId]
        );

        if (paymentRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Data pembayaran tidak ditemukan",
            });
        }

        const payment = paymentRows[0];
        const statusClean = status.toLowerCase();
        const newTransactionStatus = statusClean === "diterima" ? "settlement" : "cancel";
        const settlementTime = statusClean === "diterima" ? new Date() : null;

        const updatedCatatan = alasan
            ? (payment.catatan ? `${payment.catatan} | Catatan Admin: ${alasan}` : `Catatan Admin: ${alasan}`)
            : payment.catatan;

        await db.query(
            `UPDATE payments
             SET
                status_verifikasi = ?,
                transaction_status = ?,
                settlement_time = ?,
                catatan = ?
             WHERE id = ?`,
            [
                statusClean,
                newTransactionStatus,
                settlementTime,
                updatedCatatan,
                payment.id,
            ]
        );

        // Jika diterima (ACC), ubah status booking menjadi 'dikonfirmasi'
        if (statusClean === "diterima") {
            await db.query(
                "UPDATE booking SET status = 'dikonfirmasi' WHERE id = ?",
                [payment.booking_id]
            );
        } else if (statusClean === "ditolak") {
            // Biarkan booking 'menunggu' agar pengguna bisa upload bukti ulang
        }

        return res.json({
            success: true,
            message: statusClean === "diterima"
                ? "Pembayaran berhasil di-ACC (Diterima)!"
                : "Pembayaran telah Ditolak.",
            data: {
                orderId,
                statusVerifikasi: statusClean,
                transactionStatus: newTransactionStatus,
                settlementTime,
            },
        });
    } catch (error) {
        console.error("Verify Manual Payment Error:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal memverifikasi pembayaran",
            error: error.message,
        });
    }
};

// =====================================================
// CREATE MIDTRANS PAYMENT
// POST /api/payment/create
// =====================================================
const createPayment = async (req, res) => {
    try {
        const { bookingId, userId } = req.body;

        if (!bookingId || !userId) {
            return res.status(400).json({
                success: false,
                message: "Booking ID dan User ID wajib diisi",
            });
        }

        const [bookingRows] = await db.query(
            `SELECT
                b.id,
                b.kode_booking,
                b.user_id,
                b.total_harga,
                b.status,
                u.nama,
                u.email,
                u.no_hp
             FROM booking b
             INNER JOIN users u ON b.user_id = u.id
             WHERE b.id = ? AND b.user_id = ?
             LIMIT 1`,
            [bookingId, userId]
        );

        if (bookingRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Booking tidak ditemukan",
            });
        }

        const booking = bookingRows[0];
        const grossAmount = Number(booking.total_harga);

        if (!grossAmount || grossAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Total pembayaran tidak valid",
            });
        }

        const orderId = `AC-PAY-${booking.id}-${Date.now()}`;

        return res.status(201).json({
            success: true,
            message: "Pembayaran berhasil disiapkan",
            data: {
                bookingId: booking.id,
                kodeBooking: booking.kode_booking,
                orderId,
                grossAmount,
                status: "pending",
            },
        });
    } catch (error) {
        console.error("Create Payment Error:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal membuat pembayaran",
            error: error.message,
        });
    }
};

// =====================================================
// GET PAYMENT STATUS
// GET /api/payment/:orderId/status
// =====================================================
const getPaymentStatus = async (req, res) => {
    try {
        const { orderId } = req.params;

        const [rows] = await db.query(
            `SELECT
                p.*,
                b.kode_booking
             FROM payments p
             INNER JOIN booking b ON p.booking_id = b.id
             WHERE p.order_id = ?
             LIMIT 1`,
            [orderId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Data pembayaran tidak ditemukan",
            });
        }

        return res.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("Get Payment Status Error:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal mengambil status pembayaran",
            error: error.message,
        });
    }
};

// =====================================================
// MIDTRANS NOTIFICATION
// POST /api/payment/notification
// =====================================================
const paymentNotification = async (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Notification diproses",
    });
};

module.exports = {
    getPaymentByBookingId,
    submitManualPayment,
    verifyManualPayment,
    createPayment,
    getPaymentStatus,
    paymentNotification,
};
