# Logbook touchdown guard.
#
# Wired to two hook events in .claude/settings.json:
#   SessionStart -> records HEAD at session start
#   Stop         -> if the session added commits but none touched log/touchdowns/,
#                   blocks the stop and tells Claude to write the touchdown.
#
# Never blocks on: non-git dirs, repos without log/touchdowns/, sessions with no
# new commits, or a session that already got one nudge (stop_hook_active).
# Pre-existing dirty files are irrelevant by design — this keys off commits only,
# so a repo with long-standing uncommitted work is not nagged every session.
#
# Any unexpected failure exits 0 (allow the stop). A broken guard must never
# wedge a session.

$ErrorActionPreference = 'SilentlyContinue'

try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
    $in = $raw | ConvertFrom-Json

    $evt = $in.hook_event_name
    $sid = $in.session_id
    $cwd = if ($in.cwd) { $in.cwd } else { (Get-Location).Path }
    if (-not $sid) { exit 0 }

    $repoRoot = (git -C $cwd rev-parse --show-toplevel 2>$null)
    if (-not $repoRoot) { exit 0 }
    $repoRoot = $repoRoot.Trim()

    # Only guard repos that actually have a logbook.
    if (-not (Test-Path (Join-Path $repoRoot 'log/touchdowns'))) { exit 0 }

    $stateDir = Join-Path $env:TEMP 'claude-logbook'
    if (-not (Test-Path $stateDir)) { New-Item -ItemType Directory -Force -Path $stateDir | Out-Null }
    $key = ("$sid`_$repoRoot" -replace '[^a-zA-Z0-9]', '_')
    $marker = Join-Path $stateDir "$key.txt"

    if ($evt -eq 'SessionStart') {
        $head = (git -C $repoRoot rev-parse HEAD 2>$null)
        if ($head) { [System.IO.File]::WriteAllText($marker, $head.Trim()) }
        exit 0
    }

    if ($evt -eq 'Stop') {
        # Loop guard: we already nudged this session once. Never nudge twice.
        if ($in.stop_hook_active) { exit 0 }
        if (-not (Test-Path $marker)) { exit 0 }

        $start = ([System.IO.File]::ReadAllText($marker)).Trim()
        $head = (git -C $repoRoot rev-parse HEAD 2>$null)
        if (-not $head) { exit 0 }
        $head = $head.Trim()

        # No commits this session -> nothing to log.
        if ($head -eq $start) { exit 0 }

        # Did anything this session commit a touchdown?
        $touched = (git -C $repoRoot diff --name-only "$start..$head" -- 'log/touchdowns' 2>$null)
        if ($touched) { exit 0 }

        $subjects = (git -C $repoRoot log --format='  - %h %s' "$start..$head" 2>$null) -join "`n"

        $reason = @"
Logbook: this session committed to $repoRoot but no commit added a touchdown.

Commits with no record:
$subjects

Before finishing, write the touchdown this repo's CLAUDE.md requires:
  1. Read log/TOUCHDOWN_TEMPLATE.md for the format, the depth rule, and the
     model/effort rule.
  2. Write log/touchdowns/<YYYY-MM-DD>_<HHMM>_<slug>.md using local time.
     Do NOT use a counter, and do NOT write this commit's own sha.
  3. Commit it. Amending it into the commit above is fine; a follow-up commit is
     fine too. If the work landed in a nested repo (a gitlink), the touchdown
     goes in THIS repo and cannot share the commit - say so in the record.

Go deep on '## How it went' and '## Any errors'; stay terse elsewhere. Report
failures and correction passes honestly - a touchdown that grades itself well
when the job went badly makes the logbook worthless.
"@

        $out = @{ decision = 'block'; reason = $reason } | ConvertTo-Json -Compress
        Write-Output $out
        exit 0
    }

    exit 0
}
catch {
    # Never wedge a session because the guard broke.
    exit 0
}
