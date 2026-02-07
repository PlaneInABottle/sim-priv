# AI-Native Workflow Guide

> **Purpose:** Template for establishing AI-managed development workflows in any project.
> **Last Updated:** 2025-07-15
> **Status:** Phases 1–4 complete · Phase 5 active

| Phase | Status | Description |
|-------|--------|-------------|
| 1. Runtime Setup Analysis | ✅ Complete | Determine optimal dev environment |
| 2. Skill Creation | ✅ Complete | Codify operational knowledge |
| 3. Implementation & Verification | ✅ Complete | Validate end-to-end |
| 4. Programmatic Operations | ✅ Complete | AI creates/modifies/executes features |
| 5. Continuous Iteration | 🔄 Active | Debugging, testing, optimization, skill refinement |

---

## 1. Introduction

### What Is an AI-Native Workflow?

An AI-native workflow is a development setup where AI agents manage the full lifecycle of a project: starting services, writing code, running tests, deploying changes, and monitoring health. The developer defines intent; the AI handles execution.

This differs from AI-*assisted* development (copilot suggestions, chat-based Q&A) in a fundamental way: the AI operates autonomously within a structured environment it understands. It doesn't suggest commands—it runs them. It doesn't describe fixes—it applies them.

### Why Establish One?

- **Speed.** AI agents execute multi-step operations in seconds that take humans minutes.
- **Consistency.** Codified skills eliminate "works on my machine" and forgotten steps.
- **Scale.** Parallel agents analyze, implement, and verify simultaneously.
- **Knowledge retention.** Skills capture operational knowledge that would otherwise live in a single engineer's head.
- **Continuous validation.** Unit tests run alongside changes, catching regressions before they compound.
- **Compounding expertise.** Every skill you create makes the next AI session more capable.

### When to Use This Guide

Use this guide when:

- Starting a new project and want AI-managed development from day one
- Adopting AI tooling on an existing project
- Onboarding AI agents to an unfamiliar codebase
- Standardizing how your team works with AI development tools

---

## 2. Phase 1: Runtime Setup Analysis

**Goal:** Determine the optimal development environment for AI automation.

**Deliverable:** Architecture decision document with rationale.

### Steps

#### 2.1 Analyze Project Characteristics

Profile the project before choosing a runtime strategy. Key dimensions:

| Dimension | What to Measure | Why It Matters |
|-----------|----------------|----------------|
| File count | `find . -type f \| wc -l` | Affects Docker volume performance |
| Dependency size | `du -sh node_modules/` | Large deps slow container builds |
| Native binaries | Check for `.node`, `.so`, compiled deps | May not work across architectures |
| Hot-reload mechanism | Webpack, Vite, Turbopack, etc. | File watching differs in containers |
| Stateful services | Databases, caches, queues | Containers excel here |
| Build time | Time a full build | Baseline for optimization |

#### 2.2 Compare Runtime Options

Evaluate three approaches for every project:

**Option A: Full Docker**
```
All services in containers, code mounted via volumes
```
- ✅ Reproducible, isolated, matches production
- ❌ File watching unreliable on macOS (polling fallback)
- ❌ Native binaries may need rebuilding
- ❌ HMR latency from volume I/O

**Option B: Fully Native**
```
Everything runs directly on host
```
- ✅ Fastest HMR, native file watching
- ❌ Database/service setup varies per machine
- ❌ Version conflicts with system packages

**Option C: Hybrid**
```
Stateful services in Docker, application code runs natively
```
- ✅ Fast HMR + reliable stateful services
- ✅ File watching works natively
- ✅ Database isolation without app performance cost
- ❌ Slightly more complex setup

#### 2.3 Consider AI-Specific Requirements

AI agents need capabilities that typical dev setups may not prioritize:

- **Log access.** Agents parse logs to detect errors. Ensure logs are accessible via shell or API.
- **Health check endpoints.** Agents verify service status programmatically—HTTP health checks beat log parsing.
- **Process management.** Agents must start, stop, and restart services. Detached shells or systemd-style management is essential.
- **Deterministic startup.** The startup sequence must be scriptable with clear success/failure signals.

