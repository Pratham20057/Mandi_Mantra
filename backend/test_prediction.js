import { initMLService, callMLPrediction } from "./src/services/mlService.js";

async function runTest() {
  console.log("=== Testing Backend ML Connection ===");
  await initMLService();

  console.log("\nTesting Prediction for Wheat (7 days)...");
  const wheat7 = await callMLPrediction({
    crop: "Wheat",
    days: 7,
    currentPrice: 2600.0,
    city: "Ghaziabad",
    mandi: "Ghaziabad Mandi"
  });
  console.log("Wheat 7d Result:", {
    crop: wheat7.crop,
    days: wheat7.days,
    current_price: wheat7.current_price,
    predicted_price: wheat7.predicted_price,
    recommendation: wheat7.recommendation,
    reason: wheat7.reason,
    confidence: wheat7.confidence
  });

  console.log("\nTesting Prediction for Tomato (14 days)...");
  const tomato14 = await callMLPrediction({
    crop: "Tomato",
    days: 14,
    currentPrice: 1500.0,
    city: "Ghaziabad",
    mandi: "Ghaziabad Mandi"
  });
  console.log("Tomato 14d Result:", {
    crop: tomato14.crop,
    days: tomato14.days,
    current_price: tomato14.current_price,
    predicted_price: tomato14.predicted_price,
    net_gain_loss_rs: tomato14.net_gain_loss_rs,
    recommendation: tomato14.recommendation,
    reason: tomato14.reason,
    confidence: tomato14.confidence
  });

  console.log("\nAll backend ML connection tests passed successfully!");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
