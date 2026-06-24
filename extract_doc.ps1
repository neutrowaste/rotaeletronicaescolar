$xmlPath = Join-Path $PSScriptRoot "docx_extract\word\document.xml"
$content = [System.IO.File]::ReadAllText($xmlPath)
$matches = [regex]::Matches($content, '<w:t[^>]*>([^<]*)</w:t>')
$text = ($matches | ForEach-Object { $_.Groups[1].Value }) -join ''
$text | Out-File (Join-Path $PSScriptRoot "doc_text.txt") -Encoding UTF8
