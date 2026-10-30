import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function MandiPrice() {
  const location = useLocation();
  const navigate = useNavigate();

  const searchData = location.state?.searchData;
  const priceData = location.state?.priceData;
  const [forecastDays, setForecastDays] = useState(7);
  const [forecast, setForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState("");
  const forecastRequested = useRef(false);

  const records = priceData?.records || [];

  const record = records.length > 0 ? records[0] : null;

  const formatPrice = (price) => {
    if (price === null || price === undefined || price === "") {
      return "Not available";
    }

    return `₹${Number(price).toLocaleString("en-IN")}`;
  };

  const requestForecast = async () => {
    setForecastLoading(true);
    setForecastError("");
    setForecast(null);

    try {
      const response = await fetch("http://localhost:8000/api/v1/mandi/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: searchData?.district,
          mandi: searchData?.market,
          crop: searchData?.commodity,
          days: forecastDays,
          current_price: Number(record?.modal_price) > 0 ? Number(record.modal_price) : null,
          current_price_date: record?.arrival_date || null,
          current_price_market: record?.market || null,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to calculate the forecast.");
      }
      setForecast(data);
    } catch (error) {
      setForecastError(error.message || "Unable to calculate the forecast.");
    } finally {
      setForecastLoading(false);
    }
  };

  const ghaziabadModelCrop = ["green chilli", "green chili", "potato", "rice", "paddy", "tomato", "wheat"]
    .includes((searchData?.commodity || "").trim().toLowerCase());
  const canForecast = searchData?.district?.trim().toLowerCase() === "ghaziabad" && ghaziabadModelCrop;

  // Fetch the forecast as soon as a supported Ghaziabad crop's results open.
  useEffect(() => {
    if (!canForecast || forecastRequested.current) return;
    forecastRequested.current = true;
    requestForecast();
  }, [canForecast, requestForecast]);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-green-700">MandiMantra</h1>

          <button
            onClick={() => navigate("/Home")}
            className="text-sm text-gray-600 hover:text-green-700"
          >
            Search Again
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {record ? (
          <>
            <div className="mb-8">
              <h2 className="text-3xl font-semibold text-gray-800">
                {record.commodity}
              </h2>

              <p className="text-gray-500 mt-2">
                {record.market}, {record.district}, {record.state}
              </p>

              <p className="text-sm text-gray-400 mt-1">
                Latest available mandi price
              </p>
              {priceData?.fallback_from_market && (
                <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  No quote was available for {priceData.fallback_from_market}; showing the latest reported price from {record.market} in {record.district}.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white border rounded-lg p-6">
                <p className="text-sm text-gray-500">Minimum Price</p>

                <p className="text-2xl font-semibold text-gray-800 mt-2">
                  {formatPrice(record.min_price)}
                </p>

                <p className="text-xs text-gray-400 mt-1">per quintal</p>
              </div>

              <div className="bg-white border rounded-lg p-6">
                <p className="text-sm text-gray-500">Maximum Price</p>

                <p className="text-2xl font-semibold text-gray-800 mt-2">
                  {formatPrice(record.max_price)}
                </p>

                <p className="text-xs text-gray-400 mt-1">per quintal</p>
              </div>

              <div className="bg-white border rounded-lg p-6">
                <p className="text-sm text-gray-500">Modal Price</p>

                <p className="text-2xl font-semibold text-green-700 mt-2">
                  {formatPrice(record.modal_price)}
                </p>

                <p className="text-xs text-gray-400 mt-1">most common price</p>
              </div>
            </div>

            <div className="bg-white border rounded-lg p-6 mt-6">
              <h3 className="text-lg font-medium text-gray-800">
                Market Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                <div>
                  <p className="text-sm text-gray-500">Commodity</p>
                  <p className="text-gray-800 mt-1">{record.commodity}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Variety</p>
                  <p className="text-gray-800 mt-1">
                    {record.variety || "Not available"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Grade</p>
                  <p className="text-gray-800 mt-1">
                    {record.grade || "Not available"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Arrival Date</p>
                  <p className="text-gray-800 mt-1">
                    {record.arrival_date || "Not available"}
                  </p>
                </div>
              </div>
            </div>

            {records.length > 1 && (
              <div className="mt-8">
                <h3 className="text-xl font-medium text-gray-800 mb-4">
                  Other Available Records
                </h3>

                <div className="space-y-4">
                  {records.slice(1).map((item, index) => (
                    <div key={index} className="bg-white border rounded-lg p-5">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-800">
                            {item.variety || "Variety not available"}
                          </p>

                          <p className="text-sm text-gray-500 mt-1">
                            Grade: {item.grade || "Not available"}
                          </p>
                        </div>

                        <p className="text-lg font-semibold text-green-700">
                          {formatPrice(item.modal_price)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-medium text-gray-800">
              No mandi price data found
            </h2>

            <p className="text-gray-500 mt-2">
              {priceData?.apiError
                ? `The mandi price service could not fetch a quote: ${priceData.apiError}`
                : priceData?.message || "Try changing your commodity, district or market."}
            </p>
            {canForecast && <p className="mt-2 text-sm text-green-700">The Ghaziabad model prediction is shown separately below.</p>}

            {searchData && (
              <p className="text-sm text-gray-400 mt-2">
                Search: {searchData.commodity} — {searchData.market}
              </p>
            )}

            <button
              onClick={() => navigate("/Home")}
              className="mt-5 bg-green-600 text-white px-5 py-2.5 rounded-md hover:bg-green-700"
            >
              Search Again
            </button>
          </div>
        )}
        {canForecast && (
          <section className="mt-8 rounded-xl border border-green-200 bg-green-50 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-green-950">Ghaziabad mandi price prediction</h3>
                <p className="mt-1 text-sm text-green-800">{searchData.commodity} forecast from the Ghaziabad model, starting with the latest available government mandi price.</p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="forecast-days" className="mb-2 block text-sm text-gray-700">Forecast horizon</label>
                  <select id="forecast-days" value={forecastDays} onChange={(event) => setForecastDays(Number(event.target.value))} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm">
                    <option value={1}>1 day</option><option value={7}>7 days</option><option value={14}>14 days</option>
                  </select>
                </div>
                <button type="button" onClick={requestForecast} disabled={forecastLoading} className="rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-wait disabled:bg-slate-400">
                  {forecastLoading ? "Getting prediction…" : "Refresh prediction"}
                </button>
              </div>
            </div>
            {forecastLoading && <p className="mt-5 rounded-lg bg-white p-4 text-sm text-slate-600">Fetching prediction from the backend…</p>}
            {forecastError && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-white p-4 text-sm text-red-700">Prediction API: {forecastError}</p>}
            {forecast && (
              <div className="mt-5 rounded-xl border border-green-200 bg-white p-6 shadow-sm">
                <h4 className="mb-4 text-lg font-semibold text-green-950">Prediction result</h4>
                <p className="mb-4 text-xs text-slate-500">Model market: {forecast.model_market || "not reported by ML service"} · training data through {forecast.training_data_through || "not reported by ML service"} · method: {forecast.model_used || "not reported by ML service"}</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg bg-green-50 p-4"><p className="text-sm text-slate-500">Government mandi price</p><p className="mt-1 text-xl font-semibold">{formatPrice(forecast.current_price)}</p><p className="mt-1 text-xs text-slate-500">{forecast.price_market || forecast.mandi} · {forecast.arrival_date || "date not provided by API"}</p></div>
                  <div className="rounded-lg bg-green-50 p-4"><p className="text-sm text-slate-500">Predicted in {forecast.days} days</p><p className="mt-1 text-2xl font-bold text-green-800">{formatPrice(forecast.predicted_price)}</p><p className="mt-1 text-xs text-slate-500">Target date: {forecast.target_date}</p></div>
                  <div className="rounded-lg bg-green-50 p-4"><p className="text-sm text-slate-500">Estimated range</p><p className="mt-1 text-lg font-semibold">{formatPrice(forecast.low_estimate)} – {formatPrice(forecast.high_estimate)}</p><p className="mt-1 text-xs text-slate-500">Confidence: {forecast.confidence}</p></div>
                  <div className="rounded-lg bg-green-50 p-4"><p className="text-sm text-slate-500">Model outlook</p><p className="mt-1 text-lg font-semibold">{forecast.recommendation}</p><p className="mt-1 text-xs text-slate-500">{forecast.net_gain_loss_pct > 0 ? "+" : ""}{forecast.net_gain_loss_pct}% expected change</p></div>
                  <p className="text-sm leading-6 text-slate-600 sm:col-span-2 lg:col-span-4">{forecast.reason} {forecast.disclaimer}</p>
                </div>
              </div>
            )}
          </section>
        )}
        {record && searchData && !canForecast && (
          <p className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
            Forecasts are currently available only for Wheat, Rice, Tomato, Potato, and Green Chilli in Ghaziabad district.
          </p>
        )}
      </main>
    </div>
  );
}

export default MandiPrice;
