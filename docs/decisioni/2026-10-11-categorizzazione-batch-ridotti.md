# AI categorization: five merchants per request

- Reduced from 20 to 5 the maximum number of merchants per call to Jev, to reduce the work asked of the model in each response.
- The shared limit applies to proposal generation and to the evaluation script. Timeout, overall budget and error handling are unchanged; retries are postponed.
- Performance: more sequential requests for the same number of merchants; the improvement in timeouts must be verified on the real service, and the time budget may limit the merchants processed.
- No change to the interface or to the features described on the landing; no new observability signal, the AI request metrics remain.
