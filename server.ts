import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./src/routes/auth.js";

dotenv.config();
const app = express();

app.use(express.json());
app.use(
  cors({
    origin: "*", // Temporarily allow all origins (change later for security)
    credentials: true, // Allow cookies & auth headers
  })
);

app.use("/api/auth", authRoutes);

app.listen(5001, () => console.log("Server running on port 5001"));
