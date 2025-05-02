import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET: Fetch all categories for the logged-in user
export async function GET(req) {
   try {
      const session = await getServerSession(authOptions)

      if (!session) {
         return new Response("Unauthorized", { status: 401 })
      }

      const categories = await prisma.category.findMany({
         where: {
            userId: session.user.id
         }
      })

      return new Response(JSON.stringify(categories), { status: 200 })
   } catch (error) {
      console.error("Error fetching categories:", error)
      return new Response("Internal Server Error", { status: 500 })
   }
}

// POST: Create a new category
export async function POST(req) {
   try {
      const session = await getServerSession(authOptions)

      if (!session) {
         return new Response("Unauthorized", { status: 401 })
      }

      const { name, type, icon, color } = await req.json()

      if (!name || !type || !icon || !color) {
         return new Response("Missing required fields", { status: 400 })
      }

      const category = await prisma.category.create({
         data: {
            name,
            type,
            icon,
            color,
            userId: session.user.id
         }
      })

      return new Response(JSON.stringify(category), { status: 201 })
   } catch (error) {
      console.error("Error creating category:", error)
      return new Response("Internal Server Error", { status: 500 })
   }
}

// PUT: Update an existing category
export async function PUT(req) {
   try {
      const session = await getServerSession(authOptions)

      if (!session) {
         return new Response("Unauthorized", { status: 401 })
      }

      const { id, name, type, icon, color } = await req.json()

      if (!id || !name || !type || !icon || !color) {
         return new Response("Missing required fields", { status: 400 })
      }

      // First check if the category belongs to the user
      const existingCategory = await prisma.category.findFirst({
         where: {
            id,
            userId: session.user.id
         }
      })

      if (!existingCategory) {
         return new Response("Category not found or unauthorized", { status: 404 })
      }

      const updatedCategory = await prisma.category.update({
         where: {
            id
         },
         data: {
            name,
            type,
            icon,
            color
         }
      })

      return new Response(JSON.stringify(updatedCategory), { status: 200 })
   } catch (error) {
      console.error("Error updating category:", error)
      return new Response("Internal Server Error", { status: 500 })
   }
}

// DELETE: Delete a category
export async function DELETE(req) {
   try {
      const session = await getServerSession(authOptions)

      if (!session) {
         return new Response("Unauthorized", { status: 401 })
      }

      const { searchParams } = new URL(req.url)
      const id = searchParams.get('id')

      if (!id) {
         return new Response("Missing category ID", { status: 400 })
      }

      // First check if the category belongs to the user
      const existingCategory = await prisma.category.findFirst({
         where: {
            id,
            userId: session.user.id
         }
      })

      if (!existingCategory) {
         return new Response("Category not found or unauthorized", { status: 404 })
      }

      await prisma.category.delete({
         where: {
            id
         }
      })

      return new Response(null, { status: 204 })
   } catch (error) {
      console.error("Error deleting category:", error)
      return new Response("Internal Server Error", { status: 500 })
   }
}
