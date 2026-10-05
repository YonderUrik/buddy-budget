"use client";

import { BrokerStatements, OperationsViewSwitch } from "@/components/domain/investments";

/** Rendiconti storici del broker con liquidità riconciliata e valutazioni originali; vivono dentro la scheda Operazioni. */
export default function RendicontiPage() {
  return (
    <>
      <OperationsViewSwitch value="rendiconti" />
      <BrokerStatements />
    </>
  );
}
