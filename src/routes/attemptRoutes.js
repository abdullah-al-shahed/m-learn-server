const express = require("express");
const { saveAnswers } = require("../controllers/attemptController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.patch(
  "/:attemptId/answers",
  protect,
  authorize("student"),
  saveAnswers
);

module.exports = router;