using System;
using System.Collections.Generic;
using System.Diagnostics;

public static class PcWindows
{
    const int SW_MAXIMIZE = 3;
    const int SW_MINIMIZE = 6;
    const int SW_RESTORE = 9;

    static string ProcessName(int processId)
    {
        try
        {
            return Process.GetProcessById(processId).ProcessName;
        }
        catch (ArgumentException)
        {
            return "";
        }
    }

    public static Dictionary<string, object> Info(PcWindow window)
    {
        return new Dictionary<string, object>
        {
            { "handle", window.Handle }, { "title", window.Title }, { "process", ProcessName(window.ProcessId) },
            { "x", window.X }, { "y", window.Y }, { "width", window.Width }, { "height", window.Height },
            { "minimized", window.Minimized }, { "maximized", window.Maximized },
        };
    }

    public static object List(PcArgs args)
    {
        List<Dictionary<string, object>> windows = new List<Dictionary<string, object>>();
        foreach (PcWindow window in PcNative.ListWindows()) windows.Add(Info(window));
        return new Dictionary<string, object> { { "foreground", PcNative.ForegroundHandle() }, { "windows", windows } };
    }

    static PcWindow Find(PcArgs args)
    {
        PcWindow[] windows = PcNative.ListWindows();
        if (args.Has("handle"))
        {
            long handle = args.Long("handle");
            foreach (PcWindow window in windows)
            {
                if (window.Handle == handle) return window;
            }
            throw new ArgumentException("No open window with handle " + handle + ". Call list_windows again.");
        }

        string query = args.Str("query");
        foreach (PcWindow window in windows)
        {
            if (window.Title.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0) return window;
        }
        foreach (PcWindow window in windows)
        {
            if (ProcessName(window.ProcessId).IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0) return window;
        }
        throw new ArgumentException("No open window matches '" + query + "'. Call list_windows to see what is open.");
    }

    public static object Focus(PcArgs args)
    {
        PcWindow window = Find(args);
        bool focused = PcNative.Focus(window.Handle);
        return new Dictionary<string, object> { { "window", Info(window) }, { "focused", focused } };
    }

    public static object Act(PcArgs args)
    {
        PcWindow window = Find(args);
        string action = args.Str("action");
        if (action == "minimize") PcNative.Show(window.Handle, SW_MINIMIZE);
        else if (action == "maximize") PcNative.Show(window.Handle, SW_MAXIMIZE);
        else if (action == "restore") PcNative.Show(window.Handle, SW_RESTORE);
        else if (action == "close") PcNative.Close(window.Handle);
        else throw new ArgumentException("Unknown window action: " + action);
        return PcBridge.Result("window", Info(window));
    }
}
