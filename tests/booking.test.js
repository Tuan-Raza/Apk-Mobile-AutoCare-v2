import { describe, it, expect, vi, beforeEach } from "vitest";

const { db } = require("../config/database");
const { getBengkel, createBooking } = require("../controllers/bookingController");

describe("White Box Testing - Controller Booking: getBengkel()", () => {
    let req;
    let res;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
        db.query = vi.fn();

        req = {};
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
        };
    });

    it("[Jalur Sukses]: harus mengembalikan daftar bengkel aktif dengan status 200", async () => {
        const mockBengkelData = [
            { id: 1, nama_bengkel: "AutoCare Pusat Sudirman", status: "aktif" },
            { id: 2, nama_bengkel: "AutoCare Cabang Tebet", status: "aktif" },
        ];

        db.query.mockResolvedValueOnce([mockBengkelData]);

        await getBengkel(req, res);

        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: mockBengkelData,
        });
        expect(db.query).toHaveBeenCalledTimes(1);
    });

    it("[Jalur Catch / Error]: harus mengembalikan status 500 jika query database gagal", async () => {
        db.query.mockRejectedValueOnce(new Error("Database disconnected"));

        await getBengkel(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Gagal mengambil data bengkel",
        });
    });
});

describe("White Box Testing - Controller Booking: createBooking()", () => {
    let req;
    let res;
    let mockConnection;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});

        mockConnection = {
            beginTransaction: vi.fn().mockResolvedValue(true),
            commit: vi.fn().mockResolvedValue(true),
            rollback: vi.fn().mockResolvedValue(true),
            release: vi.fn().mockResolvedValue(true),
            query: vi.fn(),
        };

        db.getConnection = vi.fn().mockResolvedValue(mockConnection);

        req = {
            body: {},
        };

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
        };
    });

    it("[Jalur Validasi]: harus mengembalikan status 400 jika field booking tidak lengkap", async () => {
        req.body = {
            userId: 1,
            // kendaraanId kosong
            bengkelId: 1,
            jadwalId: 1,
            tanggalBooking: "2026-10-25",
            jamBooking: "10:00",
            layanan: [],
        };

        await createBooking(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Data booking belum lengkap",
        });
        expect(mockConnection.beginTransaction).not.toHaveBeenCalled();
    });

    it("[Jalur Decision: User Tidak Ditemukan]: harus rollback dan mengembalikan status 404", async () => {
        req.body = {
            userId: 9999,
            kendaraanId: 1,
            bengkelId: 1,
            jadwalId: 1,
            tanggalBooking: "2026-10-25",
            jamBooking: "10:00",
            layanan: [1],
        };

        // Mock: query user mengembalikan array kosong []
        mockConnection.query.mockResolvedValueOnce([[]]);

        await createBooking(req, res);

        expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
        expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "User tidak ditemukan",
        });
    });

    it("[Jalur Decision: Kendaraan Tidak Ditemukan / Bukan Milik User]: harus rollback dan mengembalikan status 404", async () => {
        req.body = {
            userId: 1,
            kendaraanId: 99,
            bengkelId: 1,
            jadwalId: 1,
            tanggalBooking: "2026-10-25",
            jamBooking: "10:00",
            layanan: [1],
        };

        // Mock 1: User ditemukan
        mockConnection.query.mockResolvedValueOnce([[{ id: 1 }]]);
        // Mock 2: Kendaraan dengan ID tersebut tidak ditemukan
        mockConnection.query.mockResolvedValueOnce([[]]);
        // Mock 3: Fallback kendaraan user juga tidak ada
        mockConnection.query.mockResolvedValueOnce([[]]);

        await createBooking(req, res);

        expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
        expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Kendaraan tidak ditemukan",
        });
    });
});
