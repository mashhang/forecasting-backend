"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const router = (0, express_1.Router)();
router.post("/", async (req, res) => {
    try {
        const { level, message, userId, userName } = req.body;
        if (!level || !message) {
            return res.status(400).json({ error: "Missing required fields: level or message" });
        }
        const log = await prisma.systemLog.create({
            data: {
                level,
                message,
                userId,
                userName,
            },
        });
        res.status(201).json(log);
    }
    catch (error) {
        console.error("Error saving log:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/", async (req, res) => {
    try {
        const logs = await prisma.systemLog.findMany({
            orderBy: {
                timestamp: "asc",
            },
            take: 50, // Limit to the last 50 log entries for performance
        });
        res.status(200).json(logs);
    }
    catch (error) {
        console.error("Error fetching logs:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
