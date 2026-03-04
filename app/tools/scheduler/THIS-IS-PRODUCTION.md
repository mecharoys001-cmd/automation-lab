# ✅ THIS IS THE PRODUCTION SCHEDULER

**Location:** `/home/ethan/.openclaw/workspace/automation-lab/app/tools/scheduler/`

## Deployment Info
- **Vercel Project:** automation-lab
- **Production URL:** https://tools.artsnwct.org/tools/scheduler/admin
- **Deployment Method:** Vercel CLI from automation-lab root

## Deploy Command
```bash
cd /home/ethan/.openclaw/workspace/automation-lab
vercel --prod --token $VERCEL_TOKEN --yes
```

## Recent Updates
- **March 3, 2026:** Calendar alignment fixes applied
  - MonthView: Explicit grid positioning with Tooltip wrapper
  - YearView: Explicit grid positioning with Tooltip wrapper  
  - Tooltip component: Auto-detects grid context with `display: contents`
  - All calendar views (Week, Month, Year) now have properly aligned headers and day columns

## Important Notes
- **ALL SCHEDULER EDITS** must be made in this directory
- Standing rule: TOOLTIPS ON EVERYTHING
- Test builds after changes
- Always use Claude Code for coding changes

## Deprecated Versions (DO NOT USE)
- `/home/ethan/.openclaw/workspace/projects/symphonix-scheduler/` (old standalone)
- `/home/ethan/.openclaw/workspace/symphonix-scheduler-v1-DEPRECATED-DO-NOT-USE/` (ancient version)

---
Status: ✅ ACTIVE PRODUCTION VERSION
Last Updated: March 3, 2026
