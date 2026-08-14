# SPEC_BLOCKERS Registry

This registry implements the §19 protocol of CICLO_SPEC.md.

Blockers are contradictions or unresolved gaps in the specification. They are recorded here so that the affected work front is blocked while the rest of the project keeps moving. Nothing in this file resolves the specification. Resolutions arrive from the product owner or from an approved ADR.

## Entry template

Every entry uses the following fields:

- **identifier** — stable label, e.g. `BLOCKER-0001`
- **status** — `OPEN`, `PROVISIONAL`, or `RESOLVED`
- **sections in conflict** — the CICLO_SPEC.md sections whose text contradicts each other, or the DEFINIR item that is unresolved
- **impact** — the concrete engineering consequence of the ambiguity
- **affected work fronts** — the FASE items or tasks that cannot proceed while this blocker is open
- **origin** — the cycle in which the blocker was discovered
- **provisional decision** (only when `status: PROVISIONAL`) — the option chosen, the options rejected, why the choice was made, what changes if the decision is reverted, and a link to the isolated test that documents the choice
- **resolution** (only when `status: RESOLVED`) — the ADR that closed the entry

Provisional decisions obey the constraints in §19: they are forbidden on **TRAVADO** items, they cannot invent numbers with economic effect, they must be covered by an isolated removable test, they remain reversible, and they are capped at five open at a time.

## Open

_None recorded._

## Provisional decisions

_None recorded._

## Resolved

_None recorded._
