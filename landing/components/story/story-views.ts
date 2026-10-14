import type { ScreenId } from "@/content/screens";
import { HERO, STEPS, type LivePanelId, type StoryStepId } from "@/content/story";

/** Cosa è in vista nella storia: l'apertura o uno dei passi. */
export type ActiveId = "hero" | StoryStepId;

/** Cosa mostra la finestra per un punto della storia: pannello vivo (se c'è), schermata vera, riquadro della camera, indirizzo, didascalia. */
export interface StageView {
  live?: LivePanelId;
  shot: ScreenId;
  focus?: readonly [number, number, number, number];
  url: string;
  caption: string;
}

export const VIEWS: Record<ActiveId, StageView> = {
  hero: { shot: HERO.shot, url: HERO.url, caption: HERO.caption },
  ...(Object.fromEntries(STEPS.map((s) => [s.id, { live: s.live, shot: s.shot, focus: s.focus, url: s.url, caption: s.stageCaption }])) as Record<StoryStepId, StageView>),
};

export interface StageShot {
  id: ScreenId;
  /** La schermata sta dietro un pannello vivo: si vede solo con «Vedi la schermata vera». */
  real: boolean;
}

/** Le schermate caricate nella finestra, una volta sola ciascuna (la Panoramica serve all'apertura e all'ultimo passo). */
export const STAGE_SHOTS: readonly StageShot[] = Object.values(VIEWS).reduce<StageShot[]>((acc, v) => {
  if (!acc.some((s) => s.id === v.shot)) acc.push({ id: v.shot, real: Boolean(v.live) });
  return acc;
}, []);

/** La schermata è quella da mostrare per questa vista: sempre, se non c'è un pannello vivo; altrimenti solo su richiesta. */
export function shotShown(view: StageView, id: ScreenId, real: boolean): boolean {
  return view.shot === id && (!view.live || real);
}