#### 2.4 Make and Document the Decision

Record the decision with rationale. Include:

- Which option was chosen and why
- What tradeoffs were accepted
- What project characteristics drove the decision

### Example: Sim Studio

**Project profile:**
- 4,000+ source files
- 4 GB `node_modules/` with native binaries (better-sqlite3, sharp)
- Turbopack for HMR
- PostgreSQL for data, Socket.io for realtime

**Decision: Hybrid (Option C)**
- PostgreSQL in Docker (`docker-compose.local.yml`)
- Application via `bun run dev:full` (Next.js + Socket.io) natively
- **Rationale:** Docker volumes caused 3–5× slower HMR due to file count. Native binaries required Linux rebuilds in containers. PostgreSQL has no such constraints in Docker.

**Analysis method:** Spawned parallel Opus agents to evaluate each option against Sim's characteristics. Agents returned structured comparisons; the coordinator made the final call.

> **🎯 Skill Creation Checkpoint**
>
> After Phase 1, create a skill if you discovered non-obvious runtime characteristics. Examples: "Our app requires polling-based file watching in Docker," "Native binaries require Linux rebuild." Capture these findings now—they'll save hours in future sessions.

---

## 3. Phase 2: Skill Creation

**Goal:** Codify operational knowledge so any AI agent can manage the project.

**Deliverable:** Reusable skill package committed to version control.

### What Is a Skill?

A skill is a structured document that gives an AI agent domain-specific knowledge: how to start services, what health checks to run, how to troubleshoot common failures. Without skills, every agent session starts from zero.

### Steps

#### 3.1 Initialize the Skill

Use `skill-creator` (or equivalent) to scaffold the skill structure:

```
skill-name/
├── skill.md          # Primary knowledge document
├── scripts/          # Automation scripts (optional)
└── README.md         # Human-readable overview
```

The skill document should be dense, actionable, and organized for quick lookup—not prose.

#### 3.2 Document Core Operations

Every runtime skill must cover these areas:

| Section | Contents |
|---------|----------|
| **Prerequisites** | Required tools, versions, environment variables |
| **Startup Sequence** | Ordered steps with commands and expected output |
| **Health Checks** | Endpoints/commands to verify each service |
| **Monitoring** | How to read logs, check resource usage |
| **Troubleshooting** | Common failures and their resolutions |
| **Shutdown** | Graceful stop sequence |

#### 3.3 Write for Machines, Not Humans

Skills are consumed by AI agents. Optimize for parseability:

