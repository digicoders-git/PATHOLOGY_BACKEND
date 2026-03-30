import dotenv from 'dotenv';
dotenv.config();
import express from 'express'
import multer from 'multer';
import connectDB from './config/db.js';
import helmet from 'helmet';
import cors from 'cors';
import { adminRoute } from './routes/admin.route.js';
import testServiceRouter from './routes/testService.routes.js';
import registrationRouter from './routes/registration.routes.js';
import parentRouter from './routes/parent.routes.js';
import dashboardRouter from './routes/dashboard.routes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import managePackageRoutes from './routes/admin/managePackage.routes.js';
import patientRoutes from './routes/patient/patient.routes.js';
import pathologyRoutes from './routes/pathology/pathology.routes.js';
import pathologyTestPricingRoutes from './routes/pathology/pathologyTestPricing.routes.js';
import labTestPricingRouter from './routes/labTestPricing.routes.js';
import categoryRoutes from './routes/admin/category.routes.js';
import subcategoryRoutes from './routes/admin/subcategory.routes.js';
import planRouter from './routes/plan.routes.js';
import bookingRouter from './routes/booking.routes.js';
import notificationRouter from './routes/notification.routes.js';
import offerRouter from './routes/admin/offer.routes.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express()
const port = process.env.PORT || 3000

// DEBUG LOGGING
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.headers.origin}`);
  next();
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
const allowedOrigins = [
  'https://www.laboindia.com',
  'https://laboindia.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://localhost:3000',
  'http://localhost:3001'
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

await connectDB();

app.get('/endpoints', (req, res) => {
  const data = fs.readFileSync(path.join(__dirname, 'endpoints.json'), 'utf8');
  res.status(200).json(JSON.parse(data));
});

app.use('/admin', adminRoute)
app.use('/test-service', testServiceRouter)
app.use('/registrations', registrationRouter)
app.use('/registration', registrationRouter)
app.use('/parent', parentRouter)
app.use('/dashboard', dashboardRouter)
app.use('/manage-package', managePackageRoutes)
app.use('/patient', patientRoutes)
app.use('/pathology', pathologyRoutes)
app.use('/pathology-test-pricing', pathologyTestPricingRoutes)
app.use('/lab-test-pricing', labTestPricingRouter)
app.use('/categories', categoryRoutes)
app.use('/subcategories', subcategoryRoutes)
app.use('/tests', testServiceRouter)
app.use('/plans', planRouter)
app.use('/booking', bookingRouter)
app.use('/notifications', notificationRouter)
app.use('/offers', offerRouter)

// 404 handler
app.use((req, res) =>
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` }));

// Global Error Handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ success: false, message: "File is too large. Maximum limit is 10MB." });
    }
    return res.status(400).json({ success: false, message: err.message });
  } else if (err) {
    return res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
  next();
});

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));