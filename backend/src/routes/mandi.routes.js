import { Router } from "express";
import {
  callMLPrediction,
  SUPPORTED_CROPS,
  SUPPORTED_CITIES,
  VALID_HORIZONS,
} from "../services/mlService.js";

const router = Router();
const apiCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;
const LATEST_GHAZIABAD_MARKET = "Latest available in Ghaziabad";
const AGMARKNET_API = "https://api.agmarknet.gov.in/v1";
let agmarknetFiltersPromise = null;

const arrivalTimestamp = (value) => {
  if (!value) return 0;
  const text = String(value).trim();
  const dayFirst = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayFirst) {
    return Date.UTC(Number(dayFirst[3]), Number(dayFirst[2]) - 1, Number(dayFirst[1]));
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseModalPrice = (value) => {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * Reusable helper to query Government Mandi API (data.gov.in) with caching and timeout.
 */
const fetchGovernmentAPI = async (params, timeoutMs = 15000) => {
  const url = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?${params.toString()}`;

  const cachedData = apiCache.get(url);

  if (cachedData && cachedData.expiresAt > Date.now()) {
    console.log("Using cached government API data");
    return cachedData.data;
  }

  console.log("Fetching data from Government API...");

  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();

  console.log("Government API status:", response.status);

  if (!response.ok) {
    console.error("Government API error response:", text);
    throw new Error(`Government API returned ${response.status}`);
  }

  const data = JSON.parse(text);

  apiCache.set(url, {
    data,
    expiresAt: Date.now() + CACHE_DURATION,
  });

  return data;
};

const fetchAgmarknet = async (path, params = {}) => {
  const url = new URL(`${AGMARKNET_API}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const cacheKey = url.toString();
  const cached = apiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const response = await fetch(cacheKey, {
    headers: {
      Accept: "application/json, text/plain, */*",
      Origin: "https://agmarknet.gov.in",
      Referer: "https://agmarknet.gov.in/",
      "User-Agent": "Mozilla/5.0",
    },
    signal: AbortSignal.timeout(12000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Agmarknet API returned ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = JSON.parse(text);
  apiCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_DURATION });
  return data;
};

const getAgmarknetFilters = async () => {
  if (!agmarknetFiltersPromise) {
    agmarknetFiltersPromise = fetchAgmarknet("/daily-price-arrival/filters");
  }
  try {
    return await agmarknetFiltersPromise;
  } catch (error) {
    agmarknetFiltersPromise = null;
    throw error;
  }
};

const getUttarPradeshMarketOptions = async (districtName) => {
  const filters = await getAgmarknetFilters();
  const state = filters.data.state_data.find(
    (item) => item.state_name?.trim().toLowerCase() === "uttar pradesh",
  );
  const district = filters.data.district_data.find(
    (item) =>
      item.state_id === state?.state_id &&
      item.district_name?.trim().toLowerCase() === districtName?.trim().toLowerCase(),
  );
  if (!state || !district) return [];

  return filters.data.market_data
    .filter((item) => item.state_id === state.state_id && item.district_id === district.id)
    .map((item) => ({ name: item.mkt_name.trim(), id: item.id, stateId: state.state_id }))
    .filter((item) => item.name)
    .sort((a, b) => a.name.localeCompare(b.name));
};

const getUttarPradeshLatestPriceRecords = async ({ crop, district: districtName, market }) => {
  const filters = await getAgmarknetFilters();
  const state = filters.data.state_data.find(
    (item) => item.state_name?.trim().toLowerCase() === "uttar pradesh",
  );
  const district = filters.data.district_data.find(
    (item) =>
      item.state_id === state?.state_id &&
      item.district_name?.trim().toLowerCase() === districtName?.trim().toLowerCase(),
  );
  const commodity = filters.data.cmdt_data.find(
    (item) => item.cmdt_name?.trim().toLowerCase() === crop.trim().toLowerCase(),
  );
  if (!state || !district || !commodity) return [];

  const allMarkets = await getUttarPradeshMarketOptions(districtName);
  const isLatestMarket = !market || market === LATEST_GHAZIABAD_MARKET;
  const selectedMarket = isLatestMarket
    ? null
    : allMarkets.find((item) => item.name.trim().toLowerCase() === market.trim().toLowerCase());
  // Prefer the requested mandi. If it has no report for this crop, search the
  // district's other mandis so a valid district-level quote can still be shown.
  // The returned record retains its real market name so the UI never labels a
  // different mandi's price as the selected mandi's price.
  const requested = selectedMarket
    ? [selectedMarket]
    : allMarkets;

  const reports = await Promise.all(
    requested.map(async (marketInfo) => {
      const report = await fetchAgmarknet("/prices-and-arrivals/market-price/lastweek", {
        marketId: marketInfo.id,
        stateId: state.state_id,
        commodityId: commodity.cmdt_id,
        includeExcel: false,
      });

      const dateColumns = (report.columns || [])
        .map((column) => column.key)
        .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
        .sort((a, b) => Date.parse(b) - Date.parse(a));
      const today = new Date().toISOString().slice(0, 10);
      const rows = (report.data || []).flatMap((row) => {
        const date = dateColumns.find((key) => key <= today && parseModalPrice(row[key]));
        if (!date) return [];
        return [{
          state: "Uttar Pradesh",
          district: districtName,
          market: marketInfo.name,
          commodity: crop,
          variety: row.variety || "",
          grade: "",
          arrival_date: date,
          min_price: null,
          max_price: null,
          modal_price: parseModalPrice(row[date]),
        }];
      });
      return rows;
    }),
  );

  let recentRecords = reports.flat();
  if (!recentRecords.length && selectedMarket) {
    const otherMarkets = allMarkets.filter((item) => item.id !== selectedMarket.id);
    const districtReports = await Promise.all(
      otherMarkets.map(async (marketInfo) => {
        try {
          const report = await fetchAgmarknet("/prices-and-arrivals/market-price/lastweek", {
            marketId: marketInfo.id,
            stateId: state.state_id,
            commodityId: commodity.cmdt_id,
            includeExcel: false,
          });
          const dateColumns = (report.columns || [])
            .map((column) => column.key)
            .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
            .sort((a, b) => Date.parse(b) - Date.parse(a));
          const today = new Date().toISOString().slice(0, 10);
          return (report.data || []).flatMap((row) => {
            const date = dateColumns.find((key) => key <= today && parseModalPrice(row[key]));
            if (!date) return [];
            return [{
              state: "Uttar Pradesh",
              district: districtName,
              market: marketInfo.name,
              commodity: crop,
              variety: row.variety || "",
              grade: "",
              arrival_date: date,
              min_price: null,
              max_price: null,
              modal_price: parseModalPrice(row[date]),
            }];
          });
        } catch (error) {
          console.warn(`Agmarknet lookup failed for ${marketInfo.name}:`, error.message);
          return [];
        }
      }),
    );
    recentRecords = districtReports.flat();
  }
  if (recentRecords.length) {
    return recentRecords.sort(
      (a, b) => arrivalTimestamp(b.arrival_date) - arrivalTimestamp(a.arrival_date),
    );
  }

  return [];
};

// -------------------------------------------------------------------------
// Existing Routes
// -------------------------------------------------------------------------

// Get states
router.get("/states", async (req, res) => {
  try {
    const agmarknet = await getAgmarknetFilters();
    const agmarknetStates = (agmarknet.data.state_data || [])
      .filter((item) => item.state_id !== 100000 && item.state_name)
      .map((item) => item.state_name)
      .sort((a, b) => a.localeCompare(b));
    if (agmarknetStates.length) return res.json(agmarknetStates);

    if (!process.env.GOV_API_KEY?.trim()) {
      return res.status(503).json({
        message: "Government API key is missing. Add GOV_API_KEY to backend/.env and restart the backend.",
      });
    }

    const params = new URLSearchParams({
      "api-key": process.env.GOV_API_KEY,
      format: "json",
      limit: "1000",
      offset: "0",
    });

    const data = await fetchGovernmentAPI(params);

    if (!data.records) {
      return res.status(500).json({
        message: "No records received from Government API",
      });
    }

    const states = [
      ...new Set(data.records.map((record) => record.state).filter(Boolean)),
    ].sort();

    console.log("States found:", states);

    return res.json(states);
  } catch (error) {
    console.log("State API error:", error);

    return res.status(500).json({
      message: "State API error",
      error: error.message,
    });
  }
});

// Get districts or markets
router.get("/locations", async (req, res) => {
  try {
    const { state, district } = req.query;

    if (!state) {
      return res.status(400).json({
        message: "State is required",
      });
    }

    if (state.trim().toLowerCase() === "uttar pradesh") {
      const filters = await getAgmarknetFilters();
      const stateInfo = filters.data.state_data.find(
        (item) => item.state_name?.trim().toLowerCase() === "uttar pradesh",
      );
      if (stateInfo) {
        if (!district) {
          const districts = filters.data.district_data
            .filter((item) => item.state_id === stateInfo.state_id && item.district_name)
            .map((item) => item.district_name)
            .sort((a, b) => a.localeCompare(b));
          return res.json(districts);
        }
        const districtInfo = filters.data.district_data.find(
          (item) =>
            item.state_id === stateInfo.state_id &&
            item.district_name?.trim().toLowerCase() === district.trim().toLowerCase(),
        );
        if (districtInfo) {
          return res.json(
            filters.data.market_data
              .filter(
                (item) =>
                  item.state_id === stateInfo.state_id &&
                  item.district_id === districtInfo.id &&
                  item.mkt_name,
              )
              .map((item) => item.mkt_name.trim())
              .sort((a, b) => a.localeCompare(b)),
          );
        }
      }
    }

    const params = new URLSearchParams({
      "api-key": process.env.GOV_API_KEY,
      format: "json",
      limit: "1000",
    });

    // data.gov.in exposes this resource's state filter as `state.keyword`.
    params.append("filters[state.keyword]", state);

    if (district) {
      params.append("filters[district]", district);
    }

    const data = await fetchGovernmentAPI(params);

    console.log("Location search:", {
      state,
      district,
      records: data.records?.length || 0,
    });

    if (!data.records) {
      return res.json([]);
    }

    const values = district
      ? [
          ...new Set(
            data.records.map((record) => record.market).filter(Boolean),
          ),
        ].sort((a, b) => a.localeCompare(b))
      : [
          ...new Set(
            data.records.map((record) => record.district).filter(Boolean),
          ),
        ].sort((a, b) => a.localeCompare(b));

    res.json(values);
  } catch (error) {
    console.log("Location API error:", error);

    res.status(500).json({
      message: "Failed to fetch locations",
    });
  }
});

// Get commodities for a particular market
router.get("/commodities", async (req, res) => {
  try {
    const { state, district, market } = req.query;

    if (!state || !district || !market) {
      return res.status(400).json({
        message: "State, district and market are required",
      });
    }

    // data.gov.in often returns an empty market-level list for UP even while
    // Agmarknet has current reports. Don't offer the entire national catalog:
    // check each model crop against the live report and show only crops with a
    // quote for this mandi or another mandi in the selected district.
    if (state.trim().toLowerCase() === "uttar pradesh") {
      try {
        const availability = await Promise.all(
          SUPPORTED_CROPS.map(async (crop) => {
            try {
              const records = await getUttarPradeshLatestPriceRecords({ crop, district, market });
              return records.length ? crop : null;
            } catch (error) {
              console.warn(`Agmarknet availability lookup failed for ${crop}:`, error.message);
              return null;
            }
          }),
        );
        return res.json(availability.filter(Boolean).sort((a, b) => a.localeCompare(b)));
      } catch (error) {
        console.warn("Agmarknet commodity availability unavailable; trying data.gov.in:", error.message);
      }
    }

    const params = new URLSearchParams({
      "api-key": process.env.GOV_API_KEY,
      format: "json",
      limit: "1000",
    });

    params.append("filters[state.keyword]", state);
    params.append("filters[district]", district);
    params.append("filters[market]", market);

    const data = await fetchGovernmentAPI(params);

    console.log("Commodity search:", {
      state,
      district,
      market,
      records: data.records?.length || 0,
    });

    if (!data.records) {
      return res.json([]);
    }

    const commodities = [
      ...new Set(
        data.records.map((record) => record.commodity).filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b));

    res.json(commodities);
  } catch (error) {
    console.log("Commodity API error:", error);

    res.status(500).json({
      message: "Failed to fetch commodities",
    });
  }
});

// Get commodities for a district
router.get("/district-commodities", async (req, res) => {
  try {
    const { state, district } = req.query;

    if (!state || !district) {
      return res.status(400).json({
        message: "State and district are required",
      });
    }

    const params = new URLSearchParams({
      "api-key": process.env.GOV_API_KEY,
      format: "json",
      limit: "1000",
    });

    params.append("filters[state.keyword]", state);
    params.append("filters[district]", district);

    const data = await fetchGovernmentAPI(params);

    console.log("District commodity search:", {
      state,
      district,
      records: data.records?.length || 0,
    });

    if (!data.records) {
      return res.json([]);
    }

    const commodities = [
      ...new Set(
        data.records.map((record) => record.commodity).filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b));

    res.json(commodities);
  } catch (error) {
    console.log("District commodity API error:", error);

    res.status(500).json({
      message: "Failed to fetch district commodities",
    });
  }
});

// Get mandi prices
router.get("/prices", async (req, res) => {
  try {
    const { commodity, state, district, market } = req.query;
    if (!commodity && !state && !district && !market) {
      return res.status(400).json({
        message: "Please provide at least one search filter",
      });
    }

    console.log("Price search:", {
      commodity,
      state,
      district,
      market,
    });

    if (state?.trim().toLowerCase() === "uttar pradesh" && district && commodity) {
      // Prefer Agmarknet's latest-week district/market report. Some mandis or
      // commodities are missing from that feed, so fall back to data.gov.in
      // instead of returning an empty result immediately.
      try {
        const records = await getUttarPradeshLatestPriceRecords({ crop: commodity, district, market });
        if (records.length) {
          const usedOtherMarket = market &&
            market !== LATEST_GHAZIABAD_MARKET &&
            records[0].market?.trim().toLowerCase() !== market.trim().toLowerCase();
          return res.json({
            success: true,
            source: "Agmarknet",
            total: records.length,
            fallback_from_market: usedOtherMarket ? market : null,
            records,
          });
        }
      } catch (error) {
        console.warn("Agmarknet price lookup failed; trying data.gov.in:", error.message);
      }

      if (!process.env.GOV_API_KEY?.trim()) {
        return res.json({
          success: true,
          source: "Agmarknet",
          total: 0,
          records: [],
          message: "No recent Agmarknet price was found for this crop and mandi.",
        });
      }
    }

    const params = new URLSearchParams({
      "api-key": process.env.GOV_API_KEY,
      format: "json",
      limit: "1000",
      offset: "0",
    });

    if (commodity) {
      params.append("filters[commodity]", commodity);
    }

    if (state) {
      params.append("filters[state.keyword]", state);
    }

    if (district) {
      params.append("filters[district]", district);
    }

    if (market && market !== LATEST_GHAZIABAD_MARKET) {
      params.append("filters[market]", market);
    }

    let data = await fetchGovernmentAPI(params);

    // If a selected mandi has no quote, broaden only to the selected district.
    // Keep the market returned by the API on each row so the fallback source is
    // visible instead of presenting it as the originally selected mandi.
    if ((!Array.isArray(data.records) || data.records.length === 0) && market && market !== LATEST_GHAZIABAD_MARKET && district) {
      const districtParams = new URLSearchParams(params);
      districtParams.delete("filters[market]");
      const districtData = await fetchGovernmentAPI(districtParams);
      if (Array.isArray(districtData.records) && districtData.records.length) {
        data = { ...districtData, fallback_from_market: market };
      }
    }

    console.log("Records found:", data.records?.length || 0);
    const sortedRecords = Array.isArray(data.records)
      ? [...data.records].sort(
          (a, b) => arrivalTimestamp(b.arrival_date) - arrivalTimestamp(a.arrival_date),
        )
      : [];
    if (!sortedRecords.length) {
      return res.json({
        ...data,
        records: [],
        message: `No current price is reported for ${commodity || "this commodity"} at ${market || district || "this location"}. Choose a commodity or mandi with an available quote.`,
      });
    }

    return res.json({ ...data, records: sortedRecords });
  } catch (error) {
    console.log("Price API error:", error);

    res.status(500).json({
      message: "Failed to fetch mandi prices",
    });
  }
});

// Nearby Mandis
router.get("/nearby", async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        message: "Latitude and longitude are required",
      });
    }

    const params = new URLSearchParams({
      "api-key": process.env.GOV_API_KEY,
      format: "json",
      limit: "1000",
    });

    const response = await fetch(
      `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?${params.toString()}`,
    );

    const responseText = await response.text();

    if (!response.ok) {
      console.log("Nearby API status:", response.status);
      console.log("Nearby API response:", responseText);

      return res.status(502).json({
        message: "Government API request failed",
        status: response.status,
      });
    }

    let data;

    try {
      data = JSON.parse(responseText);
    } catch (error) {
      return res.status(502).json({
        message: "Government API did not return JSON",
      });
    }

    if (!data.records) {
      return res.json([]);
    }

    const locations = [
      ...new Map(
        data.records
          .filter((record) => record.state && record.district && record.market)
          .map((record) => [
            `${record.state}-${record.district}-${record.market}`,
            {
              state: record.state,
              district: record.district,
              market: record.market,
            },
          ]),
      ).values(),
    ];

    console.log("Nearby locations found:", locations.length);

    res.json(locations);
  } catch (error) {
    console.log("Nearby API error:", error);

    res.status(500).json({
      message: "Failed to find nearby mandis",
      error: error.message,
    });
  }
});

