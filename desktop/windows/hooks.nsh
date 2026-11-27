; The setup program's own steps around Alpha's: it puts the app in the person's own apps folder and
; opens it, and Alpha's Install window does the rest (WSL, Alpha's Linux, the start at sign-in).
; Uninstalling, Alpha first saves its data in Documents and removes its Linux and its entries.
; (An update uninstalls the old app first, with /UPDATE: Alpha's Linux and its data stay.)
!macro NSIS_HOOK_PREUNINSTALL
  ${If} $UpdateMode <> 1
    ExecWait '"$INSTDIR\Alpha.exe" --uninstall'
  ${EndIf}
!macroend
