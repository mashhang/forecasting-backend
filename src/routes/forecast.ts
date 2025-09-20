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
          where: department ? { department: String(department) } : {},
          include: { category: true, allocations: true },
        },
      },
    });

    const historicalData = proposals.flatMap((proposal) =>
      proposal.lineItems.map((item) => {
        const q1 = item.allocations.find((a) => a.quarter === 1)?.proposedAmount || 0;
        const q2 = item.allocations.find((a) => a.quarter === 2)?.proposedAmount || 0;
        const q3 = item.allocations.find((a) => a.quarter === 3)?.proposedAmount || 0;
        const q4 = item.allocations.find((a) => a.quarter === 4)?.proposedAmount || 0;
        const total = q1 + q2 + q3 + q4;

        return {
          description: item.description,
          justification: item.justification,
          category: (item as any).category?.name || "Uncategorized",
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

    const proposals = await prisma.budgetProposal.findMany({
      where: {
        authorId: userId,
      },
      select: {
        id: true,
        lineItems: {
          select: {
            department: true,
          },
        },
      },
    });

    console.log("Proposals found:", JSON.stringify(proposals, null, 2));

    const departments = proposals.flatMap((proposal) =>
      proposal.lineItems.map((item) => item.department)
    );

    const uniqueDepartments = Array.from(new Set(departments)).filter(Boolean);

    console.log("Unique departments before sending:", uniqueDepartments);

    res.json({ departments: uniqueDepartments });
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({ error: "Failed to fetch departments." });
  }
});

export default router;
