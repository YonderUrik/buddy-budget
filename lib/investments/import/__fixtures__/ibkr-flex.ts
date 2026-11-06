/**
 * Fully synthetic Flex Web Service reports (Activity Flex Query, XML), internally reconciled, for tests.
 * No real account data: the account id, instruments and amounts are invented.
 */

export interface FlexFixtureOptions {
  account?: string;
  from?: string; // yyyyMMdd
  to?: string;
  /** Omit a section element entirely, as when the query does not include it. */
  omit?: string[];
  extraCash?: string;
  /**
   * A later period with no activity: cash and the position carried over from the year above, nothing traded. With
   * `position` the open position reports another quantity (a report that does not reconcile).
   */
  quiet?: boolean;
  position?: number;
}

/**
 * One year of a small EUR account: a 2000 EUR deposit, 10 shares bought at 100 (1 EUR commission), a USD dividend
 * with withholding, 400 EUR sold for 440 USD (2 EUR commission) and 0.25 EUR interest (listed twice, one transactionID).
 * Cash: EUR 597.25, USD 442.5.
 */
export function flexReport(options: FlexFixtureOptions = {}): string {
  const { account = "U90000001", from = "20250101", to = "20251231", omit = [], extraCash = "", quiet = false, position = 10 } = options;
  const sections: Record<string, string> = quiet ? quietSections(account, from, to, position) : {
    AccountInformation: `<AccountInformation accountId="${account}" acctAlias="" currency="EUR" name="Test Person" accountType="Individual" dateOpened="20250101" />`,
    EquitySummaryInBase: `<EquitySummaryInBase>
      <EquitySummaryByReportDateInBase accountId="${account}" currency="EUR" reportDate="${from}" cash="0" stock="0" dividendAccruals="0" interestAccruals="0" total="0" />
      <EquitySummaryByReportDateInBase accountId="${account}" currency="EUR" reportDate="${to}" cash="999.52" stock="1000" dividendAccruals="0" interestAccruals="0.1" total="1999.62" />
    </EquitySummaryInBase>`,
    CashReport: `<CashReport>
      <CashReportCurrency accountId="${account}" currency="BASE_SUMMARY" levelOfDetail="BaseCurrency" startingCash="0" commissions="-3" endingCash="999.52" />
      <CashReportCurrency accountId="${account}" currency="EUR" levelOfDetail="Currency" startingCash="0" commissions="-3" endingCash="597.25" />
      <CashReportCurrency accountId="${account}" currency="USD" levelOfDetail="Currency" startingCash="0" commissions="0" endingCash="442.5" />
    </CashReport>`,
    SecuritiesInfo: `<SecuritiesInfo>
      <SecurityInfo assetCategory="STK" symbol="MOCKETF" description="MOCK WORLD ETF" conid="900001" isin="IE0000000004" listingExchange="IBIS2" subCategory="ETF" currency="EUR" multiplier="1" />
      <SecurityInfo assetCategory="STK" symbol="MOCKUS" description="MOCK US CORP" conid="900002" isin="US0000000002" listingExchange="NASDAQ" subCategory="COMMON" currency="USD" multiplier="1" />
    </SecuritiesInfo>`,
    Trades: `<Trades>
      <Trade accountId="${account}" currency="EUR" assetCategory="STK" symbol="MOCKETF" description="MOCK WORLD ETF" conid="900001" isin="IE0000000004" listingExchange="IBIS2" subCategory="ETF" tradeID="7001" transactionID="8001" ibOrderID="6001" dateTime="20250102;101500" tradeDate="20250102" quantity="10" tradePrice="100" proceeds="-1000" ibCommission="-1" ibCommissionCurrency="EUR" cost="1001" buySell="BUY" notes="O" levelOfDetail="EXECUTION" />
      <Trade accountId="${account}" currency="USD" assetCategory="CASH" symbol="EUR.USD" description="EUR.USD" conid="12087792" tradeID="7002" transactionID="8002" dateTime="20250103;120000" tradeDate="20250103" quantity="-400" tradePrice="1.1" proceeds="440" ibCommission="-2" ibCommissionCurrency="EUR" buySell="SELL" notes="" levelOfDetail="EXECUTION" />
      <Lot accountId="${account}" currency="EUR" assetCategory="STK" symbol="MOCKETF" quantity="10" levelOfDetail="CLOSED_LOT" />
    </Trades>`,
    CashTransactions: `<CashTransactions>
      <CashTransaction accountId="${account}" currency="EUR" type="Deposits/Withdrawals" description="CASH RECEIPTS / ELECTRONIC FUND TRANSFERS" dateTime="20250101" reportDate="20250101" amount="2000" transactionID="9001" levelOfDetail="DETAIL" />
      <CashTransaction accountId="${account}" currency="USD" assetCategory="STK" symbol="MOCKUS" conid="900002" isin="US0000000002" type="Dividends" description="MOCKUS(US0000000002) CASH DIVIDEND USD 0.25 PER SHARE (Ordinary Dividend)" dateTime="20250315;202000" reportDate="20250315" amount="3" transactionID="9002" levelOfDetail="DETAIL" />
      <CashTransaction accountId="${account}" currency="USD" assetCategory="STK" symbol="MOCKUS" conid="900002" isin="US0000000002" type="Withholding Tax" description="MOCKUS(US0000000002) CASH DIVIDEND USD 0.25 PER SHARE - US TAX" dateTime="20250315;202000" reportDate="20250315" amount="-0.5" transactionID="9003" levelOfDetail="DETAIL" />
      <CashTransaction accountId="${account}" currency="EUR" type="Broker Interest Received" description="EUR CREDIT INT FOR DEC-2025" dateTime="20251231" reportDate="20251231" amount="0.25" transactionID="9004" levelOfDetail="DETAIL" />
      <CashTransaction accountId="${account}" currency="EUR" type="Broker Interest Received" description="EUR CREDIT INT FOR DEC-2025" dateTime="20251231" reportDate="20251231" amount="0.25" transactionID="9004" levelOfDetail="DETAIL" />
      ${extraCash}
    </CashTransactions>`,
    OpenPositions: `<OpenPositions>
      <OpenPosition accountId="${account}" currency="EUR" assetCategory="STK" symbol="MOCKETF" conid="900001" isin="IE0000000004" position="10" markPrice="100" positionValue="1000" costBasisMoney="1001" fifoPnlUnrealized="-1" reportDate="${to}" levelOfDetail="SUMMARY" />
    </OpenPositions>`,
    CorporateActions: "<CorporateActions />",
    Transfers: "<Transfers />",
  };
  return wrap(account, from, to, sections, omit);
}

