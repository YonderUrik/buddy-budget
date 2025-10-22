'use client';

import { useState } from "react";
import { Link } from "@heroui/link";
import { Snippet } from "@heroui/snippet";
import { Code } from "@heroui/code";
import { button as buttonStyles } from "@heroui/theme";

import { siteConfig } from "@/config/site";
import { title, subtitle } from "@/components/primitives";
import { GithubIcon } from "@/components/icons";
import NetWorthPredictor from "@/components/nw_predictor/NetWorthPredictor";
import { StockSearch } from "@/components/yahoo-finance/stock-search";
import { StockChart } from "@/components/yahoo-finance/stock-chart";
import { StockInfo } from "@/components/yahoo-finance/stock-info";
import { SearchResult } from "@/components/yahoo-finance/functions";

export default function Home() {
  const [selectedStock, setSelectedStock] = useState<SearchResult | null>(null);

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      {/* <div className="inline-block max-w-xl text-center justify-center">
        <span className={title()}>Make&nbsp;</span>
        <span className={title({ color: "violet" })}>beautiful&nbsp;</span>
        <br />
        <span className={title()}>
          websites regardless of your design experience.
        </span>
        <div className={subtitle({ class: "mt-4" })}>
          Beautiful, fast and modern React UI library.
        </div>
      </div> */}

      {/* <div className="flex gap-3">
        <Link
          isExternal
          className={buttonStyles({
            color: "primary",
            radius: "full",
            variant: "shadow",
          })}
          href={siteConfig.links.docs}
        >
          Documentation
        </Link>
        <Link
          isExternal
          className={buttonStyles({ variant: "bordered", radius: "full" })}
          href={siteConfig.links.github}
        >
          <GithubIcon size={20} />
          GitHub
        </Link>
      </div> */}

      {/* <div className="mt-8">
        <Snippet hideCopyButton hideSymbol variant="bordered">
          <span>
            Get started by editing <Code color="primary">app/page.tsx</Code>
          </span>
        </Snippet>
      </div> */}

      {/* <NetWorthPredictor currency="EUR" /> */}

      <div className="w-full max-w-6xl mt-8 space-y-4">
        <StockSearch
          onSelect={(stock) => setSelectedStock(stock)}
          label="Search for a stock"
          placeholder="Enter stock symbol or company name..."
        />

        {selectedStock && (
          <>
            <StockChart symbol={selectedStock.symbol} />
            <StockInfo symbol={selectedStock.symbol} />
          </>
        )}
      </div>

    </section>
  );
}
