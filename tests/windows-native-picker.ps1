param([int]$AppProcessId,[long]$AppWindowHandle,[string]$FilePath,[string]$Screenshot,[switch]$Cancel)
$ErrorActionPreference = 'Stop'
# Enumerate actual native HWNDs, avoiding a blocking accessibility-tree walk in Chromium.
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class MooZNativePicker {
  public delegate bool Callback(IntPtr h,IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumWindows(Callback cb,IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr h,Callback cb,IntPtr p);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder b,int n);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h,StringBuilder b,int n);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h,uint kind);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetDlgItem(IntPtr h,int id);
  [DllImport("user32.dll")] static extern int GetDlgCtrlID(IntPtr h);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr SendMessageTimeout(IntPtr h,uint m,IntPtr w,string text,uint flags,uint timeout,out IntPtr result);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h,uint m,IntPtr w,IntPtr l);
  static string Class(IntPtr h){var s=new StringBuilder(256);GetClassName(h,s,s.Capacity);return s.ToString();}
  static bool Owned(IntPtr h,uint pid,IntPtr appWindow){for(int n=0;n<12&&h!=IntPtr.Zero;n++){uint p;GetWindowThreadProcessId(h,out p);if(p==pid||h==appWindow)return true;h=GetWindow(h,4);}return false;}
  public static IntPtr Find(uint pid,IntPtr appWindow){IntPtr result=IntPtr.Zero;EnumWindows((h,p)=>{if(IsWindowVisible(h)&&Class(h)=="#32770"&&Owned(h,pid,appWindow)){result=h;return false;}return true;},IntPtr.Zero);return result;}
  public static string[] Dump(){var rows=new List<string>();EnumWindows((h,p)=>{uint pid;GetWindowThreadProcessId(h,out pid);var text=new StringBuilder(512);GetWindowText(h,text,text.Capacity);if(IsWindowVisible(h))rows.Add(pid+" | "+Class(h)+" | "+text);return true;},IntPtr.Zero);return rows.ToArray();}
  public static void Select(IntPtr dialog,string file,bool cancel){
    if(!cancel){IntPtr combo=GetDlgItem(dialog,1148),edit=IntPtr.Zero;
      if(combo!=IntPtr.Zero){if(Class(combo)=="Edit")edit=combo;else EnumChildWindows(combo,(h,p)=>{if(Class(h)=="Edit")edit=h;return true;},IntPtr.Zero);}
      if(edit==IntPtr.Zero)EnumChildWindows(dialog,(h,p)=>{if(Class(h)=="Edit"&&(edit==IntPtr.Zero||GetDlgCtrlID(h)==1001))edit=h;return true;},IntPtr.Zero);
      if(edit==IntPtr.Zero)throw new Exception("Native file name edit control is missing");IntPtr ignored;
      if(SendMessageTimeout(edit,12,IntPtr.Zero,file,2,3000,out ignored)==IntPtr.Zero)throw new Exception("Cannot type into the actual Windows file name control");
    }
    IntPtr button=GetDlgItem(dialog,cancel?2:1);if(button==IntPtr.Zero)throw new Exception("Native Open/Cancel button is missing");
    if(!PostMessage(button,245,IntPtr.Zero,IntPtr.Zero))throw new Exception("Cannot invoke the native picker button");
  }
}
'@
$dialog=[IntPtr]::Zero
$timer=[Diagnostics.Stopwatch]::StartNew()
while($timer.ElapsedMilliseconds -lt 15000){$dialog=[MooZNativePicker]::Find($AppProcessId,[IntPtr]$AppWindowHandle);if($dialog -ne [IntPtr]::Zero){break};Start-Sleep -Milliseconds 150}
if($Screenshot){
 Add-Type -AssemblyName System.Windows.Forms
 Add-Type -AssemblyName System.Drawing
 $bounds=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds
 $bitmap=[System.Drawing.Bitmap]::new($bounds.Width,$bounds.Height)
 $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
 try{$graphics.CopyFromScreen($bounds.Location,[System.Drawing.Point]::Empty,$bounds.Size);$bitmap.Save($Screenshot,[System.Drawing.Imaging.ImageFormat]::Png)}finally{$graphics.Dispose();$bitmap.Dispose()}
}
if($dialog -eq [IntPtr]::Zero){[MooZNativePicker]::Dump()|Write-Output;throw 'The actual native Windows file picker was not found for the owned application.'}
[MooZNativePicker]::Select($dialog,$FilePath,[bool]$Cancel)
for($attempt=0;$attempt -lt 50 -and [MooZNativePicker]::IsWindow($dialog);$attempt++){Start-Sleep -Milliseconds 100}
if([MooZNativePicker]::IsWindow($dialog)){throw 'The actual native picker did not close after Open/Cancel.'}
Write-Output $(if($Cancel){'PASS native Windows picker cancellation'}else{'PASS native Windows file selection'})
