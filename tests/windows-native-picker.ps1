param([int]$AppProcessId,[string]$FilePath,[string]$Screenshot,[switch]$Cancel)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$dialog = $null
for ($attempt = 0; $attempt -lt 60; $attempt++) {
  $all = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ClassNameProperty,'#32770'))
  foreach ($candidate in $all) { if ($candidate.Current.ProcessId -eq $AppProcessId) { $dialog = $candidate; break } }
  if ($null -ne $dialog) { break }
  Start-Sleep -Milliseconds 250
}
if ($null -eq $dialog) { throw 'The actual native Windows file picker was not found for the owned application.' }
if ($Screenshot) {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bitmap = [System.Drawing.Bitmap]::new($bounds.Width,$bounds.Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try { $graphics.CopyFromScreen($bounds.Location,[System.Drawing.Point]::Empty,$bounds.Size);$bitmap.Save($Screenshot,[System.Drawing.Imaging.ImageFormat]::Png) } finally { $graphics.Dispose();$bitmap.Dispose() }
}
if (!$Cancel) {
  $edits = $dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Edit))
  $value = $null
  foreach ($edit in $edits) {
    try { $pattern = $edit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern);if (!$pattern.Current.IsReadOnly -and $edit.Current.IsEnabled) { $value = $pattern;if ($edit.Current.AutomationId -match '^(1148|1001)$' -or $edit.Current.Name -match '^File name:?$') { break } } } catch {}
  }
  if ($null -eq $value) { throw 'Native file name field is not editable.' }
  $value.SetValue($FilePath)
}
$id = if ($Cancel) { '2' } else { '1' }
$button = $dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty,$id))
if ($null -eq $button) { throw 'Native Open/Cancel button is missing.' }
$button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
Write-Output $(if ($Cancel) { 'PASS native Windows picker cancellation' } else { 'PASS native Windows file selection' })
