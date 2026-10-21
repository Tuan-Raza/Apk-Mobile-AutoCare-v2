(async () => {
  const BASE_URL = 'http://localhost:5000';
  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  };

  const assert = (condition, msg) => {
    if (!condition) throw new Error(msg || 'Assertion failed');
  };

  console.log('====================================================');
  console.log('   AUTOCARE COMPREHENSIVE END-TO-END HEALTH CHECK   ');
  console.log('====================================================\n');

  // 1. Root Server
  await test('1. GET / - Test Server Health', async () => {
    const res = await fetch(`${BASE_URL}/`);
    assert(res.ok, `HTTP status ${res.status}`);
    const data = await res.json();
    assert(data.success === true, 'Server response not success');
  });

  const testEmail = `healthtest_${Date.now()}@gmail.com`;
  let testUserId = null;
  let testOtp = null;

  // 2. Auth: Register
  await test('2. POST /api/auth/register - Register User Baru', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama: 'Tester QA AutoCare',
        email: testEmail,
        noHp: '081298765432',
        password: 'Password123!',
      }),
    });
    const data = await res.json();
    assert(res.status === 201 && data.success, data.message || 'Register failed');
    assert(data.otp, 'OTP not returned');
    testOtp = data.otp;
  });

  // 3. Auth: Verify Email
  await test('3. POST /api/auth/verify-email - Verifikasi Email OTP', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        kode: testOtp,
      }),
    });
    const data = await res.json();
    assert(res.ok && data.success, data.message || 'Verify email failed');
    assert(data.user && data.user.id, 'User ID not in verify response');
    testUserId = data.user.id;
  });

  // 4. Auth: Login
  await test('4. POST /api/auth/login - Login Akun Baru', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Password123!',
      }),
    });
    const data = await res.json();
    assert(res.ok && data.success, data.message || 'Login failed');
    assert(data.user.email === testEmail, 'Logged in email mismatch');
    assert(data.user.foto === null, 'New user profile photo must be null');
  });

  // 5. Auth: Forgot Password & Reset
  let resetOtp = null;
  await test('5. POST /api/auth/forgot-password - Lupa Password Request', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    const data = await res.json();
    assert(res.ok && data.success, data.message || 'Forgot password failed');
    assert(data.otp, 'Reset OTP not returned');
    resetOtp = data.otp;
  });

  await test('6. POST /api/auth/verify-reset-otp - Verifikasi Reset OTP', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, kode: resetOtp }),
    });
    const data = await res.json();
    assert(res.ok && data.success, data.message || 'Verify reset OTP failed');
  });

  await test('7. POST /api/auth/reset-password - Ubah Password Baru', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      }),
    });
    const data = await res.json();
    assert(res.ok && data.success, data.message || 'Reset password failed');
  });

  // 8. User Profile
  await test('8. GET /api/user/profile/:id - Get User Profile', async () => {
    const res = await fetch(`${BASE_URL}/api/user/profile/${testUserId}`);
    const data = await res.json();
    assert(res.ok && data.success, data.message || 'Get profile failed');
    assert(data.user.id === testUserId, 'User profile id mismatch');
  });

  await test('9. PUT /api/user/profile/:id - Update User Profile & Foto', async () => {
    const sampleBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const res = await fetch(`${BASE_URL}/api/user/profile/${testUserId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama: 'Tester QA AutoCare Updated',
        email: testEmail,
        noHp: '081298765432',
        foto: sampleBase64,
      }),
    });
    const data = await res.json();
    assert(res.ok && data.success, data.message || 'Update profile failed');
    assert(data.user.foto && data.user.foto.includes('/uploads/profiles/'), 'Photo path not saved properly');
  });

  // 10. Kendaraan CRUD
  let testKendaraanId = null;
  await test('10. POST /api/kendaraan - Tambah Kendaraan', async () => {
    const res = await fetch(`${BASE_URL}/api/kendaraan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserId,
        merek: 'Honda',
        model: 'Civic Turbo',
        tahun: 2022,
        nomorPolisi: 'B 1234 QAT',
        kilometer: 15000,
      }),
    });
    const data = await res.json();
    assert(res.status === 201 && data.success, data.message || 'Tambah kendaraan failed');
    testKendaraanId = data.kendaraanId;
  });

  await test('11. GET /api/kendaraan/user/:userId - Get Kendaraan User', async () => {
    const res = await fetch(`${BASE_URL}/api/kendaraan/user/${testUserId}`);
    const data = await res.json();
    assert(res.ok && data.success, data.message || 'Get kendaraan failed');
    assert(Array.isArray(data.data) && data.data.length > 0, 'No kendaraan found');
  });

  await test('12. PUT /api/kendaraan/:id - Update Kendaraan', async () => {
    const res = await fetch(`${BASE_URL}/api/kendaraan/${testKendaraanId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merek: 'Honda',
        model: 'Civic RS',
        tahun: 2023,
        nomorPolisi: 'B 1234 QAT',
        kilometer: 18000,
      }),
    });
    const data = await res.json();
    assert(res.ok && data.success, data.message || 'Update kendaraan failed');
  });

  // 13. Booking Flow
  let bengkelId = null;
  let layananId = null;
  let jadwalId = null;
  let testBookingId = null;

  await test('13. GET /api/booking/bengkel - Get Bengkel Aktif', async () => {
    const res = await fetch(`${BASE_URL}/api/booking/bengkel`);
    const data = await res.json();
    assert(res.ok && data.success && data.data.length > 0, 'No bengkel found');
    bengkelId = data.data[0].id;
  });

  await test('14. GET /api/booking/layanan - Get Layanan Aktif', async () => {
    const res = await fetch(`${BASE_URL}/api/booking/layanan`);
    const data = await res.json();
    assert(res.ok && data.success && data.data.length > 0, 'No layanan found');
    layananId = data.data[0].id;
  });

  // Ensure a test jadwal exists
  require('dotenv').config();
  const { db } = require('./config/database');
  const [jRows] = await db.query(
    'SELECT id, tanggal, jam FROM jadwal WHERE bengkel_id = ? AND status = "tersedia" AND tersedia > 0 LIMIT 1',
    [bengkelId]
  );
  let tanggalBooking = '2026-10-25';
  let jamBooking = '09:00:00';
  if (jRows.length > 0) {
    jadwalId = jRows[0].id;
    tanggalBooking = String(jRows[0].tanggal).split('T')[0];
    jamBooking = jRows[0].jam;
  } else {
    const [insJ] = await db.query(
      'INSERT INTO jadwal (bengkel_id, tanggal, jam, kapasitas, tersedia, status) VALUES (?, ?, ?, 5, 5, "tersedia")',
      [bengkelId, tanggalBooking, jamBooking]
    );
    jadwalId = insJ.insertId;
  }

  await test('15. POST /api/booking - Create Booking Servis', async () => {
    const res = await fetch(`${BASE_URL}/api/booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserId,
        kendaraanId: testKendaraanId,
        bengkelId: bengkelId,
        jadwalId: jadwalId,
        tanggalBooking: tanggalBooking,
        jamBooking: jamBooking,
        layanan: [{ layananId: layananId, qty: 1 }],
        keluhan: 'Ganti oli rutin & pengecekan rem',
      }),
    });
    const data = await res.json();
    if (!data.success) {
      console.log('CREATE BOOKING ERROR DETAIL:', data);
    }
    assert(res.status === 201 && data.success, data.message || 'Create booking failed');
    testBookingId = data.data.bookingId;
  });

  await test('16. GET /api/booking/:id - Get Detail Booking', async () => {
    const res = await fetch(`${BASE_URL}/api/booking/${testBookingId}`);
    const data = await res.json();
    assert(res.ok && data.success && data.data.booking, 'Get booking detail failed');
    assert(data.data.booking.id === testBookingId, 'Booking ID mismatch');
  });

  // 17. Payment Flow
  let manualOrderId = null;
  await test('17. GET /api/payment/booking/:id - Get Rincian Pembayaran', async () => {
    const res = await fetch(`${BASE_URL}/api/payment/booking/${testBookingId}`);
    const data = await res.json();
    assert(res.ok && data.success && data.data.booking, 'Get payment booking failed');
  });

  await test('18. POST /api/payment/manual - Submit Pembayaran QRIS/DANA/SeaBank dengan Bukti', async () => {
    const sampleBukti = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const res = await fetch(`${BASE_URL}/api/payment/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: testBookingId,
        userId: testUserId,
        metodePembayaran: 'qris',
        buktiTransfer: sampleBukti,
        catatan: 'Bukti transfer QRIS a.n Tester QA',
      }),
    });
    const data = await res.json();
    assert(res.status === 201 && data.success, data.message || 'Submit payment failed');
    assert(data.data.statusVerifikasi === 'menunggu_verifikasi', 'Status should be menunggu_verifikasi');
    manualOrderId = data.data.orderId;
  });

  await test('19. POST /api/payment/:orderId/verify - Admin ACC Pembayaran (Status Diterima)', async () => {
    const res = await fetch(`${BASE_URL}/api/payment/${manualOrderId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'diterima',
        alasan: 'Bukti pembayaran valid',
      }),
    });
    const data = await res.json();
    assert(res.ok && data.success, data.message || 'Verify ACC failed');
    assert(data.data.statusVerifikasi === 'diterima', 'Status verifikasi must be diterima');
  });

  await test('20. GET /api/payment/:orderId/status - Cek Status Pembayaran Real-time', async () => {
    const res = await fetch(`${BASE_URL}/api/payment/${manualOrderId}/status`);
    const data = await res.json();
    assert(res.ok && data.success && data.data.transaction_status === 'settlement', 'Status must be settlement');
  });

  // Clean up test user
  await test('21. DELETE /api/user/:id - Clean up & Delete Test User Data', async () => {
    const res = await fetch(`${BASE_URL}/api/user/${testUserId}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    assert(res.ok && data.success, data.message || 'Delete user failed');
  });

  console.log('\n====================================================');
  console.log(`TOTAL PENGUJIAN: ${passed + failed}`);
  console.log(`BERHASIL (PASS): ${passed}`);
  console.log(`GAGAL (FAIL)   : ${failed}`);
  console.log('====================================================');

  process.exit(failed > 0 ? 1 : 0);
})();
