import { describe, it, expect, vi, beforeEach } from "vitest";

const { db } = require("../config/database");
const bcrypt = require("bcryptjs");
const { register, verifyEmail } = require("../controllers/authController");

describe("White Box Testing - Controller Auth: register() & verifyEmail()", () => {
    let req;
    let res;

    beforeEach(() => {
        vi.clearAllMocks();

        // Diamkan console log dan error agar output terminal bersih dan rapi
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});

        db.query = vi.fn();
        bcrypt.hash = vi.fn();

        req = {
            body: {},
        };

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
        };
    });

    // =============================================================
    // REGISTER SKENARIO
    // =============================================================
    describe("Fungsi: register()", () => {
        it("Skenario 1: harus mengembalikan status 400 jika field wajib kosong", async () => {
            req.body = { nama: "", email: "", password: "" };

            await register(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Nama, email, dan password wajib diisi",
            });
            expect(db.query).not.toHaveBeenCalled();
        });

        it("Skenario 2: harus mengembalikan status 400 jika format email tidak valid", async () => {
            req.body = {
                nama: "Budi",
                email: "budi-bukan-email",
                password: "Password123",
            };

            await register(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Format email tidak valid",
            });
            expect(db.query).not.toHaveBeenCalled();
        });

        it("Skenario 3: harus mengembalikan status 400 jika email sudah terdaftar di users", async () => {
            req.body = {
                nama: "Budi",
                email: "budi@autocare.com",
                password: "Password123",
            };

            // Mock DB: email sudah ada di users
            db.query.mockResolvedValueOnce([[{ id: 10, email: "budi@autocare.com" }]]);

            await register(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Email sudah terdaftar. Silakan langsung login.",
            });
            expect(bcrypt.hash).not.toHaveBeenCalled();
        });

        it("Skenario 4: harus mengembalikan status 201 dan menghasilkan OTP jika data valid", async () => {
            req.body = {
                nama: "Budi Santoso",
                email: "budi.baru@autocare.com",
                noHp: "08123456789",
                password: "Password123",
            };

            // 1. Cek users -> tidak ada
            db.query.mockResolvedValueOnce([[]]);
            // Mock hash password
            bcrypt.hash.mockResolvedValueOnce("$2a$10$HashedBcryptPasswordTest");
            // 2. Hapus OTP lama
            db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);
            // 3. Insert OTP baru
            db.query.mockResolvedValueOnce([{ insertId: 1 }]);

            await register(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(bcrypt.hash).toHaveBeenCalledWith("Password123", 10);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    otp: expect.any(String),
                })
            );
        });

        it("Skenario 5: harus mengembalikan status 500 jika terjadi database crash pada register", async () => {
            req.body = {
                nama: "Budi",
                email: "budi@autocare.com",
                password: "Password123",
            };

            db.query.mockRejectedValueOnce(new Error("DB Connection Error"));

            await register(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: "Gagal melakukan registrasi",
                })
            );
        });
    });

    // =============================================================
    // VERIFY EMAIL SKENARIO
    // =============================================================
    describe("Fungsi: verifyEmail()", () => {
        it("Skenario 6: harus mengembalikan status 400 jika email atau kode OTP kosong", async () => {
            req.body = { email: "", kode: "" };

            await verifyEmail(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Email dan kode verifikasi wajib diisi",
            });
        });

        it("Skenario 7: harus mengembalikan status 404 jika data verifikasi tidak ditemukan", async () => {
            req.body = { email: "unknown@autocare.com", kode: "123456" };

            // Mock DB: verifikasi tidak ditemukan
            db.query.mockResolvedValueOnce([[]]);

            await verifyEmail(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Data verifikasi tidak ditemukan atau akun sudah diverifikasi. Silakan login atau daftar ulang.",
            });
        });

        it("Skenario 8: harus mengembalikan status 400 jika kode OTP salah", async () => {
            req.body = { email: "budi@autocare.com", kode: "999999" };

            const mockPending = {
                id: 1,
                email: "budi@autocare.com",
                kode: "123456",
                expires_at: new Date(Date.now() + 10 * 60 * 1000),
            };

            db.query.mockResolvedValueOnce([[mockPending]]);

            await verifyEmail(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Kode verifikasi salah.",
            });
        });

        it("Skenario 9: harus mengembalikan status 400 jika kode OTP sudah kedaluwarsa", async () => {
            req.body = { email: "budi@autocare.com", kode: "123456" };

            const mockPendingExpired = {
                id: 1,
                email: "budi@autocare.com",
                kode: "123456",
                expires_at: new Date(Date.now() - 5 * 60 * 1000), // expired 5 menit lalu
            };

            db.query.mockResolvedValueOnce([[mockPendingExpired]]);

            await verifyEmail(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Kode verifikasi sudah kedaluwarsa. Silakan minta kode baru.",
            });
        });

        it("Skenario 10: harus mengembalikan status 200 dan menyimpan user jika OTP valid", async () => {
            req.body = { email: "budi@autocare.com", kode: "123456" };

            const mockPendingValid = {
                id: 1,
                nama: "Budi Santoso",
                email: "budi@autocare.com",
                no_hp: "08123456789",
                password: "$2a$10$HashedBcryptPasswordTest",
                kode: "123456",
                expires_at: new Date(Date.now() + 10 * 60 * 1000),
            };

            // 1. Ambil email_verifications
            db.query.mockResolvedValueOnce([[mockPendingValid]]);
            // 2. Cek apakah email sudah terdaftar di users
            db.query.mockResolvedValueOnce([[]]);
            // 3. Insert ke tabel users
            db.query.mockResolvedValueOnce([{ insertId: 55 }]);
            // 4. Hapus OTP dari email_verifications
            db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

            await verifyEmail(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: "Email berhasil diverifikasi! Pendaftaran Anda selesai.",
                user: {
                    id: 55,
                    nama: "Budi Santoso",
                    email: "budi@autocare.com",
                    noHp: "08123456789",
                },
            });
        });
    });
});