// -------------------------------------------------------------------------
// ML Prediction Configuration & Prediction Endpoint
// -------------------------------------------------------------------------

/**
 * Returns supported cities, mandis, crops and horizons for the prediction feature.
 */
router.get("/prediction-config", (req, res) => {
  res.json({
    supported_city: "Ghaziabad",
    mandis: [
      "Ghaziabad APMC",
      "Hapur APMC",
      "Muradnagar APMC",
      "Noida APMC",
      LATEST_GHAZIABAD_MARKET,
    ],
    model_market: "Ghaziabad",
    supported_crops: SUPPORTED_CROPS,
    supported_horizons: VALID_HORIZONS,
    unit: "Rs/quintal",
    disclaimer:
      "Mandi price predictions are statistical estimates derived from machine learning and historical market dynamics. Actual trading prices may vary.",
  });
});

/**
 * POST /predict
 *
 * Flow:
 * 1. Validates city: Only 'Ghaziabad' is permitted. For others, returns 'Not supported yet'.
 * 2. Validates mandi, crop, and horizon days (1, 7, 14).
 * 3. Uses the latest available Agmarknet price for the selected Ghaziabad mandi.
 * 4. Calls the in-memory ML model loaded once at server startup.
 * 5. Returns predicted price, gain/loss, recommendation, reason, and disclaimer.
 */
