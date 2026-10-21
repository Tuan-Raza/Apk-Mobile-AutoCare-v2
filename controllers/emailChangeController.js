const bcrypt = require("bcryptjs");
const { db } = require("../config/database");
const { sendVerificationEmail } = require("../utils/mailer");

// =====================================================
// REQUEST UBAH EMAIL
// =====================================================
const requestEmailChange = async (req, res) => {
    try {
        const { userId, newEmail, password } = req.body;

        if (!userId || !newEmail || !password) {
            return res.status(400).json({
                success: false,
                message: "Semua data wajib diisi",
            });
        }

        const email = newEmail.trim().toLowerCase();

        // Validasi format email
        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Format email tidak valid",
            });
        }

        // Ambil data user
        const [users] = await db.query(
            `
            SELECT id, nama, email, password
            FROM users
            WHERE id = ?
            LIMIT 1
            `,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User tidak ditemukan",
            });
        }

        const user = users[0];

        // Email baru sama dengan email lama
        if (
            email.toLowerCase() ===
            user.email.toLowerCase()
        ) {
            return res.status(400).json({
                success: false,
                message: "Email baru sama dengan email saat ini",
            });
        }

        // Cek password saat ini
        const passwordValid = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordValid) {
            return res.status(401).json({
                success: false,
                message: "Password saat ini salah",
            });
        }

        // Cek apakah email sudah digunakan user lain
        const [existingEmail] = await db.query(
            `
            SELECT id
            FROM users
            WHERE LOWER(email) = LOWER(?)
            AND id != ?
            LIMIT 1
            `,
            [email, userId]
        );

        if (existingEmail.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email tersebut sudah digunakan akun lain",
            });
        }

        // Hapus OTP lama milik user
        await db.query(
            `
            DELETE FROM email_changes
            WHERE user_id = ?
            `,
            [userId]
        );

        // Generate OTP 6 digit
        const kode = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        // Berlaku 10 menit
        const expiresAt = new Date(
            Date.now() + 10 * 60 * 1000
        );

        // Simpan request perubahan email
        await db.query(
            `
            INSERT INTO email_changes
            (
                user_id,
                old_email,
                new_email,
                kode,
                expires_at
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                user.id,
                user.email,
                email,
                kode,
                expiresAt,
            ]
        );

        // Kirim OTP ke EMAIL BARU dengan handling aman
        let mailSent = false;
        try {
            const mailRes = await sendVerificationEmail(
                email,
                kode,
                user.nama
            );
            if (mailRes && mailRes.sent) mailSent = true;
        } catch (err) {
            console.warn("Gagal mengirim email ubah email:", err.message);
        }

        console.log(`[UBAH EMAIL OTP] New Email: ${email} | OTP: ${kode}`);

        res.json({
            success: true,
            message: mailSent
                ? "Kode OTP berhasil dikirim ke email baru"
                : `Kode OTP verifikasi Anda: ${kode}`,
            otp: kode,
        });
    } catch (error) {
        console.error(
            "Request Email Change Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal mengirim kode OTP",
            error: error.message,
        });
    }
};


// =====================================================
// VERIFIKASI OTP & UPDATE EMAIL
// =====================================================
const verifyEmailChange = async (req, res) => {
    try {
        const { userId, kode } = req.body;

        if (!userId || !kode) {
            return res.status(400).json({
                success: false,
                message: "User ID dan kode OTP wajib diisi",
            });
        }

        const [rows] = await db.query(
            `
            SELECT *
            FROM email_changes
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 1
            `,
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Permintaan perubahan email tidak ditemukan",
            });
        }

        const change = rows[0];

        // Cek expired
        if (
            new Date(change.expires_at).getTime() <
            Date.now()
        ) {
            await db.query(
                `
                DELETE FROM email_changes
                WHERE id = ?
                `,
                [change.id]
            );

            return res.status(400).json({
                success: false,
                message:
                    "Kode OTP sudah expired. Silakan minta kode baru.",
            });
        }

        // Cek OTP
        if (String(kode).trim() !== String(change.kode)) {
            return res.status(400).json({
                success: false,
                message: "Kode OTP salah",
            });
        }

        // Cek lagi apakah email masih tersedia
        const [existingEmail] = await db.query(
            `
            SELECT id
            FROM users
            WHERE LOWER(email) = LOWER(?)
            AND id != ?
            LIMIT 1
            `,
            [change.new_email, userId]
        );

        if (existingEmail.length > 0) {
            await db.query(
                `
                DELETE FROM email_changes
                WHERE id = ?
                `,
                [change.id]
            );

            return res.status(409).json({
                success: false,
                message:
                    "Email tersebut sudah digunakan akun lain",
            });
        }

        // Update email user
        await db.query(
            `
            UPDATE users
            SET email = ?
            WHERE id = ?
            `,
            [change.new_email, userId]
        );

        // Hapus OTP setelah berhasil
        await db.query(
            `
            DELETE FROM email_changes
            WHERE id = ?
            `,
            [change.id]
        );

        // Ambil data user terbaru
        const [updatedUsers] = await db.query(
            `
            SELECT id, nama, email, no_hp
            FROM users
            WHERE id = ?
            LIMIT 1
            `,
            [userId]
        );

        res.json({
            success: true,
            message: "Email berhasil diubah",
            data: updatedUsers[0],
        });
    } catch (error) {
        console.error(
            "Verify Email Change Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal memverifikasi email",
            error: error.message,
        });
    }
};

module.exports = {
    requestEmailChange,
    verifyEmailChange,
};