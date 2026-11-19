; Inno Setup Script for Coretax Enterprise Accounting
#define MyAppName "Coretax Enterprise Accounting"
#define MyAppVersion "2.6.0"
#define MyAppPublisher "Harry Sunaryo"
#define MyAppComments "Credit by Harry Sunaryo"
#define MyAppURL "https://github.com/sunaryo-harry/Accounting"
#define MyAppExeName "start-server.bat"

[Setup]
AppId={{7FCD77B2-9BCB-4CCF-AF6A-71D0F17F53B3}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppComments={#MyAppComments}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName=C:\CoretaxAccounting
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist
OutputBaseFilename=Setup-Coretax-Accounting-Enterprise-x64
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
CloseApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Dirs]
Name: "{app}"; Permissions: users-full
Name: "{app}\database"; Permissions: users-full
Name: "{app}\uploads"; Permissions: users-full

[Files]
Source: "..\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: ".git\*,dist\*,installer\*,*.tmp,database\*.sqlite-wal,database\*.sqlite-shm"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{#MyAppName} (Jalankan di Latar Belakang)"; Filename: "{app}\AccountingEnterprise.vbs"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "netsh.exe"; Parameters: "advfirewall firewall add rule name=""Accounting Enterprise Server (Port 4000)"" dir=in action=allow protocol=TCP localport=4000"; Flags: runhidden
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: shellexec postinstall nowait skipifsilent
