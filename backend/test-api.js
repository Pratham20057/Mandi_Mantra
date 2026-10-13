import dotenv from "dotenv";

dotenv.config({
  path: "./.env",
});

const url = new URL(
  "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070",
);

url.searchParams.set("api-key", process.env.GOV_API_KEY);
url.searchParams.set("format", "json");
url.searchParams.set("limit", "1");

try {
  console.log("Testing Government API connection...");

  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000),
  });

  console.log("HTTP Status:", response.status);

  const text = await response.text();

  console.log("Response:", text.slice(0, 500));
} catch (error) {
  console.log("Error name:", error.name);
  console.log("Error message:", error.message);
  console.log("Cause:", error.cause?.code || error.cause?.message);
}