router.post("/predict", async (req, res) => {
  try {
    const {
      city,
      mandi,
      crop,
      days,
      current_price: submittedPrice,
      current_price_date: submittedPriceDate,
      current_price_market: submittedPriceMarket,
    } = req.body;

    // 1. City Validation: Strictly Ghaziabad only
    if (!city || city.trim().toLowerCase() !== "ghaziabad") {
      return res.status(400).json({
        success: false,
        error: "Not supported yet",
        message: `City '${city || "Unknown"}' is not supported yet. Only Ghaziabad mandi data was used to train the forecasting model.`,
      });
    }

    // 2. Horizon Days Validation: 1, 7, or 14
    const parsedDays = Number(days);
    if (!VALID_HORIZONS.includes(parsedDays)) {
      return res.status(400).json({
        success: false,
        error: "Invalid days",
        message: `Prediction horizon 'days' must be one of [1, 7, 14]. Received: ${days}`,
      });
    }

    // 3. Crop Validation
    if (!crop) {
      return res.status(400).json({
        success: false,
        error: "Crop required",
        message: "Crop name is required.",
      });
    }

    // Match crop case-insensitively or via alias
    const normalizedCrop = crop.trim().toLowerCase();
    const cropMap = {
      wheat: "Wheat",
      gehun: "Wheat",
      rice: "Rice",
      paddy: "Rice",
      chawal: "Rice",
      tomato: "Tomato",
      tamatar: "Tomato",
      potato: "Potato",
      aloo: "Potato",
      "green chilli": "Green Chilli",
      "green chili": "Green Chilli",
      chilli: "Green Chilli",
      mirchi: "Green Chilli",
    };

    const canonicalCrop = cropMap[normalizedCrop] || SUPPORTED_CROPS.find(
      (c) => c.toLowerCase() === normalizedCrop
    );

    if (!canonicalCrop) {
      return res.status(400).json({
        success: false,
        error: "Crop not supported",
        message: `Crop '${crop}' is not supported yet. Supported crops are: ${SUPPORTED_CROPS.join(", ")}.`,
      });
    }

    // Use a quote already fetched for the selected mandi when available. If the
    // price panel has no quote, fetch the latest Agmarknet market report here.
    const predictionMandi = "Ghaziabad";
    const requestedPriceMarket =
      submittedPriceMarket || mandi || predictionMandi;
    const useModelMarket = requestedPriceMarket === LATEST_GHAZIABAD_MARKET;
    let currentPrice = Number(submittedPrice);
    let priceAsOf = submittedPriceDate || null;
    let priceMarket = requestedPriceMarket;

    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      const latestRecord = (
        await getUttarPradeshLatestPriceRecords({
          crop: canonicalCrop,
          district: "Ghaziabad",
          market: useModelMarket ? LATEST_GHAZIABAD_MARKET : requestedPriceMarket,
        })
      )[0];

      if (!latestRecord) {
        return res.status(503).json({
          success: false,
          error: "CURRENT_PRICE_UNAVAILABLE",
          message: `Agmarknet has no recent ${canonicalCrop} price for ${useModelMarket ? "Ghaziabad mandis" : requestedPriceMarket}. Try another mandi or crop.`,
        });
      }

      currentPrice = latestRecord.modal_price;
      priceAsOf = latestRecord.arrival_date || null;
      priceMarket = latestRecord.market || requestedPriceMarket;
    }

    // 4. Call in-memory ML Prediction Model
    const mlResponse = await callMLPrediction({
      crop: canonicalCrop,
      days: parsedDays,
      currentPrice,
      priceAsOf,
      city: "Ghaziabad",
      mandi: predictionMandi,
    });

    if (!mlResponse || !mlResponse.success) {
      throw new Error(mlResponse?.message || "ML prediction computation failed.");
    }

    // 6. Output format satisfying all requirements
    currentPrice = mlResponse.current_price;
    const predictedPrice = mlResponse.predicted_price;
    const netGainLossRs = mlResponse.net_gain_loss_rs;
    const netGainLossPct = mlResponse.net_gain_loss_pct;
    const recommendation = mlResponse.recommendation;
    const reason = mlResponse.reason;

    return res.json({
      success: true,
      city: "Ghaziabad",
      mandi: predictionMandi,
      crop: canonicalCrop,
      days: parsedDays,
      unit: "Rs/quintal",
      model_market: mlResponse.model_market || predictionMandi,
      training_data_through: mlResponse.training_data_through || null,
      current_price: currentPrice,
      price_market: priceMarket,
      price_source: "Agmarknet latest-week market price",
      arrival_date: mlResponse.price_as_of || priceAsOf,
      predicted_price: predictedPrice,
      net_gain_loss_rs: netGainLossRs,
      net_gain_loss_pct: netGainLossPct,
      recommendation: recommendation,
      reason: reason,
      low_estimate: mlResponse.low_estimate,
      high_estimate: mlResponse.high_estimate,
      confidence: mlResponse.confidence,
      model_used: mlResponse.model_used,
      disclaimer: mlResponse.disclaimer,
    });
  } catch (error) {
    console.error("Prediction API error:", error);

    return res.status(500).json({
      success: false,
      error: "Prediction failed",
      message: error.message || "An error occurred while calculating the price forecast.",
    });
  }
});

export default router;
