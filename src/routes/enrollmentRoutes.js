const express = require("express");
const {
  applyToCourse,
  getMyEnrollments,
  getAllEnrollments,
  updateEnrollment,
} = require("../controllers/enrollmentController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, authorize("student"), applyToCourse);
router.get("/my", protect, authorize("student"), getMyEnrollments);

router.get("/", protect, authorize("admin"), getAllEnrollments);
router.patch("/:id", protect, authorize("admin"), updateEnrollment);

module.exports = router;