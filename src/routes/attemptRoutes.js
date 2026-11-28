const express = require("express");
const {
  saveAnswers,
  submitAttempt,
} = require("../controllers/attemptController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.patch(
  "/:attemptId/answers",
  protect,
  authorize("student"),
  saveAnswers
);
router.post(
  "/:attemptId/submit",
  protect,
  authorize("student"),
  submitAttempt
);

module.exports = router;