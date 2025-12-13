import { GoogleGenAI, Type } from '@google/genai';
import { ProgressionConfig, ProgressionAction, BatchStats } from '../types';

let genAI: GoogleGenAI | null = null;

const getAI = () => {
  if (!genAI) {
    if (process.env.API_KEY) {
      genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
  }
  return genAI;
};

export const generateStrategyFromDescription = async (description: string): Promise<ProgressionConfig | null> => {
  const ai = getAI();
  if (!ai) throw new Error("API Key not found");

  const prompt = `
    You are a roulette strategy expert. Convert the user's natural language description of a betting progression strategy into a structured configuration.
    
    The user says: "${description}"

    Available Actions:
    - RESET: Go back to base unit.
    - MULTIPLY: Multiply current bet by X (e.g. Martingale is Multiply by 2 on loss).
    - ADD_UNITS: Add X base units to current bet.
    - SUBTRACT_UNITS: Subtract X base units from current bet (min 1 unit).
    - DO_NOTHING: Keep bet same.
    - FIBONACCI: Use Fibonacci sequence. Value determines steps (e.g. on loss move 1 step forward, on win move 2 steps back).
    
    New Logic Fields:
    - resetOnSessionProfit: Amount of profit in a mini-sequence that triggers a reset of the bet size (e.g. "Reset after winning $150").
    - useResetOnSessionProfit: Boolean, true if the user explicitly mentions resetting after a certain profit.
    - totalProfitGoal: The total target profit to end the session.
    - useTotalProfitGoal: Boolean, true if the user explicitly mentions a target profit to stop.
    - stopLoss: Max loss limit.

    Return JSON matching the schema.
    If the strategy is unclear, provide a safe default (Martingale-like or Flat betting).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            onWinAction: { type: Type.STRING, enum: Object.values(ProgressionAction) },
            onWinValue: { type: Type.NUMBER },
            onLossAction: { type: Type.STRING, enum: Object.values(ProgressionAction) },
            onLossValue: { type: Type.NUMBER },
            stopLoss: { type: Type.NUMBER },
            totalProfitGoal: { type: Type.NUMBER },
            useTotalProfitGoal: { type: Type.BOOLEAN },
            resetOnSessionProfit: { type: Type.NUMBER },
            useResetOnSessionProfit: { type: Type.BOOLEAN },
            baseUnit: { type: Type.NUMBER }
          },
          required: ['onWinAction', 'onWinValue', 'onLossAction', 'onLossValue', 'baseUnit']
        }
      }
    });

    if (response.text) {
        return JSON.parse(response.text) as ProgressionConfig;
    }
    return null;
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
};

export const analyzeSimulationResults = async (initialBalance: number, finalBalance: number, totalSpins: number, history: any[]): Promise<string> => {
  const ai = getAI();
  if (!ai) return "AI Analysis Unavailable: No API Key.";

  const winRate = history.filter(h => h.outcome > 0).length / totalSpins;
  
  const prompt = `
    Analyze these Roulette simulation results:
    - Starting Bankroll: $${initialBalance}
    - Final Bankroll: $${finalBalance}
    - Total Spins: ${totalSpins}
    - Win Rate: ${(winRate * 100).toFixed(2)}%
    
    Briefly explain the performance. Was it luck? Did the progression help or hurt? Mention the risks of the strategy used if apparent (e.g., exponential growth).
    Keep it under 150 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No analysis generated.";
  } catch (e) {
    return "Error generating analysis.";
  }
};

export const analyzeBatchResults = async (stats: BatchStats): Promise<string> => {
  const ai = getAI();
  if (!ai) return "AI Analysis Unavailable: No API Key.";

  const prompt = `
    Analyze these batch simulation results for a Roulette Strategy:
    - Total Simulations: ${stats.totalSimulations}
    - Sessions Won (Profit): ${stats.wins}
    - Sessions Lost (Busted/Stop Loss): ${stats.losses}
    - Average Final Bankroll: $${stats.avgFinalBankroll.toFixed(2)}
    - Best Run: $${stats.bestRun}
    - Worst Run: $${stats.worstRun}
    
    Is this strategy sustainable long-term based on these Monte Carlo results? What are the key risks? Keep it concise (under 100 words).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No analysis generated.";
  } catch (e) {
    return "Error generating batch analysis.";
  }
};