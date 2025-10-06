"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
// src/lib/prisma.ts
const prisma_1 = require("../../generated/prisma");
const globalForPrisma = global;
exports.prisma = globalForPrisma.prisma ||
    new prisma_1.PrismaClient({
        log: ["query", "error", "warn"],
    });
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = exports.prisma;
}
exports.default = exports.prisma;
