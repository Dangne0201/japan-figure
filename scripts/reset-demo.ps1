$ErrorActionPreference = 'Stop'
$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot '..')

function Invoke-Compose {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  & docker compose @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
  }
}

Push-Location $repositoryRoot
try {
  Write-Warning 'This permanently deletes all demo database data, including users, orders, and admin accounts.'
  Write-Warning 'It does not delete product-upload files or Mailpit messages.'
  if ((Read-Host 'Type RESET to continue') -cne 'RESET') {
    Write-Output 'Reset cancelled.'
    return
  }

  Invoke-Compose -Arguments @('up', '-d', 'postgres', 'redis', 'mailpit')
  Invoke-Compose -Arguments @('stop', 'nginx', 'web', 'api', 'worker')
  Invoke-Compose -Arguments @('run', '--rm', 'migrate', 'npm', 'run', 'db:reset')
  Invoke-Compose -Arguments @('--profile', 'tools', 'run', '--rm', 'seed')
  Invoke-Compose -Arguments @(
    'run',
    '--rm',
    '--no-deps',
    'api',
    'npm',
    'run',
    'knowledge:reindex',
    '--workspace',
    'apps/api'
  )
  Invoke-Compose -Arguments @('up', '-d')

  Write-Output 'Demo database reset, seeded, and knowledge re-indexed successfully.'
}
catch {
  Write-Error "Demo reset did not complete: $($_.Exception.Message)"
  throw
}
finally {
  Pop-Location
}
