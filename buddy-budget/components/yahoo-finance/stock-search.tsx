"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import Image from "next/image";

import { SearchResult } from "./functions";

interface StockSearchProps {
  onSelect?: (stock: SearchResult) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function StockSearch({
  onSelect,
  label = "Search Stocks",
  placeholder = "Enter stock symbol or company name...",
  className,
}: StockSearchProps) {
  const [searchValue, setSearchValue] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Search stocks function
  const searchStocks = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setResults([]);

      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/stocks/search?q=${encodeURIComponent(query)}`,
      );

      if (!response.ok) {
        throw new Error("Failed to search stocks");
      }

      const data = await response.json();

      setResults(data.results || []);
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to search stocks. Please try again.");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search effect
  useEffect(() => {
    // Clear previous timeout
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timeout
    debounceTimerRef.current = setTimeout(() => {
      searchStocks(searchValue);
    }, 300);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchValue, searchStocks]);

  // Handle input change
  const handleInputChange = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  // Handle selection
  const handleSelectionChange = useCallback(
    (key: React.Key | null) => {
      if (key && onSelect) {
        const selectedStock = results.find((stock) => stock.symbol === key);

        if (selectedStock) {
          onSelect(selectedStock);
        }
      }
    },
    [results, onSelect],
  );

  return (
    <Autocomplete
      className={className}
      errorMessage={error}
      inputValue={searchValue}
      isInvalid={!!error}
      isLoading={isLoading}
      items={results.map((result) => ({
        key: result.symbol,
        symbol: result.symbol,
        shortname: result.shortname,
        longname: result.longname,
        name: result.name,
        exchDisp: result.exchDisp,
        typeDisp: result.typeDisp,
        quoteType: result.quoteType,
        logoUrl: result.logoUrl,
      }))}
      label={label}
      listboxProps={{
        emptyContent:
          searchValue.length >= 2
            ? "No stocks found"
            : "Start typing to search...",
      }}
      placeholder={placeholder}
      variant="bordered"
      onInputChange={handleInputChange}
      onSelectionChange={handleSelectionChange}
    >
      {(item) => (
        <AutocompleteItem key={item.key} textValue={item.symbol}>
          <div className="flex items-start gap-3">
            {/* Stock Logo */}
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-default-100 overflow-hidden">
              {item.logoUrl ? (
                <Image
                  alt={item.symbol}
                  className="w-8 h-8 object-contain"
                  height={32}
                  src={item.logoUrl}
                  width={32}
                  onError={(e) => {
                    // Fallback to symbol text if image fails to load
                    e.currentTarget.style.display = "none";
                    if (e.currentTarget.nextElementSibling) {
                      (
                        e.currentTarget.nextElementSibling as HTMLElement
                      ).style.display = "flex";
                    }
                  }}
                />
              ) : null}
              <span
                className="text-xs font-bold text-default-600"
                style={{ display: item.logoUrl ? "none" : "flex" }}
              >
                {item.symbol.substring(0, 2)}
              </span>
            </div>

            {/* Stock Info */}
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-small font-semibold">{item.symbol}</span>
                {item.typeDisp && (
                  <span className="text-tiny px-1.5 py-0.5 rounded-md bg-default-100 text-default-600">
                    {item.typeDisp}
                  </span>
                )}
              </div>
              <span className="text-small text-default-700 truncate">
                {item.longname || item.shortname || item.name}
              </span>
              {item.exchDisp && (
                <span className="text-tiny text-default-400">
                  {item.exchDisp}
                </span>
              )}
            </div>
          </div>
        </AutocompleteItem>
      )}
    </Autocomplete>
  );
}
