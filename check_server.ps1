# Check main page
try {
    $response = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 5
    Write-Host 'Main page Status:' $response.StatusCode
    Write-Host 'Main page Length:' $response.Content.Length
} catch {
    Write-Host 'Main page Error:' $_.Exception.Message
}

# Check main.jsx module
try {
    $response = Invoke-WebRequest -Uri 'http://localhost:3000/src/main.jsx' -UseBasicParsing -TimeoutSec 5
    Write-Host 'main.jsx Status:' $response.StatusCode
    Write-Host 'main.jsx Length:' $response.Content.Length
    Write-Host '--- FIRST 300 CHARS ---'
    Write-Host $response.Content.Substring(0, [Math]::Min(300, $response.Content.Length))
} catch {
    Write-Host 'main.jsx Error:' $_.Exception.Message
}

# Check App.jsx module
try {
    $response = Invoke-WebRequest -Uri 'http://localhost:3000/src/App.jsx' -UseBasicParsing -TimeoutSec 5
    Write-Host 'App.jsx Status:' $response.StatusCode
    Write-Host 'App.jsx Length:' $response.Content.Length
} catch {
    Write-Host 'App.jsx Error:' $_.Exception.Message
}

# Check gedcomParser.js
try {
    $response = Invoke-WebRequest -Uri 'http://localhost:3000/src/utils/gedcomParser.js' -UseBasicParsing -TimeoutSec 5
    Write-Host 'gedcomParser.js Status:' $response.StatusCode
    Write-Host 'gedcomParser.js Length:' $response.Content.Length
} catch {
    Write-Host 'gedcomParser.js Error:' $_.Exception.Message
}