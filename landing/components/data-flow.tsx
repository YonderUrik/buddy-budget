"use client";
import { t as trLanding } from "@/lib/localization";

import { Building2, Check, Lock, Server, ShieldCheck, UserRound, X } from "lucide-react";
import { Fragment, useState, type ComponentType } from "react";
import "./data-flow.css";
import { FLOW, type FlowNodeId } from "@/content/security";
import { track } from "@/lib/analytics";

const NODE_ICONS: Record<FlowNodeId, ComponentType<{ size?: number }>> = {
  tu: UserRound,
  banca: Building2,
  gocardless: ShieldCheck,
  buddybudget: Server,
};

/** Passaggio aperto all'arrivo: la banca, dove si decide la cosa che preoccupa di più (le credenziali). */
const DEFAULT_NODE: FlowNodeId = "banca";

/**
 * Diagramma del percorso dei dati quando si collega una banca: quattro passaggi uniti da collegamenti su cui scorre
 * un punto (fermo con `prefers-reduced-motion`). Toccando un passaggio si legge cosa riceve e cosa non vede mai;
 * ogni scelta invia `security_node_selected` a Umami.
 */
export function DataFlow({ content = FLOW, initial = DEFAULT_NODE }: { content?: typeof FLOW; initial?: FlowNodeId }) {
  const [selected, setSelected] = useState<FlowNodeId>(initial);
  const node = content.nodes.find((n) => n.id === selected) ?? content.nodes[0];

  const select = (id: FlowNodeId) => {
    if (id === selected) return;
    setSelected(id);
    track("security_node_selected", { node: id });
  };

  return (
    <div className="df cell">
      <div className="df-track" role="tablist" aria-label={trLanding("Passaggi dei dati")}>
        {content.nodes.map((n, i) => {
          const Icon = NODE_ICONS[n.id];
          const active = n.id === selected;
          return (
            <Fragment key={n.id}>
              <button type="button" role="tab" id={`df-tab-${n.id}`} aria-selected={active} aria-controls="df-panel" className={`df-node${active ? " on" : ""}`} onClick={() => select(n.id)}>
                <span className="df-ic" aria-hidden="true"><Icon size={20} /></span>
                <span className="df-label">{trLanding(n.label)}</span>
                <span className="df-role">{trLanding(n.role)}</span>
              </button>
              {i < content.links.length ? (
                <span className="df-link" aria-hidden="true">
                  <span className="df-line"><i className="df-dot" style={{ animationDelay: `${i * 0.6}s` }} /></span>
                  <span className="df-link-text">{i === 0 ? <Lock size={12} /> : null}{trLanding(content.links[i])}</span>
                </span>
              ) : null}
            </Fragment>
          );
        })}
      </div>
      <div className="df-panel" id="df-panel" role="tabpanel" aria-labelledby={`df-tab-${node.id}`}>
        <div>
          <h3>{trLanding(node.seesTitle)}</h3>
          <ul className="df-list">
            {node.sees.map((s) => <li key={s}><Check size={16} aria-hidden="true" />{trLanding(s)}</li>)}
          </ul>
        </div>
        <div>
          <h3>{trLanding("Cosa non succede mai")}</h3>
          <ul className="df-list df-never">
            {node.never.map((s) => <li key={s}><X size={16} aria-hidden="true" />{trLanding(s)}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
