$headers = @{
    'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    'Accept' = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    'Accept-Language' = 'en-US,en;q=0.9'
    'Accept-Encoding' = 'gzip, deflate, br'
    'Connection' = 'keep-alive'
    'Cache-Control' = 'no-cache'
    'Pragma' = 'no-cache'
    'Sec-Fetch-Dest' = 'document'
    'Sec-Fetch-Mode' = 'navigate'
    'Sec-Fetch-Site' = 'none'
    'Sec-Fetch-User' = '?1'
    'Upgrade-Insecure-Requests' = '1'
    'Referer' = 'https://www.myheritage.com/'
}

# Use .NET HttpClient for more control
Add-Type -AssemblyName System.Net.Http

$handler = New-Object System.Net.Http.HttpClientHandler
$handler.AllowAutoRedirect = $true
$handler.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate

$client = New-Object System.Net.Http.HttpClient($handler)
$client.Timeout = [TimeSpan]::FromSeconds(30)

foreach ($header in $headers.GetEnumerator()) {
    if ($header.Key -ne 'Content-Length') {
        try { $client.DefaultRequestHeaders.TryAddWithoutValidation($header.Key, $header.Value) } catch {}
    }
}

try {
    $url = 'https://www.myheritage.com/family-sites/wairua/OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ?hcl=1&tr_date=20260816'
    $response = $client.GetAsync($url).GetAwaiter().GetResult()
    
    Write-Host 'Status Code:' ([int]$response.StatusCode) $response.ReasonPhrase
    Write-Host 'Final URL:' $response.RequestMessage.RequestUri.AbsoluteUri
    
    $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    Write-Host 'Content Length:' $content.Length
    Write-Host '--- FIRST 3000 CHARS ---'
    Write-Host $content.Substring(0, [Math]::Min(3000, $content.Length))
    
    # Check for any Set-Cookie headers
    Write-Host '--- COOKIES ---'
    foreach ($cookie in $handler.CookieContainer.GetCookies([Uri]'https://www.myheritage.com')) {
        Write-Host $cookie.Name '=' $cookie.Value
    }
    
    if ($content.Length -gt 0) {
        [System.IO.File]::WriteAllText('C:\xampp\htdocs\familytree\myheritage_page2.html', $content)
        Write-Host 'File saved successfully.'
    }
} catch {
    Write-Host 'Error:' $_.Exception.Message
    if ($_.Exception.InnerException) {
        Write-Host 'Inner Error:' $_.Exception.InnerException.Message
    }
} finally {
    $client.Dispose()
}