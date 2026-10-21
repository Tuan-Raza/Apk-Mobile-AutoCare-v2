import { describe, it, expect, vi, beforeEach } from "vitest";

const { db } = require("../config/database");
const bcrypt = require("bcryptjs");
const { login } = require("../controllers/authController");

describe("White Box Testing - Controller Auth: login()", () => {
    let req;
    let res;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock method db.query dan bcrypt.compare langsung pada modul yang di-cache
        db.query = vi.fn();
        bcrypt.compare = vi.fn();

        req = {
            body: {},
        };

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
        };
    });

    // -------------------------------------------------------------
    // SKENARIO 1: Jalur Validasi Input Kosong (Harus Expect Status 400)
    // -------------------------------------------------------------
    describe("Skenario 1: Validasi Input Kosong", () => {
        it("harus mengembalikan status 400 jika email dan password kosong", async () => {
            req.body = { email: "", password: "" };

            await login(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Email dan password wajib diisi",
            });
            expect(db.query).not.toHaveBeenCalled();
        });

        it("harus mengembalikan status 400 jika password tidak diisi", async () => {
            req.body = { email: "user@example.com", password: "" };

            await login(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Email dan password wajib diisi",
            });
            expect(db.query).not.toHaveBeenCalled();
        });

        it("harus mengembalikan status 400 jika email tidak diisi", async () => {
            req.body = { email: "", password: "Password123" };

            await login(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Email dan password wajib diisi",
            });
            expect(db.query).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------
    // SKENARIO 2: Jalur Akun/Email Tidak Ditemukan di DB (Status 401)
    // -------------------------------------------------------------
    describe("Skenario 2: Akun / Email Tidak Ditemukan", () => {
        it("harus mengembalikan status 401 jika email tidak terdaftar di database", async () => {
            req.body = {
                email: "tidakada@autocare.com",
                password: "Password123",
            };

            // Mock DB: user tidak ditemukan (rows kosong [])
            db.query.mockResolvedValueOnce([[]]);

            await login(req, res);

            expect(db.query).toHaveBeenCalledWith(
                "SELECT * FROM users WHERE email = ?",
                ["tidakada@autocare.com"]
            );
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Email atau password salah",
            });
            expect(bcrypt.compare).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------
    // SKENARIO 3: Jalur Password Salah Saat Dicocokkan (Status 401)
    // -------------------------------------------------------------
    describe("Skenario 3: Password Salah / Tidak Cocok", () => {
        it("harus mengembalikan status 401 jika password tidak cocok dengan hash bcrypt", async () => {
            req.body = {
                email: "ahmad@autocare.com",
                password: "PasswordSalah123",
            };

            const mockUser = {
                id: 1,
                nama: "Ahmad",
                email: "ahmad@autocare.com",
                password: "$2a$10$FakeHashedPasswordFromDb",
                no_hp: "081234567890",
                foto: null,
            };

            // Mock DB: user ditemukan
            db.query.mockResolvedValueOnce([[mockUser]]);

            // Mock bcrypt: password tidak cocok (false)
            bcrypt.compare.mockResolvedValueOnce(false);

            await login(req, res);

            expect(bcrypt.compare).toHaveBeenCalledWith(
                "PasswordSalah123",
                "$2a$10$FakeHashedPasswordFromDb"
            );
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Email atau password salah",
            });
        });
    });

    // -------------------------------------------------------------
    // SKENARIO 4: Jalur Sukses - Kredensial Valid (Status 200)
    // -------------------------------------------------------------
    describe("Skenario 4: Kredensial Valid / Login Berhasil", () => {
        it("harus mengembalikan status 200 beserta payload data user lengkap", async () => {
            req.body = {
                email: "Ahmad@AutoCare.com", // uji normalisasi trim & lowercase
                password: "PasswordBenar123",
            };

            const mockUser = {
                id: 1,
                nama: "Ahmad",
                email: "ahmad@autocare.com",
                password: "$2a$10$FakeHashedPasswordFromDb",
                no_hp: "081234567890",
                foto: "/uploads/profiles/ahmad.jpg",
            };

            // Mock DB: user ditemukan
            db.query.mockResolvedValueOnce([[mockUser]]);

            // Mock bcrypt: password cocok (true)
            bcrypt.compare.mockResolvedValueOnce(true);

            await login(req, res);

            expect(db.query).toHaveBeenCalledWith(
                "SELECT * FROM users WHERE email = ?",
                ["ahmad@autocare.com"]
            );
            expect(bcrypt.compare).toHaveBeenCalledWith(
                "PasswordBenar123",
                "$2a$10$FakeHashedPasswordFromDb"
            );
            expect(res.status).not.toHaveBeenCalledWith(400);
            expect(res.status).not.toHaveBeenCalledWith(401);
            expect(res.status).not.toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: "Login berhasil",
                user: {
                    id: 1,
                    nama: "Ahmad",
                    email: "ahmad@autocare.com",
                    noHp: "081234567890",
                    foto: "/uploads/profiles/ahmad.jpg",
                },
            });
        });
    });

    // -------------------------------------------------------------
    // SKENARIO 5: Jalur Catch Error / Server Down (Status 500)
    // -------------------------------------------------------------
    describe("Skenario 5: Exception / Server Error", () => {
        it("harus mengembalikan status 500 jika database error / crash", async () => {
            req.body = {
                email: "ahmad@autocare.com",
                password: "Password123",
            };

            // Mock DB melempar error
            db.query.mockRejectedValueOnce(
                new Error("Database connection lost: ECONNREFUSED")
            );

            await login(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Terjadi kesalahan server",
            });
        });
    });
});
