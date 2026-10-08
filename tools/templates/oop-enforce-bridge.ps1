#Requires -Version 7.5
# Template version 1; source identity @@SOURCE_IDENTITY@@.
# Conditional PowerShell template for a verified eligible host. Adapt documented
# native event envelopes in this shell before freezing the initial package.
# Parameters are supplied by an authorized installation-local registration.
# Required trusted native integration: resolve the runtime-owned maintenance
# declaration independently on every protected invocation and supply its current
# observation. Constrain actual effects before admitting bridge repair. This
# transport template alone neither authenticates stdin nor provides confinement.
param(
    [Parameter(Mandatory)][string]$Controller,
    [Parameter(Mandatory)][string]$Interpreter,
    [Parameter(Mandatory)][string]$Command,
    [Parameter(Mandatory)][string]$ExpectedSourceIdentity,
    [Parameter(Mandatory)][ValidateSet('oop-request-v1')][string]$EventFormat,
    [ValidateRange(1,6000)][int]$TimeoutMs = 6000
)
$ErrorActionPreference = 'Stop'
try {
    if ($Command -notin @('entry','interaction','pre-effect','post-effect','completion','recovery','delegate','probe','validate-configuration')) { exit 4 }
    if (-not [IO.Path]::IsPathFullyQualified($Controller) -or -not [IO.Path]::IsPathFullyQualified($Interpreter)) { exit 4 }
    [Console]::InputEncoding = [Text.UTF8Encoding]::new($false, $true)
    [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
    $payload = [Console]::In.ReadToEnd()
    if ($payload.Length -gt 0 -and $payload[0] -eq [char]0xFEFF) { $payload = $payload.Substring(1) }
    if ([Text.Encoding]::UTF8.GetByteCount($payload) -gt 1048576) { exit 4 }
    # Preserve JSON timestamp strings and timestamp-shaped identifiers exactly.
    # Official ConvertFrom-Json -DateKind documentation reviewed 2026-10-24:
    # https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/convertfrom-json?view=powershell-7.5
    $request = $payload | ConvertFrom-Json -DateKind String -ErrorAction Stop
    # HOST-EVENT ADAPTATION: only the explicitly configured OOP request envelope
    # is accepted here. Map a documented native event in this shell before using
    # another format. Do not alter the controller transport/validation below.
    if ($EventFormat -cne 'oop-request-v1' -or $request -isnot [pscustomobject]) { exit 4 }
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $Interpreter
    $start.ArgumentList.Add($Controller)
    $start.ArgumentList.Add($Command)
    $start.WorkingDirectory = [IO.Path]::GetDirectoryName($Controller)
    $start.UseShellExecute = $false
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.CreateNoWindow = $true
    $start.StandardInputEncoding = [Text.UTF8Encoding]::new($false)
    $start.StandardOutputEncoding = [Text.UTF8Encoding]::new($false, $true)
    $start.StandardErrorEncoding = [Text.UTF8Encoding]::new($false, $true)
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $start
    if (-not $process.Start()) { exit 4 }
    $output = $process.StandardOutput.ReadToEndAsync()
    $errors = $process.StandardError.ReadToEndAsync()
    $clock = [Diagnostics.Stopwatch]::StartNew()
    if (-not $process.StandardInput.WriteAsync($payload).Wait($TimeoutMs)) { $process.Kill($true); exit 4 }
    $process.StandardInput.Close()
    $remaining = [Math]::Max(1, $TimeoutMs - [int]$clock.ElapsedMilliseconds)
    if (-not $process.WaitForExit($remaining)) { $process.Kill($true); exit 4 }
    $raw = $output.WaitAsync([TimeSpan]::FromMilliseconds($remaining)).GetAwaiter().GetResult()
    $null = $errors.WaitAsync([TimeSpan]::FromMilliseconds($remaining)).GetAwaiter().GetResult()
    if ([Text.Encoding]::UTF8.GetByteCount($raw) -gt 2097152) { exit 4 }
    $response = $raw | ConvertFrom-Json -DateKind String -ErrorAction Stop
    if ($Command -ceq 'validate-configuration') {
        $expected = @('format','type','request_id','source_binding','valid','reason','dispatch_verified','validation_binding','error')
        $actual = @($response.PSObject.Properties.Name)
        if ($actual.Count -ne $expected.Count -or @($expected | Where-Object { $actual -cnotcontains $_ }).Count -ne 0 -or
            ($response.format -isnot [long] -and $response.format -isnot [int]) -or $response.format -ne 1 -or $response.type -cne 'oop_configuration_validation' -or
            $response.request_id -cne $request.request_id -or $response.valid -isnot [bool] -or $response.error -isnot [bool] -or
            $response.dispatch_verified -isnot [bool] -or $response.dispatch_verified -ne $false -or $response.reason -isnot [string] -or [string]::IsNullOrWhiteSpace($response.reason) -or
            $response.source_binding.kind -cne 'source_content' -or $response.source_binding.source_identity -cne $ExpectedSourceIdentity -or
            @($response.source_binding.PSObject.Properties).Count -ne 2 -or ($response.error -and $response.valid)) { exit 4 }
        $expectedExit = if ($response.error) { 4 } elseif ($response.valid) { 0 } else { 2 }
        if ($process.ExitCode -ne $expectedExit -or ($response.valid -and $response.validation_binding -isnot [pscustomobject]) -or
            (-not $response.valid -and $null -ne $response.validation_binding)) { exit 4 }
        if ($response.valid) {
            $binding = $response.validation_binding
            $fields = @('plan_identity','observation_identity','configuration_revision','host','installation_uid','workspace','observation_reference')
            if (@($binding.PSObject.Properties).Count -ne $fields.Count) { exit 4 }
            foreach ($field in $fields) {
                if ($binding.$field -isnot [string] -or [string]::IsNullOrWhiteSpace($binding.$field)) { exit 4 }
            }
            if ($binding.plan_identity -cnotmatch '^sha256:[a-f0-9]{64}$' -or $binding.observation_identity -cnotmatch '^sha256:[a-f0-9]{64}$' -or
                $binding.configuration_revision -cne $request.plan.expected_revision -or $binding.configuration_revision -cne $request.facts.configuration_revision -or
                $binding.host -cne $request.facts.host -or $binding.installation_uid -cne $request.facts.installation_uid -or
                $binding.workspace -cne $request.facts.workspace -or $binding.observation_reference -cne $request.facts.reference) { exit 4 }
        }
        [Console]::Out.Write($raw)
        exit $expectedExit
    }
    $codes = @{allow=0;deny=2;unknown=3;error=4}
    $keys = @($response.PSObject.Properties.Name)
    $required = @('format','type','request_id','command','source_binding','decision','reason_code','effect_permission','assurance','payload')
    if ($keys.Count -ne $required.Count -or @($required | Where-Object { $keys -cnotcontains $_ }).Count -ne 0) { exit 4 }
    if (($response.format -isnot [long] -and $response.format -isnot [int]) -or
        $response.format -ne 1 -or $response.type -cne 'oop_admission' -or
        $response.request_id -cne $request.request_id -or $response.command -cne $Command -or
        $response.source_binding.kind -cne 'source_content' -or
        $response.source_binding.source_identity -cne $ExpectedSourceIdentity -or
        @($response.source_binding.PSObject.Properties).Count -ne 2 -or
        $response.decision -cnotmatch '^(allow|deny|unknown|error)$' -or
        $response.reason_code -isnot [string] -or [string]::IsNullOrWhiteSpace($response.reason_code) -or
        $response.assurance -isnot [string] -or [string]::IsNullOrWhiteSpace($response.assurance) -or
        $response.payload -isnot [pscustomobject] -or
        $response.effect_permission -cnotmatch '^(not_granted|conditional_on_adapter)$' -or
        -not $codes.ContainsKey([string]$response.decision) -or
        $process.ExitCode -ne $codes[[string]$response.decision]) { exit 4 }
    if ($Command -eq 'pre-effect' -and $response.decision -ceq 'allow') {
        if ($response.effect_permission -cne 'conditional_on_adapter') { exit 4 }
    } elseif ($response.effect_permission -cne 'not_granted') { exit 4 }
    if ($response.decision -ceq 'allow') {
        $payloadKeys = @($response.payload.PSObject.Properties.Name)
        $expectedPayload = @('checked','modules','observation_time','semantic_assurance','state_write')
        if ($payloadKeys.Count -ne 5 -or @($expectedPayload | Where-Object { $payloadKeys -cnotcontains $_ }).Count -ne 0 -or
            $response.payload.checked -isnot [array] -or $response.payload.checked.Count -eq 0 -or
            $response.payload.modules -isnot [array] -or $response.payload.modules.Count -eq 0) { exit 4 }
        foreach ($list in @('checked','modules')) {
            foreach ($item in $response.payload.$list) {
                if ($item -isnot [string] -or [string]::IsNullOrWhiteSpace($item)) { exit 4 }
            }
        }
        foreach ($name in @('observation_time','semantic_assurance','state_write')) {
            $item = $response.payload.$name
            if ($item -isnot [string] -or [string]::IsNullOrWhiteSpace($item)) { exit 4 }
        }
        $observed = [DateTimeOffset]::MinValue
        if (-not [DateTimeOffset]::TryParse($response.payload.observation_time, [ref]$observed)) { exit 4 }
    }
    [Console]::Out.Write($raw)
    exit $process.ExitCode
} catch {
    if ($null -ne $process -and $null -ne $process.StartInfo -and -not $process.HasExited) { $process.Kill($true) }
    exit 4
}
