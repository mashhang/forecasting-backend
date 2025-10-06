import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "../../generated/prisma";
const prisma = new PrismaClient();
const router = Router();
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
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const token = jwt.sign({ id: String(user.id), role: user.role }, JWT_SECRET, { expiresIn: "1h" });
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
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: String(decoded.userId) },
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
export default router;
