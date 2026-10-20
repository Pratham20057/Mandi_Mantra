import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  // Main search
  const [commodity, setCommodity] = useState("");
  const [state, setState] = useState("");
  const [states, setStates] = useState([]);
  const [district, setDistrict] = useState("");
  const [market, setMarket] = useState("");

  const [districts, setDistricts] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [commodities, setCommodities] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Location
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");

  // Compare search
  const [compareState, setCompareState] = useState("");
  const [compareDistrict, setCompareDistrict] = useState("");
  const [compareCommodity, setCompareCommodity] = useState("");

  const [compareDistricts, setCompareDistricts] = useState([]);
  const [compareCommodities, setCompareCommodities] = useState([]);

  const [comparePrices, setComparePrices] = useState([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");

 
  // Load States
  
  useEffect(() => {
    const fetchStates = async () => {
      try {
        setError("");

        const response = await fetch(
          "http://localhost:8000/api/v1/mandi/states",
        );

        if (!response.ok) {
          throw new Error("Failed to fetch states");
        }

        const data = await response.json();

        setStates(data);
      } catch (error) {
        console.log("Error fetching states:", error);
        setError(
          "Unable to load states. The Government price service may be temporarily unavailable.",
        );
      }
    };

    fetchStates();
  }, []);

  // Main Search - Districts
 
  useEffect(() => {
    if (!state) {
      setDistricts([]);
      setDistrict("");
      setMarkets([]);
      setMarket("");
      setCommodities([]);
      setCommodity("");
      return;
    }

    const fetchDistricts = async () => {
      try {
        setError("");

        const response = await fetch(
          `http://localhost:8000/api/v1/mandi/locations?state=${encodeURIComponent(
            state,
          )}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch districts");
        }

        const data = await response.json();

        setDistricts(data);
        setDistrict("");
        setMarkets([]);
        setMarket("");
        setCommodities([]);
        setCommodity("");
      } catch (error) {
        console.log("Error fetching districts:", error);
        setError("Unable to load districts.");
      }
    };

    fetchDistricts();
  }, [state]);

  // Main Search - Markets
  useEffect(() => {
    if (!state || !district) {
      setMarkets([]);
      setMarket("");
      setCommodities([]);
      setCommodity("");
      return;
    }

    const fetchMarkets = async () => {
      try {
        setError("");

        const response = await fetch(
          `http://localhost:8000/api/v1/mandi/locations?state=${encodeURIComponent(
            state,
          )}&district=${encodeURIComponent(district)}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch markets");
        }

        const data = await response.json();

        setMarkets(data);
        setMarket("");
        setCommodities([]);
        setCommodity("");
      } catch (error) {
        console.log("Error fetching markets:", error);
        setError("Unable to load mandis.");
      }
    };

    fetchMarkets();
  }, [state, district]);

  // Main Search - Commodities
  
  useEffect(() => {
    if (!state || !district || !market) {
      setCommodities([]);
      setCommodity("");
      return;
    }

    const fetchCommodities = async () => {
      try {
        setError("");

        const params = new URLSearchParams({
          state,
          district,
          market,
        });

        const response = await fetch(
          `http://localhost:8000/api/v1/mandi/commodities?${params.toString()}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch commodities");
        }

        const data = await response.json();

        setCommodities(data);
        setCommodity("");
      } catch (error) {
        console.log("Error fetching commodities:", error);
        setError("Unable to load commodities.");
      }
    };

    fetchCommodities();
  }, [state, district, market]);

  // Compare Search - Districts
  
  useEffect(() => {
    if (!compareState) {
      setCompareDistricts([]);
      setCompareDistrict("");
      setCompareCommodities([]);
      setCompareCommodity("");
      setComparePrices([]);
      return;
    }

    const fetchCompareDistricts = async () => {
      try {
        setCompareError("");

        const response = await fetch(
          `http://localhost:8000/api/v1/mandi/locations?state=${encodeURIComponent(
            compareState,
          )}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch comparison districts");
        }

        const data = await response.json();

        setCompareDistricts(data);
        setCompareDistrict("");
        setCompareCommodities([]);
        setCompareCommodity("");
        setComparePrices([]);
      } catch (error) {
        console.log("Error fetching comparison districts:", error);
        setCompareError("Unable to load districts.");
      }
    };

    fetchCompareDistricts();
  }, [compareState]);

  // Compare Search - Commodities

  useEffect(() => {
    if (!compareState || !compareDistrict) {
      setCompareCommodities([]);
      setCompareCommodity("");
      setComparePrices([]);
      return;
    }

    const fetchCompareCommodities = async () => {
      try {
        setCompareError("");

        const params = new URLSearchParams({
          state: compareState,
          district: compareDistrict,
        });

        const response = await fetch(
          `http://localhost:8000/api/v1/mandi/district-commodities?${params.toString()}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch comparison commodities");
        }

        const data = await response.json();

        setCompareCommodities(data);
        setCompareCommodity("");
        setComparePrices([]);
      } catch (error) {
        console.log("Error fetching comparison commodities:", error);
        setCompareError("Unable to load commodities.");
      }
    };

    fetchCompareCommodities();
  }, [compareState, compareDistrict]);

  // Use My Location
 
  const handleUseLocation = () => {
    setLocationMessage("");
    setError("");

    if (!navigator.geolocation) {
      setLocationMessage("Location is not supported by your browser.");
      return;
    }

    setLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;

          console.log("User location:", {
            latitude,
            longitude,
          });

          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
          );

          if (!response.ok) {
            throw new Error("Unable to find location");
          }

          const data = await response.json();

          console.log("Location data:", data);

          const address = data.address;

          const detectedState = address?.state || "";
          const detectedDistrict =
            address?.state_district ||
            address?.district ||
            address?.county ||
            "";

          if (!detectedState) {
            throw new Error("State could not be detected");
          }

          setState(detectedState);

          setLocationMessage(
            `Location detected: ${detectedDistrict}, ${detectedState}`,
          );
        } catch (error) {
          console.log("Location error:", error);

          setLocationMessage(
            "Unable to find your district from your location.",
          );
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        console.log("Location permission error:", error);

        if (error.code === 1) {
          setLocationMessage("Location permission was denied.");
        } else if (error.code === 2) {
          setLocationMessage("Unable to detect your location.");
        } else {
          setLocationMessage("Location request timed out.");
        }

        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  
  // Main Search
  const handleSearch = async (event) => {
    event.preventDefault();

    if (!state || !district || !market || !commodity) {
      setError("Please select all search details.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        commodity,
        state,
        district,
        market,
      });

      const response = await fetch(
        `http://localhost:8000/api/v1/mandi/prices?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch prices");
      }

      const data = await response.json();

      navigate("/MandiPrice", {
        state: {
          searchData: {
            commodity,
            state,
            district,
            market,
          },
          priceData: data,
        },
      });
    } catch (error) {
      console.log("Error fetching mandi prices:", error);
      setError("Unable to fetch mandi prices.");
    } finally {
      setLoading(false);
    }
  };

  // Compare Prices
  
  const handleCompare = async (event) => {
    event.preventDefault();

    if (!compareState || !compareDistrict || !compareCommodity) {
      setCompareError("Please select all comparison details.");
      return;
    }

    try {
      setCompareLoading(true);
      setCompareError("");
      setComparePrices([]);

      const params = new URLSearchParams({
        commodity: compareCommodity,
        state: compareState,
        district: compareDistrict,
      });

      const response = await fetch(
        `http://localhost:8000/api/v1/mandi/prices?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch comparison prices");
      }

      const data = await response.json();

      setComparePrices(data.records || []);

      if (!data.records || data.records.length === 0) {
        setCompareError("No price data found for this commodity.");
      }
    } catch (error) {
      console.log("Error comparing prices:", error);
      setCompareError("Unable to compare mandi prices.");
    } finally {
      setCompareLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-green-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="#" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-800 text-lg font-bold text-white">
              M
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight text-green-900">
                MandiMantra
              </h1>
              <p className="text-xs text-slate-500">
                Smarter mandi price discovery
              </p>
            </div>
          </a>

          <div className="flex items-center gap-5 text-sm font-medium text-slate-600 sm:gap-8">
            <a href="#" className="transition-colors hover:text-green-800">
              Home
            </a>

            <a
              href="#compare"
              className="transition-colors hover:text-green-800"
            >
              Compare Prices
            </a>

            <a href="#about" className="transition-colors hover:text-green-800">
              About
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Main Search */}
        <div className="mb-8">
          <h2 className="text-3xl font-semibold text-gray-800">
            Check Mandi Prices
          </h2>

          <p className="text-gray-500 mt-2">
            Find the latest available prices of agricultural commodities from
            different mandis.
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          className="bg-white border rounded-lg p-6 max-w-4xl"
        >
          <h3 className="text-lg font-medium text-gray-800 mb-5">
            Search Price
          </h3>

          {error && (
            <div className="mb-5 border border-red-200 bg-red-50 text-red-600 rounded-md px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {locationMessage && (
            <div className="mb-5 border border-green-200 bg-green-50 text-green-700 rounded-md px-4 py-3 text-sm">
              {locationMessage}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* State */}
            <div>
              <label className="block text-sm text-gray-700 mb-2">State</label>

              <select
                value={state}
                onChange={(event) => setState(event.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 bg-white outline-none focus:border-green-600"
              >
                <option value="">Select State</option>

                {states.map((stateName) => (
                  <option key={stateName} value={stateName}>
                    {stateName}
                  </option>
                ))}
              </select>
            </div>

            {/* District */}
            <div>
              <label className="block text-sm text-gray-700 mb-2">
                District
              </label>

              <select
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
                disabled={!state}
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 bg-white outline-none focus:border-green-600 disabled:bg-gray-100"
              >
                <option value="">
                  {state ? "Select District" : "Select State First"}
                </option>

                {districts.map((districtName) => (
                  <option key={districtName} value={districtName}>
                    {districtName}
                  </option>
                ))}
              </select>
            </div>

            {/* Market */}
            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Mandi / Market
              </label>

              <select
                value={market}
                onChange={(event) => setMarket(event.target.value)}
                disabled={!district}
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 bg-white outline-none focus:border-green-600 disabled:bg-gray-100"
              >
                <option value="">
                  {district ? "Select Mandi" : "Select District First"}
                </option>

                {markets.map((marketName) => (
                  <option key={marketName} value={marketName}>
                    {marketName}
                  </option>
                ))}
              </select>
            </div>

            {/* Commodity */}
            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Commodity
              </label>

              <select
                value={commodity}
                onChange={(event) => setCommodity(event.target.value)}
                disabled={!market}
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 bg-white outline-none focus:border-green-600 disabled:bg-gray-100"
              >
                <option value="">
                  {market ? "Select Commodity" : "Select Mandi First"}
                </option>

                {commodities.map((commodityName) => (
                  <option key={commodityName} value={commodityName}>
                    {commodityName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              disabled={!commodity || loading}
              className="bg-green-600 text-white px-6 py-2.5 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? "Searching..." : "Search"}
            </button>

            <button
              type="button"
              onClick={handleUseLocation}
              disabled={locationLoading}
              className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              {locationLoading ? "Detecting..." : "Use My Location"}
            </button>
          </div>
        </form>

        {/* Compare Prices */}
        <section id="compare" className="mt-14 max-w-5xl">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">
              Compare Mandi Prices
            </h2>

            <p className="text-gray-500 mt-2">
              Compare the latest available price of a commodity across different
              mandis in a district.
            </p>
          </div>

          <form
            onSubmit={handleCompare}
            className="bg-white border rounded-lg p-6"
          >
            {compareError && (
              <div className="mb-5 border border-red-200 bg-red-50 text-red-600 rounded-md px-4 py-3 text-sm">
                {compareError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Compare State */}
              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  State
                </label>

                <select
                  value={compareState}
                  onChange={(event) => setCompareState(event.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2.5 bg-white outline-none focus:border-green-600"
                >
                  <option value="">Select State</option>

                  {states.map((stateName) => (
                    <option key={stateName} value={stateName}>
                      {stateName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Compare District */}
              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  District
                </label>

                <select
                  value={compareDistrict}
                  onChange={(event) => setCompareDistrict(event.target.value)}
                  disabled={!compareState}
                  className="w-full border border-gray-300 rounded-md px-3 py-2.5 bg-white outline-none focus:border-green-600 disabled:bg-gray-100"
                >
                  <option value="">
                    {compareState ? "Select District" : "Select State First"}
                  </option>

                  {compareDistricts.map((districtName) => (
                    <option key={districtName} value={districtName}>
                      {districtName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Compare Commodity */}
              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Commodity
                </label>

                <select
                  value={compareCommodity}
                  onChange={(event) => setCompareCommodity(event.target.value)}
                  disabled={!compareDistrict}
                  className="w-full border border-gray-300 rounded-md px-3 py-2.5 bg-white outline-none focus:border-green-600 disabled:bg-gray-100"
                >
                  <option value="">
                    {compareDistrict
                      ? "Select Commodity"
                      : "Select District First"}
                  </option>

                  {compareCommodities.map((commodityName) => (
                    <option key={commodityName} value={commodityName}>
                      {commodityName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={compareLoading || !compareCommodity}
              className="mt-6 bg-green-600 text-white px-6 py-2.5 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {compareLoading ? "Comparing..." : "Compare Prices"}
            </button>
          </form>

          {/* Comparison Results */}
          {comparePrices.length > 0 && (
            <div className="bg-white border rounded-lg mt-6 overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-medium text-gray-800">
                  {compareCommodity} Prices
                </h3>

                <p className="text-sm text-gray-500 mt-1">
                  {compareDistrict}, {compareState}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-6 py-3 font-medium text-gray-700">
                        Mandi
                      </th>

                      <th className="text-left px-6 py-3 font-medium text-gray-700">
                        Min Price
                      </th>

                      <th className="text-left px-6 py-3 font-medium text-gray-700">
                        Max Price
                      </th>

                      <th className="text-left px-6 py-3 font-medium text-gray-700">
                        Modal Price
                      </th>

                      <th className="text-left px-6 py-3 font-medium text-gray-700">
                        Date
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {comparePrices.map((record, index) => (
                      <tr key={index} className="border-b last:border-b-0">
                        <td className="px-6 py-4 text-gray-800">
                          {record.market}
                        </td>

                        <td className="px-6 py-4">₹{record.min_price}</td>

                        <td className="px-6 py-4">₹{record.max_price}</td>

                        <td className="px-6 py-4 font-medium">
                          ₹{record.modal_price}
                        </td>

                        <td className="px-6 py-4 text-gray-500">
                          {record.arrival_date}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* About */}
        <div id="about" className="mt-12 max-w-4xl">
          <h3 className="text-xl font-medium text-gray-800">
            About MandiMantra
          </h3>

          <p className="text-gray-500 mt-3 leading-7">
            MandiMantra provides information about agricultural commodity prices
            available in Indian mandis. Users can search for a commodity and
            select a location to view its latest available mandi price.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-10">
        <div className="max-w-6xl mx-auto px-6 py-5 text-sm text-gray-500">
          MandiMantra &copy; 2026
        </div>
      </footer>
    </div>
  );
}

export default Home;
