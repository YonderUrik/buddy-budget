import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readRawFile, type Outcome } from "./contract";
import { validateBitpandaSettlements } from "./validate-bitpanda";
const csv = readFileSync(new URL("./fixtures/bitpanda-inclusive-fees.csv", import.meta.url), "utf8");
const outcomes = (price = 39602): Outcome[] => [
  {row:0,kind:"ignore",reason:"Venue"},{row:1,kind:"ignore",reason:"Header"},
  {row:2,kind:"cash",date:"2026-01-01",currency:"EUR",amount:200,description:"Deposit",transfer:true},
  {row:3,kind:"investment",date:"2026-01-02",currency:"EUR",type:"acquisto",name:"BTC",isin:null,instrumentType:"crypto",quantity:0.005,price,grossAmount:null,fees:1.99,taxes:0,description:"Buy"},
  {row:4,kind:"cash",date:"2026-01-03",currency:"EUR",amount:100,description:"Deposit",transfer:true},
];
describe("Bitpanda inclusive settlement reconciliation",()=>{
  it("rejects fees added on top of the inclusive market price",()=>{expect(()=>validateBitpandaSettlements(readRawFile(csv),outcomes(40000))).toThrow('non riconcilia');});
  it("accepts the net execution price with fees retained exactly once",()=>{expect(()=>validateBitpandaSettlements(readRawFile(csv),outcomes())).not.toThrow();});
  it("requires actual quantities, fees and all transaction rows",()=>{for(const patch of [{quantity:0.006},{fees:0},{kind:'ignore',reason:'not supported'}]){const rows=outcomes();Object.assign(rows[3],patch);expect(()=>validateBitpandaSettlements(readRawFile(csv),rows)).toThrow();}});
  it("allows unsupported rows to remain under review instead of silently importing them",()=>{const rows=outcomes();rows[3]={row:3,kind:'error',reason:'Unsupported'};expect(()=>validateBitpandaSettlements(readRawFile(csv),rows)).not.toThrow();});
  it("checks sell net proceeds as gross minus fees",()=>{const rows=outcomes();Object.assign(rows[3],{type:'vendita',price:40398});const sale=csv.replace('buy,outgoing','sell,incoming');expect(()=>validateBitpandaSettlements(readRawFile(sale),rows)).not.toThrow();});
  it("rejects unhandled taxes and fees paid in another currency",()=>{expect(()=>validateBitpandaSettlements(readRawFile(csv.replace('1.99000000,EUR','1.99000000,BTC')),outcomes())).toThrow();expect(()=>validateBitpandaSettlements(readRawFile(csv.replace('0.99,-,-,0.00','0.99,-,-,2.00')),outcomes())).toThrow();});
  it("rejects invented financial movements in the preamble",()=>{const rows=outcomes();rows[0]={...rows[2],row:0};expect(()=>validateBitpandaSettlements(readRawFile(csv),rows)).toThrow();});
  it("does not apply Bitpanda semantics to another provider",()=>{expect(()=>validateBitpandaSettlements(readRawFile(csv.replace('Venue: Bitpanda','Venue: Other')),outcomes(40000))).not.toThrow();});
});
