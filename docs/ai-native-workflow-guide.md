# AI-Native Workflow Guide

> **Purpose:** Template for establishing AI-managed development workflows in any project.
> **Last Updated:** 2026-02-07
> **Status:** Phases 1–3 complete · Phase 4 in progress · Phase 5 planned

| Phase | Status | Description |
|-------|--------|-------------|
| 1. Runtime Setup Analysis | ✅ Complete | Determine optimal dev environment |
| 2. Skill Creation | ✅ Complete | Codify operational knowledge |
| 3. Implementation & Verification | ✅ Complete | Validate end-to-end |
| 4. Programmatic Operations | 🔄 In Progress | AI creates/modifies/executes features |
| 5. Continuous Iteration | 📋 Future | Debugging, optimization, expansion |

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

---

## 5. Phase 4: Programmatic Operations

> **Status:** 🔄 In Progress

**Goal:** Enable AI agents to create, modify, execute, and test application features programmatically.

**Deliverable:** AI can build and test features autonomously through available APIs and tools.

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

### Example: Sim Studio (In Progress)

Available tools: `sim-mcp` server with 20+ operations for workflow management, block configuration, edge management, variable operations, and custom tool creation.

Current work: Testing workflow creation and modification through MCP tools, verifying AI can build complete workflows programmatically.

---

## 6. Phase 5: Continuous Iteration

> **Status:** 📋 Future

**Goal:** Establish a feedback loop where AI agents improve the development workflow over time.

### Planned Areas

- **Debugging workflows:** AI diagnoses and fixes failures in production workflows
- **Performance optimization:** Identify bottlenecks and optimize hot paths
- **Capability expansion:** Add new skills as the project grows
- **Skill updates:** Incorporate learnings from failures back into skills
- **Cross-project patterns:** Extract generalizable patterns into shared skills

---

## 7. Best Practices

### Decision-Making

- **Analyze before deciding.** Spawn agents to evaluate options in parallel. Never assume one approach fits all projects.
- **Document decisions.** Record what was chosen, why, and what tradeoffs were accepted.
- **Use sync agents for analysis.** Analysis and verification tasks should block until complete—don't fire and forget.

### Skill Management

- **Create skills for repeatable operations.** If an agent does it twice, it should be a skill.
- **Write for machines.** Structured commands and expected outputs, not narrative prose.
- **Version control skills.** They're project artifacts, not disposable notes.
- **Update skills with learnings.** Every failure is a documentation gap.

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

Phase 2: Skill Creation
  □ Initialize skill structure
  □ Document startup sequence with commands and expected output
  □ Document health checks for every service
  □ Document troubleshooting for common failures
  □ Add automation scripts
  □ Commit skill to version control

Phase 3: Implementation & Verification
  □ Agent starts environment using skill (no human steps)
  □ All health checks pass
  □ Services survive session boundaries (detached mode)
  □ Agent can stop and restart services
  □ Edge cases tested (port conflicts, missing config)

Phase 4: Programmatic Operations
  □ Inventory available APIs and tools
  □ Test CRUD through each interface
  □ Verify execution and monitoring capabilities
  □ Agent can build features end-to-end

Phase 5: Continuous Iteration
  □ Feedback loop established
  □ Skills updated with learnings
  □ Performance baselines tracked
  □ New capabilities added incrementally
```
