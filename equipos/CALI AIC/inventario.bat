@echo off
setlocal

:: Timestamp limpio
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "(Get-Date).ToString('yyyy-MM-dd_HH-mm-ss')"`) do set TS=%%A

set OUTPUT=Inventario_%COMPUTERNAME%_%TS%.txt

echo Generando inventario...

echo =============================== > "%OUTPUT%"
echo  INVENTARIO DE EQUIPO %COMPUTERNAME% >> "%OUTPUT%"
echo  Fecha: %DATE% - Hora: %TIME% >> "%OUTPUT%"
echo =============================== >> "%OUTPUT%"

:: ==== SERIAL DEL EQUIPO ====
echo. >> "%OUTPUT%"
echo ==== SERIAL DEL EQUIPO ==== >> "%OUTPUT%"
powershell -NoProfile -Command ^
 "Get-CimInstance Win32_BIOS | Select-Object SerialNumber | Format-List" >> "%OUTPUT%"


:: ==== INFORMACIÓN DEL SISTEMA ====
echo. >> "%OUTPUT%"
echo ==== INFORMACIÓN DEL SISTEMA ==== >> "%OUTPUT%"
systeminfo >> "%OUTPUT%"

:: ==== CPU ====
echo. >> "%OUTPUT%"
echo ==== CPU ==== >> "%OUTPUT%"
powershell -NoProfile -Command ^
 "Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed | Format-List" >> "%OUTPUT%"

:: ==== MEMORIA RAM ====
echo. >> "%OUTPUT%"
echo ==== MEMORIA RAM ==== >> "%OUTPUT%"
powershell -NoProfile -Command ^
 "Get-CimInstance Win32_PhysicalMemory | Select-Object Manufacturer,PartNumber,Capacity,Speed | Format-List" >> "%OUTPUT%"

:: ==== DISCO DURO ====
echo. >> "%OUTPUT%"
echo ==== DISCO DURO ==== >> "%OUTPUT%"
powershell -NoProfile -Command ^
 "Get-CimInstance Win32_DiskDrive | Select-Object Model,SerialNumber,Size,InterfaceType,MediaType | Format-List" >> "%OUTPUT%"

:: ==== PARTICIONES ====
echo. >> "%OUTPUT%"
echo ==== PARTICIONES ==== >> "%OUTPUT%"
powershell -NoProfile -Command ^
 "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,FileSystem,Size,FreeSpace,VolumeName | Format-List" >> "%OUTPUT%"

echo. >> "%OUTPUT%"
echo ==== FIN DEL INFORME ==== >> "%OUTPUT%"

echo Archivo generado: %OUTPUT%
pause
