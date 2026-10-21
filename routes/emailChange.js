const express = require("express");

const router = express.Router();

const {
    requestEmailChange,
    verifyEmailChange,
} = require("../controllers/emailChangeController");

router.post(
    "/request",
    requestEmailChange
);

router.post(
    "/verify",
    verifyEmailChange
);

module.exports = router;