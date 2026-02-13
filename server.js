import express from 'express'
import multer from 'multer';
import connectDB from './config/db.js';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { adminRoute } from './routes/admin.route.js';
import testServiceRouter from './routes/testService.routes.js';
import registrationRouter from './routes/registration.routes.js';
import parentRouter from './routes/parent.routes.js';
import dashboardRouter from './routes/dashboard.routes.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config()

const app = express()
const port = process.env.PORT || 3000
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(
  cors({
    origin: "*",
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

app.use('/admin', adminRoute)
app.use('/test-service', testServiceRouter)
app.use('/registrations', registrationRouter)
app.use('/parent', parentRouter)
app.use('/dashboard', dashboardRouter)

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