"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || "default_secret";
router.post("/login", async (req, res) => {
    try {
        const { id, email, password } = req.body;
        let user;
        if (id) {
            user = await prisma.user.findUnique({ where: { id: String(id) } });
        }
        else if (email) {
            user = await prisma.user.findUnique({ where: { email } });
        }
        if (!user || !(await bcrypt_1.default.compare(password, user.password))) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const token = jsonwebtoken_1.default.sign({ id: String(user.id), role: user.role }, JWT_SECRET, { expiresIn: "1h" });
        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                firstLogin: user.firstLogin,
            },
        });
    }
    catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/authenticateUser", async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res
                .status(401)
                .json({ error: "Unauthorized: No token provided" });
        }
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: String(decoded.id) },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        req.user = user;
        next();
    }
    catch (error) {
        console.error("Authentication Error:", error);
        res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
});
router.get("/profile", async (req, res) => {
    if (!req.user) {
        return res.status(404).json({ error: "User not found" });
    }
    res.json({ user: req.user });
});
exports.default = router;
