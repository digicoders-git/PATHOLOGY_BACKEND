import cloudinary from "cloudinary";
import dotenv from 'dotenv'
dotenv.config()

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dazumf2fc',
  api_key: process.env.CLOUDINARY_API_KEY || '936979368812817',
  api_secret: process.env.CLOUDINARY_API_SECRET || '2Q81L1UbrQelnxUgeG_QTGxgSn8',
});

export default cloudinary.v2;
