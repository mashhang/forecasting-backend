import { Router } from "express";
import prisma from "../lib/prisma";
import { generateForecast, analyzeVariance } from "../services/forecastingService";

const router = Router();

router.get("/generate/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const { department, seasonalityPeriod, alpha, beta, gamma } = req.query;

    const parsedSeasonalityPeriod = seasonalityPeriod ? Number(seasonalityPeriod) : 4;
    const parsedAlpha = alpha ? Number(alpha) : 0.5;
    const parsedBeta = beta ? Number(beta) : 0.3;
    const parsedGamma = gamma ? Number(gamma) : 0.2;

    // Fetch historical data for forecasting
    const proposals = await prisma.budgetProposal.findMany({
      where: {
        authorId: userId,
      },
      include: {
        lineItems: {
          include: { category: true, allocations: true },
        },
      },
    });

    const historicalData = proposals.flatMap((proposal) =>
      proposal.lineItems
        .filter((item: any) => !department || item.department === department)
        .map((item: any) => {
        const q1 = item.allocations.find((a: any) => a.quarter === 1)?.proposedAmount || 0;
        const q2 = item.allocations.find((a: any) => a.quarter === 2)?.proposedAmount || 0;
        const q3 = item.allocations.find((a: any) => a.quarter === 3)?.proposedAmount || 0;
        const q4 = item.allocations.find((a: any) => a.quarter === 4)?.proposedAmount || 0;
        const total = q1 + q2 + q3 + q4;

        return {
          description: item.description,
          justification: item.justification,
          category: item.category?.name || "Uncategorized",
          department: item.department,
          year: item.year, // Get year from BudgetLineItem directly
          q1,
          q2,
          q3,
          q4,
          total,
        };
      })
    );

    // Generate forecast
    const forecasts = await generateForecast(
      historicalData,
      String(department),
      parsedSeasonalityPeriod,
      parsedAlpha,
      parsedBeta,
      parsedGamma
    );

    // Analyze variance (for now, comparing forecasts against themselves as a placeholder)
    const varianceAnalysis = await analyzeVariance(forecasts, historicalData);

    res.json({ forecasts, varianceAnalysis });
  } catch (error) {
    console.error("Error generating forecast or analyzing variance:", error);
    res.status(500).json({ error: "Failed to generate forecast or analyze variance." });
  }
});

router.get("/departments/:userId", async (req, res) => {
  console.log("Received request for departments!");
  try {
    const userId = req.params.userId;
    console.log("Fetching departments for userId:", userId);
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    // Get all unique departments from all budget line items, not just user's proposals
    const lineItems = await (prisma.budgetLineItem as any).findMany({
      select: {
        department: true,
      },
      distinct: ['department'],
    });

    console.log("All line items with departments:", JSON.stringify(lineItems, null, 2));

    const departments = lineItems
      .map((item: any) => item.department)
      .filter(Boolean); // Remove null/undefined departments

    console.log("Unique departments before sending:", departments);

    res.json({ departments });
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({ error: "Failed to fetch departments." });
  }
});

export default router;
