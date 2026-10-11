/** Stato puro di un percorso a passi: indice corrente e verso dell'ultimo spostamento (serve all'animazione). */

export type StepDirection = 1 | -1;

export interface StepFlowState {
  index: number;
  direction: StepDirection;
}

export type StepFlowAction = { type: "next" } | { type: "back" } | { type: "goTo"; index: number };

/** Passo di partenza: `index` fuori intervallo viene riportato nei limiti. */
export function initialStepFlow(count: number, index = 0): StepFlowState {
  return { index: clampStep(index, count), direction: 1 };
}

export function clampStep(index: number, count: number): number {
  return Math.min(Math.max(index, 0), Math.max(count - 1, 0));
}

/** Avanti e indietro si fermano agli estremi (non c'è un passo «prima del primo»): le uscite le gestisce il chiamante. */
export function stepFlowReducer(count: number) {
  return (state: StepFlowState, action: StepFlowAction): StepFlowState => {
    switch (action.type) {
      case "next":
        return state.index >= count - 1 ? state : { index: state.index + 1, direction: 1 };
      case "back":
        return state.index <= 0 ? state : { index: state.index - 1, direction: -1 };
      case "goTo": {
        const index = clampStep(action.index, count);
        return index === state.index ? state : { index, direction: index > state.index ? 1 : -1 };
      }
    }
  };
}
