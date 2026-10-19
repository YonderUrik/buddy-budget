/**
 * components/domain/welcome — barrel file
 *
 * «Dall'ultima visita»: the toast a returning user sees on opening the app (what happened while away, what waits),
 * which also keeps the visit alive.
 */

export { WelcomeToast } from "./welcome-toast";
export { WELCOME_HREFS, happenedLine, waitingLine, welcomeToastContent } from "./welcome-lines";
export type { WelcomeFormatters, WelcomeLine, WelcomeToastContent } from "./welcome-lines";
