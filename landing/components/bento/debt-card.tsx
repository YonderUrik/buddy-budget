import { DebtStepsChart } from "../screens";

/** Residuo d'esempio di un finanziamento che scende a ogni rata. */
export function DebtCard() {
  return (
    <div className="vis" aria-hidden="true">
      <div className="lab">Residuo del finanziamento</div>
      <div className="mini">18.200 €</div>
      <div style={{ marginTop: 8 }}>
        <DebtStepsChart width={300} height={80} />
      </div>
    </div>
  );
}
