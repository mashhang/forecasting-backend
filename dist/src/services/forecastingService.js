"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateForecast = generateForecast;
exports.analyzeVariance = analyzeVariance;
const nostradamus_1 = __importDefault(require("nostradamus"));
async function generateForecast(data, department = "", seasonalityPeriod = 4, alpha = 0.5, beta = 0.3, gamma = 0.2) {
    console.log("Generating forecast with Nostradamus (Holt-Winters) algorithm...");
    const forecastedData = [];
    // Group historical data by unique item (description + department + category)
    const groupedData = data.reduce((acc, item) => {
        const key = `${item.description}-${item.department}-${item.category}`;
        if (!acc[key]) {
            acc[key] = { ...item, timeSeries: [] }; // Keep other item details, add timeSeries array
        }
        acc[key].timeSeries.push(item.q1, item.q2, item.q3, item.q4);
        return acc;
    }, {});
    for (const key in groupedData) {
        const item = groupedData[key];
        const timeSeries = item.timeSeries.filter((val) => typeof val === 'number'); // Ensure data is numeric
        if (timeSeries.length < 2 * seasonalityPeriod) {
            console.warn(`Insufficient data for Holt-Winters for item ${key}. Need at least two full seasonal periods (${2 * seasonalityPeriod} data points) but got ${timeSeries.length}. Skipping forecast.`);
            forecastedData.push({
                ...item,
                forecastedQ1: 0, forecastedQ2: 0, forecastedQ3: 0, forecastedQ4: 0, forecastedTotal: 0
            });
            continue;
        }
        try {
            console.log("Time series for item", key, ":", timeSeries);
            console.log("Forecast parameters: alpha=", alpha, ", beta=", beta, ", gamma=", gamma, ", seasonalityPeriod=", seasonalityPeriod);
            const predictions = (0, nostradamus_1.default)(timeSeries, alpha, beta, gamma, seasonalityPeriod, seasonalityPeriod);
            console.log("Predictions from Nostradamus:", predictions);
            // Extract the actual forecast values (the last `seasonalityPeriod` values)
            const forecastValues = predictions.slice(-seasonalityPeriod);
            const nextYear = item.year + 1;
            const forecastedQ1 = forecastValues[0] || 0;
            const forecastedQ2 = forecastValues[1] || 0;
            const forecastedQ3 = forecastValues[2] || 0;
            const forecastedQ4 = forecastValues[3] || 0;
            const forecastedTotal = forecastedQ1 + forecastedQ2 + forecastedQ3 + forecastedQ4;
            forecastedData.push({
                ...item,
                year: nextYear,
                forecastedQ1,
                forecastedQ2,
                forecastedQ3,
                forecastedQ4,
                forecastedTotal,
            });
        }
        catch (err) {
            console.error(`Error forecasting for item ${key}:`, err);
            forecastedData.push({
                ...item,
                forecastedQ1: 0, forecastedQ2: 0, forecastedQ3: 0, forecastedQ4: 0, forecastedTotal: 0,
            });
        }
    }
    return forecastedData;
}
async function analyzeVariance(forecasts, historicalData) {
    console.log("Analyzing variance...");
    const varianceAnalysis = forecasts.map((forecastItem) => {
        const correspondingHistorical = historicalData.find((historicalItem) => historicalItem.description === forecastItem.description &&
            historicalItem.department === forecastItem.department &&
            historicalItem.category === forecastItem.category &&
            historicalItem.year === (forecastItem.year - 1));
        if (!correspondingHistorical) {
            return {
                ...forecastItem,
                varianceQ1: "N/A",
                varianceQ2: "N/A",
                varianceQ3: "N/A",
                varianceQ4: "N/A",
                varianceTotal: "N/A",
            };
        }
        return {
            ...forecastItem,
            varianceQ1: forecastItem.forecastedQ1 - correspondingHistorical.q1,
            varianceQ2: forecastItem.forecastedQ2 - correspondingHistorical.q2,
            varianceQ3: forecastItem.forecastedQ3 - correspondingHistorical.q3,
            varianceQ4: forecastItem.forecastedQ4 - correspondingHistorical.q4,
            varianceTotal: forecastItem.forecastedTotal - correspondingHistorical.total,
        };
    });
    return varianceAnalysis;
}
