import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import mandiRoutes from "./routes/mandi.routes.js";
import { initMLService } from "./services/mlService.js";

dotenv.config({
  path: "./.env",
});

console.log("Government API key loaded:", !!process.env.GOV_API_KEY);

const app = express();
const port = process.env.PORT || 8000;

// Permissive CORS for local frontend development
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

// Mount routes under /api/v1/mandi
app.use("/api/v1/mandi", mandiRoutes);

// Also mount /predict directly at root to satisfy technical requirement: POST /predict
app.use("/predict", (req, res, next) => {
  req.url = "/predict";
  return mandiRoutes(req, res, next);
});

app.get("/", (req, res) => {
  res.json({
    service: "MandiMantra Backend API",
    status: "running",
    endpoints: {
      predict: "POST /api/v1/mandi/predict or POST /predict",
      prediction_config: "GET /api/v1/mandi/prediction-config",
      prices: "GET /api/v1/mandi/prices",
      locations: "GET /api/v1/mandi/locations",
      states: "GET /api/v1/mandi/states",
    },
  });
});

app.listen(port, async () => {
  console.log(`Server is listening on port http://localhost:${port}`);
  // Load trained ML models once at server startup
  await initMLService();
});

console.log("Welcome to MandiMantra");
