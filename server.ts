import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./src/routes/auth.js";
import uploadRoutes from "./src/routes/upload.js";
import forecastRoutes from "./src/routes/forecast.js";
import userRoutes from "./src/routes/user.js";
import logRouter from "./src/routes/log.js";

dotenv.config();
const app = express();

app.use(express.json());
// CORS configuration with environment variable support
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001", 
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "https://loa-forecasting.vercel.app"
];

// Add additional origins from environment variable if provided
if (process.env.ALLOWED_ORIGINS) {
  const additionalOrigins = process.env.ALLOWED_ORIGINS.split(',');
  allowedOrigins.push(...additionalOrigins);
}

// Debug logging for CORS
console.log("Allowed CORS origins:", allowedOrigins);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        console.log("CORS: Allowing origin:", origin);
        callback(null, true);
      } else {
        console.log("CORS: Blocking origin:", origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With", 
      "Content-Type",
      "Accept",
      "Authorization",
      "Cache-Control"
    ],
  })
);

// Test endpoint for CORS debugging
app.get("/api/test", (req, res) => {
  res.json({ 
    message: "CORS test successful", 
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/file", uploadRoutes);
app.use("/api/forecast", forecastRoutes);
app.use("/api/log", logRouter);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
