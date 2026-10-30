import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ML Service Configuration
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:5001";
const MANDI_MODEL_ROOT = path.resolve(__dirname, "../../../../");
const ML_SERVER_SCRIPT = path.join(MANDI_MODEL_ROOT, "ml_server.py");

let mlServerProcess = null;

// Fallback verified prices from Ghaziabad Mandi dataset (used when Govt API has no record today)
export const FALLBACK_PRICES = {
  "Green Chilli": 5163.30,
  "Potato": 610.00,
  "Rice": 2383.20,
  "Tomato": 1131.00,
  "Wheat": 2586.20,
};

export const SUPPORTED_CROPS = [
  "Green Chilli",
  "Potato",
  "Rice",
  "Tomato",
  "Wheat",
];

export const SUPPORTED_CITIES = ["Ghaziabad"];
export const VALID_HORIZONS = [1, 7, 14];

/**
 * Checks if the ML Flask server is alive at ML_SERVICE_URL
 */
export async function checkMLServerHealth() {
  try {
    const res = await fetch(`${ML_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      return { alive: true, data };
    }
    return { alive: false };
  } catch (err) {
    return { alive: false, error: err.message };
  }
}

/**
 * Spawns the Python ML service once on server startup if not already running.
 * Models are loaded once at startup in memory.
 */
export async function initMLService() {
  console.log("Checking ML Prediction Service status...");
  const health = await checkMLServerHealth();

  if (health.alive) {
    console.log("ML Prediction Service is already active and healthy on", ML_SERVICE_URL);
    return;
  }

  console.log("ML Service not responding. Starting in-memory Python ML server...");

  if (!fs.existsSync(ML_SERVER_SCRIPT)) {
    console.error("Warning: ml_server.py not found at:", ML_SERVER_SCRIPT);
    return;
  }

  try {
    mlServerProcess = spawn("python", [ML_SERVER_SCRIPT], {
      cwd: MANDI_MODEL_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    mlServerProcess.stdout.on("data", (data) => {
      console.log(`[ML Server]: ${data.toString().trim()}`);
    });

    mlServerProcess.stderr.on("data", (data) => {
      console.error(`[ML Server Error]: ${data.toString().trim()}`);
    });

    mlServerProcess.on("close", (code) => {
      console.log(`ML Server process exited with code ${code}`);
      mlServerProcess = null;
    });

    // Wait up to 10 seconds for ML server to finish pre-loading all 15 models
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const check = await checkMLServerHealth();
      if (check.alive) {
        console.log("ML Server initialized and all 15 models loaded into memory successfully.");
        return;
      }
    }
    console.warn("ML Server did not respond within 10s, will retry on request.");
  } catch (err) {
    console.error("Failed to spawn Python ML Server:", err);
  }
}

/**
 * Calls the in-memory ML server to predict price change over horizon.
 */
export async function callMLPrediction({ crop, days, currentPrice, priceAsOf, city, mandi }) {
  const payload = {
    city: city || "Ghaziabad",
    mandi: mandi || "Ghaziabad Mandi",
    crop,
    days: Number(days),
    current_price: Number(currentPrice),
    current_price_date: priceAsOf || null,
  };

  const response = await fetch(`${ML_SERVICE_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000), // 8-second timeout
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(errorText);
    } catch {
      parsed = { message: errorText };
    }
    throw new Error(parsed.message || `ML Server responded with HTTP ${response.status}`);
  }

  return await response.json();
}
