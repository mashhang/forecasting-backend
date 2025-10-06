"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_js_1 = __importDefault(require("./src/routes/auth.js"));
const upload_js_1 = __importDefault(require("./src/routes/upload.js"));
const forecast_js_1 = __importDefault(require("./src/routes/forecast.js"));
const user_js_1 = __importDefault(require("./src/routes/user.js"));
const log_js_1 = __importDefault(require("./src/routes/log.js"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
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
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            console.log("CORS: Allowing origin:", origin);
            callback(null, true);
        }
        else {
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
}));
// Test endpoint for CORS debugging
app.get("/api/test", (req, res) => {
    res.json({
        message: "CORS test successful",
        origin: req.headers.origin,
        timestamp: new Date().toISOString()
    });
});
app.use("/api/auth", auth_js_1.default);
app.use("/api/user", user_js_1.default);
app.use("/api/file", upload_js_1.default);
app.use("/api/forecast", forecast_js_1.default);
app.use("/api/log", log_js_1.default);
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
