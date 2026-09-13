# @growthos/ingest

CSV header sniffer and heuristic `MappingSpec` proposal. Pure JS — no DuckDB.

DuckDB (`sniff_csv()`) is the later statistical profiler. Adding `@duckdb/node-api`
to the Render install is a verified-plan change of its own, not a rider on this slice.
The existing fixed-schema ingestion path stays the executor until a mapping eval gate
exists.

No `package.json` — same path-alias rule as `@growthos/domain`.
