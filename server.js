const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const { testConnection } = require("./config/database");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const kendaraanRoutes = require("./routes/kendaraan");
const bookingRoutes = require("./routes/booking");
const paymentRoutes = require("./routes/payment");
const emailChangeRoutes = require("./routes/emailChange");
testConnection();
const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Static uploads folder for profile photos & vehicle images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =========================
// TEST SERVER
// =========================
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "AutoCare Backend berjalan",
    });
});

// =========================
// API ROUTES
// =========================
app.use("/api/auth", authRoutes);
app.use("/api", authRoutes); // Alias agar endpoint /api/login & /api/register langsung bisa diakses
app.use("/api/user", userRoutes);
app.use("/api/kendaraan", kendaraanRoutes);
app.use("/api/booking", bookingRoutes);
app.use(
    "/api/payment",
    paymentRoutes
);
app.use(
    "/api/email-change",
    emailChangeRoutes
);


// =========================
// SERVER
// =========================
const { sendVerificationEmail } = require("./utils/mailer");

app.post("/api/test-email", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email tujuan wajib diisi",
            });
        }

        const kode = Math.floor(100000 + Math.random() * 900000).toString();

        await sendVerificationEmail(
            email,
            kode,
            "Pengguna AutoCare"
        );

        res.json({
            success: true,
            message: "Email berhasil dikirim",
        });
    } catch (error) {
        console.error("Test Email Error:", error);

        res.status(500).json({
            success: false,
            message: "Email gagal dikirim",
            error: error.message,
        });
    }
});

const PORT = process.env.PORT

app.listen(PORT, "0.0.0.0", () => {
    console.log(
        `AutoCare Backend berjalan di http://localhost:${PORT}`
    );
});