```markdown
## Start PostgreSQL
Command: `docker compose -f docker-compose.local.yml up -d`
Verify: `docker compose -f docker-compose.local.yml ps` → status "Up"
Health: `curl -s http://localhost:5432` or check container logs
Failure: If port 5432 occupied, run `lsof -i :5432` and kill the process
```

Avoid narrative explanations. Use structured formats: command → expected output → failure mode → resolution.

#### 3.4 Include Automation Scripts

For complex operations, include shell scripts that agents can execute directly:

```bash
#!/bin/bash
# health-check.sh - Verify all services are operational
check_postgres() { docker compose -f docker-compose.local.yml ps --format json | grep -q '"running"'; }
check_app() { curl -sf http://localhost:3000/api/health > /dev/null; }
check_socket() { curl -sf http://localhost:3001/health > /dev/null; }

check_postgres && echo "✓ Postgres" || echo "✗ Postgres"
check_app && echo "✓ App" || echo "✗ App"
check_socket && echo "✓ Socket" || echo "✗ Socket"
```

#### 3.5 Commit to Version Control

Skills are project artifacts. Commit them alongside code:

```bash
git add .skills/sim-runtime/
git commit -m "feat: add sim-runtime skill for AI-managed development"
```

This ensures every developer (human or AI) has access to the same operational knowledge.

### Example: sim-runtime Skill

The `sim-runtime` skill for Sim Studio covers:

- **Startup:** Docker Compose for Postgres → `bun run dev:full` for app + sockets
- **Health checks:** Three endpoints (`localhost:3000/api/health`, `localhost:3001/health`, Docker container status)
- **Monitoring:** Log file locations, common error patterns
- **Troubleshooting:** Port conflicts, migration failures, stale containers
- **Process management:** Detached shell usage, PID tracking

**Key learning:** Detached shells (`mode="async", detach=true`) are essential for servers. Attached shells terminate when the AI session ends, killing the dev environment.

> **🎯 Skill Creation Checkpoint**
>
> Your runtime skill is the foundation. As you troubleshoot during Phase 3, update this skill with every failure mode you encounter. A skill that only covers the happy path is incomplete.

---

## 4. Phase 3: Implementation & Verification

**Goal:** Validate that the runtime setup works end-to-end under AI management.

**Deliverable:** A working development environment fully managed by AI agents.

### Steps

#### 4.1 Spawn an Agent to Start the Environment

Don't start services manually. Have an AI agent follow the skill to start everything:

```
Agent prompt: "Use the sim-runtime skill to start the full development 
environment. Verify all services are healthy before reporting success."
```

This tests both the skill's accuracy and the agent's ability to execute it.

#### 4.2 Verify All Services

After startup, confirm every service is operational:

| Check | Method | Expected |
|-------|--------|----------|
| Database | Container status or connection test | Running, accepting connections |
| Application | HTTP health endpoint | 200 OK |
| Auxiliary services | Protocol-specific check | Healthy response |

Automated health checks are non-negotiable. If an agent can't verify a service is running, it can't reliably operate on it.

#### 4.3 Test Detached Mode

Services must survive session boundaries. Verify:

1. Start services in detached mode
2. Confirm services are running
3. Simulate session end (or start a new agent)
4. Verify services are still running from the new context

If services die when the session ends, the setup is not production-ready for AI workflows.

#### 4.4 Confirm AI Can Manage the Full Lifecycle

Test the complete cycle:

```
Start → Verify → Use → Restart → Verify → Stop → Verify stopped
```

The AI agent must be able to recover from failures without human intervention. Test edge cases:

- Port already in use
- Database migration needed
- Stale containers from previous session
- Missing environment variables

### Example: Sim Studio Verification

**Process:**
1. Spawned agent with `sim-runtime` skill loaded
2. Agent started PostgreSQL via Docker Compose
3. Agent ran `bun run dev:full` in detached mode (shellId 3)
4. Agent verified all three health endpoints returned healthy
5. Confirmed services persisted across agent restarts

**Issue encountered:** Initial startup used attached shells—services died when the agent session ended. Fixed by switching to detached mode with `detach: true`.

**Result:** All services operational, managed entirely by AI, persistent across sessions.

> **🎯 Skill Creation Checkpoint**
>
> After Phase 3, you've learned things the skill didn't cover. Go back and update it: add failure modes you hit, edge cases you tested, timing nuances (e.g., "database needs 5 seconds before accepting connections"). This iterative refinement is how skills mature.

---

## 5. Phase 4: Programmatic Operations

> **Status:** ✅ Complete

**Goal:** Enable AI agents to create, modify, execute, and test application features programmatically.

**Deliverable:** AI can build and test features autonomously through available APIs and tools.

**Completion Notes:**
- Programmatic CRUD operations working through available APIs/tools
- Real-time UI sync verified (changes made programmatically reflect immediately)
- All available tools inventoried, tested, and documented
- AI agents can build complete features end-to-end without human intervention

### Steps

#### 5.1 Identify Available APIs and Tools

Inventory every programmatic interface the project exposes:

- **MCP tools** (Model Context Protocol servers)
- **REST/GraphQL APIs**
- **CLI commands**
- **Database access**
- **File system operations**

For Sim Studio, the `sim-mcp` server provides workflow CRUD, block management, edge operations, variable management, and custom tool creation—all callable by AI agents.

#### 5.2 Test CRUD Operations

Verify the AI can perform basic operations through each interface:

| Operation | Test |
|-----------|------|
| Create | Build a new entity from scratch |
| Read | Retrieve and inspect existing entities |
| Update | Modify an entity and verify changes |
| Delete | Remove an entity and confirm removal |

#### 5.3 Verify Execution Capabilities

Beyond CRUD, test that the AI can trigger and observe execution:

- Run workflows/pipelines/tests
- Read execution logs and results
- Detect and diagnose failures
- Apply fixes and re-run

#### 5.4 Test Monitoring and Logging

Confirm the AI can observe system behavior:

- Access application logs
- Query metrics endpoints
- Detect anomalies or errors
- Correlate events across services

### Example: Sim Studio

Available tools: `sim-mcp` server with 20+ operations for workflow management, block configuration, edge management, variable operations, and custom tool creation.

**Results:** Workflow creation, modification, and execution fully operational through MCP tools. AI agents build complete workflows programmatically with real-time UI reflection. All tools verified and documented in dedicated skills.

> **🎯 Skill Creation Checkpoint**
>
> After Phase 4, create a skill for your programmatic operations. Document the tool inventory, common operation patterns, error handling, and any workarounds you discovered. This skill becomes the API reference for future AI sessions.

---

## 6. Phase 5: Continuous Iteration

> **Status:** 🔄 Active

**Goal:** Establish sustainable development cycles where AI agents improve the project, create skills from discovered patterns, and validate changes through testing.

**Deliverable:** A self-improving development workflow with growing skill coverage and reliable test validation.

### 6.1 Test-Driven Development Cycle

Testing is the backbone of AI-driven development. Without tests, AI agents have no way to verify their changes work or that they haven't broken existing functionality.

#### Run Unit Tests Alongside Changes

Every code change should be accompanied by running relevant unit tests:

```
1. Make a change to a module
2. Run unit tests for that module immediately
3. If tests fail → fix the code or update the tests
4. If tests pass → proceed to the next change
```

This tight loop prevents regressions from compounding. An AI agent that makes five changes before testing will spend more time debugging than one that tests after each change.

#### Fix Tests That Break Due to Changes

When your change intentionally alters behavior, existing tests may fail. This is expected. The correct response:

| Scenario | Action |
|----------|--------|
| Test fails because behavior changed intentionally | Update the test to reflect new behavior |
| Test fails due to a bug in the change | Fix the code, not the test |
| Test is flaky or unrelated to the change | Note it, but don't ignore it—file it for investigation |

#### Add Tests for New Functionality

When adding new features or capabilities:

- Write tests that cover the expected behavior
- Include edge cases (empty input, invalid data, boundary conditions)
- Test error handling paths, not just happy paths
- Ensure tests are deterministic—no timing dependencies or external service calls in unit tests

#### Tests Validate AI-Driven Changes

AI agents make changes rapidly. Tests are the primary safety net:

```
Agent makes change → runs tests → tests pass → change is safe
Agent makes change → runs tests → tests fail → agent investigates and fixes
```

Without this loop, AI-driven development is just AI-driven guessing.

### 6.2 Debugging Workflows

When something breaks, AI agents should follow a structured debugging approach:

#### Read Error Output First

```
1. Check the error message and stack trace
2. Identify the failing component
3. Inspect the relevant code or configuration
4. Form a hypothesis
5. Test the hypothesis with a targeted fix
6. Verify the fix resolves the issue without introducing new failures
```

#### Use Verbose Logging and Inspection Tools

- Enable debug-level logging when investigating issues
- Use inspection tools to examine state (API responses, database contents, variable values)
- Compare expected vs. actual behavior at each step in the pipeline
- Check logs from all relevant services, not just the one that reported the error

#### Diagnose Root Causes, Not Symptoms

Fixing the immediate error often masks a deeper problem. AI agents should:

- Trace the error back to its origin, not just the point of failure
- Check if similar patterns exist elsewhere in the codebase
- Verify the fix addresses the root cause, not just the symptom

### 6.3 Performance Optimization

Once features work correctly, optimize them:

#### Establish Baselines

Before optimizing, measure current performance:

- Execution time for key operations
- Resource usage (memory, CPU, network)
- Response times for user-facing endpoints

#### Optimize With Evidence

- Profile before optimizing—don't guess at bottlenecks
- Make one change at a time and measure the impact
- Run tests after each optimization to ensure correctness is preserved
- Document what was optimized, what the improvement was, and any tradeoffs

### 6.4 Expanding Capabilities

As the project grows, AI capabilities should grow with it:

#### Identify Gaps

During daily development, note where AI agents struggle:

- Operations that require multiple manual steps
- Knowledge that isn't captured in any skill
- Tools or APIs that don't exist yet but would be useful
- Repetitive tasks that could be automated

#### Build Incrementally

Don't try to automate everything at once. Prioritize by frequency and impact:

| Priority | Criteria |
|----------|----------|
| High | Done daily, takes >5 minutes, error-prone |
| Medium | Done weekly, moderate complexity |
| Low | Rare, simple, or already fast enough |

### 6.5 Creating Skills for Discovered Patterns

This is where AI-native development compounds. Every pattern you discover and codify makes future work faster.

#### When to Create a New Skill

Create a skill when you notice:

- You've explained the same process to an AI agent more than once
- An operation requires non-obvious steps or workarounds
- A debugging session revealed knowledge that isn't documented anywhere
- A new tool or API was integrated and has usage patterns worth capturing

#### Skill Creation Process

```
1. Identify the pattern or knowledge gap
2. Document the core operations (commands, expected outputs, failure modes)
3. Include real examples from your project
4. Test the skill by having a fresh AI agent follow it
5. Iterate based on where the agent gets stuck
6. Commit the skill to version control
```

#### Keep Skills Focused

One skill per concern. A skill that covers "everything about deployment" is too broad. Prefer:

- `deployment-staging` — How to deploy to staging
- `deployment-production` — How to deploy to production (different approvals, checks)
- `deployment-rollback` — How to roll back a bad deploy

#### Update Skills Continuously

Skills are living documents. Update them when:

- A process changes (new tool, new step, removed dependency)
- A failure reveals a gap (add the failure mode and resolution)
- A better approach is discovered (replace the old approach, note why)

### 6.6 Monitoring and Observability

Establish ongoing monitoring so AI agents can detect issues proactively:

#### Health Dashboards

- Define key health indicators for the project
- Set up automated health checks that run on a schedule
- Alert on degradation, not just outright failure

#### Execution Log Analysis

- Review execution logs periodically for error patterns
- Track operation success rates over time
- Identify slow operations that may need optimization

#### Feedback Into Skills

Monitoring findings should feed back into skills:

```
Monitor detects recurring error → 
  Investigate root cause → 
  Document in troubleshooting skill → 
  AI agents handle it automatically next time
```

---

## 7. Best Practices for AI-Native Development

### Skill-First Approach: Document Before Automating

Before building complex automation, capture what you know in a skill. Skills are cheaper than code—they're faster to write, easier to update, and immediately useful to any AI agent.

**The pattern:**
```
Discover how something works → Write it down as a skill → 
AI agents use the skill → Skill proves its value → 
Automate further if needed
```

Don't skip straight to automation. A well-written skill often eliminates the need for custom tooling.

### Test Continuously: Validate Every Change

AI agents move fast. Tests are the guardrails that prevent fast movement from becoming fast failure.

- **Unit tests after code changes.** Run the relevant test suite after modifying code. Don't batch changes without validation.
- **Fix broken tests immediately.** A failing test is a signal, not noise. Investigate before moving on.
- **Add tests for new functionality.** Untested features are undocumented assumptions.
- **Use tests as documentation.** Well-named tests describe expected behavior better than comments.

### Inspect State: Use Verbose Logging and Inspection

When something doesn't work, inspect rather than guess:

- Read the actual error output—don't assume you know what failed
- Use API inspection tools to see the real state of entities
- Enable verbose/debug logging during investigation
- Compare expected vs. actual output at each step

### Iterate Rapidly: AI Enables Fast Cycles

AI-native development compresses the development loop:

```
Traditional:  Plan → Implement → Test → Debug → Deploy  (hours/days)
AI-Native:    Intent → Implement → Test → Fix → Verify  (minutes)
```

Leverage this speed:
- Make small, focused changes rather than large batches
- Test immediately after each change
- Fix issues while context is fresh
- Commit working increments frequently

### Build Reusable Skills: Don't Repeat Yourself

Every time an AI agent figures something out from scratch, that's wasted effort. Skills compound:

| Session | Without Skills | With Skills |
|---------|---------------|-------------|
| First | Agent discovers process (30 min) | Agent discovers process (30 min), creates skill (10 min) |
| Second | Agent discovers process again (30 min) | Agent loads skill, executes immediately (2 min) |
| Third | Agent discovers process again (30 min) | Agent loads skill, executes immediately (2 min) |
| **Total** | **90 min** | **44 min** (and accelerating) |

The investment in skill creation pays for itself after a single reuse.

### Create Skills During Development, Not After

Don't wait until a project is "done" to create skills. Create them as you go:

- **After debugging:** Document the failure mode and resolution
- **After integration:** Document the API patterns and gotchas
- **After optimization:** Document what was slow, what fixed it, and how to measure
- **After onboarding a new tool:** Document setup, configuration, and common operations

Skills created in the moment capture details that are forgotten within days.

### Decision-Making

- **Analyze before deciding.** Spawn agents to evaluate options in parallel. Never assume one approach fits all projects.
- **Document decisions.** Record what was chosen, why, and what tradeoffs were accepted.
- **Use sync agents for analysis.** Analysis and verification tasks should block until complete—don't fire and forget.

### Runtime Operations

- **Use detached shells for long-running services.** Attached shells die with the session.
- **Health checks over log parsing.** HTTP endpoints are faster and more reliable than grepping logs.
- **Test the full lifecycle.** Start → verify → use → restart → verify → stop.

### Agent Coordination

- **Parallel agents for independent analysis.** Spawn multiple explorers for different areas simultaneously.
- **Sequential agents for dependent operations.** Don't start Phase 3 until Phase 2 is verified.
- **Trust but verify.** When an agent reports success, spot-check critical changes.

---

## 8. Common Patterns

### Infrastructure

| Pattern | When to Use |
|---------|-------------|
| Docker for stateful services | Databases, caches, message queues—anything with persistent data |
| Native execution for hot-reload apps | Frontend/backend apps where file-watching speed matters |
| Detached shells for persistence | Any long-running process that must survive session boundaries |
| Health check endpoints | Every service should expose a machine-readable health status |

### AI Operations

| Pattern | When to Use |
|---------|-------------|
| Skills for operational knowledge | Startup sequences, troubleshooting, monitoring procedures |
| Parallel agents for analysis | Evaluating multiple options, reviewing multiple files |
| MCP/API tools for operations | CRUD operations on application entities |
| SQL tracking for complex tasks | Multi-step operations with dependencies |
| Unit tests after code changes | Every modification to application code |
| Skill creation after discovery | New pattern found, debugging session completed, tool integrated |

### Startup Sequence Template

```
1. Start stateful services (Docker)     → Verify via container status
2. Wait for services to accept traffic  → Verify via health endpoint or connection test
3. Run migrations if needed             → Verify via exit code
4. Start application (detached)         → Verify via health endpoint
5. Start auxiliary services (detached)  → Verify via health endpoint
6. Final integration check              → All endpoints healthy
```

### Health Check Template

```bash
# Generic health check pattern
check_service() {
  local name="$1" url="$2"
  if curl -sf "$url" > /dev/null 2>&1; then
    echo "✓ $name"
    return 0
  else
    echo "✗ $name"
    return 1
  fi
}

check_service "Application" "http://localhost:3000/api/health"
check_service "WebSocket"   "http://localhost:3001/health"
```

---

## 9. Anti-Patterns

| Anti-Pattern | Why It's Harmful | Do This Instead |
|--------------|-----------------|-----------------|
| Assuming runtime works | Leads to silent failures and wasted debugging time | Verify every service after startup |
| Over-engineering runtime setup | Complexity slows agents and increases failure surface | Choose the simplest option that meets requirements |
| Skipping skill creation | Knowledge lost between sessions; agents repeat mistakes | Codify operational knowledge immediately |
| Using attached shells for servers | Services die when the AI session ends | Use detached mode (`detach: true`) |
| Guessing instead of analyzing | Incorrect assumptions compound into larger failures | Spawn agents to investigate and report facts |
| Log parsing for health checks | Fragile, slow, format-dependent | Expose HTTP health endpoints |
| Manual service management | Not reproducible, not delegatable to AI | Script everything; put it in a skill |
| Monolithic skills | Hard to maintain, hard to reuse | One skill per concern (runtime, testing, deployment) |
| Batching changes without testing | Failures compound, root cause becomes unclear | Run unit tests after each meaningful change |
| Deferring skill creation | Details forgotten, context lost | Create skills during development, not after |
| Fixing symptoms, not root causes | Same issue recurs in different forms | Trace errors to origin; update skills with findings |
| Testing only happy paths | Edge cases cause production failures | Include error cases, boundary conditions, invalid input |

---

## 10. Project-Specific Considerations

When adapting this guide to a new project, evaluate these dimensions:

### Language and Framework

| Concern | Questions to Answer |
|---------|-------------------|
| Package manager | Does it support workspaces? Lock file format? |
| Build system | Incremental? Watch mode available? |
| Hot reload | Native file watching or polling? |
| Test runner | Parallel execution? Watch mode? |
| Type checking | Separate step or integrated with build? |

### Native Dependencies

- Do any dependencies compile native code? (e.g., `better-sqlite3`, `sharp`, `bcrypt`)
- Will they work in Docker's Linux environment if developed on macOS/Windows?
- Are prebuilt binaries available, or is a build toolchain required?

### File Watching

- Does the framework use `fs.watch`, `chokidar`, or `inotify`?
- Is polling required in Docker? What's the performance impact?
- Are there known limits on file watcher count? (`fs.inotify.max_user_watches`)

### Port Management

- List all ports the project uses (app, database, cache, dev tools)
- Document conflict resolution: how to find and kill processes on occupied ports
- Consider port configuration via environment variables for flexibility

### Environment Variables

- Catalog required variables with descriptions and example values
- Distinguish between secrets (API keys) and configuration (port numbers)
- Document how to generate or obtain each secret
- Use `.env.example` as the canonical reference

### Database Management

- Migration strategy: auto-run on startup or manual step?
- Seed data: required for development? How to apply?
- Reset procedure: how to wipe and rebuild from scratch?

---

## Appendix: Quick-Start Checklist

Use this checklist when establishing an AI-native workflow on a new project:

```
Phase 1: Runtime Setup
  □ Profile the project (files, deps, native binaries, services)
  □ Evaluate Docker vs. native vs. hybrid
  □ Consider AI requirements (logs, health checks, process management)
  □ Document the decision and rationale
  □ 🎯 Create skill if non-obvious runtime characteristics were discovered

Phase 2: Skill Creation
  □ Initialize skill structure
  □ Document startup sequence with commands and expected output
  □ Document health checks for every service
  □ Document troubleshooting for common failures
  □ Add automation scripts
  □ Commit skill to version control
  □ 🎯 Verify skill covers all failure modes encountered so far

Phase 3: Implementation & Verification
  □ Agent starts environment using skill (no human steps)
  □ All health checks pass
  □ Services survive session boundaries (detached mode)
  □ Agent can stop and restart services
  □ Edge cases tested (port conflicts, missing config)
  □ 🎯 Update skill with newly discovered failure modes and edge cases

Phase 4: Programmatic Operations
  □ Inventory available APIs and tools
  □ Test CRUD through each interface
  □ Verify execution and monitoring capabilities
  □ Agent can build features end-to-end
  □ Run unit tests to validate programmatic changes
  □ 🎯 Create skill documenting tool inventory and operation patterns

Phase 5: Continuous Iteration
  □ Test-driven development cycle established
  □ Unit tests run after code changes
  □ Skills created for newly discovered patterns
  □ Debugging follows structured approach
  □ Performance baselines tracked
  □ Monitoring feeds findings back into skills
  □ New capabilities added incrementally
  □ Existing skills updated with learnings
```
