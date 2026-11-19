Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = appDir

Dim nodeExe
If fso.FileExists(appDir & "\node.exe") Then
    nodeExe = """" & appDir & "\node.exe"""
Else
    nodeExe = "node"
End If

' If called with --browser-only, just open the browser after sleep
If WScript.Arguments.Count > 0 Then
    If WScript.Arguments(0) = "--browser-only" Then
        WScript.Sleep 2500
        WshShell.Run "http://localhost:4000"
        WScript.Quit
    End If
End If

' Normal launcher: run server in background and open browser
WshShell.Run "cmd /c " & nodeExe & " server/index.js", 0, False
WScript.Sleep 2500
WshShell.Run "http://localhost:4000"
