"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { MOTION_OK } from "./motion-ok";

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

/** Exponential ease-out used by every entrance of the page. */
export const EASE_OUT = "expo.out";

export { gsap, MOTION_OK, ScrollTrigger, SplitText, useGSAP };
