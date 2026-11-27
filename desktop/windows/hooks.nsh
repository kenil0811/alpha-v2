; The setup program's own steps around Alpha's: it puts the app in the person's own apps folder and
; opens it, and Alpha's Install window does the rest (WSL, Alpha's Linux, the start at sign-in).
; Uninstalling, Alpha first saves its data on this PC (AlphaData\saved, which a later install
; offers to bring back) and removes its Linux and its entries; with the uninstaller's own "Delete
; the application data" ticked, nothing is saved and everything Alpha kept on this PC goes.
; (An update uninstalls the old app first, with /UPDATE: Alpha's Linux and its data stay.)
!macro NSIS_HOOK_PREUNINSTALL
  ${If} $UpdateMode <> 1
    ${If} $DeleteAppDataCheckboxState = 1
      ExecWait '"$INSTDIR\Alpha.exe" --uninstall --delete-data'
    ${Else}
      ExecWait '"$INSTDIR\Alpha.exe" --uninstall'
    ${EndIf}
  ${EndIf}
!macroend
