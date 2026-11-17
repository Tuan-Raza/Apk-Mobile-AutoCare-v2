const nodemailer = require("nodemailer");

const getTransporter = () => {
    const pass = (process.env.EMAIL_PASS || "").replace(/\s+/g, "");
    return nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: pass,
        },
    });
};

const sendVerificationEmail = async (email, kode, nama) => {
    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.log(`[SIMULASI EMAIL] EMAIL_USER/EMAIL_PASS belum diatur. OTP untuk ${email}: ${kode}`);
            return { sent: false, simulated: true, kode };
        }

        const transporter = getTransporter();
        const info = await transporter.sendMail({
            from: `"AutoCare" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `🔐 Kode Verifikasi AutoCare: ${kode}`,
            html: `
                <div style="
                    font-family: Arial, sans-serif;
                    max-width: 500px;
                    margin: auto;
                    padding: 30px;
                    border: 1px solid #eeeeee;
                    border-radius: 12px;
                ">
                    <h2 style="color: #F20D18;">
                        Verifikasi Email AutoCare
                    </h2>

                    <p>
                        Halo <strong>${nama}</strong>,
                    </p>

                    <p>
                        Terima kasih telah mendaftar di AutoCare.
                        Gunakan kode berikut untuk memverifikasi email kamu:
                    </p>

                    <div style="
                        text-align: center;
                        margin: 30px 0;
                    ">
                        <span style="
                            display: inline-block;
                            padding: 15px 25px;
                            background: #f5f5f5;
                            border-radius: 10px;
                            font-size: 30px;
                            font-weight: bold;
                            letter-spacing: 8px;
                            color: #F20D18;
                        ">
                            ${kode}
                        </span>
                    </div>

                    <p>
                        Kode ini berlaku selama <strong>15 menit</strong>.
                    </p>

                    <p style="color: #777;">
                        Jika kamu tidak merasa melakukan pendaftaran,
                        abaikan email ini.
                    </p>

                    <hr style="border: none; border-top: 1px solid #eee;">

                    <p style="
                        text-align: center;
                        color: #999;
                        font-size: 12px;
                    ">
                        AutoCare
                    </p>
                </div>
            `,
        });

        console.log("EMAIL VERIFIKASI TERKIRIM:", {
            to: email,
            messageId: info.messageId,
            accepted: info.accepted,
        });

        return { sent: true, messageId: info.messageId, kode };
    } catch (error) {
        console.warn("[MAILER WARNING] Gagal mengirim email via SMTP:", error.message);
        if (error.message.includes("535") || error.message.includes("BadCredentials")) {
            console.warn("[MAILER INFO] Gmail menolak login karena membutuhkan 'App Password' (Sandi Aplikasi) 16 karakter, bukan password akun biasa. Buat di: https://myaccount.google.com/apppasswords");
        }
        console.log(`[VERIFIKASI EMAIL KODE] ${email}: ${kode}`);
        return { sent: false, error: error.message, kode };
    }
};

const sendResetPasswordEmail = async (email, kode, nama) => {
    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.log(`[SIMULASI EMAIL] EMAIL_USER/EMAIL_PASS belum diatur. Kode reset untuk ${email}: ${kode}`);
            return { sent: false, simulated: true, kode };
        }

        const transporter = getTransporter();
        const info = await transporter.sendMail({
            from: `"AutoCare" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `🔐 Kode Reset Password AutoCare: ${kode}`,
            text: `
Halo ${nama},

Kami menerima permintaan untuk mereset password akun AutoCare kamu.

Kode reset password kamu adalah:

${kode}

Kode ini berlaku selama 15 menit.

Jika kamu tidak meminta reset password, abaikan email ini.
            `,
            html: `
                <div style="
                    font-family: Arial, sans-serif;
                    max-width: 500px;
                    margin: auto;
                    padding: 30px;
                    border: 1px solid #eeeeee;
                    border-radius: 12px;
                ">
                    <h2 style="color:#F20D18;">
                        Reset Password AutoCare
                    </h2>

                    <p>
                        Halo <strong>${nama}</strong>,
                    </p>

                    <p>
                        Kami menerima permintaan untuk mereset
                        password akun AutoCare kamu.
                    </p>

                    <p>
                        Gunakan kode berikut:
                    </p>

                    <div style="
                        text-align:center;
                        margin:30px 0;
                    ">
                        <span style="
                            display:inline-block;
                            padding:15px 25px;
                            background:#f5f5f5;
                            border-radius:10px;
                            font-size:30px;
                            font-weight:bold;
                            letter-spacing:8px;
                            color:#F20D18;
                        ">
                            ${kode}
                        </span>
                    </div>

                    <p>
                        Kode ini berlaku selama
                        <strong>15 menit</strong>.
                    </p>

                    <p style="color:#777;">
                        Jika kamu tidak meminta reset password,
                        abaikan email ini.
                    </p>

                    <hr style="
                        border:none;
                        border-top:1px solid #eee;
                    ">

                    <p style="
                        text-align:center;
                        color:#999;
                        font-size:12px;
                    ">
                        AutoCare
                    </p>
                </div>
            `,
        });

        console.log("EMAIL RESET PASSWORD TERKIRIM:", {
            to: email,
            messageId: info.messageId,
            accepted: info.accepted,
        });

        return { sent: true, messageId: info.messageId, kode };
    } catch (error) {
        console.warn("[MAILER WARNING] Gagal mengirim reset password via SMTP:", error.message);
        if (error.message.includes("535") || error.message.includes("BadCredentials")) {
            console.warn("[MAILER INFO] Gmail menolak login karena membutuhkan 'App Password' (Sandi Aplikasi) 16 karakter, bukan password akun biasa. Buat di: https://myaccount.google.com/apppasswords");
        }
        console.log(`[RESET PASSWORD KODE] ${email}: ${kode}`);
        return { sent: false, error: error.message, kode };
    }
};

module.exports = {
    getTransporter,
    sendVerificationEmail,
    sendResetPasswordEmail,
};
