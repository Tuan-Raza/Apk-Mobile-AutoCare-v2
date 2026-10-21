const {db} = require("../config/database");
const bcrypt = require("bcryptjs");
const {
    sendVerificationEmail,
    sendResetPasswordEmail,
} = require("../utils/mailer");

// ===============================
// REGISTER
// ===============================
const register = async (req, res) => {
    try {
        const {
            nama,
            email,
            noHp,
            password,
        } = req.body;

        if (!nama || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Nama, email, dan password wajib diisi",
            });
        }

        const emailClean = email.trim().toLowerCase();
        const namaClean = nama.trim();
        const noHpClean = noHp ? noHp.trim() : "";

        // Validasi format email dasar
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailClean)) {
            return res.status(400).json({
                success: false,
                message: "Format email tidak valid",
            });
        }

        // Cek apakah email sudah menjadi user
        const [existingUser] = await db.query(
            "SELECT id FROM users WHERE LOWER(email) = ?",
            [emailClean]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Email sudah terdaftar. Silakan langsung login.",
            });
        }

        // Password di-hash sebelum disimpan sementara
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate OTP 6 digit
        const kode = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        // OTP berlaku 15 menit
        const expiresAt = new Date(
            Date.now() + 15 * 60 * 1000
        );

        // Hapus OTP lama untuk email tersebut
        await db.query(
            "DELETE FROM email_verifications WHERE LOWER(email) = ?",
            [emailClean]
        );

        // Simpan data sementara
        await db.query(
            `INSERT INTO email_verifications
            (
                nama,
                email,
                no_hp,
                password,
                kode,
                expires_at
            )
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                namaClean,
                emailClean,
                noHpClean,
                hashedPassword,
                kode,
                expiresAt,
            ]
        );

        // Kirim OTP ke email dengan handling aman
        let mailSent = false;
        try {
            const mailRes = await sendVerificationEmail(
                emailClean,
                kode,
                namaClean
            );
            if (mailRes && mailRes.sent) {
                mailSent = true;
            }
        } catch (mailErr) {
            console.warn("Gagal mengirim email pendaftaran:", mailErr.message);
        }

        console.log(`[PENDAFTARAN SUKSES] Email: ${emailClean} | OTP: ${kode}`);

        res.status(201).json({
            success: true,
            message: mailSent
                ? "Kode verifikasi telah dikirim ke email Anda"
                : `Pendaftaran berhasil! Gunakan kode verifikasi: ${kode}`,
            otp: kode, // Disertakan agar selalu bisa diverifikasi tanpa hambatan
        });
    } catch (error) {
        console.error("Register Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal melakukan registrasi",
            error: error.message,
        });
    }
};

// ===============================
// VERIFY EMAIL
// ===============================
const verifyEmail = async (req, res) => {
    try {
        const {
            email,
            kode,
        } = req.body;

        if (!email || !kode) {
            return res.status(400).json({
                success: false,
                message: "Email dan kode verifikasi wajib diisi",
            });
        }

        const emailClean = email.trim().toLowerCase();
        const kodeClean = String(kode).trim();

        // Ambil data verifikasi terbaru
        const [verification] = await db.query(
            `SELECT *
             FROM email_verifications
             WHERE LOWER(email) = ?
             ORDER BY id DESC
             LIMIT 1`,
            [emailClean]
        );

        if (verification.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Data verifikasi tidak ditemukan atau akun sudah diverifikasi. Silakan login atau daftar ulang.",
            });
        }

        const data = verification[0];

        // Cek OTP
        if (String(data.kode) !== kodeClean) {
            return res.status(400).json({
                success: false,
                message: "Kode verifikasi salah.",
            });
        }

        // Cek expired
        if (new Date(data.expires_at).getTime() < Date.now()) {
            return res.status(400).json({
                success: false,
                message: "Kode verifikasi sudah kedaluwarsa. Silakan minta kode baru.",
            });
        }

        // Cek lagi apakah email sudah terdaftar
        const [existingUser] = await db.query(
            "SELECT id FROM users WHERE LOWER(email) = ?",
            [emailClean]
        );

        if (existingUser.length > 0) {
            await db.query(
                "DELETE FROM email_verifications WHERE LOWER(email) = ?",
                [emailClean]
            );

            return res.status(400).json({
                success: false,
                message: "Email sudah terdaftar. Silakan langsung login.",
            });
        }

        // Masukkan user yang sudah terverifikasi
        const [result] = await db.query(
            `INSERT INTO users
            (
                nama,
                email,
                no_hp,
                password,
                nama_lengkap,
                kontak
            )
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                data.nama,
                data.email,
                data.no_hp || "",
                data.password,
                data.nama,
                data.no_hp || "",
            ]
        );

        // Hapus data OTP pendaftaran
        await db.query(
            "DELETE FROM email_verifications WHERE LOWER(email) = ?",
            [emailClean]
        );

        res.json({
            success: true,
            message: "Email berhasil diverifikasi! Pendaftaran Anda selesai.",
            user: {
                id: result.insertId,
                nama: data.nama,
                email: data.email,
                noHp: data.no_hp,
            },
        });
    } catch (error) {
        console.error("Verify Email Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal melakukan verifikasi email",
            error: error.message,
        });
    }
};

