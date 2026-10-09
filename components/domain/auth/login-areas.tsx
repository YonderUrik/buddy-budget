/** Fila delle aree dell'app sotto il grafico del login: icona su fondo tinto, nome e frase corta. */

import { cn } from "@/lib/utils";
import { LOGIN_AREAS, type LoginArea } from "./login-areas.data";

export interface LoginAreasProps {
  areas?: readonly LoginArea[];
  className?: string;
}

export function LoginAreas({ areas = LOGIN_AREAS, className }: LoginAreasProps) {
  return (
    <ul className={cn("grid grid-cols-6 gap-4", className)}>
      {areas.map(({ name, description, icon: Icon, color }) => (
        <li key={name} className="flex items-center gap-2.5">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-full"
            style={{ color, backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)` }}
            aria-hidden="true"
          >
            <Icon className="size-[18px]" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block font-heading text-[15px] font-medium text-foreground">{name}</span>
            <span className="block text-xs text-text-3">{description}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
