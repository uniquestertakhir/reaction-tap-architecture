# Reaction Tap — PROJECT_CONTEXT (AUTO)

> Generated: 2026-02-22 18:13:39  
> Branch: usage: git [-v | --version] [-h | --help] [-C <path>] [-c <name>=<value>]            [--exec-path[=<path>]] [--html-path] [--man-path] [--info-path]            [-p | --paginate | -P | --no-pager] [--no-replace-objects] [--no-lazy-fetch]            [--no-optional-locks] [--no-advice] [--bare] [--git-dir=<path>]            [--work-tree=<path>] [--namespace=<name>] [--config-env=<name>=<envvar>]            <command> [<args>]  These are common Git commands used in various situations:  start a working area (see also: git help tutorial)    clone      Clone a repository into a new directory    init       Create an empty Git repository or reinitialize an existing one  work on the current change (see also: git help everyday)    add        Add file contents to the index    mv         Move or rename a file, a directory, or a symlink    restore    Restore working tree files    rm         Remove files from the working tree and from the index  examine the history and state (see also: git help revisions)    bisect     Use binary search to find the commit that introduced a bug    diff       Show changes between commits, commit and working tree, etc    grep       Print lines matching a pattern    log        Show commit logs    show       Show various types of objects    status     Show the working tree status  grow, mark and tweak your common history    backfill   Download missing objects in a partial clone    branch     List, create, or delete branches    commit     Record changes to the repository    merge      Join two or more development histories together    rebase     Reapply commits on top of another base tip    reset      Reset current HEAD to the specified state    switch     Switch branches    tag        Create, list, delete or verify a tag object signed with GPG  collaborate (see also: git help workflows)    fetch      Download objects and refs from another repository    pull       Fetch from and integrate with another repository or a local branch    push       Update remote refs along with associated objects  'git help -a' and 'git help -g' list available subcommands and some concept guides. See 'git help <command>' or 'git help <concept>' to read about a specific subcommand or concept. See 'git help git' for an overview of the system.  
> Commit: usage: git [-v | --version] [-h | --help] [-C <path>] [-c <name>=<value>]            [--exec-path[=<path>]] [--html-path] [--man-path] [--info-path]            [-p | --paginate | -P | --no-pager] [--no-replace-objects] [--no-lazy-fetch]            [--no-optional-locks] [--no-advice] [--bare] [--git-dir=<path>]            [--work-tree=<path>] [--namespace=<name>] [--config-env=<name>=<envvar>]            <command> [<args>]  These are common Git commands used in various situations:  start a working area (see also: git help tutorial)    clone      Clone a repository into a new directory    init       Create an empty Git repository or reinitialize an existing one  work on the current change (see also: git help everyday)    add        Add file contents to the index    mv         Move or rename a file, a directory, or a symlink    restore    Restore working tree files    rm         Remove files from the working tree and from the index  examine the history and state (see also: git help revisions)    bisect     Use binary search to find the commit that introduced a bug    diff       Show changes between commits, commit and working tree, etc    grep       Print lines matching a pattern    log        Show commit logs    show       Show various types of objects    status     Show the working tree status  grow, mark and tweak your common history    backfill   Download missing objects in a partial clone    branch     List, create, or delete branches    commit     Record changes to the repository    merge      Join two or more development histories together    rebase     Reapply commits on top of another base tip    reset      Reset current HEAD to the specified state    switch     Switch branches    tag        Create, list, delete or verify a tag object signed with GPG  collaborate (see also: git help workflows)    fetch      Download objects and refs from another repository    pull       Fetch from and integrate with another repository or a local branch    push       Update remote refs along with associated objects  'git help -a' and 'git help -g' list available subcommands and some concept guides. See 'git help <command>' or 'git help <concept>' to read about a specific subcommand or concept. See 'git help git' for an overview of the system.  

## What this repo is
Multi-game skill platform (Reaction Tap = first game). Cash (USD) modes must be: **pick stake → auto-find opponent (matchmaking) → game starts**.  
**No lobby/invite flow for cash modes**. Matchmaking must NOT be a separate “page flow” that complicates UX (at most a short overlay).

## Runtime layout (known)
- Web: pps/web (Next.js App Router)
- API: pps/api (Fastify)

## Core flows (current implementation clues)
- Games hub: pps/web/app/(public)/games/page.tsx
- Play: pps/web/app/(public)/play/page.tsx
- Shop: pps/web/app/(public)/shop/page.tsx
- Withdraw page: pps/web/app/(public)/withdraw/page.tsx
- API server: pps/api/src/server.ts
- Match service: pps/api/src/services/match.service.ts
- Wallet service: pps/api/src/services/wallet.service.ts
- Cashout service: pps/api/src/services/cashout.service.ts

## References detected (AUTO)
### /withdraw references
- apps\web\app\(public)\cashout-admin\page.tsx
- apps\web\app\(public)\play\page.tsx
- apps\web\app\(public)\shop\page.tsx
- apps\web\app\(public)\withdraw\page.tsx
- apps\web\app\api\wallet\withdraw\route.ts

### /api/match references
- apps\web\app\(public)\lobby\page.tsx
- apps\web\app\(public)\matchmaking\page.tsx
- apps\web\app\(public)\play\page.tsx
- apps\web\app\api\match\create\route.ts
- apps\web\app\api\match\[id]\runs\route.ts
- apps\web\app\api\match\[id]\stake\route.ts
- apps\web\app\api\match\[id]\start\route.ts
- apps\web\app\api\match\[id]\route.ts

### /api/wallet/withdraw references
- apps\web\app\(public)\cashout-admin\page.tsx
- apps\web\app\(public)\play\page.tsx
- apps\web\app\(public)\withdraw\page.tsx
- apps\web\app\api\wallet\withdraw\route.ts

## Source files index (AUTO)
See: docs/_SOURCE_FILES.txt

## Tree (AUTO)
See: docs/_TREE.txt

## MANUAL NOTES (keep this short)
- (add 3–7 bullets about what changed since last snapshot)
