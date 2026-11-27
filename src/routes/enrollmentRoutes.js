const express = require("express");
const {
  applyToCourse,
  getMyEnrollments,
} = require("../controllers/enrollmentController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, authorize("student"), applyToCourse);
router.get("/my", protect, authorize("student"), getMyEnrollments);

module.exports = router;