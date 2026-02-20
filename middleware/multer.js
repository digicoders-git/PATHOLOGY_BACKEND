import multer from "multer";
import path from "path";
import fs from "fs";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let folder = "uploads/";

    // Define folder structure based on fieldname
    if (file.fieldname === "labLogo") folder += "registrations/logos";
    else if (file.fieldname === "labBanner") folder += "registrations/banners";
    else if (file.fieldname === "certificationFiles") folder += "registrations/certifications";
    else if (file.fieldname === "pathologyDocs") folder += "registrations/docs";
    else if (file.fieldname === "profilePhoto") folder += "profiles";
    else if (file.fieldname === "testReport") folder += "reports";
    else folder += "misc";

    // Create directory if it doesn't exist
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    // Unique filename: fieldname-timestamp-random.ext
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB Limit
});

export default upload;
