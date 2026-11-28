const express = require("express");
const {
  createExam,
  getPublicExams,
  getAllExamsAdmin,
  updateExam,
} = require("../controllers/examController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { startExam } = require("../controllers/attemptController");

const router = express.Router();

router.get("/", getPublicExams);

router.get("/admin/all", protect, authorize("admin"), getAllExamsAdmin);
router.post("/", protect, authorize("admin"), createExam);
router.patch("/:id", protect, authorize("admin"), updateExam);
router.post("/:examId/start", protect, authorize("student"), startExam);

module.exports = router;