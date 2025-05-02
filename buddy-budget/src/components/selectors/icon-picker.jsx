import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

export default function IconPicker({ currentValue, icons, setValue }) {
   return (
      <RadioGroup
         className="flex gap-4 flex-wrap"
         value={currentValue}
         onValueChange={(value) => setValue(value)}
      >
         {icons.map((icon) => (
            <div key={icon.value} className="flex items-center space-x-2">
               <RadioGroupItem
                  value={icon.value}
                  id={`icon-first-${icon.value}`}
                  className="peer sr-only"
               />
               <Label
                  htmlFor={`icon-first-${icon.value}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-muted bg-popover hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-blue-600 peer-data-[state=checked]:text-blue-600 dark:peer-data-[state=checked]:text-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 transition-all"
               >
                  {icon.icon}
               </Label>
            </div>
         ))}
      </RadioGroup>
   )
}