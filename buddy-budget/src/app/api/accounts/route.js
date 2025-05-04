import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getExchangeRates } from "@/components/yahooFinance/exchange-rates"

export async function GET(req) {
   try {
      const session = await getServerSession(authOptions)

      if (!session) {
         return new Response("Unauthorized", { status: 401 })
      }

      const accounts = await prisma.account.findMany({
         where: {
            userId: session.user.id
         }
      })

      return new Response(JSON.stringify(accounts), { status: 200 })
   } catch (error) {
      console.error("Error fetching accounts:", error)
      return new Response("Internal Server Error", { status: 500 })
   }
}

export async function POST(req) {
   try {
      const session = await getServerSession(authOptions)

      if (!session) {
         return new Response("Unauthorized", { status: 401 })
      }

      const { name, type, icon, color, currency, value } = await req.json()

      if (!name || !type || !icon || !color || !currency || !value) {
         return new Response("Missing required fields", { status: 400 })
      }

      const result = await prisma.$transaction(async (tx) => {
         const account = await prisma.account.create({
            data: {
               name,
               type,
               icon,
               color,
               currency,
               value,
               userId: session.user.id
            }
         })

         let convertedValue = value
         if (currency !== session.user.primaryCurrency) {
            const exchangeRate = await getExchangeRates(currency, session.user.primaryCurrency)
            convertedValue = value * exchangeRate
         }

         // GET last wealth snapshot
         let lastWealthSnapshot = await tx.wealthSnapshot.findFirst({
            where: {
               userId: session.user.id
            },
            select: {
               userId: true,
               liquidityAccounts: true,
               totalValue: true
            },
            orderBy: { timestamp: 'desc' }
         })

         if (!lastWealthSnapshot) {
            lastWealthSnapshot = {
               userId: session.user.id,
               liquidityAccounts: [
                  {
                     id: account.id,
                     value,
                     convertedValue,
                  }
               ],
               totalValue: convertedValue
            }
         } else {
            lastWealthSnapshot.liquidityAccounts.push({
               id: account.id,
               value,
               convertedValue,
            })
            lastWealthSnapshot.totalValue += convertedValue
         }


         await tx.wealthSnapshot.create({
            data: lastWealthSnapshot
         })

         return { success: true, account }
      })

      if (result.success) {
         return new Response(JSON.stringify(result.account), { status: 201 })
      } else {
         return new Response("Internal Server Error", { status: 500 })
      }

   } catch (error) {
      console.error("Error creating account:", error)
      return new Response("Internal Server Error", { status: 500 })
   }
}

export async function PUT(req) {
   try {
      const session = await getServerSession(authOptions)

      if (!session) {
         return new Response("Unauthorized", { status: 401 })
      }

      const { id, name, type, icon, color, value } = await req.json()

      if (!id || !name || !type || !icon || !color || !value) {
         return new Response("Missing required fields", { status: 400 })
      }

      const existingAccount = await prisma.account.findUnique({
         where: { id, userId: session.user.id }
      })

      if (!existingAccount) {
         return new Response("Account not found", { status: 404 })
      }

      const result = await prisma.$transaction(async (tx) => {
         const account = await tx.account.update({
            where: { id, userId: session.user.id },
            data: { name, type, icon, color, value }
         })

         if (existingAccount.value !== value) {
            let exchangeRate = 1
            if (existingAccount.currency !== session.user.primaryCurrency) {
               exchangeRate = await getExchangeRates(existingAccount.currency, session.user.primaryCurrency)
            }

            const convertedValue = value * exchangeRate

            const lastWealthSnapshot = await tx.wealthSnapshot.findFirst({
               where: { userId: session.user.id },
               orderBy: { timestamp: 'desc' },
               select: {
                  userId: true,
                  liquidityAccounts: true,
                  totalValue: true,
               }
            })


            if (!lastWealthSnapshot) {
               throw new Error("No wealth snapshots found")
            }

            const liquidityAccount = lastWealthSnapshot.liquidityAccounts.find(account => account.id === id)
            if (!liquidityAccount) {
               throw new Error("Liquidity account not found")
            }

               
            const difference = convertedValue - liquidityAccount.convertedValue

            lastWealthSnapshot.liquidityAccounts = lastWealthSnapshot.liquidityAccounts.map(account =>
               account.id === id ? { ...account, value, convertedValue } : account
            )

            lastWealthSnapshot.totalValue += difference


            await tx.wealthSnapshot.create({
               data: lastWealthSnapshot
            })

            return { success: true, account }
         }

         return { success: true, account }
      })

      if (result.success) {
         return new Response(JSON.stringify(result.account), { status: 200 })
      } else {
         return new Response("Internal Server Error", { status: 500 })
      }
   } catch (error) {
      console.error("Error updating account:", error)
      return new Response("Internal Server Error", { status: 500 })
   }
}

export async function DELETE(req) {
   try {
      const session = await getServerSession(authOptions)

      if (!session) {
         return new Response("Unauthorized", { status: 401 })
      }

      const { id } = await req.json()

      if (!id) {
         return new Response("Missing required fields", { status: 400 })
      }

      const account = await prisma.account.findUnique({
         where: { id, userId: session.user.id }
      })

      if (!account) {
         return new Response("Account not found", { status: 404 })
      }

      const result = await prisma.$transaction(async (tx) => {
         await tx.account.delete({
            where: { id, userId: session.user.id }
         })

         const wealthSnapshots = await tx.wealthSnapshot.findMany({
            where: {
               userId: session.user.id
            }
         });

         // Filter manually since we're working with a JSON array
         const filteredSnapshots = wealthSnapshots.filter(snapshot =>
            snapshot.liquidityAccounts.some(item => item.id === account.id)
         );

         if (filteredSnapshots.length === 0) {
            throw new Error("No wealth snapshots found with this account")
         }


         for (const wealthSnapshot of filteredSnapshots) {
            const accountItem = wealthSnapshot.liquidityAccounts.find(item => item.id === account.id);
            if (!accountItem) continue;

            const accountConvertedValue = accountItem.convertedValue;
            wealthSnapshot.liquidityAccounts = wealthSnapshot.liquidityAccounts.filter(item => item.id !== account.id);

            await tx.wealthSnapshot.update({
               where: { id: wealthSnapshot.id },
               data: {
                  liquidityAccounts: wealthSnapshot.liquidityAccounts,
                  totalValue: wealthSnapshot.totalValue - accountConvertedValue
               }
            })
         }

         return { success: true }
      })

      if (result.success) {
         return new Response("Account deleted successfully", { status: 200 })
      } else {
         return new Response("Internal Server Error", { status: 500 })
      }
   } catch (error) {
      console.error("Error deleting account:", error)
      return new Response("Internal Server Error", { status: 500 })
   }
}