// backend/controllers/courseController.js
import { Course } from "../models/courseModel.js";
import { ExamSubmission } from "../models/examSubmissionModel.js";
import { uploadAssetToCloudinary } from "../helper/assetUpload.js";

function getUploadUrl(result) {
  return (
    result?.secure_url ||
    result?.secureUrl ||
    result?.url ||
    result?.Location || // some S3 helpers
    result?.location ||
    null
  );
}

/** files[] -> map by fieldname */
function groupFilesByField(files = []) {
  const map = {};
  for (const f of files) {
    (map[f.fieldname] ||= []).push(f);
  }
  return map;
}

/** Pick the first defined value from a list */
const first = (...vals) => vals.find(v => v != null && v !== "");

export async function listCourses(req, res){ 
  const courses = await Course.find().select("-questions");
  res.json(courses);
}

export async function getCourse(req, res){
  const c = await Course.findById(req.params.id);
  if(!c) return res.status(404).json({message:"Not found"});
  const safe = c.toObject();
  safe.questions = safe.questions.map(q => ({ text: q.text, options: q.options }));
  res.json(safe);
}

export async function createCourse(req, res) {
  try {
    const {
      courseName,
      price,
      description,
      // If uploadLarge already uploaded & injected URLs, they may be under these keys:
      thumbnailUrl,
      videoUrl,
      pptUrl,
      slidesUrl,
      documentUrl,
      certificateTemplateUrl,
      certificateUrl,
      // questions can be stringified JSON or array
      questions: questionsRaw,
    } = req.body;

    if (!courseName) {
      return res.status(400).json({ message: "courseName is required" });
    }

    // Start with URLs that might already be in req.body from your middleware
    let _thumbnailUrl = first(thumbnailUrl);
    let _videoUrl = first(videoUrl);
    let _pptUrl = first(pptUrl, slidesUrl, documentUrl);
    let _certificateTemplateUrl = first(certificateTemplateUrl, certificateUrl);

    // If any are still missing, try uploading from files (uploadLarge.any() gives buffers in req.files)
    const filesByField = groupFilesByField(Array.isArray(req.files) ? req.files : []);

    // Accept multiple possible fieldnames you might have used in the UI / middleware
    if (!_thumbnailUrl) {
      const f = (filesByField.thumbnail || filesByField.image || [])[0];
      if (f) {
        const up = await uploadAssetToCloudinary({
          buffer: f.buffer, originalName: f.originalname, mimeType: f.mimetype,
        });
        _thumbnailUrl = getUploadUrl(up);
      }
    }

    if (!_videoUrl) {
      const f = (filesByField.video || filesByField.courseVideo || [])[0];
      if (f) {
        const up = await uploadAssetToCloudinary({
          buffer: f.buffer, originalName: f.originalname, mimeType: f.mimetype,
        });
        _videoUrl = getUploadUrl(up);
      }
    }

    if (!_pptUrl) {
      const f = (filesByField.ppt || filesByField.slides || filesByField.document || [])[0];
      if (f) {
        const up = await uploadAssetToCloudinary({
          buffer: f.buffer, originalName: f.originalname, mimeType: f.mimetype, // helper already sets resource_type
        });
        _pptUrl = getUploadUrl(up);
      }
    }

    if (!_certificateTemplateUrl) {
      const f = (filesByField.certificateTemplate || filesByField.certificate || filesByField.cert || [])[0];
      if (f) {
        const up = await uploadAssetToCloudinary({
          buffer: f.buffer, originalName: f.originalname, mimeType: f.mimetype,
        });
        _certificateTemplateUrl = getUploadUrl(up);
      }
    }

    if (!_certificateTemplateUrl) {
      // still missing → fail gracefully (don’t crash process)
      return res.status(400).json({ message: "certificateTemplateUrl is required" });
    }

    // Parse questions (allow array or JSON string)
    let questions = [];
    if (questionsRaw) {
      questions = Array.isArray(questionsRaw) ? questionsRaw : JSON.parse(questionsRaw);
      const ok = Array.isArray(questions) && questions.every(
        q => q?.text && Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.correctIndex)
      );
      if (!ok) return res.status(400).json({ message: "questions invalid shape" });
    }

    const created = await Course.create({
      courseName,
      price,
      description,
      thumbnailUrl: _thumbnailUrl,
      videoUrl: _videoUrl,
      pptUrl: _pptUrl,
      certificateTemplateUrl: _certificateTemplateUrl,
      questions,
      createdBy: req.user._id,
    });

    return res.status(201).json(created);
  } catch (err) {
    const isValidation = err?.name === "ValidationError" || err?.message?.includes("JSON");
    return res.status(isValidation ? 400 : 500).json({ message: err.message });
  }
}