// ===============================
// RESEND VERIFICATION CODE
// ===============================
const resendVerification = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email wajib diisi",
            });
        }

        const emailClean = email.trim().toLowerCase();

        const [rows] = await db.query(
            "SELECT * FROM email_verifications WHERE LOWER(email) = ? ORDER BY id DESC LIMIT 1",
            [emailClean]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Data pendaftaran tidak ditemukan. Silakan lakukan pendaftaran terlebih dahulu.",
            });
        }

        const data = rows[0];
        const newKode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await db.query(
            "UPDATE email_verifications SET kode = ?, expires_at = ? WHERE id = ?",
            [newKode, expiresAt, data.id]
        );

        let mailSent = false;
        try {
            const mailRes = await sendVerificationEmail(emailClean, newKode, data.nama);
            if (mailRes && mailRes.sent) mailSent = true;
        } catch (err) {
            console.warn("Gagal kirim ulang email verifikasi:", err.message);
        }

        console.log(`[KIRIM ULANG OTP] Email: ${emailClean} | OTP: ${newKode}`);

        res.json({
            success: true,
            message: mailSent
                ? "Kode verifikasi baru telah dikirim ke email Anda"
                : `Kode verifikasi baru Anda: ${newKode}`,
            otp: newKode,
        });
    } catch (error) {
        console.error("Resend Verification Error:", error);
        res.status(500).json({
            success: false,
            message: "Gagal mengirim ulang kode verifikasi",
            error: error.message,
        });
    }
};

// ===============================
// LOGIN
// ===============================
const login = async (req, res) => {
    try {
        const {
            email,
            password,
        } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email dan password wajib diisi",
            });
        }

        const emailClean = email.trim().toLowerCase();

        const [users] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [emailClean]
        );
        console.log(users);
        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Email atau password salah",
            });
        }

        const user = users[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Email atau password salah",
            });
        }

        res.json({
            success: true,
            message: "Login berhasil",
            user: {
                id: user.id,
                nama: user.nama,
                email: user.email,
                noHp: user.no_hp,
                foto: user.foto,
            },
        });
    } catch (error) {
        console.error("Login Error:", error);

        res.status(500).json({
            success: false,
            message: "Terjadi kesalahan server",
        });
    }
};

