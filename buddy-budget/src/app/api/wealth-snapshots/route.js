import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req) {
   const session = await getServerSession(authOptions)

   if (!session) {
      return new Response("Unauthorized", { status: 401 })
   }

   // Get URL parameters
   const { searchParams } = new URL(req.url)
   const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')) : undefined
   const skip = searchParams.get('skip') ? parseInt(searchParams.get('skip')) : undefined
   const sortBy = searchParams.get('sortBy') || 'timestamp'
   const sortOrder = searchParams.get('sortOrder') || 'asc'
   const fromDate = searchParams.get('fromDate')
   const toDate = searchParams.get('toDate')

   // Build where clause
   const where = {
      userId: session.user.id,
      ...(fromDate && {
         timestamp: {
            gte: new Date(fromDate),
            ...(toDate && { lte: new Date(toDate) })
         }
      })
   }

   const wealthSnapshots = await prisma.wealthSnapshot.findMany({
      where,
      orderBy: {
         [sortBy]: sortOrder
      },
      take: limit,
      skip: skip
   })

   // Extract account IDs from all wealthSnapshots
   const accountIds = new Set()
   wealthSnapshots.forEach(snapshot => {
      snapshot.liquidityAccounts.forEach(account => {
         if (account.id) accountIds.add(account.id)
      })
   })

   // Fetch all referenced accounts in a single query
   const accounts = await prisma.account.findMany({
      where: {
         id: { in: Array.from(accountIds) },
         userId: session.user.id
      }
   })

   // Create a map for quick account lookup
   const accountsMap = {}
   accounts.forEach(account => {
      accountsMap[account.id] = account
   })

   // Enhance wealthSnapshots with full account details
   const enhancedSnapshots = wealthSnapshots.map(snapshot => {
      const enhancedLiquidityAccounts = snapshot.liquidityAccounts.map(liquidityAccount => {
         if (liquidityAccount.id && accountsMap[liquidityAccount.id]) {
            return {
               ...liquidityAccount,
               accountDetails: accountsMap[liquidityAccount.id]
            }
         }
         return liquidityAccount
      })

      return {
         ...snapshot,
         liquidityAccounts: enhancedLiquidityAccounts
      }
   })

   return new Response(JSON.stringify(enhancedSnapshots), { status: 200 })
}