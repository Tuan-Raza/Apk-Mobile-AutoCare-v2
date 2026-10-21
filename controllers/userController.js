const { db } = require("../config/database");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

// =============================================================
// GET USER PROFILE
// =============================================================
const getUserProfile = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "User ID wajib disertakan",
            });
        }

        const [users] = await db.query(
            "SELECT id, nama, email, no_hp, foto, created_at FROM users WHERE id = ?",
            [id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User tidak ditemukan",
            });
        }

        const user = users[0];

        res.json({
            success: true,
            user: {
                id: user.id,
                nama: user.nama,
                email: user.email,
                noHp: user.no_hp,
                foto: user.foto,
                createdAt: user.created_at,
            },
        });
    } catch (error) {
        console.error("Get User Profile Error:", error);
        res.status(500).json({
            success: false,
            message: "Gagal mengambil profil pengguna",
            error: error.message,
        });
    }
};

// =============================================================
// UPDATE USER PROFILE & FOTO
// =============================================================
const updateUserProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const { nama, email, noHp, foto } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "User ID wajib disertakan",
            });
        }

        const [existing] = await db.query(
            "SELECT id, foto FROM users WHERE id = ?",
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User tidak ditemukan",
            });
        }

        let savedFotoPath = existing[0].foto;

        // Jika foto dikirim dalam format Base64 Data URL
        if (foto && typeof foto === "string") {
            if (foto.startsWith("data:image/")) {
                const uploadDir = path.join(__dirname, "../uploads/profiles");
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                const matches = foto.match(/^data:image\/([a-zA-Z0-9.+]+);base64,(.+)$/);
                let ext = "jpg";
                let base64Data = foto;

                if (matches && matches.length === 3) {
                    ext = matches[1] === "jpeg" ? "jpg" : matches[1];
                    base64Data = matches[2];
                } else {
                    base64Data = foto.replace(/^data:image\/\w+;base64,/, "");
                }

                const fileName = `profile-${id}-${Date.now()}.${ext}`;
                const filePath = path.join(uploadDir, fileName);

                await fs.promises.writeFile(filePath, Buffer.from(base64Data, "base64"));
                savedFotoPath = `/uploads/profiles/${fileName}`;
            } else if (foto.startsWith("/uploads/") || foto.startsWith("http")) {
                savedFotoPath = foto;
            }
        } else if (foto === null) {
            savedFotoPath = null;
        }

        // Siapkan field update
        const updates = [];
        const values = [];

        if (nama !== undefined && nama !== null) {
            updates.push("nama = ?");
            values.push(nama.trim());
        }

        if (email !== undefined && email !== null) {
            updates.push("email = ?");
            values.push(email.trim().toLowerCase());
        }

        if (noHp !== undefined && noHp !== null) {
            updates.push("no_hp = ?");
            values.push(noHp.trim());
        }

        if (foto !== undefined) {
            updates.push("foto = ?");
            values.push(savedFotoPath);
        }

        if (updates.length > 0) {
            values.push(id);
            await db.query(
                `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
                values
            );
        }

        const [updatedUsers] = await db.query(
            "SELECT id, nama, email, no_hp, foto FROM users WHERE id = ?",
            [id]
        );

        const updated = updatedUsers[0];

        res.json({
            success: true,
            message: "Profil berhasil diperbarui",
            user: {
                id: updated.id,
                nama: updated.nama,
                email: updated.email,
                noHp: updated.no_hp,
                foto: updated.foto,
            },
        });
    } catch (error) {
        console.error("Update User Profile Error:", error);
        res.status(500).json({
            success: false,
            message: "Gagal memperbarui profil pengguna",
            error: error.message,
        });
    }
};

// =============================================================
// CHANGE PASSWORD
// PUT /api/user/change-password/:id
// =============================================================
const changePassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { passwordLama, passwordBaru } = req.body;

        if (!id || !passwordLama || !passwordBaru) {
            return res.status(400).json({
                success: false,
                message: "Semua data password wajib diisi",
            });
        }

        if (passwordBaru.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password baru minimal 8 karakter",
            });
        }

        const [users] = await db.query(
            "SELECT id, password FROM users WHERE id = ?",
            [id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User tidak ditemukan",
            });
        }

        const user = users[0];
        const match = await bcrypt.compare(passwordLama, user.password);

        if (!match) {
            return res.status(400).json({
                success: false,
                message: "Password lama tidak sesuai",
            });
        }

        const hashed = await bcrypt.hash(passwordBaru, 10);
        await db.query(
            "UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?",
            [hashed, id]
        );

        res.json({
            success: true,
            message: "Password berhasil diperbarui",
        });
    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({
            success: false,
            message: "Gagal mengubah password",
            error: error.message,
        });
    }
};

// =============================================================
// DELETE USER ACCOUNT
// DELETE /api/user/:id
// =============================================================
const deleteAccount = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { id } = req.params;

        const [users] = await connection.query(
            "SELECT id FROM users WHERE id = ?",
            [id]
        );

        if (users.length === 0) {
            connection.release();
            return res.status(404).json({
                success: false,
                message: "User tidak ditemukan",
            });
        }

        await connection.beginTransaction();

        // Hapus payments terkait booking user
        await connection.query(
            `DELETE p FROM payments p
             INNER JOIN booking b ON p.booking_id = b.id
             WHERE b.user_id = ?`,
            [id]
        );

        // Hapus riwayat booking detail
        await connection.query(
            `DELETE bd FROM booking_detail bd
             INNER JOIN booking b ON bd.booking_id = b.id
             WHERE b.user_id = ?`,
            [id]
        );

        // Hapus booking
        await connection.query("DELETE FROM booking WHERE user_id = ?", [id]);

        // Hapus email changes
        await connection.query("DELETE FROM email_changes WHERE user_id = ?", [id]);

        // Hapus kendaraan
        await connection.query("DELETE FROM kendaraan WHERE user_id = ?", [id]);

        // Hapus user
        await connection.query("DELETE FROM users WHERE id = ?", [id]);

        await connection.commit();
        connection.release();

        res.json({
            success: true,
            message: "Akun berhasil dihapus",
        });
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error("Delete Account Error:", error);
        res.status(500).json({
            success: false,
            message: "Gagal menghapus akun",
            error: error.message,
        });
    }
};

module.exports = {
    getUserProfile,
    updateUserProfile,
    changePassword,
    deleteAccount,
};
