# Reaction Tap — STATE_SNAPSHOT (AUTO)

> Generated: 2026-02-22 18:13:39  
> Branch: usage: git [-v | --version] [-h | --help] [-C <path>] [-c <name>=<value>]            [--exec-path[=<path>]] [--html-path] [--man-path] [--info-path]            [-p | --paginate | -P | --no-pager] [--no-replace-objects] [--no-lazy-fetch]            [--no-optional-locks] [--no-advice] [--bare] [--git-dir=<path>]            [--work-tree=<path>] [--namespace=<name>] [--config-env=<name>=<envvar>]            <command> [<args>]  These are common Git commands used in various situations:  start a working area (see also: git help tutorial)    clone      Clone a repository into a new directory    init       Create an empty Git repository or reinitialize an existing one  work on the current change (see also: git help everyday)    add        Add file contents to the index    mv         Move or rename a file, a directory, or a symlink    restore    Restore working tree files    rm         Remove files from the working tree and from the index  examine the history and state (see also: git help revisions)    bisect     Use binary search to find the commit that introduced a bug    diff       Show changes between commits, commit and working tree, etc    grep       Print lines matching a pattern    log        Show commit logs    show       Show various types of objects    status     Show the working tree status  grow, mark and tweak your common history    backfill   Download missing objects in a partial clone    branch     List, create, or delete branches    commit     Record changes to the repository    merge      Join two or more development histories together    rebase     Reapply commits on top of another base tip    reset      Reset current HEAD to the specified state    switch     Switch branches    tag        Create, list, delete or verify a tag object signed with GPG  collaborate (see also: git help workflows)    fetch      Download objects and refs from another repository    pull       Fetch from and integrate with another repository or a local branch    push       Update remote refs along with associated objects  'git help -a' and 'git help -g' list available subcommands and some concept guides. See 'git help <command>' or 'git help <concept>' to read about a specific subcommand or concept. See 'git help git' for an overview of the system.  
> Commit: usage: git [-v | --version] [-h | --help] [-C <path>] [-c <name>=<value>]            [--exec-path[=<path>]] [--html-path] [--man-path] [--info-path]            [-p | --paginate | -P | --no-pager] [--no-replace-objects] [--no-lazy-fetch]            [--no-optional-locks] [--no-advice] [--bare] [--git-dir=<path>]            [--work-tree=<path>] [--namespace=<name>] [--config-env=<name>=<envvar>]            <command> [<args>]  These are common Git commands used in various situations:  start a working area (see also: git help tutorial)    clone      Clone a repository into a new directory    init       Create an empty Git repository or reinitialize an existing one  work on the current change (see also: git help everyday)    add        Add file contents to the index    mv         Move or rename a file, a directory, or a symlink    restore    Restore working tree files    rm         Remove files from the working tree and from the index  examine the history and state (see also: git help revisions)    bisect     Use binary search to find the commit that introduced a bug    diff       Show changes between commits, commit and working tree, etc    grep       Print lines matching a pattern    log        Show commit logs    show       Show various types of objects    status     Show the working tree status  grow, mark and tweak your common history    backfill   Download missing objects in a partial clone    branch     List, create, or delete branches    commit     Record changes to the repository    merge      Join two or more development histories together    rebase     Reapply commits on top of another base tip    reset      Reset current HEAD to the specified state    switch     Switch branches    tag        Create, list, delete or verify a tag object signed with GPG  collaborate (see also: git help workflows)    fetch      Download objects and refs from another repository    pull       Fetch from and integrate with another repository or a local branch    push       Update remote refs along with associated objects  'git help -a' and 'git help -g' list available subcommands and some concept guides. See 'git help <command>' or 'git help <concept>' to read about a specific subcommand or concept. See 'git help git' for an overview of the system.  

## What works now (fill 5 bullets max)
- Web starts
- Games screen opens
- Shop opens
- Withdraw page exists at /(public)/withdraw
- API routes exist for wallet/match/cashout

## Current pain / bugs (fill 5 bullets max)
- (write actual bugs here)

## Next target behavior (absolute)
- Cash games: **stake → auto-match → short “waiting” overlay → start**
- No separate matchmaking page flow (no extra decisions).
- Later: invites/custom stake (not now).

## Files recently touched (AUTO hint: top suspects)
- apps/web/app/(public)/play/page.tsx
- apps/web/app/(public)/shop/page.tsx
- apps/web/app/(public)/withdraw/page.tsx
- apps/api/src/server.ts
- apps/api/src/services/match.service.ts
- apps/api/src/services/wallet.service.ts
- apps/api/src/services/cashout.service.ts

## Structure artifacts (AUTO)
- Tree: docs/_TREE.txt
- Source list: docs/_SOURCE_FILES.txt

## MANUAL CHANGELOG (1–2 lines each)
- YYYY-MM-DD: ...
