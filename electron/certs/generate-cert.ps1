# SSL Sertifika Olusturma - PowerShell
# Bu script self-signed sertifika olusturur

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "SSL Sertifika Olusturma (PowerShell)" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# IP adresini bul
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169\.' } | Select-Object -First 1).IPAddress

Write-Host "Yerel IP: $localIP" -ForegroundColor Yellow

# Powershell ile sertifika olustur
$cert = New-SelfSignedCertificate `
    -DnsName "localhost", $env:COMPUTERNAME, $localIP `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -KeyExportPolicy Exportable `
    -KeySpec Signature `
    -KeyLength 2048 `
    -HashAlgorithm SHA256 `
    -NotAfter (Get-Date).AddYears(1)

Write-Host "Sertifika olusturuldu: $($cert.Thumbprint)" -ForegroundColor Green

# PEM formatina cevir
$certPath = "cert.pem"
$keyPath = "key.pem"

# Sertifikayi export et
$certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
$certBase64 = [System.Convert]::ToBase64String($certBytes, [System.Base64FormattingOptions]::InsertLineBreaks)
$certPem = "-----BEGIN CERTIFICATE-----`n$certBase64`n-----END CERTIFICATE-----"
$certPem | Out-File -FilePath $certPath -Encoding ASCII

# Private key'i export et (PKCS8 formatinda)
$keyBytes = $cert.PrivateKey.Key.Export([System.Security.Cryptography.CngKeyBlobFormat]::Pkcs8PrivateBlob)
$keyBase64 = [System.Convert]::ToBase64String($keyBytes, [System.Base64FormattingOptions]::InsertLineBreaks)
$keyPem = "-----BEGIN PRIVATE KEY-----`n$keyBase64`n-----END PRIVATE KEY-----"
$keyPem | Out-File -FilePath $keyPath -Encoding ASCII

Write-Host ""
Write-Host "Sertifikalar olusturuldu:" -ForegroundColor Green
Write-Host "  - $certPath" -ForegroundColor White
Write-Host "  - $keyPath" -ForegroundColor White
Write-Host ""
Write-Host "ONEMLI: Telefonunuzda $("https://" + $localIP + ":3000") adresine gittiginde" -ForegroundColor Yellow
Write-Host "         'Guvenli degil' uyarisi cikacak, 'Gelismis' ve 'Devam et' diyerek gecin." -ForegroundColor Yellow
Write-Host ""
Write-Host "Uygulamayi yeniden baslatin: npm run dev" -ForegroundColor Cyan
