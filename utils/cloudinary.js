import cloudinary from "../config/cloudinary.js";
import fs from "fs";

export const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder: "pathology/packages"
    });

    fs.unlinkSync(localFilePath); 
    return response.url;
  } catch (error) {
    if (fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);
    console.error("CLOUDINARY_UPLOAD_ERROR:", error);
    return null;
  }
};

export const uploadAndKeepLocal = async (localFilePath, folder = "pathology/general") => {
  try {
    if (!localFilePath) return null;

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder: folder
    });

    return response.secure_url;
  } catch (error) {
    console.error("CLOUDINARY_DUAL_UPLOAD_ERROR:", error);
    return null;
  }
};
