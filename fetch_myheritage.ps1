$headers = @{
    'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    'Accept' = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    'Accept-Language' = 'en-US,en;q=0.9'
    'Cache-Control' = 'no-cache'
    'Pragma' = 'no-cache'
}

try {
    $response = Invoke-WebRequest -Uri 'https://www.myheritage.com/family-sites/wairua/OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ?hcl=1&tr_date=20260816' -Headers $headers -UseBasicParsing -MaximumRedirection 5
    Write-Host 'Status:' $response.StatusCode
    Write-Host 'Final URL:' $response.BaseResponse.ResponseUri.AbsoluteUri
    Write-Host 'Content Length:' $response.Content.Length
    Write-Host '--- FIRST 5000 CHARS ---'
    $response.Content.Substring(0, [Math]::Min(5000, $response.Content.Length))
    [System.IO.File]::WriteAllText('C:\xampp\htdocs\familytree\myheritage_page.html', $response.Content)
    Write-Host ''
    Write-Host 'File saved successfully.'
} catch {
    Write-Host 'Error:' $_.Exception.Message
    if ($_.Exception.Response) {
        Write-Host 'Status Code:' $_.Exception.Response.StatusCode
        Write-Host 'Status Description:' $_.Exception.Response.StatusDescription
    }
}