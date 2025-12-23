"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Tooltip } from "@heroui/tooltip";
import Image from "next/image";

import { getStockLogo } from "./functions";

import { formatCurrency, formatPercentage, formatDate } from "@/utils/format";

interface StockInfoProps {
  symbol: string;
  logoUrl?: string | null;
  longName?: string;
}

// Format large numbers (for market cap, revenue, etc.)
const formatLargeNumber = (value: number, currency: string): string => {
  if (value >= 1e12) {
    return `${formatCurrency(value / 1e12, { currency })}T`;
  } else if (value >= 1e9) {
    return `${formatCurrency(value / 1e9, { currency })}B`;
  } else if (value >= 1e6) {
    return `${formatCurrency(value / 1e6, { currency })}M`;
  }

  return formatCurrency(value, { currency });
};

export function StockInfo({
  symbol,
  logoUrl: propLogoUrl,
  longName: propLongName,
}: StockInfoProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedLogoUrl, setFetchedLogoUrl] = useState<string | null>(null);

  // Use prop values if provided, otherwise use fetched values
  const logoUrl = propLogoUrl !== undefined ? propLogoUrl : fetchedLogoUrl;

  // Get currency from quote data
  const currency = useMemo(() => {
    if (!data) return "USD";

    return data.price?.currency || data.summaryDetail?.currency || "USD";
  }, [data]);

  // Get long name from prop or data
  const longName = useMemo(() => {
    if (propLongName !== undefined) return propLongName;
    if (!data) return "";

    return (
      data.price?.longName ||
      data.price?.shortName ||
      data.quoteType?.longName ||
      ""
    );
  }, [data, propLongName]);

  useEffect(() => {
    const fetchData = async () => {
      if (!symbol) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/stocks/details?symbol=${encodeURIComponent(symbol)}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch stock details");
        }

        const result = await response.json();

        setData(result.details);

        // Only fetch logo if not provided as prop
        if (propLogoUrl === undefined) {
          const shortName = result.details?.price?.shortName || "";
          const quoteType = result.details?.quoteType?.quoteType || "EQUITY";

          try {
            const logo = await getStockLogo(symbol, shortName, quoteType);

            setFetchedLogoUrl(logo);
          } catch (logoErr) {
            console.error("Error fetching logo:", logoErr);
            setFetchedLogoUrl(null);
          }
        }
      } catch (err) {
        console.error("Error fetching stock details:", err);
        setError("Failed to load stock information");
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [symbol, propLogoUrl]);

  if (isLoading) {
    return (
      <Card className="w-full bg-white dark:bg-black">
        <CardBody className="flex justify-center items-center h-64">
          <Spinner size="lg" />
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full bg-white dark:bg-black">
        <CardBody className="flex justify-center items-center h-64">
          <p className="text-danger">{error}</p>
        </CardBody>
      </Card>
    );
  }

  if (!data) return null;

  const profile = data.assetProfile || {};

  // Check if asset profile has meaningful data (more than just maxAge/empty arrays)
  const hasAssetProfileData = Object.keys(profile).some((key) => {
    if (key === "maxAge") return false;
    const value = profile[key];

    if (Array.isArray(value)) return value.length > 0;

    return value !== null && value !== undefined && value !== "";
  });

  return (
    <div className="w-full space-y-4">
      {/* Quick Stats Summary - Top Priority Metrics */}
      {(data.financialData || data.defaultKeyStatistics) && (
        <Card className="bg-white dark:bg-black border-2 border-brand-blue-500/20">
          <CardHeader className="flex gap-3 pb-2">
            {/* Stock Logo */}
            <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-lg bg-gradient-to-br from-brand-blue-100 to-brand-gold-100 dark:from-brand-blue-900/30 dark:to-brand-gold-900/30 overflow-hidden">
              {logoUrl ? (
                <Image
                  alt={symbol}
                  className="w-12 h-12 object-contain"
                  height={48}
                  src={logoUrl}
                  width={48}
                  onError={(e) => {
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
                className="text-lg font-bold bg-gradient-to-r from-brand-blue-600 to-brand-gold-600 bg-clip-text text-transparent"
                style={{ display: logoUrl ? "none" : "flex" }}
              >
                {symbol.substring(0, 2)}
              </span>
            </div>

            <div className="flex flex-col flex-1">
              <h3 className="text-xl font-bold">
                {symbol}
                {longName && (
                  <span className="text-sm font-normal text-default-500 ml-2">
                    {longName}
                  </span>
                )}
              </h3>
              <p className="text-xs text-default-400">Key Statistics Summary</p>
            </div>
          </CardHeader>
          <CardBody className="pt-2">
            {/* Grid of Key Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Current Price */}
              {data.financialData?.currentPrice && (
                <div className="space-y-1">
                  <Tooltip content="Current trading price of the stock">
                    <div className="text-xs text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                      Current Price
                    </div>
                  </Tooltip>
                  <div className="text-2xl font-bold bg-gradient-to-r from-brand-blue-600 to-brand-gold-600 bg-clip-text text-transparent">
                    {formatCurrency(data.financialData.currentPrice, {
                      currency:
                        data.financialData.financialCurrency || currency,
                      showCents: true,
                    })}
                  </div>
                </div>
              )}

              {/* Market Cap */}
              {data.defaultKeyStatistics?.marketCap && (
                <div className="space-y-1">
                  <Tooltip content="Total market value of all outstanding shares">
                    <div className="text-xs text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                      Market Cap
                    </div>
                  </Tooltip>
                  <div className="text-xl font-bold text-default-900 dark:text-default-100">
                    {formatLargeNumber(
                      data.defaultKeyStatistics.marketCap,
                      currency,
                    )}
                  </div>
                </div>
              )}

              {/* P/E Ratio */}
              {data.defaultKeyStatistics?.forwardPE && (
                <div className="space-y-1">
                  <Tooltip content="Price-to-Earnings ratio - lower may indicate better value">
                    <div className="text-xs text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                      P/E Ratio
                    </div>
                  </Tooltip>
                  <div className="text-xl font-bold text-default-900 dark:text-default-100">
                    {data.defaultKeyStatistics.forwardPE.toFixed(2)}
                  </div>
                </div>
              )}

              {/* Beta (Volatility) */}
              {data.defaultKeyStatistics?.beta && (
                <div className="space-y-1">
                  <Tooltip content="Volatility relative to market. >1 = more volatile, <1 = less volatile">
                    <div className="text-xs text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                      Beta
                    </div>
                  </Tooltip>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-default-900 dark:text-default-100">
                      {data.defaultKeyStatistics.beta.toFixed(3)}
                    </span>
                    <Chip
                      color={
                        data.defaultKeyStatistics.beta > 1.2
                          ? "danger"
                          : data.defaultKeyStatistics.beta > 0.8
                            ? "warning"
                            : "success"
                      }
                      size="sm"
                      variant="flat"
                    >
                      {data.defaultKeyStatistics.beta > 1.2
                        ? "High"
                        : data.defaultKeyStatistics.beta > 0.8
                          ? "Med"
                          : "Low"}
                    </Chip>
                  </div>
                </div>
              )}

              {/* Recommendation */}
              {data.financialData?.recommendationKey && (
                <div className="space-y-1">
                  <Tooltip content="Analyst recommendation consensus">
                    <div className="text-xs text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                      Recommendation
                    </div>
                  </Tooltip>
                  <Chip
                    color={
                      data.financialData.recommendationMean <= 2
                        ? "success"
                        : data.financialData.recommendationMean <= 3
                          ? "primary"
                          : data.financialData.recommendationMean <= 4
                            ? "warning"
                            : "danger"
                    }
                    size="lg"
                    variant="flat"
                  >
                    {data.financialData.recommendationKey.toUpperCase()}
                  </Chip>
                </div>
              )}

              {/* Target Price Upside */}
              {data.financialData?.targetMeanPrice &&
                data.financialData?.currentPrice && (
                  <div className="space-y-1">
                    <Tooltip content="Potential upside/downside to analyst target price">
                      <div className="text-xs text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                        Target Upside
                      </div>
                    </Tooltip>
                    <Chip
                      color={
                        ((data.financialData.targetMeanPrice -
                          data.financialData.currentPrice) /
                          data.financialData.currentPrice) *
                          100 >
                        0
                          ? "success"
                          : "danger"
                      }
                      size="lg"
                      variant="flat"
                    >
                      {((data.financialData.targetMeanPrice -
                        data.financialData.currentPrice) /
                        data.financialData.currentPrice) *
                        100 >
                      0
                        ? "+"
                        : ""}
                      {formatPercentage(
                        ((data.financialData.targetMeanPrice -
                          data.financialData.currentPrice) /
                          data.financialData.currentPrice) *
                          100,
                      )}
                    </Chip>
                  </div>
                )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Asset Profile */}
      {Object.keys(profile).length > 0 && (
        <Card className="bg-white dark:bg-black">
          <CardHeader className="flex gap-3">
            {/* Stock Logo */}
            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg bg-default-100 overflow-hidden">
              {logoUrl ? (
                <Image
                  alt={symbol}
                  className="w-10 h-10 object-contain"
                  height={40}
                  src={logoUrl}
                  width={40}
                  onError={(e) => {
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
                className="text-sm font-bold text-default-600"
                style={{ display: logoUrl ? "none" : "flex" }}
              >
                {symbol.substring(0, 2)}
              </span>
            </div>

            <div className="flex flex-col">
              <h3 className="text-lg font-bold">
                {symbol}
                {longName && (
                  <span className="text-sm font-normal text-default-500 ml-2">
                    {longName}
                  </span>
                )}
              </h3>
              <p className="text-xs text-default-400">Asset Profile</p>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            {!hasAssetProfileData && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="text-default-400 mb-2">
                  <svg
                    className="w-16 h-16 mx-auto mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                    />
                  </svg>
                </div>
                <p className="text-sm text-default-500 font-semibold">
                  No Asset Profile Data Available
                </p>
                <p className="text-xs text-default-400 mt-1 max-w-md">
                  Detailed company information is not available for this
                  security. This is common for ETFs, mutual funds, and some
                  international securities.
                </p>
              </div>
            )}

            {/* Business Summary */}
            {profile.longBusinessSummary && (
              <>
                <div>
                  <Tooltip content="A comprehensive description of the company's business operations, segments, and services">
                    <h4 className="text-sm font-semibold text-default-700 mb-2 cursor-help border-b border-dotted border-default-400 inline-block">
                      Business Summary
                    </h4>
                  </Tooltip>
                  <p className="text-sm text-default-600 mt-1">
                    {profile.longBusinessSummary}
                  </p>
                </div>
                <Divider />
              </>
            )}

            {/* Employment */}
            {profile.fullTimeEmployees && (
              <>
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-default-700">
                    Organization
                  </h4>
                  <div className="text-sm">
                    <Tooltip content="Total number of full-time employees working for the company">
                      <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                        Full-Time Employees:
                      </span>
                    </Tooltip>{" "}
                    <span className="font-semibold text-lg">
                      {profile.fullTimeEmployees.toLocaleString()}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Accordion for Additional Details */}
            {((profile.companyOfficers && profile.companyOfficers.length > 0) ||
              profile.auditRisk !== undefined ||
              profile.boardRisk !== undefined ||
              profile.compensationRisk !== undefined ||
              profile.shareHolderRightsRisk !== undefined ||
              profile.overallRisk !== undefined) && (
              <>
                <Divider />
                <Accordion variant="bordered">
                  {/* Executive Team */}
                  {profile.companyOfficers &&
                    profile.companyOfficers.length > 0 && (
                      <AccordionItem
                        key="executives"
                        title={
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              Executive Team
                            </span>
                            <Chip color="default" size="sm" variant="flat">
                              {profile.companyOfficers.length} officers
                            </Chip>
                          </div>
                        }
                      >
                        <div className="space-y-3 pb-4">
                          {profile.companyOfficers.map(
                            (officer: any, index: number) => (
                              <div
                                key={index}
                                className="flex justify-between items-start border-b border-default-200 pb-2 last:border-0"
                              >
                                <div className="flex-1">
                                  <div className="font-semibold text-sm">
                                    {officer.name}
                                  </div>
                                  <div className="text-xs text-default-500">
                                    {officer.title}
                                  </div>
                                  {officer.age && (
                                    <div className="text-xs text-default-400">
                                      Age: {officer.age}
                                    </div>
                                  )}
                                </div>
                                {officer.totalPay > 0 && (
                                  <div className="text-right ml-4">
                                    <Tooltip content="Total compensation for the fiscal year">
                                      <div className="text-xs text-default-500 cursor-help border-b border-dotted border-default-400">
                                        Total Pay ({officer.fiscalYear})
                                      </div>
                                    </Tooltip>
                                    <div className="font-semibold text-sm">
                                      {formatCurrency(officer.totalPay, {
                                        currency,
                                        showCents: false,
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ),
                          )}
                        </div>
                      </AccordionItem>
                    )}

                  {/* Governance & Risk Metrics */}
                  {(profile.auditRisk !== undefined ||
                    profile.boardRisk !== undefined ||
                    profile.compensationRisk !== undefined ||
                    profile.shareHolderRightsRisk !== undefined ||
                    profile.overallRisk !== undefined) && (
                    <AccordionItem
                      key="governance"
                      title={
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            Governance & Risk Assessment
                          </span>
                          {profile.overallRisk !== undefined && (
                            <Chip
                              color={
                                profile.overallRisk <= 3
                                  ? "success"
                                  : profile.overallRisk <= 6
                                    ? "warning"
                                    : "danger"
                              }
                              size="sm"
                              variant="flat"
                            >
                              Overall: {profile.overallRisk}/10
                            </Chip>
                          )}
                        </div>
                      }
                    >
                      <div className="space-y-3 pb-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                          {profile.overallRisk !== undefined && (
                            <div className="col-span-2 sm:col-span-3">
                              <Tooltip content="Comprehensive risk score combining all governance factors. Lower is better (1=Low Risk, 10=High Risk)">
                                <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                                  Overall Risk:
                                </span>
                              </Tooltip>{" "}
                              <Chip
                                color={
                                  profile.overallRisk <= 3
                                    ? "success"
                                    : profile.overallRisk <= 6
                                      ? "warning"
                                      : "danger"
                                }
                                size="sm"
                                variant="flat"
                              >
                                {profile.overallRisk}/10
                              </Chip>
                            </div>
                          )}
                          {profile.auditRisk !== undefined && (
                            <div>
                              <Tooltip content="Risk related to audit quality, accounting practices, and financial reporting integrity">
                                <span className="text-default-500 text-xs cursor-help border-b border-dotted border-default-400">
                                  Audit Risk:
                                </span>
                              </Tooltip>{" "}
                              <Chip
                                color={
                                  profile.auditRisk <= 3
                                    ? "success"
                                    : profile.auditRisk <= 6
                                      ? "warning"
                                      : "danger"
                                }
                                size="sm"
                                variant="flat"
                              >
                                {profile.auditRisk}/10
                              </Chip>
                            </div>
                          )}
                          {profile.boardRisk !== undefined && (
                            <div>
                              <Tooltip content="Risk related to board composition, independence, and effectiveness">
                                <span className="text-default-500 text-xs cursor-help border-b border-dotted border-default-400">
                                  Board Risk:
                                </span>
                              </Tooltip>{" "}
                              <Chip
                                color={
                                  profile.boardRisk <= 3
                                    ? "success"
                                    : profile.boardRisk <= 6
                                      ? "warning"
                                      : "danger"
                                }
                                size="sm"
                                variant="flat"
                              >
                                {profile.boardRisk}/10
                              </Chip>
                            </div>
                          )}
                          {profile.compensationRisk !== undefined && (
                            <div>
                              <Tooltip content="Risk related to executive compensation structure and alignment with shareholder interests">
                                <span className="text-default-500 text-xs cursor-help border-b border-dotted border-default-400">
                                  Compensation Risk:
                                </span>
                              </Tooltip>{" "}
                              <Chip
                                color={
                                  profile.compensationRisk <= 3
                                    ? "success"
                                    : profile.compensationRisk <= 6
                                      ? "warning"
                                      : "danger"
                                }
                                size="sm"
                                variant="flat"
                              >
                                {profile.compensationRisk}/10
                              </Chip>
                            </div>
                          )}
                          {profile.shareHolderRightsRisk !== undefined && (
                            <div>
                              <Tooltip content="Risk related to shareholder voting rights and protection of minority shareholders">
                                <span className="text-default-500 text-xs cursor-help border-b border-dotted border-default-400">
                                  Shareholder Rights Risk:
                                </span>
                              </Tooltip>{" "}
                              <Chip
                                color={
                                  profile.shareHolderRightsRisk <= 3
                                    ? "success"
                                    : profile.shareHolderRightsRisk <= 6
                                      ? "warning"
                                      : "danger"
                                }
                                size="sm"
                                variant="flat"
                              >
                                {profile.shareHolderRightsRisk}/10
                              </Chip>
                            </div>
                          )}
                        </div>
                        {profile.governanceEpochDate && (
                          <div className="text-xs text-default-400 mt-2">
                            <Tooltip content="Date when the governance risk scores were last updated">
                              <span className="cursor-help border-b border-dotted border-default-400">
                                Last Updated:
                              </span>
                            </Tooltip>{" "}
                            {formatDate(profile.governanceEpochDate)}
                          </div>
                        )}
                      </div>
                    </AccordionItem>
                  )}
                </Accordion>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {/* Calendar Events */}
      {data.calendarEvents &&
        (data.calendarEvents.earnings ||
          data.calendarEvents.exDividendDate) && (
          <Card className="bg-white dark:bg-black">
            <CardHeader>
              <h3 className="text-lg font-bold">Upcoming Events</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              {/* Earnings Information */}
              {data.calendarEvents.earnings && (
                <div className="space-y-3">
                  <Tooltip content="Information about the company's upcoming earnings announcement">
                    <h4 className="text-sm font-semibold text-default-700 cursor-help border-b border-dotted border-default-400 inline-block">
                      Earnings Report
                    </h4>
                  </Tooltip>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    {/* Earnings Date */}
                    {data.calendarEvents.earnings.earningsDate &&
                      data.calendarEvents.earnings.earningsDate.length > 0 && (
                        <div className="space-y-1">
                          <Tooltip content="The date when the company will announce its earnings results">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Earnings Date:
                            </span>
                          </Tooltip>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-base">
                              {formatDate(
                                data.calendarEvents.earnings.earningsDate[0],
                              )}
                            </span>
                            {!data.calendarEvents.earnings
                              .isEarningsDateEstimate && (
                              <Chip color="success" size="sm" variant="flat">
                                Confirmed
                              </Chip>
                            )}
                            {data.calendarEvents.earnings
                              .isEarningsDateEstimate && (
                              <Chip color="warning" size="sm" variant="flat">
                                Estimate
                              </Chip>
                            )}
                          </div>
                        </div>
                      )}

                    {/* Earnings Call Date */}
                    {data.calendarEvents.earnings.earningsCallDate &&
                      data.calendarEvents.earnings.earningsCallDate.length >
                        0 && (
                        <div className="space-y-1">
                          <Tooltip content="The scheduled date and time for the earnings conference call">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Earnings Call:
                            </span>
                          </Tooltip>
                          <div className="font-semibold text-base">
                            {formatDate(
                              new Date(
                                data.calendarEvents.earnings
                                  .earningsCallDate[0] * 1000,
                              ),
                            )}
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Earnings Estimates */}
                  {(data.calendarEvents.earnings.earningsAverage ||
                    data.calendarEvents.earnings.revenueAverage) && (
                    <>
                      <Divider />
                      <div className="space-y-3">
                        <Tooltip content="Analyst estimates for the upcoming earnings report">
                          <h5 className="text-xs font-semibold text-default-600 cursor-help border-b border-dotted border-default-400 inline-block uppercase">
                            Analyst Estimates
                          </h5>
                        </Tooltip>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* EPS Estimates */}
                          {data.calendarEvents.earnings.earningsAverage && (
                            <div className="space-y-2">
                              <Tooltip content="Earnings per share (EPS) estimates from analysts">
                                <div className="text-xs text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                                  EPS Estimate
                                </div>
                              </Tooltip>
                              <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-default-500">
                                    Average:
                                  </span>
                                  <span className="font-semibold">
                                    {formatCurrency(
                                      data.calendarEvents.earnings
                                        .earningsAverage,
                                      { currency, showCents: true },
                                    )}
                                  </span>
                                </div>
                                {data.calendarEvents.earnings.earningsLow !==
                                  undefined && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-default-400">
                                      Low:
                                    </span>
                                    <span className="text-xs">
                                      {formatCurrency(
                                        data.calendarEvents.earnings
                                          .earningsLow,
                                        { currency, showCents: true },
                                      )}
                                    </span>
                                  </div>
                                )}
                                {data.calendarEvents.earnings.earningsHigh !==
                                  undefined && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-default-400">
                                      High:
                                    </span>
                                    <span className="text-xs">
                                      {formatCurrency(
                                        data.calendarEvents.earnings
                                          .earningsHigh,
                                        { currency, showCents: true },
                                      )}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Revenue Estimates */}
                          {data.calendarEvents.earnings.revenueAverage && (
                            <div className="space-y-2">
                              <Tooltip content="Revenue estimates from analysts for the upcoming earnings period">
                                <div className="text-xs text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                                  Revenue Estimate
                                </div>
                              </Tooltip>
                              <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-default-500">
                                    Average:
                                  </span>
                                  <span className="font-semibold">
                                    {formatCurrency(
                                      data.calendarEvents.earnings
                                        .revenueAverage,
                                      { currency, notation: "compact" },
                                    )}
                                  </span>
                                </div>
                                {data.calendarEvents.earnings.revenueLow !==
                                  undefined && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-default-400">
                                      Low:
                                    </span>
                                    <span className="text-xs">
                                      {formatCurrency(
                                        data.calendarEvents.earnings.revenueLow,
                                        { currency, notation: "compact" },
                                      )}
                                    </span>
                                  </div>
                                )}
                                {data.calendarEvents.earnings.revenueHigh !==
                                  undefined && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-default-400">
                                      High:
                                    </span>
                                    <span className="text-xs">
                                      {formatCurrency(
                                        data.calendarEvents.earnings
                                          .revenueHigh,
                                        { currency, notation: "compact" },
                                      )}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Ex-Dividend Date */}
              {data.calendarEvents.exDividendDate && (
                <>
                  {data.calendarEvents.earnings && <Divider />}
                  <div className="space-y-2">
                    <Tooltip content="The date after which new stock buyers are not eligible to receive the upcoming dividend payment">
                      <h4 className="text-sm font-semibold text-default-700 cursor-help border-b border-dotted border-default-400 inline-block">
                        Ex-Dividend Date
                      </h4>
                    </Tooltip>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-base">
                        {formatDate(data.calendarEvents.exDividendDate)}
                      </span>
                      <Chip color="primary" size="sm" variant="flat">
                        Dividend Event
                      </Chip>
                    </div>
                    <p className="text-xs text-default-500">
                      Purchase shares before this date to be eligible for the
                      next dividend payment
                    </p>
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        )}

      {/* Earnings */}
      {data.earnings &&
        (data.earnings.earningsChart || data.earnings.financialsChart) && (
          <Card className="bg-white dark:bg-black">
            <CardHeader>
              <h3 className="text-lg font-bold">Earnings</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              {/* Current Quarter Estimate */}
              {data.earnings.earningsChart?.currentQuarterEstimate && (
                <>
                  <div className="flex items-center justify-between p-3 bg-default-100 rounded-lg">
                    <div>
                      <Tooltip content="Analyst consensus estimate for the current quarter earnings per share">
                        <h4 className="text-sm font-semibold text-default-700 cursor-help border-b border-dotted border-default-400 inline-block">
                          Current Quarter Estimate (
                          {
                            data.earnings.earningsChart
                              .currentQuarterEstimateDate
                          }{" "}
                          {
                            data.earnings.earningsChart
                              .currentQuarterEstimateYear
                          }
                          )
                        </h4>
                      </Tooltip>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {formatCurrency(
                          data.earnings.earningsChart.currentQuarterEstimate,
                          { currency, showCents: true },
                        )}
                      </div>
                      <div className="text-xs text-default-500">
                        EPS Estimate
                      </div>
                    </div>
                  </div>
                  <Divider />
                </>
              )}

              <Accordion variant="bordered">
                {/* Quarterly Earnings History */}
                {data.earnings.earningsChart?.quarterly &&
                  data.earnings.earningsChart.quarterly.length > 0 && (
                    <AccordionItem
                      key="quarterly-earnings"
                      title={
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            Quarterly Earnings History
                          </span>
                          <Chip color="primary" size="sm" variant="flat">
                            Last {data.earnings.earningsChart.quarterly.length}{" "}
                            quarters
                          </Chip>
                        </div>
                      }
                    >
                      <div className="space-y-3 pb-4">
                        {data.earnings.earningsChart.quarterly.map(
                          (quarter: any, index: number) => (
                            <div
                              key={index}
                              className="border border-default-200 rounded-lg p-3 space-y-2"
                            >
                              <div className="flex justify-between items-center">
                                <div className="font-semibold text-sm">
                                  {quarter.date}
                                </div>
                                <Chip
                                  color={
                                    parseFloat(quarter.surprisePct) > 0
                                      ? "success"
                                      : "danger"
                                  }
                                  size="sm"
                                  variant="flat"
                                >
                                  {parseFloat(quarter.surprisePct) > 0
                                    ? "+"
                                    : ""}
                                  {quarter.surprisePct}% surprise
                                </Chip>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <Tooltip content="Actual reported earnings per share">
                                    <div className="text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                                      Actual
                                    </div>
                                  </Tooltip>
                                  <div className="font-semibold text-sm mt-1">
                                    {formatCurrency(quarter.actual, {
                                      currency,
                                      showCents: true,
                                    })}
                                  </div>
                                </div>
                                <div>
                                  <Tooltip content="Analyst consensus estimate">
                                    <div className="text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                                      Estimate
                                    </div>
                                  </Tooltip>
                                  <div className="font-semibold text-sm mt-1">
                                    {formatCurrency(quarter.estimate, {
                                      currency,
                                      showCents: true,
                                    })}
                                  </div>
                                </div>
                                <div>
                                  <Tooltip content="Difference between actual and estimate">
                                    <div className="text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                                      Difference
                                    </div>
                                  </Tooltip>
                                  <div
                                    className={`font-semibold text-sm mt-1 ${parseFloat(quarter.difference) > 0 ? "text-success" : "text-danger"}`}
                                  >
                                    {parseFloat(quarter.difference) > 0
                                      ? "+"
                                      : ""}
                                    {formatCurrency(
                                      parseFloat(quarter.difference),
                                      { currency, showCents: true },
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </AccordionItem>
                  )}

                {/* Quarterly Financials */}
                {data.earnings.financialsChart?.quarterly &&
                  data.earnings.financialsChart.quarterly.length > 0 && (
                    <AccordionItem
                      key="quarterly-financials"
                      title={
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            Quarterly Revenue & Earnings
                          </span>
                          <Chip color="secondary" size="sm" variant="flat">
                            {data.earnings.financialCurrency || currency}
                          </Chip>
                        </div>
                      }
                    >
                      <div className="space-y-3 pb-4">
                        {data.earnings.financialsChart.quarterly.map(
                          (quarter: any, index: number) => (
                            <div
                              key={index}
                              className="border border-default-200 rounded-lg p-3"
                            >
                              <div className="font-semibold text-sm mb-2">
                                {quarter.date}
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                  <Tooltip content="Total revenue for the quarter">
                                    <div className="text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                                      Revenue
                                    </div>
                                  </Tooltip>
                                  <div className="font-semibold text-sm mt-1">
                                    {formatLargeNumber(
                                      quarter.revenue,
                                      data.earnings.financialCurrency ||
                                        currency,
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <Tooltip content="Net earnings for the quarter">
                                    <div className="text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                                      Earnings
                                    </div>
                                  </Tooltip>
                                  <div className="font-semibold text-sm mt-1">
                                    {formatLargeNumber(
                                      quarter.earnings,
                                      data.earnings.financialCurrency ||
                                        currency,
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </AccordionItem>
                  )}

                {/* Yearly Financials */}
                {data.earnings.financialsChart?.yearly &&
                  data.earnings.financialsChart.yearly.length > 0 && (
                    <AccordionItem
                      key="yearly-financials"
                      title={
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            Annual Revenue & Earnings
                          </span>
                          <Chip color="success" size="sm" variant="flat">
                            {data.earnings.financialsChart.yearly.length} years
                          </Chip>
                        </div>
                      }
                    >
                      <div className="space-y-3 pb-4">
                        {data.earnings.financialsChart.yearly.map(
                          (year: any, index: number) => {
                            const prevYear =
                              index > 0
                                ? data.earnings.financialsChart.yearly[
                                    index - 1
                                  ]
                                : null;
                            const revenueGrowth = prevYear
                              ? ((year.revenue - prevYear.revenue) /
                                  prevYear.revenue) *
                                100
                              : null;
                            const earningsGrowth = prevYear
                              ? ((year.earnings - prevYear.earnings) /
                                  prevYear.earnings) *
                                100
                              : null;

                            return (
                              <div
                                key={index}
                                className="border border-default-200 rounded-lg p-3 space-y-2"
                              >
                                <div className="flex justify-between items-center">
                                  <div className="font-semibold">
                                    {year.date}
                                  </div>
                                  {revenueGrowth !== null && (
                                    <Chip
                                      color={
                                        revenueGrowth > 0 ? "success" : "danger"
                                      }
                                      size="sm"
                                      variant="flat"
                                    >
                                      Revenue: {revenueGrowth > 0 ? "+" : ""}
                                      {revenueGrowth.toFixed(1)}% YoY
                                    </Chip>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                  <div>
                                    <Tooltip content="Total annual revenue">
                                      <div className="text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                                        Revenue
                                      </div>
                                    </Tooltip>
                                    <div className="font-semibold text-base mt-1">
                                      {formatLargeNumber(
                                        year.revenue,
                                        data.earnings.financialCurrency ||
                                          currency,
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <Tooltip content="Total annual net earnings">
                                      <div className="text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                                        Earnings
                                      </div>
                                    </Tooltip>
                                    <div className="font-semibold text-base mt-1">
                                      {formatLargeNumber(
                                        year.earnings,
                                        data.earnings.financialCurrency ||
                                          currency,
                                      )}
                                    </div>
                                    {earningsGrowth !== null && (
                                      <div
                                        className={`text-xs mt-1 ${earningsGrowth > 0 ? "text-success" : "text-danger"}`}
                                      >
                                        {earningsGrowth > 0 ? "+" : ""}
                                        {earningsGrowth.toFixed(1)}% YoY
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </AccordionItem>
                  )}
              </Accordion>
            </CardBody>
          </Card>
        )}

      {/* Financial Data - Detailed Metrics */}
      {data.financialData && Object.keys(data.financialData).length > 0 && (
        <Card className="bg-white dark:bg-black">
          <CardHeader>
            <h3 className="text-lg font-bold">Financial Details</h3>
            <p className="text-xs text-default-400">
              In-depth financial metrics and analyst targets
            </p>
          </CardHeader>
          <CardBody>
            <Accordion variant="bordered">
              {/* Price Targets */}
              {(data.financialData.targetHighPrice ||
                data.financialData.targetLowPrice ||
                data.financialData.targetMedianPrice) && (
                <AccordionItem
                  key="price-targets"
                  title={
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        Analyst Price Targets
                      </span>
                      {data.financialData.numberOfAnalystOpinions && (
                        <Chip color="primary" size="sm" variant="flat">
                          {data.financialData.numberOfAnalystOpinions} analysts
                        </Chip>
                      )}
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 text-sm">
                    {data.financialData.targetLowPrice && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Lowest analyst price target">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Target Low:
                          </span>
                        </Tooltip>
                        <span className="font-semibold">
                          {formatCurrency(data.financialData.targetLowPrice, {
                            currency:
                              data.financialData.financialCurrency || currency,
                          })}
                        </span>
                      </div>
                    )}
                    {data.financialData.targetMedianPrice && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Median analyst price target">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Target Median:
                          </span>
                        </Tooltip>
                        <span className="font-semibold">
                          {formatCurrency(
                            data.financialData.targetMedianPrice,
                            {
                              currency:
                                data.financialData.financialCurrency ||
                                currency,
                            },
                          )}
                        </span>
                      </div>
                    )}
                    {data.financialData.targetHighPrice && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Highest analyst price target">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Target High:
                          </span>
                        </Tooltip>
                        <span className="font-semibold">
                          {formatCurrency(data.financialData.targetHighPrice, {
                            currency:
                              data.financialData.financialCurrency || currency,
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </AccordionItem>
              )}

              {/* Cash & Debt */}
              {(data.financialData.totalCash ||
                data.financialData.totalDebt ||
                data.financialData.debtToEquity) && (
                <AccordionItem
                  key="cash-debt"
                  title={
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Cash & Debt</span>
                      {data.financialData.debtToEquity && (
                        <Chip
                          color={
                            data.financialData.debtToEquity > 200
                              ? "danger"
                              : data.financialData.debtToEquity > 100
                                ? "warning"
                                : "success"
                          }
                          size="sm"
                          variant="flat"
                        >
                          D/E: {data.financialData.debtToEquity.toFixed(1)}%
                        </Chip>
                      )}
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 text-sm">
                    {data.financialData.totalCash && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Total cash and cash equivalents on the balance sheet">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Total Cash:
                          </span>
                        </Tooltip>
                        <span className="font-semibold">
                          {formatLargeNumber(
                            data.financialData.totalCash,
                            data.financialData.financialCurrency || currency,
                          )}
                        </span>
                      </div>
                    )}
                    {data.financialData.totalCashPerShare && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Cash per share">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Cash Per Share:
                          </span>
                        </Tooltip>
                        <span className="font-semibold">
                          {formatCurrency(
                            data.financialData.totalCashPerShare,
                            {
                              currency:
                                data.financialData.financialCurrency ||
                                currency,
                              showCents: true,
                            },
                          )}
                        </span>
                      </div>
                    )}
                    {data.financialData.totalDebt && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Total debt obligations">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Total Debt:
                          </span>
                        </Tooltip>
                        <span className="font-semibold">
                          {formatLargeNumber(
                            data.financialData.totalDebt,
                            data.financialData.financialCurrency || currency,
                          )}
                        </span>
                      </div>
                    )}
                    {data.financialData.debtToEquity && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Debt-to-Equity ratio. Lower values indicate less leverage">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Debt to Equity:
                          </span>
                        </Tooltip>
                        <Chip
                          color={
                            data.financialData.debtToEquity > 200
                              ? "danger"
                              : data.financialData.debtToEquity > 100
                                ? "warning"
                                : "success"
                          }
                          size="sm"
                          variant="flat"
                        >
                          {data.financialData.debtToEquity.toFixed(2)}%
                        </Chip>
                      </div>
                    )}
                    {data.financialData.quickRatio && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Quick ratio (acid test). Measures ability to pay short-term obligations. >1.0 is healthy">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Quick Ratio:
                          </span>
                        </Tooltip>
                        <Chip
                          color={
                            data.financialData.quickRatio >= 1
                              ? "success"
                              : data.financialData.quickRatio >= 0.5
                                ? "warning"
                                : "danger"
                          }
                          size="sm"
                          variant="flat"
                        >
                          {data.financialData.quickRatio.toFixed(3)}
                        </Chip>
                      </div>
                    )}
                    {data.financialData.currentRatio && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Current ratio. Measures ability to pay short-term liabilities. >1.0 indicates good liquidity">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Current Ratio:
                          </span>
                        </Tooltip>
                        <Chip
                          color={
                            data.financialData.currentRatio >= 1.5
                              ? "success"
                              : data.financialData.currentRatio >= 1
                                ? "warning"
                                : "danger"
                          }
                          size="sm"
                          variant="flat"
                        >
                          {data.financialData.currentRatio.toFixed(3)}
                        </Chip>
                      </div>
                    )}
                  </div>
                </AccordionItem>
              )}

              {/* Revenue & Profitability */}
              {(data.financialData.totalRevenue ||
                data.financialData.ebitda ||
                data.financialData.grossProfits) && (
                <AccordionItem
                  key="revenue-profitability"
                  title={
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        Revenue & Profitability
                      </span>
                      {data.financialData.profitMargins && (
                        <Chip color="success" size="sm" variant="flat">
                          Profit Margin:{" "}
                          {formatPercentage(
                            data.financialData.profitMargins * 100,
                            { multiply: true, decimals: 1 },
                          )}
                        </Chip>
                      )}
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 text-sm">
                    {data.financialData.totalRevenue && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Total revenue for the most recent fiscal period">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Total Revenue:
                          </span>
                        </Tooltip>
                        <span className="font-semibold">
                          {formatLargeNumber(
                            data.financialData.totalRevenue,
                            data.financialData.financialCurrency || currency,
                          )}
                        </span>
                      </div>
                    )}
                    {data.financialData.revenuePerShare && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Revenue per share">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Revenue Per Share:
                          </span>
                        </Tooltip>
                        <span className="font-semibold">
                          {formatCurrency(data.financialData.revenuePerShare, {
                            currency:
                              data.financialData.financialCurrency || currency,
                            showCents: true,
                          })}
                        </span>
                      </div>
                    )}
                    {data.financialData.grossProfits && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Gross profit (Revenue - Cost of Goods Sold)">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Gross Profits:
                          </span>
                        </Tooltip>
                        <span className="font-semibold">
                          {formatLargeNumber(
                            data.financialData.grossProfits,
                            data.financialData.financialCurrency || currency,
                          )}
                        </span>
                      </div>
                    )}
                    {data.financialData.ebitda && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Earnings Before Interest, Taxes, Depreciation, and Amortization">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            EBITDA:
                          </span>
                        </Tooltip>
                        <span className="font-semibold">
                          {formatLargeNumber(
                            data.financialData.ebitda,
                            data.financialData.financialCurrency || currency,
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </AccordionItem>
              )}

              {/* Margins */}
              {(data.financialData.grossMargins ||
                data.financialData.operatingMargins ||
                data.financialData.profitMargins ||
                data.financialData.ebitdaMargins) && (
                <AccordionItem
                  key="margins"
                  title={
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Margins</span>
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 text-sm">
                    {data.financialData.grossMargins !== undefined && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Gross profit margin (Gross Profit / Revenue). Higher is better">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Gross Margin:
                          </span>
                        </Tooltip>
                        <span className="font-semibold">
                          {formatPercentage(
                            data.financialData.grossMargins * 100,
                            { multiply: true, decimals: 2 },
                          )}
                        </span>
                      </div>
                    )}
                    {data.financialData.ebitdaMargins !== undefined && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="EBITDA margin (EBITDA / Revenue)">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            EBITDA Margin:
                          </span>
                        </Tooltip>
                        <span className="font-semibold">
                          {formatPercentage(
                            data.financialData.ebitdaMargins * 100,
                            { multiply: true, decimals: 2 },
                          )}
                        </span>
                      </div>
                    )}
                    {data.financialData.operatingMargins !== undefined && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Operating margin (Operating Income / Revenue)">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Operating Margin:
                          </span>
                        </Tooltip>
                        <span className="font-semibold">
                          {formatPercentage(
                            data.financialData.operatingMargins * 100,
                            { multiply: true, decimals: 2 },
                          )}
                        </span>
                      </div>
                    )}
                    {data.financialData.profitMargins !== undefined && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Net profit margin (Net Income / Revenue). Higher is better">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Profit Margin:
                          </span>
                        </Tooltip>
                        <span className="font-semibold">
                          {formatPercentage(
                            data.financialData.profitMargins * 100,
                            { multiply: true, decimals: 2 },
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </AccordionItem>
              )}

              {/* Cash Flow */}
              {(data.financialData.operatingCashflow ||
                data.financialData.freeCashflow) && (
                <AccordionItem
                  key="cashflow"
                  title={
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Cash Flow</span>
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 text-sm">
                    {data.financialData.operatingCashflow && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Cash generated from normal business operations">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Operating Cash Flow:
                          </span>
                        </Tooltip>
                        <span className="font-semibold">
                          {formatLargeNumber(
                            data.financialData.operatingCashflow,
                            data.financialData.financialCurrency || currency,
                          )}
                        </span>
                      </div>
                    )}
                    {data.financialData.freeCashflow && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Cash available after capital expenditures">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Free Cash Flow:
                          </span>
                        </Tooltip>
                        <span className="font-semibold">
                          {formatLargeNumber(
                            data.financialData.freeCashflow,
                            data.financialData.financialCurrency || currency,
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </AccordionItem>
              )}

              {/* Returns & Growth */}
              {(data.financialData.returnOnAssets ||
                data.financialData.returnOnEquity ||
                data.financialData.revenueGrowth ||
                data.financialData.earningsGrowth) && (
                <AccordionItem
                  key="returns-growth"
                  title={
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Returns & Growth</span>
                      {data.financialData.returnOnEquity && (
                        <Chip
                          color={
                            data.financialData.returnOnEquity > 0.15
                              ? "success"
                              : "warning"
                          }
                          size="sm"
                          variant="flat"
                        >
                          ROE:{" "}
                          {formatPercentage(
                            data.financialData.returnOnEquity * 100,
                            { multiply: true, decimals: 1 },
                          )}
                        </Chip>
                      )}
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 text-sm">
                    {data.financialData.returnOnAssets !== undefined && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Return on Assets. Measures how efficiently assets generate profit. Higher is better">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Return on Assets:
                          </span>
                        </Tooltip>
                        <span className="font-semibold">
                          {formatPercentage(
                            data.financialData.returnOnAssets * 100,
                            { multiply: true, decimals: 2 },
                          )}
                        </span>
                      </div>
                    )}
                    {data.financialData.returnOnEquity !== undefined && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Return on Equity. Measures profitability relative to shareholder equity. Higher is better">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Return on Equity:
                          </span>
                        </Tooltip>
                        <Chip
                          color={
                            data.financialData.returnOnEquity > 0.15
                              ? "success"
                              : data.financialData.returnOnEquity > 0.1
                                ? "primary"
                                : "warning"
                          }
                          size="sm"
                          variant="flat"
                        >
                          {formatPercentage(
                            data.financialData.returnOnEquity * 100,
                            { multiply: true, decimals: 2 },
                          )}
                        </Chip>
                      </div>
                    )}
                    {data.financialData.revenueGrowth !== undefined && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Year-over-year revenue growth rate">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Revenue Growth:
                          </span>
                        </Tooltip>
                        <Chip
                          color={
                            data.financialData.revenueGrowth > 0
                              ? "success"
                              : "danger"
                          }
                          size="sm"
                          variant="flat"
                        >
                          {formatPercentage(
                            data.financialData.revenueGrowth * 100,
                            { multiply: true, decimals: 2 },
                          )}
                        </Chip>
                      </div>
                    )}
                    {data.financialData.earningsGrowth !== undefined && (
                      <div className="flex justify-between items-center">
                        <Tooltip content="Year-over-year earnings growth rate">
                          <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                            Earnings Growth:
                          </span>
                        </Tooltip>
                        <Chip
                          color={
                            data.financialData.earningsGrowth > 0
                              ? "success"
                              : "danger"
                          }
                          size="sm"
                          variant="flat"
                        >
                          {formatPercentage(
                            data.financialData.earningsGrowth * 100,
                            { multiply: true, decimals: 2 },
                          )}
                        </Chip>
                      </div>
                    )}
                  </div>
                </AccordionItem>
              )}
            </Accordion>
          </CardBody>
        </Card>
      )}

      {/* Institutional Ownership */}
      {data.institutionOwnership &&
        data.institutionOwnership.ownershipList &&
        data.institutionOwnership.ownershipList.length > 0 && (
          <Card className="bg-white dark:bg-black">
            <CardHeader>
              <h3 className="text-lg font-bold">Institutional Ownership</h3>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                {/* Summary Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 bg-default-100 rounded-lg mb-4">
                  <div>
                    <Tooltip content="Number of major institutional holders">
                      <div className="text-xs text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                        Top Institutions
                      </div>
                    </Tooltip>
                    <div className="text-2xl font-bold mt-1">
                      {data.institutionOwnership.ownershipList.length}
                    </div>
                  </div>
                  <div>
                    <Tooltip content="Total percentage held by top institutions">
                      <div className="text-xs text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                        Total Holdings
                      </div>
                    </Tooltip>
                    <div className="text-2xl font-bold mt-1">
                      {formatPercentage(
                        data.institutionOwnership.ownershipList.reduce(
                          (sum: number, inst: any) => sum + (inst.pctHeld || 0),
                          0,
                        ) * 100,
                        { multiply: true, decimals: 1 },
                      )}
                    </div>
                  </div>
                  <div>
                    <Tooltip content="Reporting period for ownership data">
                      <div className="text-xs text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                        As of Date
                      </div>
                    </Tooltip>
                    <div className="text-sm font-semibold mt-1">
                      {data.institutionOwnership.ownershipList[0]?.reportDate &&
                        formatDate(
                          data.institutionOwnership.ownershipList[0].reportDate,
                        )}
                    </div>
                  </div>
                </div>

                <Divider />

                {/* Top 10 Holders */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-default-700">
                    Top Institutional Holders
                  </h4>
                  <div className="space-y-2">
                    {data.institutionOwnership.ownershipList.map(
                      (institution: any, index: number) => (
                        <div
                          key={index}
                          className="border border-default-200 rounded-lg p-3 hover:bg-default-50 transition-colors"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-default-400">
                                  #{index + 1}
                                </span>
                                <span className="font-semibold text-sm">
                                  {institution.organization}
                                </span>
                              </div>
                              {institution.reportDate && (
                                <div className="text-xs text-default-400 mt-1">
                                  Reported: {formatDate(institution.reportDate)}
                                </div>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <Tooltip content="Percentage of total shares outstanding held by this institution">
                                <Chip
                                  color={
                                    institution.pctHeld >= 0.1
                                      ? "success"
                                      : institution.pctHeld >= 0.05
                                        ? "primary"
                                        : institution.pctHeld >= 0.02
                                          ? "warning"
                                          : "default"
                                  }
                                  size="sm"
                                  variant="flat"
                                >
                                  {formatPercentage(institution.pctHeld * 100, {
                                    multiply: true,
                                    decimals: 2,
                                  })}
                                </Chip>
                              </Tooltip>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mt-3">
                            {institution.position && (
                              <div>
                                <Tooltip content="Number of shares held">
                                  <div className="text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                                    Position
                                  </div>
                                </Tooltip>
                                <div className="font-semibold mt-1">
                                  {institution.position.toLocaleString()} shares
                                </div>
                              </div>
                            )}
                            {institution.value && (
                              <div>
                                <Tooltip content="Market value of holdings">
                                  <div className="text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                                    Value
                                  </div>
                                </Tooltip>
                                <div className="font-semibold mt-1">
                                  {formatLargeNumber(
                                    institution.value,
                                    currency,
                                  )}
                                </div>
                              </div>
                            )}
                            {institution.pctChange !== undefined && (
                              <div>
                                <Tooltip content="Change in holdings from previous period">
                                  <div className="text-default-500 cursor-help border-b border-dotted border-default-400 inline-block">
                                    Change
                                  </div>
                                </Tooltip>
                                <div className="mt-1">
                                  <Chip
                                    color={
                                      institution.pctChange > 0
                                        ? "success"
                                        : institution.pctChange < 0
                                          ? "danger"
                                          : "default"
                                    }
                                    size="sm"
                                    variant="flat"
                                  >
                                    {institution.pctChange > 0 ? "+" : ""}
                                    {formatPercentage(
                                      institution.pctChange * 100,
                                      { multiply: true, decimals: 2 },
                                    )}
                                  </Chip>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                {/* Ownership Insights */}
                <Divider />
                <div className="text-xs text-default-500 p-3 bg-default-50 rounded-lg">
                  <Tooltip content="Institutional ownership indicates professional investor confidence in the company">
                    <div className="cursor-help">
                      <span className="font-semibold">
                        About Institutional Ownership:
                      </span>
                      <p className="mt-1">
                        High institutional ownership can indicate strong
                        confidence from professional investors, but it may also
                        lead to higher volatility. Major changes in holdings can
                        signal shifts in institutional sentiment about the
                        company&apos;s prospects.
                      </p>
                    </div>
                  </Tooltip>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

      {/* Key Statistics */}
      {data.defaultKeyStatistics &&
        Object.keys(data.defaultKeyStatistics).length > 0 && (
          <Card className="bg-white dark:bg-black">
            <CardHeader>
              <h3 className="text-lg font-bold">Key Statistics</h3>
            </CardHeader>
            <CardBody>
              <Accordion variant="bordered">
                {/* Valuation Metrics */}
                {(data.defaultKeyStatistics.enterpriseValue ||
                  data.defaultKeyStatistics.forwardPE ||
                  data.defaultKeyStatistics.priceToBook ||
                  data.defaultKeyStatistics.beta) && (
                  <AccordionItem
                    key="valuation"
                    title={
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Valuation Metrics</span>
                        {data.defaultKeyStatistics.forwardPE && (
                          <Chip color="primary" size="sm" variant="flat">
                            P/E:{" "}
                            {data.defaultKeyStatistics.forwardPE.toFixed(2)}
                          </Chip>
                        )}
                      </div>
                    }
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 text-sm">
                      {data.defaultKeyStatistics.enterpriseValue && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Total value of the company including debt, calculated as market cap plus debt minus cash">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Enterprise Value:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {formatLargeNumber(
                              data.defaultKeyStatistics.enterpriseValue,
                              currency,
                            )}
                          </span>
                        </div>
                      )}
                      {data.defaultKeyStatistics.forwardPE && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Price-to-Earnings ratio based on estimated future earnings. Lower values may indicate undervaluation">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Forward P/E:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {data.defaultKeyStatistics.forwardPE.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {data.defaultKeyStatistics.priceToBook && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Price-to-Book ratio comparing market value to book value. Below 1.0 may indicate undervaluation">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Price to Book:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {data.defaultKeyStatistics.priceToBook.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {data.defaultKeyStatistics.bookValue && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Book value per share, representing net asset value per share">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Book Value:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {formatCurrency(
                              data.defaultKeyStatistics.bookValue,
                              { currency, showCents: true },
                            )}
                          </span>
                        </div>
                      )}
                      {data.defaultKeyStatistics.enterpriseToRevenue && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Enterprise Value to Revenue ratio. Lower values may indicate better value">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              EV/Revenue:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {data.defaultKeyStatistics.enterpriseToRevenue.toFixed(
                              2,
                            )}
                          </span>
                        </div>
                      )}
                      {data.defaultKeyStatistics.beta && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Beta measures volatility relative to the market. >1 = more volatile, <1 = less volatile than market">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Beta:
                            </span>
                          </Tooltip>
                          <Chip
                            color={
                              data.defaultKeyStatistics.beta > 1.2
                                ? "danger"
                                : data.defaultKeyStatistics.beta > 0.8
                                  ? "warning"
                                  : "success"
                            }
                            size="sm"
                            variant="flat"
                          >
                            {data.defaultKeyStatistics.beta.toFixed(3)}
                          </Chip>
                        </div>
                      )}
                    </div>
                  </AccordionItem>
                )}

                {/* Share Statistics */}
                {(data.defaultKeyStatistics.sharesOutstanding ||
                  data.defaultKeyStatistics.floatShares ||
                  data.defaultKeyStatistics.heldPercentInsiders ||
                  data.defaultKeyStatistics.heldPercentInstitutions) && (
                  <AccordionItem
                    key="shares"
                    title={
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Share Statistics</span>
                        {data.defaultKeyStatistics.sharesOutstanding && (
                          <Chip color="default" size="sm" variant="flat">
                            {formatLargeNumber(
                              data.defaultKeyStatistics.sharesOutstanding,
                              currency,
                            )}{" "}
                            shares
                          </Chip>
                        )}
                      </div>
                    }
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 text-sm">
                      {data.defaultKeyStatistics.sharesOutstanding && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Total number of shares currently held by all shareholders">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Shares Outstanding:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {formatLargeNumber(
                              data.defaultKeyStatistics.sharesOutstanding,
                              currency,
                            )}
                          </span>
                        </div>
                      )}
                      {data.defaultKeyStatistics.impliedSharesOutstanding && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Implied shares outstanding including options and convertible securities">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Implied Shares:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {formatLargeNumber(
                              data.defaultKeyStatistics
                                .impliedSharesOutstanding,
                              currency,
                            )}
                          </span>
                        </div>
                      )}
                      {data.defaultKeyStatistics.floatShares && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Shares available for public trading, excluding restricted shares">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Float Shares:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {formatLargeNumber(
                              data.defaultKeyStatistics.floatShares,
                              currency,
                            )}
                          </span>
                        </div>
                      )}
                      {data.defaultKeyStatistics.heldPercentInsiders !==
                        undefined && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Percentage of shares held by company insiders (executives, directors)">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Insider Holdings:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {formatPercentage(
                              data.defaultKeyStatistics.heldPercentInsiders *
                                100,
                              { multiply: true, decimals: 2 },
                            )}
                          </span>
                        </div>
                      )}
                      {data.defaultKeyStatistics.heldPercentInstitutions !==
                        undefined && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Percentage of shares held by institutional investors (mutual funds, pension funds, etc.)">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Institutional Holdings:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {formatPercentage(
                              data.defaultKeyStatistics
                                .heldPercentInstitutions * 100,
                              { multiply: true, decimals: 2 },
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </AccordionItem>
                )}

                {/* Earnings & Profitability */}
                {(data.defaultKeyStatistics.trailingEps ||
                  data.defaultKeyStatistics.forwardEps ||
                  data.defaultKeyStatistics.profitMargins ||
                  data.defaultKeyStatistics.earningsQuarterlyGrowth) && (
                  <AccordionItem
                    key="earnings"
                    title={
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          Earnings & Profitability
                        </span>
                        {data.defaultKeyStatistics.profitMargins && (
                          <Chip color="success" size="sm" variant="flat">
                            Margin:{" "}
                            {formatPercentage(
                              data.defaultKeyStatistics.profitMargins * 100,
                              { multiply: true, decimals: 1 },
                            )}
                          </Chip>
                        )}
                      </div>
                    }
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 text-sm">
                      {data.defaultKeyStatistics.trailingEps && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Earnings per share over the last 12 months (trailing twelve months)">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Trailing EPS:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {formatCurrency(
                              data.defaultKeyStatistics.trailingEps,
                              { currency, showCents: true },
                            )}
                          </span>
                        </div>
                      )}
                      {data.defaultKeyStatistics.forwardEps && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Expected earnings per share for the next 12 months">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Forward EPS:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {formatCurrency(
                              data.defaultKeyStatistics.forwardEps,
                              { currency, showCents: true },
                            )}
                          </span>
                        </div>
                      )}
                      {data.defaultKeyStatistics.profitMargins !==
                        undefined && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Net profit as a percentage of revenue. Higher is better">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Profit Margin:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {formatPercentage(
                              data.defaultKeyStatistics.profitMargins * 100,
                              { multiply: true, decimals: 2 },
                            )}
                          </span>
                        </div>
                      )}
                      {data.defaultKeyStatistics.earningsQuarterlyGrowth !==
                        undefined && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Quarter-over-quarter earnings growth rate">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Quarterly Growth:
                            </span>
                          </Tooltip>
                          <Chip
                            color={
                              data.defaultKeyStatistics
                                .earningsQuarterlyGrowth > 0
                                ? "success"
                                : "danger"
                            }
                            size="sm"
                            variant="flat"
                          >
                            {formatPercentage(
                              data.defaultKeyStatistics
                                .earningsQuarterlyGrowth * 100,
                              { multiply: true, decimals: 1 },
                            )}
                          </Chip>
                        </div>
                      )}
                      {data.defaultKeyStatistics.netIncomeToCommon && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Net income available to common shareholders">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Net Income:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {formatLargeNumber(
                              data.defaultKeyStatistics.netIncomeToCommon,
                              currency,
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </AccordionItem>
                )}

                {/* Fund Information */}
                {(data.defaultKeyStatistics.fundFamily ||
                  data.defaultKeyStatistics.legalType ||
                  data.defaultKeyStatistics.category ||
                  data.defaultKeyStatistics.fundInceptionDate) && (
                  <AccordionItem
                    key="fund-info"
                    title={
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Fund Information</span>
                        {data.defaultKeyStatistics.legalType && (
                          <Chip color="secondary" size="sm" variant="flat">
                            {data.defaultKeyStatistics.legalType}
                          </Chip>
                        )}
                      </div>
                    }
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 text-sm">
                      {data.defaultKeyStatistics.legalType && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="The legal structure of the fund">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Legal Type:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {data.defaultKeyStatistics.legalType}
                          </span>
                        </div>
                      )}
                      {data.defaultKeyStatistics.fundFamily && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="The fund family or asset management company">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Fund Family:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {data.defaultKeyStatistics.fundFamily}
                          </span>
                        </div>
                      )}
                      {data.defaultKeyStatistics.category && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Fund investment category or strategy">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Category:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {data.defaultKeyStatistics.category}
                          </span>
                        </div>
                      )}
                      {data.defaultKeyStatistics.fundInceptionDate && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Date when the fund was launched">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Inception Date:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {formatDate(
                              data.defaultKeyStatistics.fundInceptionDate,
                            )}
                          </span>
                        </div>
                      )}
                      {data.defaultKeyStatistics.leadInvestor && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Primary fund manager or lead investor">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Lead Investor:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {data.defaultKeyStatistics.leadInvestor}
                          </span>
                        </div>
                      )}
                      {data.defaultKeyStatistics.latestShareClass && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="The latest share class designation">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Share Class:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {data.defaultKeyStatistics.latestShareClass}
                          </span>
                        </div>
                      )}
                    </div>
                  </AccordionItem>
                )}

                {/* Dividend & Performance */}
                {(data.defaultKeyStatistics.lastDividendValue ||
                  data.defaultKeyStatistics["52WeekChange"] ||
                  data.defaultKeyStatistics.lastSplitFactor) && (
                  <AccordionItem
                    key="dividend-performance"
                    title={
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          Dividend & Performance
                        </span>
                        {data.defaultKeyStatistics["52WeekChange"] !==
                          undefined && (
                          <Chip
                            color={
                              data.defaultKeyStatistics["52WeekChange"] > 0
                                ? "success"
                                : "danger"
                            }
                            size="sm"
                            variant="flat"
                          >
                            52W:{" "}
                            {formatPercentage(
                              data.defaultKeyStatistics["52WeekChange"] * 100,
                              { multiply: true, decimals: 1 },
                            )}
                          </Chip>
                        )}
                      </div>
                    }
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 text-sm">
                      {data.defaultKeyStatistics.lastDividendValue && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="The most recent dividend payment per share">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Last Dividend:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {formatCurrency(
                              data.defaultKeyStatistics.lastDividendValue,
                              { currency, showCents: true },
                            )}
                          </span>
                        </div>
                      )}
                      {data.defaultKeyStatistics.lastDividendDate && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Date of the most recent dividend payment">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Last Dividend Date:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {formatDate(
                              data.defaultKeyStatistics.lastDividendDate,
                            )}
                          </span>
                        </div>
                      )}
                      {data.defaultKeyStatistics["52WeekChange"] !==
                        undefined && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Stock price change over the last 52 weeks">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              52-Week Change:
                            </span>
                          </Tooltip>
                          <Chip
                            color={
                              data.defaultKeyStatistics["52WeekChange"] > 0
                                ? "success"
                                : "danger"
                            }
                            size="sm"
                            variant="flat"
                          >
                            {formatPercentage(
                              data.defaultKeyStatistics["52WeekChange"] * 100,
                              { multiply: true, decimals: 2 },
                            )}
                          </Chip>
                        </div>
                      )}
                      {data.defaultKeyStatistics.SandP52WeekChange !==
                        undefined && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="S&P 500 index change over the last 52 weeks for comparison">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              S&P 500 52W Change:
                            </span>
                          </Tooltip>
                          <Chip
                            color={
                              data.defaultKeyStatistics.SandP52WeekChange > 0
                                ? "success"
                                : "danger"
                            }
                            size="sm"
                            variant="flat"
                          >
                            {formatPercentage(
                              data.defaultKeyStatistics.SandP52WeekChange * 100,
                              { multiply: true, decimals: 2 },
                            )}
                          </Chip>
                        </div>
                      )}
                      {data.defaultKeyStatistics.lastSplitFactor && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="The ratio of the most recent stock split">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Last Split Factor:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {data.defaultKeyStatistics.lastSplitFactor}
                          </span>
                        </div>
                      )}
                      {data.defaultKeyStatistics.lastSplitDate && (
                        <div className="flex justify-between items-center">
                          <Tooltip content="Date of the most recent stock split">
                            <span className="text-default-500 cursor-help border-b border-dotted border-default-400">
                              Last Split Date:
                            </span>
                          </Tooltip>
                          <span className="font-semibold">
                            {formatDate(
                              new Date(
                                data.defaultKeyStatistics.lastSplitDate * 1000,
                              ),
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </AccordionItem>
                )}
              </Accordion>
            </CardBody>
          </Card>
        )}
    </div>
  );
}
