// src/routes/upload.ts
import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import csv from "csv-parser";
import { Readable } from "stream";
import prisma from "../lib/prisma";

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = (req as any).file;
    const userId = (req as any).body.userId;

    if (!file) return res.status(400).json({ error: "No file uploaded" });
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    // ✅ Check if user exists
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) return res.status(400).json({ error: "Invalid userId" });

    let rows: any[] = [];
    if (file.mimetype === "text/csv") {
      // ✅ Handle CSV file
      const stream = Readable.from(file.buffer.toString());
      await new Promise((resolve, reject) => {
        stream
          .pipe(csv())
          .on("data", (data) => rows.push(data))
          .on("end", resolve)
          .on("error", reject);
      });
    } else if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      // ✅ Read Excel file
      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    // ✅ Normalize rows
    const normalizedRows = rows.map((row) => {
      console.log("Raw row data:", row); // Log raw row data for debugging
      const parsedYear = Number(row.Year) || Number(row.year); // Explicitly try 'Year' or 'year'
      console.log("Parsed year:", parsedYear); // Log parsed year
      return {
        description: row.Description || row.description || row['ACCOUNT CATEGORY'] || "Untitled",
        justification: row.Justification || row.justification || null,
        category: row.Category || row.category || "Uncategorized",
        department: row.Department || row.department || "Unknown",
        year: parsedYear || new Date().getFullYear(), // Fallback if parsing fails
        q1: Number(row.Q1) || Number(row.q1) || Number(row['1ST QUARTER']) || 0,
        q2: Number(row.Q2) || Number(row.q2) || Number(row['2ND QUARTER']) || 0,
        q3: Number(row.Q3) || Number(row.q3) || Number(row['3RD QUARTER']) || 0,
        q4: Number(row.Q4) || Number(row.q4) || Number(row['4TH QUARTER']) || 0,
        total:
          (Number(row.Q1 || row.q1) || 0) +
          (Number(row.Q2 || row.q2) || 0) +
          (Number(row.Q3 || row.q3) || 0) +
          (Number(row.Q4 || row.q4) || 0),
      };
    });

    // ✅ Create new proposal
    const proposal = await prisma.budgetProposal.create({
      data: {
        title: `Uploaded Proposal - ${new Date().toISOString()}`,
        year: normalizedRows[0]?.year || new Date().getFullYear(), // Use the year from the first uploaded row
        authorId: userId,
      },
    });

    // ✅ Insert line items and allocations
    for (const row of normalizedRows) {
      const lineItem = await prisma.budgetLineItem.create({
        data: {
          description: row.description,
          justification: row.justification,
          department: row.department,
          year: row.year, // Save the year from the normalized row
          category: {
            connectOrCreate: {
              where: { name: row.category },
              create: { name: row.category },
            },
          },
          budgetProposal: { connect: { id: proposal.id } },
        },
      });

      const allocations = [
        { quarter: 1, proposedAmount: row.q1 },
        { quarter: 2, proposedAmount: row.q2 },
        { quarter: 3, proposedAmount: row.q3 },
        { quarter: 4, proposedAmount: row.q4 },
        { quarter: 0, proposedAmount: row.total }, // annual total
      ];

      for (const alloc of allocations) {
        if (alloc.proposedAmount > 0) {
          await prisma.budgetAllocation.create({
            data: {
              quarter: alloc.quarter,
              proposedAmount: alloc.proposedAmount,
              budgetLineItemId: lineItem.id,
            },
          });
        }
      }
    }

    res.json({
      success: true,
      count: normalizedRows.length,
      proposalId: proposal.id,
      rows: normalizedRows.map((row) => ({
        department: row.department || "N/A", // if you have this field in Excel
        year: row.year || new Date().getFullYear(),
        q1: row.q1,
        q2: row.q2,
        q3: row.q3,
        q4: row.q4,
        total: row.total,
      })),
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Upload failed", details: err });
  }
});

// Get all rows from proposals for this user
router.get("/rows/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const proposals = await prisma.budgetProposal.findMany({
      where: { authorId: userId },
      include: {
        lineItems: {
          include: { category: true, allocations: true },
        },
      },
    });

    const allRows = proposals.flatMap((proposal) =>
      proposal.lineItems.map((item) => {
        const q1 = item.allocations.find((a) => a.quarter === 1)?.proposedAmount || 0;
        const q2 = item.allocations.find((a) => a.quarter === 2)?.proposedAmount || 0;
        const q3 = item.allocations.find((a) => a.quarter === 3)?.proposedAmount || 0;
        const q4 = item.allocations.find((a) => a.quarter === 4)?.proposedAmount || 0;
        const totalAlloc = item.allocations.find((a) => a.quarter === 0)?.proposedAmount;
        const total = typeof totalAlloc === "number" ? totalAlloc : q1 + q2 + q3 + q4;

        return {
          description: item.description,
          justification: item.justification,
          category: item.category.name,
          department: item.department || "N/A",
          year: proposal.year,
          q1,
          q2,
          q3,
          q4,
          total,
        };
      })
    );

    res.json({ rows: allRows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch rows" });
  }
});

export default router;
