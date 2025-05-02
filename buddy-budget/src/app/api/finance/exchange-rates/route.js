import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getExchangeRates } from "@/components/yahooFinance/exchange-rates";

export async function GET(request) {
   try {
      const session = await getServerSession(authOptions)

      if (!session) {
         return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const { searchParams } = new URL(request.url)
      const fromCurrency = searchParams.get("fromCurrency")
      const toCurrency = searchParams.get("toCurrency")

      const exchangeRate = await getExchangeRates(fromCurrency, toCurrency)

      return NextResponse.json({ exchangeRate }, { status: 200 })

   } catch (error) {
      console.error("Error fetching exchange rates:", error)
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
   }

}