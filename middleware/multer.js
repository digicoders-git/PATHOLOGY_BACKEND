import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let subfolder = "misc";

    if (file.fieldname === "labLogo") subfolder = "registrations/logos";
    else if (file.fieldname === "labBanner") subfolder = "registrations/banners";
    else if (file.fieldname === "certificationFiles") subfolder = "registrations/certifications";
    else if (file.fieldname === "pathologyDocs" || file.fieldname === "cmoCertificate") subfolder = "registrations/docs";
    else if (file.fieldname === "profilePhoto") subfolder = "profiles";
    else if (file.fieldname === "testReport") subfolder = "reports";
    else if (file.fieldname === "categoryIcon") subfolder = "categories";
    else if (file.fieldname === "testImage") subfolder = "tests";
    else if (file.fieldname === "offerImage") subfolder = "offers";
    else if (file.fieldname === "offerBadge" || file.fieldname === "offerBadgeImage") subfolder = "plans";

    const folder = path.join(UPLOADS_ROOT, subfolder);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "testReport") {
    if (file.mimetype === "application/pdf" || path.extname(file.originalname).toLowerCase() === ".pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF format is allowed for test reports"), false);
    }
  } else {
    cb(null, true);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB Limit
});

export default upload;
