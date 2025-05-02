import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Input } from "../ui/input";
import { Palette } from "lucide-react";
import { useTranslation } from "react-i18next";

const colors = [
   { value: "#2563eb", label: "Blue" },
   { value: "#0ea5e9", label: "Sky" },
   { value: "#8b5cf6", label: "Violet" },
   { value: "#f59e0b", label: "Amber" },
   { value: "#ef4444", label: "Red" },
   { value: "#ec4899", label: "Pink" },
   { value: "#6366f1", label: "Indigo" },
   { value: "#10b981", label: "Emerald" },
]

export default function ColorPicker({ currentValue, setValue }) {
   const { t } = useTranslation()
   return (
      <RadioGroup
         className="flex gap-4 flex-wrap"
         value={currentValue}
         onValueChange={(value) => setValue(value)}
      >
         {colors.map((color) => (
            <div key={color.value} className="flex items-center space-x-2">
               <RadioGroupItem value={color.value} id={`color-${color.value}`} className="peer sr-only" />
               <Label
                  htmlFor={`color-${color.value}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-muted hover:border-gray-400 dark:hover:border-gray-500 peer-data-[state=checked]:border-gray-900 dark:peer-data-[state=checked]:border-white transition-all"
                  style={{ backgroundColor: color.value }}
               />
            </div>
         ))}
         {/* Custom color picker */}
         <Popover>
            <PopoverTrigger asChild>
               <button
                  type="button"
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${!colors.some((c) => c.value === currentValue)
                     ? "border-gray-900 dark:border-white"
                     : "border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                     }`}
                  style={{
                     background: !colors.some((c) => c.value === currentValue)
                        ? currentValue
                        : "linear-gradient(135deg, #2563eb, #8b5cf6, #ef4444, #f59e0b)",
                  }}
               >
                  <Palette className="h-4 w-4 text-white drop-shadow-sm" />
               </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 dark:bg-gray-800 dark:border-gray-700">
               <div className="space-y-3">
                  <h4 className="font-medium text-sm dark:text-gray-200">{t("common.customColor")}</h4>
                  <div className="flex gap-2">
                     <div className="h-8 w-8 rounded-full border dark:border-gray-600" style={{ backgroundColor: currentValue }} />
                     <Input
                        type="text"
                        value={currentValue}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="#RRGGBB"
                        className="flex-1 focus-visible:ring-blue-500/50"
                     />
                  </div>
                  <input
                     type="color"
                     value={currentValue}
                     onChange={(e) => setValue(e.target.value)}
                     className="w-full h-10 p-1 rounded border dark:border-gray-600 dark:bg-gray-700"
                  />
               </div>
            </PopoverContent>
         </Popover>
      </RadioGroup>
   )
}