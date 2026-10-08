// Trusted wrapper. Model code executes only inside a fresh WASM VM with no host bindings.
import { newQuickJSWASMModule } from "quickjs-emscripten";
let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
  if (Buffer.byteLength(input) > 64 * 1024 * 1024) process.exit(1);
}
try {
  const { code, table } = JSON.parse(input);
  const mod = await newQuickJSWASMModule();
  const runtime = mod.newRuntime();
  runtime.setMemoryLimit(256 * 1024 * 1024);
  runtime.setMaxStackSize(512 * 1024);
  const deadline = Date.now() + 3000;
  runtime.setInterruptHandler(() => Date.now() > deadline);
  const vm = runtime.newContext();
  const result = vm.evalCode(`"use strict"; const parse = (${code}); JSON.stringify(parse(${JSON.stringify(table)}));`);
  if (result.error) { result.error.dispose(); throw new Error("sandbox"); }
  const output = vm.getString(result.value);
  result.value.dispose(); vm.dispose(); runtime.dispose();
  if (Buffer.byteLength(output) > 64 * 1024 * 1024) throw new Error("output");
  process.stdout.write(output);
} catch { process.exitCode = 1; }
