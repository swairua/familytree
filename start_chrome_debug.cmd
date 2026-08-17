@echo off
echo ======================================================
echo  Starting Chrome with Remote Debugging Enabled
echo ======================================================
echo.
echo This will allow MyHeritage extraction to access
echo your real Chrome session and cookies.
echo.
echo IMPORTANT: Close all other Chrome windows first!
echo Press any key to continue...
pause >nul

echo.
echo Starting Chrome with debugging port 9222...
echo A new Chrome window will open. Please:
echo   1. Log into MyHeritage if needed
echo   2. Visit your family site
echo   3. Leave this window open
echo.
echo Then run: node fetch_myheritage_full.mjs
echo.

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 "https://www.myheritage.com/family-sites/wairua/OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ?hcl=1&tr_date=20260816"

echo Chrome started. This window will close in 5 seconds...
timeout /t 5 >nul
exit