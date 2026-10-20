; GPL-3.0-or-later. Added 2026-10-20.
; Only NSIS core instructions and its bundled MUI2/nsDialogs (zlib) are used.
Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
Name "象棋屏幕助手"
OutFile "@@OUTPUT@@"
InstallDir "$LOCALAPPDATA\Programs\xiangqi-position-assistant"
InstallDirRegKey HKCU "Software\XiangqiScreenAssistant" "InstallDir"
RequestExecutionLevel user
SetCompressor zlib
SetOverwrite on
VIProductVersion "@@VERSION_QUAD@@"
VIAddVersionKey /LANG=1033 "ProductName" "象棋屏幕助手"
VIAddVersionKey /LANG=1033 "FileDescription" "象棋屏幕助手安装程序"
VIAddVersionKey /LANG=1033 "ProductVersion" "@@VERSION@@"
VIAddVersionKey /LANG=1033 "FileVersion" "@@VERSION@@"
VIAddVersionKey /LANG=1033 "LegalCopyright" "GPL-3.0-or-later; see included third-party notices"
Icon "@@ROOT@@/desktop/icon.ico"
UninstallIcon "@@ROOT@@/desktop/icon.ico"
!define MUI_ABORTWARNING
!define MUI_ICON "@@ROOT@@/desktop/icon.ico"
!define MUI_UNICON "@@ROOT@@/desktop/icon.ico"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "@@ROOT@@/LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\象棋屏幕助手.exe"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

Section "象棋屏幕助手" Main
SetShellVarContext current
@@INSTALL_FILES@@
SetOutPath "$INSTDIR"
WriteUninstaller "$INSTDIR\Uninstall.exe"
WriteRegStr HKCU "Software\XiangqiScreenAssistant" "InstallDir" "$INSTDIR"
WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\org.xiangqi.positionassistant" "DisplayName" "象棋屏幕助手"
WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\org.xiangqi.positionassistant" "DisplayVersion" "@@VERSION@@"
WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\org.xiangqi.positionassistant" "InstallLocation" "$INSTDIR"
WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\org.xiangqi.positionassistant" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\org.xiangqi.positionassistant" "DisplayIcon" "$INSTDIR\象棋屏幕助手.exe"
WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\org.xiangqi.positionassistant" "NoModify" 1
WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\org.xiangqi.positionassistant" "NoRepair" 1
CreateShortcut "$DESKTOP\象棋屏幕助手.lnk" "$INSTDIR\象棋屏幕助手.exe"
CreateShortcut "$SMPROGRAMS\象棋屏幕助手.lnk" "$INSTDIR\象棋屏幕助手.exe"
SectionEnd

Section "Uninstall"
SetShellVarContext current
SetOutPath "$TEMP"
@@REMOVE_FILES@@
Delete "$DESKTOP\象棋屏幕助手.lnk"
Delete "$SMPROGRAMS\象棋屏幕助手.lnk"
Delete "$INSTDIR\Uninstall.exe"
RMDir "$INSTDIR"
DeleteRegKey HKCU "Software\XiangqiScreenAssistant"
DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\org.xiangqi.positionassistant"
SectionEnd
