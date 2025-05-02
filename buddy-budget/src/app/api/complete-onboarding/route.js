import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getExchangeRates } from "@/components/yahooFinance/exchange-rates"

export async function POST(req) {
   try {
      const session = await getServerSession(authOptions)

      if (!session) {
         return new Response("Unauthorized", { status: 401 })
      }

      const { userPreferences, accounts, categories } = await req.json()

      const user = await prisma.user.findUnique({
         where: {
            id: session.user.id
         }
      })

      if (!user) {
         return new Response("User not found", { status: 404 })
      }

      const result =await prisma.$transaction(async (tx) => {
         await tx.user.update({
            where: {
               id: user.id
            },
            data: {
               hasCompletedOnboarding: true,
               primaryCurrency: userPreferences.primaryCurrency,
               dateFormat: userPreferences.dateFormat,
            }
         })

         if (categories?.length > 0) {
            await tx.category.createMany({
               data: categories.map((category) => ({
                  name: category.name,
                  type: category.type,
                  icon: category.icon,
                  color: category.color,
                  userId: user.id
               }))
            })
         }

         let liquidityAccounts = []
         if (accounts?.length > 0) {
            // First create all accounts
            await tx.account.createMany({
               data: accounts.map((account) => ({
                  userId: user.id,
                  value: account.value,
                  name: account.name,
                  currency: account.currency,
                  type: account.type,
                  icon: account.icon,
                  color: account.color,
               }))
            })

            // Then fetch the created accounts to get their IDs
            const createdAccounts = await tx.account.findMany({
               where: {
                  userId: user.id
               },
            })

            // Process exchange rates for each account
            liquidityAccounts = await Promise.all(createdAccounts.map(async (account) => {
               if (account.currency === userPreferences.primaryCurrency) {
                  return {
                     id: account.id,
                     value: account.value,
                     convertedValue: account.value,
                  }
               }

               const exchangeRate = await getExchangeRates(account.currency, userPreferences.primaryCurrency)
               if (exchangeRate === -1) {
                  throw new Error("Failed to get exchange rate")
               }

               return {
                  id: account.id,
                  value: account.value,
                  convertedValue: account.value * exchangeRate,
               }
            }))
         }


         await tx.wealthSnapshot.create({
            data: {
               userId: user.id,
               liquidityAccounts,
               totalValue: liquidityAccounts.reduce((acc, account) => acc + account.convertedValue, 0),
            }
         })

         return { success: true }
      })

      return new Response(JSON.stringify(result), { status: 200 })


   } catch (error) {
      return new Response("Internal Server Error", { status: 500 })
   }
}
