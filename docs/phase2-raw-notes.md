# Flux Phase 2: Design Notes

> Raw capture of Phase 2 thoughts following 100+ autonomous task completions via dog-fooding.

---

## 1. Anvil Tools: From MCP to CLI Convention

**Origin:** Extracted from forge/bellows game engine's "Anvil" MCP - hot-loading tools agents can modify/extend and immediately use within a session without reconnection.

**The Shift:** Drop the MCP framing. Instead, make it a **CLI-first tool based on conventions** with these properties:

- **Cross-project shared tools** - Example: FontAwesome icon discovery via GraphQL API (handles hallucinated icon names, fuzzy keyword matching like "settings" → "gear", "slider")
- **Project-owned tools** - Clear pattern for projects to define their own tools
- **Immediate availability** - Add a tool, it's immediately available for model tool calls
- **High discoverability/composability** - Tools are self-describing and composable
- **Agent accountability** - Agents identify gaps during retros, extend/modify/add new Anvil tools

**Pattern:** Convention-based CLI, not protocol-based MCP.

---

## 2. Auto-Planning: Emergent vs Prescriptive

**The Problem:** BMAD/speckit-style spec-driven systems create HIGHLY prescriptive work upfront. This kills emergent ideas, creative problem-solving, and adaptability when plans fail.

**The Solution:**

1. **User establishes:** Design document + high-level milestones/epics as roadmap (pointer in project config)
2. **Flux continuously:**
   - Monitors ticket state (pending/completed)
   - References the design doc as "northstar"
   - **Incrementally extracts tickets** from the design based on current context
   - Allows implementation details to be flexible, adaptable, emergent

**Workflow:**
- Don't create 1000 tickets upfront
- Create a dozen toward first milestone
- As completed, system learns project, understands challenges
- Builds needed tools via Anvil
- Layers more work continuously
- Code reviews, refactor considerations based on new learning
- Repeat until milestones achieved

**Key insight:** The plan emerges from doing the work, not from upfront specification.

---

## 3. Native Agent: Beyond CLI Wrappers

**Current State:** Claude Code (CC) implemented, Opencode planned.

**The Idea:** Build our own agent from scratch with:
- Custom system prompts
- Specialized tools
- Direct model provider API calls (OpenAI, Anthropic, etc.)
- Skip CLI tools entirely as intermediaries

**Strategy:** Build in parallel, keep all options available (CC, Opencode, Native). This enables:
- Benchmarking native agent performance
- A/B testing with same PRD/roadmap across separate projects
- User choice based on task type

---

## 4. Multi-Project Daemon: Always-On Orchestrator

**Current State:** Single project per Flux instance, orchestrator start/stopped with work.

**Target State:**
- **One daemon process** across all projects
- **Projects as units** - can be running or not
- **Orchestrator always on** - not started/stopped
- **Workers per project** - 1..n workers for issues on running projects
- **Agent CWD** - launched from project path

**Requirements:**
- Fault tolerant (crashes, reboots, laptop sleep)
- Personal tool - runs on user's computer for their projects
- Project paths stored, agents launch with appropriate CWD

---

## Open Questions

1. How do Anvil tools declare their schema/interface for the model to understand?
2. Auto-planning trigger: scheduled (cron-like) or event-driven (on completion)?
3. Native agent architecture: separate process, or built into daemon?
4. Multi-project: SQLite for metadata? How to handle project isolation vs shared resources?

---

## Next Steps

- [ ] Distill into formal design document
- [ ] Prioritize features for Phase 2 MVP
- [ ] Prototype Anvil tool conventions
- [ ] Design native agent architecture
- [ ] Plan daemon/multi-project migration path
