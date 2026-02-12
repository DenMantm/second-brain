#!/usr/bin/env pwsh
# Integration test for TTS service concurrent request handling
# Run this against a running TTS service to verify serialization

param(
    [string]$ServiceUrl = "http://localhost:3002"
)

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "TTS Concurrent Request Integration Test" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Check if service is running
Write-Host "Checking service health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$ServiceUrl/ping" -Method Get -ErrorAction Stop
    Write-Host "✅ Service is healthy: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "❌ Service is not responding at $ServiceUrl" -ForegroundColor Red
    Write-Host "Make sure the TTS service is running:" -ForegroundColor Yellow
    Write-Host "  docker-compose up -d tts-service" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "Launching 5 concurrent synthesis requests..." -ForegroundColor Yellow
Write-Host ""

# Prepare test texts
$texts = @(
    "This is the first concurrent request.",
    "This is the second concurrent request.",
    "This is the third concurrent request.",
    "This is the fourth concurrent request.",
    "This is the fifth concurrent request."
)

# Track start time
$startTime = Get-Date

# Launch all requests concurrently using jobs
$jobs = @()
for ($i = 0; $i -lt $texts.Count; $i++) {
    $text = $texts[$i]
    $requestNum = $i + 1
    
    $job = Start-Job -ScriptBlock {
        param($url, $text, $num)
        
        $requestStart = Get-Date
        Write-Output "[$num] Request started at $($requestStart.ToString('HH:mm:ss.fff'))"
        
        try {
            $body = @{
                text = $text
                speed = 1.0
                format = "wav"
            } | ConvertTo-Json
            
            $response = Invoke-RestMethod `
                -Uri "$url/api/tts/synthesize" `
                -Method Post `
                -Body $body `
                -ContentType "application/json" `
                -ErrorAction Stop
            
            $requestEnd = Get-Date
            $duration = ($requestEnd - $requestStart).TotalSeconds
            
            Write-Output "[$num] Request completed at $($requestEnd.ToString('HH:mm:ss.fff')) (${duration}s)"
            Write-Output "[$num] Audio duration: $($response.duration)s, Processing: $($response.processing_time)s"
            
            return @{
                success = $true
                num = $num
                startTime = $requestStart
                endTime = $requestEnd
                duration = $duration
                processingTime = $response.processing_time
            }
        } catch {
            $requestEnd = Get-Date
            Write-Output "[$num] Request FAILED: $($_.Exception.Message)"
            
            return @{
                success = $false
                num = $num
                error = $_.Exception.Message
            }
        }
    } -ArgumentList $ServiceUrl, $text, $requestNum
    
    $jobs += $job
}

# Wait for all jobs to complete
Write-Host "Waiting for all requests to complete..." -ForegroundColor Yellow
$jobs | Wait-Job | Out-Null

# Collect results
$results = @()
foreach ($job in $jobs) {
    $output = Receive-Job -Job $job
    # Print job output
    $output | Where-Object { $_ -is [string] } | ForEach-Object {
        Write-Host $_ -ForegroundColor Gray
    }
    
    # Collect result object
    $result = $output | Where-Object { $_ -is [hashtable] } | Select-Object -Last 1
    if ($result) {
        $results += $result
    }
}

# Cleanup jobs
$jobs | Remove-Job

$endTime = Get-Date
$totalTime = ($endTime - $startTime).TotalSeconds

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Results" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Check success rate
$successCount = ($results | Where-Object { $_.success }).Count
Write-Host "Successful requests: $successCount / $($results.Count)" -ForegroundColor $(if ($successCount -eq $results.Count) { "Green" } else { "Red" })
Write-Host "Total execution time: ${totalTime}s" -ForegroundColor White
Write-Host ""

# Check serialization
if ($successCount -ge 2) {
    Write-Host "Checking request serialization..." -ForegroundColor Yellow
    
    $successful = $results | Where-Object { $_.success } | Sort-Object num
    $serialized = $true
    
    for ($i = 1; $i -lt $successful.Count; $i++) {
        $prev = $successful[$i - 1]
        $curr = $successful[$i]
        
        $overlap = $curr.startTime -lt $prev.endTime
        
        if ($overlap) {
            Write-Host "❌ Request $($curr.num) started before Request $($prev.num) ended (OVERLAP DETECTED)" -ForegroundColor Red
            $serialized = $false
        }
    }
    
    if ($serialized) {
        Write-Host "✅ All requests were properly serialized (no overlap)" -ForegroundColor Green
    }
    
    # Calculate expected vs actual time
    $avgProcessing = ($successful | ForEach-Object { $_.processingTime } | Measure-Object -Average).Average
    $expectedTime = $avgProcessing * $successful.Count
    $overhead = (($totalTime - $expectedTime) / $expectedTime) * 100
    
    Write-Host ""
    Write-Host "Performance Analysis:" -ForegroundColor Yellow
    Write-Host "  Average processing time: ${avgProcessing}s" -ForegroundColor White
    Write-Host "  Expected total time: ${expectedTime}s" -ForegroundColor White
    Write-Host "  Actual total time: ${totalTime}s" -ForegroundColor White
    Write-Host "  Overhead: ${overhead}%" -ForegroundColor $(if ($overhead -lt 50) { "Green" } else { "Yellow" })
    
    Write-Host ""
    if ($serialized -and $overhead -lt 50) {
        Write-Host "✅ PASS: Service correctly serializes requests with acceptable overhead" -ForegroundColor Green
    } elseif ($serialized) {
        Write-Host "⚠️  WARN: Requests serialized but overhead is high (${overhead}%)" -ForegroundColor Yellow
    } else {
        Write-Host "❌ FAIL: Requests are not properly serialized" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""
