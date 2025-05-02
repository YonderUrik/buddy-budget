"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { formatCurrency, formatDate } from "@/lib/config"
import { useTranslation } from "react-i18next"
import { TrendingUp } from "lucide-react"

export function PreviewCard({ currency, dateFormat }) {
   const { t, i18n } = useTranslation()
   const canvasRef = useRef(null)
   const [currentDate, setCurrentDate] = useState("")
   const [isHovered, setIsHovered] = useState(false)
   const [formattedBalance, setFormattedBalance] = useState("")
   const [formattedChange, setFormattedChange] = useState("")

   useEffect(() => {
      // Format currency values
      setFormattedBalance(formatCurrency(2325.25, currency, i18n.language))
      setFormattedChange(formatCurrency(78.9, currency, i18n.language))
   }, [currency, i18n.language])

   useEffect(() => {
      // Format the current date based on the selected format
      const date = new Date()
      let formattedDate = ""

      formattedDate = formatDate(date, dateFormat, i18n.language)

      setCurrentDate(formattedDate)
   }, [dateFormat, i18n.language])

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

      // Draw chart background grid
      const isDarkMode = document.documentElement.classList.contains('dark')
      const gridColor = isDarkMode ? "rgba(75, 85, 99, 0.3)" : "rgba(229, 231, 235, 0.5)" // Adjust for dark mode
      const numVerticalLines = 6
      const numHorizontalLines = 4
      
      // Draw vertical grid lines
      for (let i = 0; i <= numVerticalLines; i++) {
         const x = (canvas.offsetWidth / numVerticalLines) * i
         ctx.beginPath()
         ctx.strokeStyle = gridColor
         ctx.lineWidth = 1
         ctx.moveTo(x, 0)
         ctx.lineTo(x, canvas.offsetHeight)
         ctx.stroke()
      }

      // Draw horizontal grid lines
      for (let i = 0; i <= numHorizontalLines; i++) {
         const y = (canvas.offsetHeight / numHorizontalLines) * i
         ctx.beginPath()
         ctx.strokeStyle = gridColor
         ctx.lineWidth = 1
         ctx.moveTo(0, y)
         ctx.lineTo(canvas.offsetWidth, y)
         ctx.stroke()
      }

      // Generate smooth curve points
      const points = []
      const numPoints = 50
      for (let i = 0; i < numPoints; i++) {
         const x = (canvas.offsetWidth / (numPoints - 1)) * i
         const progress = i / (numPoints - 1)
         
         // Create a more natural curve with some random variations
         const baseY = canvas.offsetHeight * (0.7 - 0.4 * progress)
         const variation = Math.sin(progress * Math.PI * 3) * 10
         const y = baseY + variation
         
         points.push({ x, y })
      }

      // Draw the curve
      ctx.beginPath()
      ctx.strokeStyle = "#2563eb" // Blu invece di Emerald
      ctx.lineWidth = 2
      ctx.moveTo(points[0].x, points[0].y)

      // Use bezier curves for smooth line
      for (let i = 0; i < points.length - 1; i++) {
         const xc = (points[i].x + points[i + 1].x) / 2
         const yc = (points[i].y + points[i + 1].y) / 2
         ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc)
      }
      
      // Last curve point
      ctx.quadraticCurveTo(
         points[points.length - 1].x,
         points[points.length - 1].y,
         points[points.length - 1].x,
         points[points.length - 1].y
      )
      ctx.stroke()

      // Fill area under the curve
      ctx.lineTo(canvas.offsetWidth, canvas.offsetHeight)
      ctx.lineTo(0, canvas.offsetHeight)
      ctx.closePath()
      ctx.fillStyle = "rgba(37, 99, 235, 0.1)" // Blu con opacity invece di Emerald
      ctx.fill()
   }, [])

   return (
      <motion.div
         className="border border-blue-100 dark:border-blue-900/30 rounded-lg p-5 bg-white dark:bg-gray-800/50 backdrop-blur-sm"
         initial={{ boxShadow: "0 1px 3px rgba(37, 99, 235, 0.1)" }}
         animate={{
            boxShadow: isHovered
               ? "0 10px 25px -5px rgba(37, 99, 235, 0.2), 0 8px 10px -6px rgba(37, 99, 235, 0.1)"
               : "0 1px 3px rgba(37, 99, 235, 0.1)",
         }}
         transition={{ duration: 0.2 }}
         onMouseEnter={() => setIsHovered(true)}
         onMouseLeave={() => setIsHovered(false)}
      >
         <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t("common.exampleAccount")}</div>
         <motion.div
            className="text-3xl font-semibold mb-1 dark:text-white"
            key={currency}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
         >
            {formattedBalance}
         </motion.div>
         <motion.div
            className="flex items-center text-sm text-blue-600 dark:text-blue-400 mb-4"
            key={`${currency}-${dateFormat}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
         >
            <TrendingUp className="h-3 w-3 mr-1" />
            <span>+{formattedChange}</span>
            <span className="ml-1">(+3.5%)</span>
            <span className="ml-2 text-gray-500 dark:text-gray-400">{t("common.asOf")} {currentDate}</span>
         </motion.div>
         <div className="h-16">
            <canvas ref={canvasRef} className="w-full h-full" />
         </div>
      </motion.div>
   )
}