function wrap(account: string, from: string, to: string, sections: Record<string, string>, omit: string[]): string {
  const body = Object.entries(sections).filter(([name]) => !omit.includes(name)).map(([, xml]) => xml).join("\n    ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<FlexQueryResponse queryName="BuddyBudget" type="AF">
  <FlexStatements count="1">
    <FlexStatement accountId="${account}" fromDate="${from}" toDate="${to}" period="Custom" whenGenerated="20260101;083000">
    ${body}
    </FlexStatement>
  </FlexStatements>
</FlexQueryResponse>`;
}

function quietSections(account: string, from: string, to: string, position: number): Record<string, string> {
  return {
    AccountInformation: `<AccountInformation accountId="${account}" currency="EUR" name="Test Person" accountType="Individual" dateOpened="20250101" />`,
    EquitySummaryInBase: `<EquitySummaryInBase>
      <EquitySummaryByReportDateInBase accountId="${account}" currency="EUR" reportDate="${from}" cash="999.52" stock="1000" interestAccruals="0.1" total="1999.62" />
      <EquitySummaryByReportDateInBase accountId="${account}" currency="EUR" reportDate="${to}" cash="999.52" stock="1000" interestAccruals="0.1" total="1999.62" />
    </EquitySummaryInBase>`,
    CashReport: `<CashReport>
      <CashReportCurrency accountId="${account}" currency="EUR" levelOfDetail="Currency" startingCash="597.25" commissions="0" endingCash="597.25" />
      <CashReportCurrency accountId="${account}" currency="USD" levelOfDetail="Currency" startingCash="442.5" commissions="0" endingCash="442.5" />
    </CashReport>`,
    Trades: "<Trades />",
    CashTransactions: "<CashTransactions />",
    OpenPositions: `<OpenPositions>
      <OpenPosition accountId="${account}" currency="EUR" assetCategory="STK" symbol="MOCKETF" description="MOCK WORLD ETF" conid="900001" isin="IE0000000004" listingExchange="IBIS2" subCategory="ETF" position="${position}" markPrice="100" positionValue="${position * 100}" costBasisMoney="1001" fifoPnlUnrealized="-1" reportDate="${to}" levelOfDetail="SUMMARY" />
    </OpenPositions>`,
    CorporateActions: "<CorporateActions />",
    Transfers: "<Transfers />",
  };
}
