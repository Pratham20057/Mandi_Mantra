import { useLocation, useNavigate } from "react-router-dom";

function MandiPrice() {
  const location = useLocation();
  const navigate = useNavigate();

  const searchData = location.state?.searchData;
  const priceData = location.state?.priceData;

  const records = priceData?.records || [];

  const record = records.length > 0 ? records[0] : null;

  const formatPrice = (price) => {
    if (price === null || price === undefined || price === "") {
      return "Not available";
    }

    return `₹${Number(price).toLocaleString("en-IN")}`;
  };

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
              Try changing your commodity, district or market.
            </p>

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
      </main>
    </div>
  );
}

export default MandiPrice;
