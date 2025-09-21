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
app.use(
  cors({
    origin: "http://localhost:3000", // allow only your Next.js frontend
    credentials: true,
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/file", uploadRoutes);
app.use("/api/forecast", forecastRoutes);
app.use("/api/log", logRouter);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
