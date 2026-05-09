# Skill Registry - ERP-Market

## Project Skills

| Skill | Location | Description |
|-------|----------|-------------|
| branch-pr | `~/.config/opencode/skills/branch-pr/` | Create Gentle AI pull requests with issue-first checks |
| chained-pr | `~/.config/opencode/skills/chained-pr/` | Split oversized changes into chained PRs |
| cognitive-doc-design | `~/.config/opencode/skills/cognitive-doc-design/` | Design docs that reduce cognitive load |
| comment-writer | `~/.config/opencode/skills/comment-writer/` | Write warm, direct collaboration comments |
| issue-creation | `~/.config/opencode/skills/issue-creation/` | Create Gentle AI issues with issue-first checks |
| judgment-day | `~/.config/opencode/skills/judgment-day/` | Blind dual review, fix confirmed issues, re-judge |
| sdd-apply | `~/.config/opencode/skills/sdd-apply/` | Implement SDD tasks from specs and design |
| sdd-archive | `~/.config/opencode/skills/sdd-archive/` | Archive completed SDD change by syncing delta specs |
| sdd-design | `~/.config/opencode/skills/sdd-design/` | Create SDD technical design and architecture |
| sdd-explore | `~/.config/opencode/skills/sdd-explore/` | Explore SDD ideas before committing to change |
| sdd-init | `~/.config/opencode/skills/sdd-init/` | Initialize SDD context, testing capabilities, registry |
| sdd-onboard | `~/.config/opencode/skills/sdd-onboard/` | Walk users through SDD workflow |
| sdd-propose | `~/.config/opencode/skills/sdd-propose/` | Create SDD change proposal with intent, scope |
| sdd-spec | `~/.config/opencode/skills/sdd-spec/` | Write SDD delta specs with requirements |
| sdd-tasks | `~/.config/opencode/skills/sdd-tasks/` | Break SDD change into implementation tasks |
| sdd-verify | `~/.config/opencode/skills/sdd-verify/` | Execute tests and prove implementation matches specs |
| skill-creator | `~/.config/opencode/skills/skill-creator/` | Create LLM-first skills with valid frontmatter |
| skill-registry | `~/.config/opencode/skills/skill-registry/` | Create or update project skill registry |
| work-unit-commits | `~/.config/opencode/skills/work-unit-commits/` | Plan commits as reviewable work units |

## Agent Skills (Global)

| Skill | Location | Description |
|-------|----------|-------------|
| go-testing | `~/.agents/skills/go-testing/` | Focused Go testing patterns |
| code-review-excellence | `~/.agents/skills/code-review-excellence/` | Master effective code review practices |
| insforge | `~/.agents/skills/insforge/` | Frontend code with InsForge SDK |
| insforge-cli | `~/.agents/skills/insforge-cli/` | Backend infrastructure management with InsForge |
| insforge-debug | `~/.agents/skills/insforge-debug/` | Debug InsForge project errors |
| insforge-integrations | `~/.agents/skills/insforge-integrations/` | Third-party auth integration with InsForge |
| nodejs-backend-patterns | `~/.agents/skills/nodejs-backend-patterns/` | Production-ready Node.js backend services |
| pdf-skill | `~/.agents/skills/pdf-skill/` | PDF generation, parsing, manipulation |
| postgresql-table-design | `~/.agents/skills/postgresql-table-design/` | PostgreSQL schema design best practices |
| typescript-advanced-types | `~/.agents/skills/typescript-advanced-types/` | TypeScript advanced type system |
| ui-ux-pro-max | `~/.agents/skills/ui-ux-pro-max/` | UI/UX design intelligence |
| data-export-master | `~/.agents/skills/data-export-master/` | Data export design (Excel, PDF, CSV) |
| brainstorming | `~/.agents/skills/brainstorming/` | Explore user intent and design before implementation |
| caveman-commit | `~/.agents/skills/caveman-commit/` | Ultra-compressed commit message generator |

## Stack Detection

- **Backend**: Node.js + Express + TypeScript + Prisma (SQLite/PostgreSQL)
- **Frontend**: React + Vite + TypeScript + Tailwind CSS v4 + Radix UI + Zustand + TanStack Query
- **Desktop**: Electron + electron-vite + TypeScript
- **Monorepo**: pnpm workspaces
- **Database**: Prisma ORM con soporte multi-db (SQLite via better-sqlite3, PostgreSQL via pg)

## Testing Capabilities

**Estado**: NO CONFIGURED

| Layer | Tool | Status |
|-------|------|--------|
| Unit Tests | None | ❌ Not configured |
| Integration Tests | None | ❌ Not configured |
| E2E Tests | None | ❌ Not configured |
| Linter | None | ❌ Not configured |
| Formatter | None | ❌ Not configured |
| Type Checker | TypeScript | ✅ Configured |

**Strict TDD**: `false` (no test runner detected)

**Recomendación**: El proyecto no tiene testing configurado. El script `test` en el root package.json solo hace `echo "Error: no test specified" && exit 1`.

## Next Steps

1. Ejecutar `/sdd-explore` para explorar el dominio del proyecto
2. Considerar configurar testing (Vitest para frontend, Jest/Vitest para backend)
3. Considerar ESLint + Prettier para code quality
