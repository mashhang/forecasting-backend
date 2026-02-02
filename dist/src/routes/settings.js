"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const router = (0, express_1.Router)();
// Get all settings
router.get("/", async (req, res) => {
    try {
        const settings = await prisma_1.default.systemSettings.findMany();
        // Convert to key-value object
        const settingsObj = {};
        settings.forEach((setting) => {
            // Try to parse as number, otherwise keep as string
            const numValue = parseFloat(setting.value);
            settingsObj[setting.key] = isNaN(numValue) ? setting.value : numValue;
        });
        res.json(settingsObj);
    }
    catch (error) {
        console.error("Error fetching settings:", error);
        res.status(500).json({ error: "Failed to fetch settings" });
    }
});
// Update multiple settings at once (must come before /:key route)
router.put("/", async (req, res) => {
    try {
        const settings = req.body;
        const userId = req.user?.id;
        const updates = Object.entries(settings).map(([key, value]) => prisma_1.default.systemSettings.upsert({
            where: { key },
            update: {
                value: String(value),
                updatedBy: userId || undefined,
            },
            create: {
                key,
                value: String(value),
                updatedBy: userId || undefined,
            },
        }));
        await Promise.all(updates);
        // Return updated settings
        const allSettings = await prisma_1.default.systemSettings.findMany();
        const settingsObj = {};
        allSettings.forEach((setting) => {
            const numValue = parseFloat(setting.value);
            settingsObj[setting.key] = isNaN(numValue) ? setting.value : numValue;
        });
        res.json(settingsObj);
    }
    catch (error) {
        console.error("Error updating settings:", error);
        res.status(500).json({ error: "Failed to update settings" });
    }
});
// Get a specific setting
router.get("/:key", async (req, res) => {
    try {
        const { key } = req.params;
        const setting = await prisma_1.default.systemSettings.findUnique({
            where: { key },
        });
        if (!setting) {
            return res.status(404).json({ error: "Setting not found" });
        }
        const numValue = parseFloat(setting.value);
        res.json({
            key: setting.key,
            value: isNaN(numValue) ? setting.value : numValue,
            description: setting.description,
        });
    }
    catch (error) {
        console.error("Error fetching setting:", error);
        res.status(500).json({ error: "Failed to fetch setting" });
    }
});
// Update or create a setting
router.put("/:key", async (req, res) => {
    try {
        const { key } = req.params;
        const { value, description } = req.body;
        const userId = req.user?.id;
        if (value === undefined) {
            return res.status(400).json({ error: "Value is required" });
        }
        const setting = await prisma_1.default.systemSettings.upsert({
            where: { key },
            update: {
                value: String(value),
                description: description || undefined,
                updatedBy: userId || undefined,
            },
            create: {
                key,
                value: String(value),
                description: description || undefined,
                updatedBy: userId || undefined,
            },
        });
        const numValue = parseFloat(setting.value);
        res.json({
            key: setting.key,
            value: isNaN(numValue) ? setting.value : numValue,
            description: setting.description,
        });
    }
    catch (error) {
        console.error("Error updating setting:", error);
        res.status(500).json({ error: "Failed to update setting" });
    }
});
exports.default = router;
