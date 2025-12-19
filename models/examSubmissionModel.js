// backend/models/examSubmissionModel.js
import mongoose from "mongoose";

const examSubmissionSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  courseId:  { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  answers:   { type: [Number], required: true }, // indices 0..3
  score:     { type: Number, required: true },   // number correct
  total:     { type: Number, required: true },
  percent:   { type: Number, required: true },
  passed:    { type: Boolean, required: true },
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

examSubmissionSchema.index({ userId: 1, courseId: 1 }, { unique: true }); // 1 attempt (optional)

export const ExamSubmission = mongoose.model("ExamSubmission", examSubmissionSchema);
