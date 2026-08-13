# Ouroboros

### Autonomous Software Engineering Benchmark

**30 days. Three frontier AI agents. One immutable specification. No human-written production code after the benchmark begins.**

Ouroboros is a controlled experiment in autonomous software engineering.

A multi-agent system receives a fixed software specification and is given 30 days to architect, implement, test, review, refactor, and evolve a complete production-grade software system.

## Agent Team

| Role | Model | Responsibility |
|---|---|---|
| Supervisor | GPT-5.6 Sol | Architecture, planning, technical decisions, review and acceptance |
| Implementer | Claude Opus 5 | Implementation, testing and refactoring |
| Ideator | Claude Sonnet 5 | Feature, product and engineering improvement proposals |

## Product

**CICLO**

A deterministic career simulator for trading fictional cryptocurrencies.

The product is a fully local Electron desktop application with a deterministic market simulation, replayable saves, accounting ledger, derivatives, NPCs, missions, leaderboard and time acceleration.

## Experiment Rules

- The product specification is frozen before autonomous execution begins.
- Autonomous agents cannot modify the specification.
- No human writes production code after the benchmark begins.
- Every accepted change must pass automated validation.
- Every implementation is independently reviewed by the supervisor.
- Only approved changes are committed.
- The complete development history remains public.
- Daily checkpoints are tagged throughout the experiment.

## Autonomous Workflow

    Claude Sonnet 5
          |
          | proposes work
          v
    GPT-5.6 Sol
          |
          | selects and specifies
          v
    Claude Opus 5
          |
          | implements
          v
    Automated Validation
          |
          v
    GPT-5.6 Sol
          |
          +-- REQUEST_CHANGES --> Claude Opus 5
          |
          +-- APPROVE
                  |
                  v
             Commit + Push
                  |
                  v
                Repeat

## Human Intervention

Human involvement is limited to:

- defining the initial specification;
- building the benchmark infrastructure;
- maintaining the host environment;
- emergency intervention if the benchmark infrastructure itself fails.

Product engineering decisions and production code are delegated to the autonomous agent team after the benchmark begins.

## Current Status

**Infrastructure preparation.**

The autonomous 30-day run has not started yet.