export async function updateCourse(req, res) {
  try {
    const filter = { _id: req.params.id, createdBy: req.user._id };
    const course = await Course.findOne(filter);
    if (!course) return res.status(404).json({ message: "Not found or not owner" });

    const {
      courseName, price, description,
      thumbnailUrl, videoUrl, pptUrl, slidesUrl, documentUrl,
      certificateTemplateUrl, certificateUrl,
      questions: questionsRaw,
    } = req.body;

    if (courseName != null) course.courseName = courseName;
    if (price != null) course.price = price;
    if (description != null) course.description = description;

    if (questionsRaw != null) {
      const q = Array.isArray(questionsRaw) ? questionsRaw : JSON.parse(questionsRaw);
      const ok = Array.isArray(q) && q.every(
        x => x?.text && Array.isArray(x.options) && x.options.length === 4 && Number.isInteger(x.correctIndex)
      );
      if (!ok) return res.status(400).json({ message: "questions invalid shape" });
      course.questions = q;
    }

    // Prefer URLs from body if middleware injected them
    course.thumbnailUrl = first(thumbnailUrl, course.thumbnailUrl);
    course.videoUrl = first(videoUrl, course.videoUrl);
    course.pptUrl = first(pptUrl, slidesUrl, documentUrl, course.pptUrl);
    course.certificateTemplateUrl = first(certificateTemplateUrl, certificateUrl, course.certificateTemplateUrl);

    // Then accept new file uploads (optional)
    const filesByField = groupFilesByField(Array.isArray(req.files) ? req.files : []);

    if (filesByField.thumbnail?.[0]) {
      const f = filesByField.thumbnail[0];
      const up = await uploadAssetToCloudinary({ buffer: f.buffer, originalName: f.originalname, mimeType: f.mimetype });
      course.thumbnailUrl = getUploadUrl(up);
    }

    if (filesByField.video?.[0]) {
      const f = filesByField.video[0];
      const up = await uploadAssetToCloudinary({ buffer: f.buffer, originalName: f.originalname, mimeType: f.mimetype });
      course.videoUrl = getUploadUrl(up);
    }

    const pptFile = (filesByField.ppt || filesByField.slides || filesByField.document || [])[0];
    if (pptFile) {
      const up = await uploadAssetToCloudinary({ buffer: pptFile.buffer, originalName: pptFile.originalname, mimeType: pptFile.mimetype });
      course.pptUrl = getUploadUrl(up);
    }

    const certFile = (filesByField.certificateTemplate || filesByField.certificate || filesByField.cert || [])[0];
    if (certFile) {
      const up = await uploadAssetToCloudinary({ buffer: certFile.buffer, originalName: certFile.originalname, mimeType: certFile.mimetype });
      course.certificateTemplateUrl = getUploadUrl(up);
    }

    await course.save();
    return res.json(course);
  } catch (err) {
    const isValidation = err?.name === "ValidationError" || err?.message?.includes("JSON");
    return res.status(isValidation ? 400 : 500).json({ message: err.message });
  }
}

export async function deleteCourse(req, res){
  const deleted = await Course.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
  if(!deleted) return res.status(404).json({message:"Not found or not owner"});
  res.json({ ok:true });
}

export async function submitExam(req, res){
  const { answers } = req.body;
  const course = await Course.findById(req.params.id);
  if(!course) return res.status(404).json({message:"Course not found"});
  if(!Array.isArray(answers) || answers.length !== course.questions.length){
    return res.status(400).json({message:"Invalid answers"});
  }
  let score = 0;
  course.questions.forEach((q, i) => { if(answers[i] === q.correctIndex) score++; });
  const total = course.questions.length;
  const percent = Math.round((score/total)*100);
  const passed = percent >= 80;

  await ExamSubmission.findOneAndUpdate(
    { userId: req.user._id, courseId: course._id },
    { answers, score, total, percent, passed },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json({
    score, total, percent, passed,
    certificateTemplateUrl: passed ? course.certificateTemplateUrl : null
  });
}

export async function getMyExamStatus(req, res) {
  const doc = await ExamSubmission.findOne({
    userId: req.user._id,
    courseId: req.params.id,
  }).lean();

  if (!doc) return res.json({ attempted: false, passed: false });

  const { score, total, percent, passed } = doc;
  res.json({ attempted: true, passed: !!passed, score, total, percent });
}

// --- add near other imports/exports ---
export async function getCourseManage(req, res) {
  // Only the owner can see/manage the full course (incl. correctIndex)
  const course = await Course.findOne({ _id: req.params.id, createdBy: req.user._id }).lean();
  if (!course) return res.status(404).json({ message: "Not found or not owner" });
  return res.json(course); // includes questions with correctIndex
}

export async function getCourseQuestions(req, res) {
  const course = await Course.findOne({ _id: req.params.id, createdBy: req.user._id })
    .select("questions")
    .lean();
  if (!course) return res.status(404).json({ message: "Not found or not owner" });
  return res.json({ questions: course.questions });
}

export async function updateCourseQuestions(req, res) {
  const { questions: questionsRaw } = req.body;
  const course = await Course.findOne({ _id: req.params.id, createdBy: req.user._id });
  if (!course) return res.status(404).json({ message: "Not found or not owner" });

  const q = Array.isArray(questionsRaw) ? questionsRaw : JSON.parse(questionsRaw || "[]");
  const ok =
    Array.isArray(q) &&
    q.every(
      (x) =>
        x?.text &&
        Array.isArray(x.options) &&
        x.options.length === 4 &&
        Number.isInteger(x.correctIndex) &&
        x.correctIndex >= 0 &&
        x.correctIndex <= 3
    );
  if (!ok) return res.status(400).json({ message: "questions invalid shape" });

  course.questions = q;
  await course.save();
  return res.json({ questions: course.questions });
}

