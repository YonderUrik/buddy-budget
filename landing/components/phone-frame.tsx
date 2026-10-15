import "./phone-frame.css";
import type { CSSProperties, ReactNode } from "react";

/** Ora nella barra di stato (quella delle immagini dei telefoni, non un dato). */
const STATUS_TIME = "9:41";

export interface PhoneFrameProps {
  /** Altezza dello schermo (es. `46vh`, `520px`); la larghezza segue le proporzioni 390×844 di un iPhone; all'app restano 390×751. Senza, vale il default del CSS. */
  height?: string;
  className?: string;
  /** Cosa sta sullo schermo sotto la barra di stato: immagini o pannelli posizionati in assoluto (`inset: 0`). */
  children: ReactNode;
}

/**
 * Cornice da telefono attorno a una schermata a misura di telefono: scocca con i tasti, isola e barra di stato in alto,
 * indicatore in basso. È decorativa: il testo alternativo lo porta il contenuto.
 */
export function PhoneFrame({ height, className, children }: PhoneFrameProps) {
  return (
    <div className={`pf${className ? ` ${className}` : ""}`} style={height ? ({ "--pf-h": height } as CSSProperties) : undefined}>
      <i className="pf-key pf-mute" aria-hidden="true" />
      <i className="pf-key pf-up" aria-hidden="true" />
      <i className="pf-key pf-down" aria-hidden="true" />
      <i className="pf-key pf-power" aria-hidden="true" />
      <div className="pf-bezel">
        <div className="pf-screen">
          <div className="pf-status" aria-hidden="true">
            <span className="pf-time">{STATUS_TIME}</span>
            <span className="pf-island" />
            <span className="pf-icons">
              <span className="pf-signal"><i /><i /><i /><i /></span>
              <i className="pf-battery" />
            </span>
          </div>
          <div className="pf-view">{children}</div>
          <i className="pf-home" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
