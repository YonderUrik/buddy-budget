"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Media query sotto cui le animazioni girano: con `prefers-reduced-motion: reduce` la pagina resta statica e leggibile. */
export const MOTION_OK = "(prefers-reduced-motion: no-preference)";

/** Curva di uscita esponenziale usata da tutti gli ingressi della pagina. */
export const EASE_OUT = "expo.out";

export { gsap, ScrollTrigger, useGSAP };
