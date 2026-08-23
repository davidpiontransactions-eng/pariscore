$ErrorActionPreference = 'SilentlyContinue'
$Out = 'C:\Users\David\ZCodeProject\pariscore\.gitcreds.tmp'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public class CredEnum {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public uint Flags; public uint Type; public IntPtr TargetName; public IntPtr Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize; public IntPtr CredentialBlob; public uint Persist;
    public uint AttributeCount; public IntPtr Attributes; public IntPtr TargetAlias; public IntPtr UserName;
  }
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredEnumerate(string Filter, uint Flags, out uint Count, out IntPtr Credentials);
  [DllImport("advapi32.dll")]
  public static extern void CredFree(IntPtr cred);
}
'@

$count = 0
$list = [IntPtr]::Zero
if ([CredEnum]::CredEnumerate($null, 0, [ref]$count, [ref]$list)) {
  $items = New-Object System.IntPtr[] $count
  [System.Runtime.InteropServices.Marshal]::Copy($list, $items, 0, $count)
  foreach ($p in $items) {
    $c = [System.Runtime.InteropServices.Marshal]::PtrToStructure($p, [type][CredEnum+CREDENTIAL])
    $t = [System.Runtime.InteropServices.Marshal]::PtrToStringUni($c.TargetName)
    if ($t -match 'github|git:') {
      $u = [System.Runtime.InteropServices.Marshal]::PtrToStringUni($c.UserName)
      $bs = [int]$c.CredentialBlobSize
      Write-Output ("TARGET=" + $t + "  type=" + $c.Type + "  user=" + $u + "  blob=" + $bs)
    }
  }
  [CredEnum]::CredFree($list)
} else {
  Write-Output "ENUM_FAIL"
}
