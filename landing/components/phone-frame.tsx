import "./phone-frame.css";
import type { CSSProperties, ReactNode } from "react";

/** Time shown in the status bar (the one of phone marketing images, not real data). */
const STATUS_TIME = "9:41";

export interface PhoneFrameProps {
  /** Screen height (e.g. `46vh`, `520px`); the width follows the 390×844 proportions of an iPhone; the app keeps 390×751. Without it, the CSS default applies. */
  height?: string;
  className?: string;
  /** What sits on the screen below the status bar: images or panels, absolutely positioned (`inset: 0`). */
  children: ReactNode;
}

/**
 * Phone frame around a phone-size screen: body with keys, island and status bar at the top, home indicator at the
 * bottom. It is decorative: the alternative text belongs to the content.
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
