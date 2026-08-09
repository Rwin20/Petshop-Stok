@echo off
REM SSL Sertifika Olusturma Script'i
REM Windows icin OpenSSL gereklidir veya mkcert kullanabilirsiniz

echo.
echo ====================================
echo SSL Sertifika Olusturma
echo ====================================
echo.

REM Mkcert kontrolu
where mkcert >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo mkcert bulundu, sertifikalar olusturuluyor...
    mkcert -key-file key.pem -cert-file cert.pem localhost 127.0.0.1 ::1 %COMPUTERNAME%
    for /f "tokens=*" %%i in ('powershell -command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notmatch 'Loopback'}).IPAddress"') do (
        mkcert -key-file key.pem -cert-file cert.pem localhost 127.0.0.1 ::1 %%i
    )
    echo.
    echo Sertifikalar olusturuldu!
    goto :done
)

REM OpenSSL kontrolu
where openssl >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo OpenSSL bulundu, sertifikalar olusturuluyor...
    openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
    echo.
    echo Sertifikalar olusturuldu!
    goto :done
)

echo HATA: mkcert veya openssl bulunamadi!
echo.
echo Asagidaki seceneklerden birini kullanin:
echo.
echo 1) mkcert (Onerilen):
echo    - https://github.com/FiloSottile/mkcert adresinden indirin
echo    - mkcert -install
echo    - Bu script'i tekrar calistirin
echo.
echo 2) PowerShell'de bu komutu calistirin:
echo    powershell -ExecutionPolicy Bypass -File generate-cert.ps1
echo.
pause
exit /b 1

:done
echo.
echo Simdi uygulamayi yeniden baslatarak HTTPS kullanabilirsiniz.
pause
