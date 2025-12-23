"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import { title, subtitle } from "@/components/primitives";
import { StockSearch } from "@/components/yahoo-finance/stock-search";
import { StockChart } from "@/components/yahoo-finance/stock-chart";
import { StockInfo } from "@/components/yahoo-finance/stock-info";
import { SearchResult } from "@/components/yahoo-finance/functions";
import { TrendingIcon } from "@/components/icons";

export default function FinancePage() {
  const [selectedStock, setSelectedStock] = useState<SearchResult | null>(null);

  const handleStockSelect = (stock: SearchResult) => {
    setSelectedStock(stock);
  };

  return (
    <div className="flex flex-col gap-12 py-8 md:py-12">
      {/* Hero Section */}
      <section className="flex flex-col items-center gap-6 text-center px-4">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <TrendingIcon className="text-brand-gold-500" size={48} />
          </div>
          <h1 className={title({ size: "lg" })}>
            <span className="bg-gradient-to-r from-brand-blue-500 to-brand-gold-500 bg-clip-text text-transparent">
              Finance Tracker
            </span>
          </h1>
          <p className={subtitle({ class: "mt-4 max-w-2xl mx-auto" })}>
            Real-time stock tracking powered by Yahoo Finance. Search for any
            stock to view interactive charts, detailed analytics, and company
            information.
          </p>
        </motion.div>
      </section>

      {/* Search Section */}
      <section className="flex flex-col items-center gap-6 px-4">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <StockSearch
            className="w-full"
            label="Search Stocks"
            placeholder="Enter stock symbol or company name (e.g., AAPL, Tesla, Microsoft)..."
            onSelect={handleStockSelect}
          />
          {selectedStock && (
            <motion.p
              animate={{ opacity: 1 }}
              className="mt-3 text-sm text-default-500 text-center"
              initial={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              Currently viewing:{" "}
              <span className="font-semibold text-brand-blue-500">
                {selectedStock.symbol}
              </span>{" "}
              -{" "}
              {selectedStock.longname ||
                selectedStock.shortname ||
                selectedStock.name}
            </motion.p>
          )}
        </motion.div>
      </section>

      {/* Stock Data Section */}
      {selectedStock ? (
        <motion.section
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-8 px-4"
          initial={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.5 }}
        >
          {/* Stock Chart */}
          <div className="w-full max-w-7xl mx-auto">
            <StockChart
              logoUrl={selectedStock.logoUrl}
              longName={
                selectedStock.longname ||
                selectedStock.shortname ||
                selectedStock.name
              }
              symbol={selectedStock.symbol}
            />
          </div>

          {/* Stock Information */}
          <div className="w-full max-w-7xl mx-auto">
            <StockInfo
              logoUrl={selectedStock.logoUrl}
              longName={
                selectedStock.longname ||
                selectedStock.shortname ||
                selectedStock.name
              }
              symbol={selectedStock.symbol}
            />
          </div>
        </motion.section>
      ) : (
        <motion.section
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center gap-6 px-4 py-16"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="relative flex flex-col items-center gap-4 p-12 rounded-2xl border-2 border-dashed border-brand-blue-500/30 dark:border-brand-blue-400/30 bg-gradient-to-br from-brand-blue-50/30 via-transparent to-brand-gold-50/30 dark:from-brand-blue-950/20 dark:via-transparent dark:to-brand-gold-950/20 max-w-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-blue-500/5 via-transparent to-brand-gold-500/5 rounded-2xl" />
            <TrendingIcon
              className="text-brand-blue-400 relative z-10"
              size={64}
            />
            <div className="text-center relative z-10">
              <h3 className="text-xl font-bold mb-2">No Stock Selected</h3>
              <p className="text-default-500 max-w-md">
                Search for a stock symbol or company name above to view detailed
                charts, analytics, and company information. Try searching for
                popular stocks like AAPL, TSLA, MSFT, or GOOGL.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-4 relative z-10">
              {["AAPL", "TSLA", "MSFT", "GOOGL", "AMZN", "NVDA"].map(
                (symbol) => (
                  <button
                    key={symbol}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-blue-100 dark:bg-brand-blue-900/30 text-brand-blue-700 dark:text-brand-blue-300 hover:bg-brand-blue-200 dark:hover:bg-brand-blue-900/50 transition-colors"
                    onClick={async () => {
                      // Fetch stock data to populate selectedStock
                      try {
                        const response = await fetch(
                          `/api/stocks/search?q=${symbol}`,
                        );
                        const data = await response.json();
                        const stock = data.results?.find(
                          (r: SearchResult) =>
                            r.symbol.toUpperCase() === symbol.toUpperCase(),
                        );

                        if (stock) {
                          setSelectedStock(stock);
                        }
                      } catch (err) {
                        console.error("Error fetching stock:", err);
                      }
                    }}
                  >
                    {symbol}
                  </button>
                ),
              )}
            </div>
          </div>
        </motion.section>
      )}
    </div>
  );
}
