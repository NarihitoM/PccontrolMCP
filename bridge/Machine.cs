using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Reflection;
using System.Windows.Forms;

public static class PcMachine
{
    const string BRIGHTNESS_MISSING = "Brightness control is not available. It only works on built-in laptop screens.";

    static List<Dictionary<string, object>> startApps;

    static object Call(object target, string member, BindingFlags kind, params object[] arguments)
    {
        return target.GetType().InvokeMember(member, kind, null, target, arguments);
    }

    public static List<Dictionary<string, object>> StartApps()
    {
        if (startApps != null) return startApps;

        object shell = Activator.CreateInstance(Type.GetTypeFromProgID("Shell.Application"));
        object folder = Call(shell, "NameSpace", BindingFlags.InvokeMethod, "shell:AppsFolder");
        object items = Call(folder, "Items", BindingFlags.InvokeMethod);

        List<Dictionary<string, object>> apps = new List<Dictionary<string, object>>();
        foreach (object item in (IEnumerable)items)
        {
            string name = Convert.ToString(Call(item, "Name", BindingFlags.GetProperty));
            string id = Convert.ToString(Call(item, "Path", BindingFlags.GetProperty));
            if (name.Length > 0 && id.Length > 0) apps.Add(new Dictionary<string, object> { { "name", name }, { "id", id } });
        }
        apps.Sort((a, b) => string.Compare((string)a["name"], (string)b["name"], StringComparison.OrdinalIgnoreCase));
        startApps = apps;
        return apps;
    }

    public static void StartApp(string id)
    {
        if (Path.IsPathRooted(id) && File.Exists(id))
        {
            Process.Start(new ProcessStartInfo(id) { UseShellExecute = true });
            return;
        }
        Process.Start("explorer.exe", "shell:AppsFolder\\" + id);
    }

    public static void Open(string target, bool mustExist)
    {
        if (mustExist && !File.Exists(target) && !Directory.Exists(target))
        {
            throw new FileNotFoundException("Path not found: " + target);
        }
        Process.Start(new ProcessStartInfo(target) { UseShellExecute = true });
    }

    static ManagementObject First(string scope, string query)
    {
        try
        {
            using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(scope, query))
            {
                foreach (ManagementObject item in searcher.Get()) return item;
            }
        }
        catch (ManagementException)
        {
            return null;
        }
        return null;
    }

    public static int GetBrightness()
    {
        ManagementObject monitor = First("root\\WMI", "SELECT CurrentBrightness FROM WmiMonitorBrightness");
        if (monitor == null) throw new NotSupportedException(BRIGHTNESS_MISSING);
        return Convert.ToInt32(monitor["CurrentBrightness"]);
    }

    public static void SetBrightness(int percent)
    {
        ManagementObject methods = First("root\\WMI", "SELECT * FROM WmiMonitorBrightnessMethods");
        if (methods == null) throw new NotSupportedException(BRIGHTNESS_MISSING);
        methods.InvokeMethod("WmiSetBrightness", new object[] { (uint)1, (byte)Math.Max(0, Math.Min(100, percent)) });
    }

    public static string GetClipboard()
    {
        return Clipboard.ContainsText() ? Clipboard.GetText() : "";
    }

    public static void SetClipboard(string text)
    {
        if (text.Length == 0) Clipboard.Clear();
        else Clipboard.SetText(text);
    }

    public static object Info()
    {
        ManagementObject os = First("root\\CIMV2", "SELECT Caption, Version, TotalVisibleMemorySize, FreePhysicalMemory, LastBootUpTime FROM Win32_OperatingSystem");
        ManagementObject cpu = First("root\\CIMV2", "SELECT Name, LoadPercentage FROM Win32_Processor");
        ManagementObject battery = First("root\\CIMV2", "SELECT EstimatedChargeRemaining, BatteryStatus FROM Win32_Battery");

        Dictionary<string, object> info = new Dictionary<string, object> { { "computer", Environment.MachineName } };
        if (os != null)
        {
            DateTime boot = ManagementDateTimeConverter.ToDateTime(Convert.ToString(os["LastBootUpTime"]));
            info["os"] = os["Caption"] + " " + os["Version"];
            info["memoryTotalMb"] = Convert.ToInt64(os["TotalVisibleMemorySize"]) / 1024;
            info["memoryFreeMb"] = Convert.ToInt64(os["FreePhysicalMemory"]) / 1024;
            info["uptimeMinutes"] = (long)(DateTime.Now - boot).TotalMinutes;
        }
        if (cpu != null)
        {
            info["cpu"] = Convert.ToString(cpu["Name"]).Trim();
            info["cpuLoad"] = cpu["LoadPercentage"] == null ? -1 : Convert.ToInt32(cpu["LoadPercentage"]);
        }
        if (battery != null)
        {
            info["batteryPercent"] = Convert.ToInt32(battery["EstimatedChargeRemaining"]);
            info["charging"] = Convert.ToInt32(battery["BatteryStatus"]) != 1;
        }
        return info;
    }

    public static void Sleep()
    {
        Application.SetSuspendState(PowerState.Suspend, false, false);
    }
}
