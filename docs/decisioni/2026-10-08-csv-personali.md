# Asynchronous personal CSVs

Unsupported CSVs use private, versioned per-user formats, generated via OpenRouter with a configurable model.
The durable queue is in Postgres and is consumed by a separate worker: an intentional exception to the `after()`/Redis pattern, required to isolate CPU and survive app restarts.
The generated code runs in QuickJS/WASM in a child process without credentials or host APIs, with memory limits and an external timeout.
CSVs and previews are encrypted, every row has a visible outcome and the financial save is atomic only after confirmation.
Details, configuration, limits and checks: [Personal CSVs](../personal-csv-import.md).
