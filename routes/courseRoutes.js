// backend/routes/courseRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { lectureOnly } from "../middleware/authMiddleware.js";
import { listCourses, getCourse, createCourse, updateCourse, deleteCourse, submitExam, getMyExamStatus, getCourseManage, getCourseQuestions, updateCourseQuestions, } from "../controllers/courseController.js";
import { uploadLarge } from "../helper/largeFileUploadMiddleware.js";

const router = express.Router();

// public (or protect if you prefer)
router.get("/", listCourses);
router.get("/:id", getCourse);

// write = Lecture
router.post("/", protect, lectureOnly,uploadLarge.any(), createCourse);
router.patch("/:id", protect, lectureOnly,uploadLarge.any(), updateCourse);
router.delete("/:id", protect, lectureOnly, deleteCourse);

// exam
router.post("/:id/attempt", protect, submitExam); // Viewer/any authenticated
router.get("/:id/status", protect, getMyExamStatus);

// owner/lecture-only manage endpoints (return correctIndex)
router.get("/:id/manage", protect, lectureOnly, getCourseManage);
router.get("/:id/questions", protect, lectureOnly, getCourseQuestions);
router.put("/:id/questions", protect, lectureOnly, updateCourseQuestions);

export default router;