// FORGOT PASSWORD
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email wajib diisi",
            });
        }

        const emailClean = email.trim().toLowerCase();

        // Cek apakah email terdaftar
        const [users] = await db.query(
            `SELECT id, nama, email
             FROM users
             WHERE email = ?
             LIMIT 1`,
            [emailClean]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Email tidak terdaftar",
            });
        }

        const user = users[0];

        // Generate OTP 6 digit
        const kode = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        // Berlaku 10 menit
        const expiresAt = new Date(
            Date.now() + 10 * 60 * 1000
        );

        // Hapus OTP lama
        await db.query(
            "DELETE FROM password_resets WHERE email = ?",
            [emailClean]
        );

        // Simpan OTP baru
        await db.query(
            `INSERT INTO password_resets
            (
                email,
                kode,
                expires_at
            )
            VALUES (?, ?, ?)`,
            [
                emailClean,
                kode,
                expiresAt,
            ]
        );

        // Kirim OTP ke email
        let mailSent = false;
        try {
            const mailRes = await sendResetPasswordEmail(
                emailClean,
                kode,
                user.nama
            );
            if (mailRes && mailRes.sent) mailSent = true;
        } catch (emailError) {
            console.warn("Reset Password Email Error:", emailError.message);
        }

        console.log(`[RESET PASSWORD OTP] Email: ${emailClean} | OTP: ${kode}`);

        res.json({
            success: true,
            message: mailSent
                ? "Kode reset password telah dikirim ke email"
                : `Kode reset password Anda: ${kode}`,
            otp: kode,
        });

    } catch (error) {
        console.error(
            "Forgot Password Error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Terjadi kesalahan saat memproses reset password",
        });
    }
};

const verifyResetOTP = async (req, res) => {
    try {
        const { email, kode } = req.body;

        if (!email || !kode) {
            return res.status(400).json({
                success: false,
                message: "Email dan kode OTP wajib diisi.",
            });
        }

        const emailClean = email.trim().toLowerCase();
        const kodeClean = String(kode).trim();

        // Ambil OTP reset password terbaru
        const [rows] = await db.query(
            `
            SELECT *
            FROM password_resets
            WHERE email = ?
            ORDER BY id DESC
            LIMIT 1
            `,
            [emailClean]
        );

        if (rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Kode OTP tidak ditemukan. Silakan kirim ulang OTP.",
            });
        }

        const resetData = rows[0];

        // Cek kode OTP
        if (String(resetData.kode) !== kodeClean) {
            return res.status(400).json({
                success: false,
                message: "Kode OTP salah.",
            });
        }

        // Cek expired
        const now = new Date();
        const expiresAt = new Date(resetData.expires_at);

        if (now > expiresAt) {
            return res.status(400).json({
                success: false,
                message: "Kode OTP sudah kedaluwarsa. Silakan kirim ulang OTP.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "OTP berhasil diverifikasi.",
        });
    } catch (error) {
        console.error("VERIFY RESET OTP ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Terjadi kesalahan pada server.",
        });
    }
};

const resetPassword = async (req, res) => {
    try {
        const {
            email,
            password,
            confirmPassword,
        } = req.body;

        if (!email || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message:
                    "Email, password, dan konfirmasi password wajib diisi.",
            });
        }

        const emailClean = email.trim().toLowerCase();

        // Validasi password
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password minimal 8 karakter.",
            });
        }

        if (!/\d/.test(password)) {
            return res.status(400).json({
                success: false,
                message:
                    "Password harus mengandung minimal 1 angka.",
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message:
                    "Konfirmasi password tidak cocok.",
            });
        }

        // Cari akun berdasarkan email
        const [users] = await db.query(
            `
            SELECT id, password
            FROM users
            WHERE email = ?
            LIMIT 1
            `,
            [emailClean]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Akun dengan email tersebut tidak ditemukan.",
            });
        }

        const user = users[0];

        // Pastikan password baru berbeda dari password lama
        const passwordSama = await bcrypt.compare(
            password,
            user.password
        );

        if (passwordSama) {
            return res.status(400).json({
                success: false,
                message:
                    "Password baru tidak boleh sama dengan password sebelumnya.",
            });
        }

        // Hash password baru
        const hashedPassword = await bcrypt.hash(
            password,
            10
        );

        // Update password
        await db.query(
            `
            UPDATE users
            SET password = ?
            WHERE id = ?
            `,
            [hashedPassword, user.id]
        );

        // Hapus OTP yang sudah digunakan
        await db.query(
            `
            DELETE FROM password_resets
            WHERE email = ?
            `,
            [emailClean]
        );

        return res.status(200).json({
            success: true,
            message:
                "Password berhasil diubah. Silakan login kembali.",
        });
    } catch (error) {
        console.error(
            "RESET PASSWORD ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Terjadi kesalahan pada server.",
        });
    }
};



module.exports = {
    register,
    verifyEmail,
    resendVerification,
    login,
    forgotPassword,
    verifyResetOTP,
    resetPassword,
};