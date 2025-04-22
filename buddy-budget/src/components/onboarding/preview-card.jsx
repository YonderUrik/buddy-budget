"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"


export function PreviewCard({ currency, dateFormat }) {
   const canvasRef = useRef(null)
   const [currentDate, setCurrentDate] = useState("")
   const [isHovered, setIsHovered] = useState(false)

   useEffect(() => {
      // Format the current date based on the selected format
      const date = new Date()
      let formattedDate = ""

      switch (dateFormat) {
         case "MM-DD-YYYY":
            formattedDate = `${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}-${date.getFullYear()}`
            break
         case "DD-MM-YYYY":
            formattedDate = `${date.getDate().toString().padStart(2, "0")}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getFullYear()}`
            break
         case "YYYY-MM-DD":
            formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`
            break
         default:
            formattedDate = `${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}-${date.getFullYear()}`
      }

      setCurrentDate(formattedDate)
   }, [dateFormat])

   useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Set canvas dimensions
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
      ctx.scale(dpr, dpr)

      // Draw chart
      ctx.strokeStyle = "#10b981" // Emerald color
      ctx.lineWidth = 2
      ctx.beginPath()

      // Starting point (left side, middle height)
      const startX = 0
      const startY = canvas.offsetHeight / 2

      // Create a simple upward trend with some fluctuations
      const points = [
         { x: startX, y: startY },
         { x: canvas.offsetWidth * 0.2, y: startY * 1.1 },
         { x: canvas.offsetWidth * 0.4, y: startY * 0.9 },
         { x: canvas.offsetWidth * 0.6, y: startY * 0.8 },
         { x: canvas.offsetWidth * 0.8, y: startY * 0.7 },
         { x: canvas.offsetWidth, y: startY * 0.5 },
      ]

      // Draw the line
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
         ctx.lineTo(points[i].x, points[i].y)
      }
      ctx.stroke()

      // Fill area under the line
      ctx.lineTo(canvas.offsetWidth, canvas.offsetHeight)
      ctx.lineTo(0, canvas.offsetHeight)
      ctx.closePath()
      ctx.fillStyle = "rgba(16, 185, 129, 0.1)" // Emerald with opacity
      ctx.fill()
   }, [])

   // Format currency
   const formatCurrency = (amount) => {
      try {
         return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency,
         }).format(amount)
      } catch (error) {
         return null
      }
   }

   return (
      <motion.div
         className="border rounded-lg p-5 bg-white"
         initial={{ boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
         animate={{
            boxShadow: isHovered
               ? "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)"
               : "0 1px 3px rgba(0,0,0,0.1)",
         }}
         transition={{ duration: 0.2 }}
         onMouseEnter={() => setIsHovered(true)}
         onMouseLeave={() => setIsHovered(false)}
      >
         <div className="text-sm text-gray-500 mb-1">Example account</div>
         <motion.div
            className="text-3xl font-semibold mb-1"
            key={currency}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
         >
            {formatCurrency(2325.25)}
         </motion.div>
         <motion.div
            className="flex items-center text-sm text-emerald-500 mb-4"
            key={`${currency}-${dateFormat}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
         >
            <span>+{formatCurrency(78.9)}</span>
            <span className="ml-1">(+3.5%)</span>
            <span className="ml-1 text-gray-500">as of {currentDate}</span>
         </motion.div>
         <div className="h-16">
            <canvas ref={canvasRef} className="w-full h-full" />
         </div>
      </motion.div>
   )
}

