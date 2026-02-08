# Generate self-signed SSL certificate for development (Windows)

$certDir = ".\ssl"
if (-not (Test-Path $certDir)) {
    New-Item -ItemType Directory -Path $certDir | Out-Null
}

Write-Host "Generating self-signed SSL certificate for development..." -ForegroundColor Cyan

# Create certificate using New-SelfSignedCertificate
$cert = New-SelfSignedCertificate `
    -DnsName "localhost", "127.0.0.1" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddYears(1) `
    -KeyUsage DigitalSignature, KeyEncipherment `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -HashAlgorithm SHA256 `
    -Subject "CN=localhost"

# Export certificate
$certPath = Join-Path $certDir "nginx-selfsigned.crt"
$keyPath = Join-Path $certDir "nginx-selfsigned.key"

# Export as PEM format
Export-Certificate -Cert $cert -FilePath "$certDir\temp.cer" | Out-Null
$certPem = Get-Content "$certDir\temp.cer" -Encoding Byte
[System.IO.File]::WriteAllText($certPath, "-----BEGIN CERTIFICATE-----`n")
[System.IO.File]::AppendAllText($certPath, [System.Convert]::ToBase64String($certPem, 'InsertLineBreaks'))
[System.IO.File]::AppendAllText($certPath, "`n-----END CERTIFICATE-----`n")
Remove-Item "$certDir\temp.cer"

# Export private key (requires password)
$password = ConvertTo-SecureString -String "temp" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "$certDir\temp.pfx" -Password $password | Out-Null

# Convert PFX to PEM key using OpenSSL (if available)
if (Get-Command openssl -ErrorAction SilentlyContinue) {
    & openssl pkcs12 -in "$certDir\temp.pfx" -nocerts -out $keyPath -nodes -passin pass:temp 2>$null
    Remove-Item "$certDir\temp.pfx"
    
    Write-Host "✅ SSL certificate generated at $certDir" -ForegroundColor Green
    Write-Host "   - Certificate: nginx-selfsigned.crt" -ForegroundColor White
    Write-Host "   - Key: nginx-selfsigned.key" -ForegroundColor White
} else {
    Write-Host "⚠️  OpenSSL not found. Using Docker to convert certificate..." -ForegroundColor Yellow
    
    # Use Docker with OpenSSL image to convert
    docker run --rm -v "${PWD}/ssl:/certs" alpine/openssl pkcs12 -in /certs/temp.pfx -nocerts -out /certs/nginx-selfsigned.key -nodes -passin pass:temp
    Remove-Item "$certDir\temp.pfx"
    
    Write-Host "✅ SSL certificate generated at $certDir" -ForegroundColor Green
    Write-Host "   - Certificate: nginx-selfsigned.crt" -ForegroundColor White
    Write-Host "   - Key: nginx-selfsigned.key" -ForegroundColor White
}

# Remove from certificate store
Remove-Item -Path "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force

Write-Host "`n⚠️  This is a self-signed certificate for development only!" -ForegroundColor Yellow
