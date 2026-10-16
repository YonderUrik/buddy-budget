import { describe, expect, it } from "vitest";
import { validateSourceAmounts } from "./validate-source-amounts";
import type { Outcome, PersonalParser } from "./contract";
const parser: PersonalParser = {kind:"javascript",code:"function(){}",metadata:{version:1,institution:{name:null,evidence:"unknown"},delimiter:",",columns:[{section:null,index:1,name:"Amount",mapsTo:["amount"]}]}};
const outcome = (amount: number): Outcome[] => [{row:2,kind:"cash",date:"2026-10-01",currency:"EUR",description:"Synthetic",amount,transfer:false}];
const table = (value: string) => ({headers:[],rows:[],delimiter:"",rawCsv:`Institution: Test\nDate,Amount\n2026-10-01,${value}`});
describe("source amount validation",()=>{
  it("blocks the 100x scaling error observed with the live AI",()=>{ expect(()=>validateSourceAmounts(parser,table('-12.50'),outcome(-1250))).toThrow('Importo diverso'); });
  it("accepts decimal dots and quoted decimal commas",()=>{ expect(()=>validateSourceAmounts(parser,table('-12.50'),outcome(-12.5))).not.toThrow();expect(()=>validateSourceAmounts(parser,table('"-12,50"'),outcome(-12.5))).not.toThrow(); });
  it("does not guess ambiguous thousands or composite mappings",()=>{expect(()=>validateSourceAmounts(parser,table('1.234'),outcome(1234))).not.toThrow();const composite=structuredClone(parser);if(composite.kind==='javascript')composite.metadata!.columns.push({section:null,index:2,name:'Fees',mapsTo:['amount']});expect(()=>validateSourceAmounts(composite,table('-12.50'),outcome(-13.5))).not.toThrow();});
});
