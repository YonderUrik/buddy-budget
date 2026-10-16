# AI filter: keep recognizing companies

- The filter recognizes the trailing company legal form in the text before extraction removes it: «DB Vertrieb GmbH» no longer becomes a false person name.
- Only the cleaned name keeps reaching the AI. Blocking of bank transfers and other operations keeps precedence, and names of people without indications of a business remain blocked.
- Added regression tests for companies, person names and bank transfers to companies. No visual change, no landing impact; no new observability signal or additional external request per item.
- Retries and a visible distinction between errors and missing proposals remain postponed; this fix concerns the filter's false positive.
