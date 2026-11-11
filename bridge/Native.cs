using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public class PcWindow
{
    public long Handle;
    public string Title;
    public int ProcessId;
    public int X;
    public int Y;
    public int Width;
    public int Height;
    public bool Minimized;
    public bool Maximized;
}

public static class PcNative
{
    [StructLayout(LayoutKind.Sequential)]
    struct POINT { public int X; public int Y; }

    [StructLayout(LayoutKind.Sequential)]
    struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }

    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }

    [StructLayout(LayoutKind.Explicit)]
    struct INPUTUNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }

    [StructLayout(LayoutKind.Sequential)]
    struct INPUT { public uint type; public INPUTUNION u; }

    delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint count, INPUT[] inputs, int size);
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT point);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hWnd, int command);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int max);
    [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hWnd, uint command);
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr hWnd, int index);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] static extern bool LockWorkStation();
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr hWnd, int attribute, out int value, int size);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr hWnd, int attribute, out RECT value, int size);

    const uint INPUT_MOUSE = 0;
    const uint INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint KEYEVENTF_UNICODE = 0x0004;
    const uint MOUSEEVENTF_WHEEL = 0x0800;
    const uint MOUSEEVENTF_HWHEEL = 0x1000;
    const int WHEEL_DELTA = 120;
    const int GWL_EXSTYLE = -20;
    const int WS_EX_TOOLWINDOW = 0x00000080;
    const uint GW_OWNER = 4;
    const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
    const int DWMWA_CLOAKED = 14;
    const uint WM_CLOSE = 0x0010;
    const ushort VK_RETURN = 0x0D;
    const ushort VK_TAB = 0x09;
    const ushort VK_MENU = 0x12;
    const int MIN_GLIDE_MS = 120;
    const int MAX_GLIDE_MS = 700;
    const int GLIDE_STEP_MS = 8;
    const int MAX_TYPING_MS = 25000;
    const int MIN_SCROLL_MS = 200;
    const int MAX_SCROLL_MS = 1500;
    const int KEY_STEP_MS = 45;
    const int KEY_HOLD_MS = 70;

    static readonly Random Jitter = new Random();

    static readonly HashSet<ushort> ExtendedKeys = new HashSet<ushort> {
        0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2D, 0x2E, 0x5B, 0x5C, 0x5D, 0x6F, 0x90, 0xA3, 0xA5
    };

    public static void EnableDpiAwareness()
    {
        try
        {
            if (SetProcessDpiAwarenessContext(new IntPtr(-4))) return;
        }
        catch (EntryPointNotFoundException)
        {
        }
        SetProcessDPIAware();
    }

    static INPUT Mouse(uint flags, uint data)
    {
        INPUT input = new INPUT();
        input.type = INPUT_MOUSE;
        input.u.mi.dwFlags = flags;
        input.u.mi.mouseData = data;
        return input;
    }

    static INPUT Key(ushort vk, ushort scan, uint flags)
    {
        INPUT input = new INPUT();
        input.type = INPUT_KEYBOARD;
        input.u.ki.wVk = vk;
        input.u.ki.wScan = scan;
        input.u.ki.dwFlags = flags;
        return input;
    }

    static INPUT VirtualKey(ushort vk, bool up)
    {
        uint flags = up ? KEYEVENTF_KEYUP : 0;
        if (ExtendedKeys.Contains(vk)) flags |= KEYEVENTF_EXTENDEDKEY;
        return Key(vk, 0, flags);
    }

    static void Send(List<INPUT> inputs)
    {
        if (inputs.Count == 0) return;
        uint sent = SendInput((uint)inputs.Count, inputs.ToArray(), Marshal.SizeOf(typeof(INPUT)));
        if (sent != inputs.Count)
        {
            throw new InvalidOperationException("Windows blocked the input. The target window may be running as administrator.");
        }
    }

    public static int[] CursorPosition()
    {
        POINT point;
        GetCursorPos(out point);
        return new int[] { point.X, point.Y };
    }

    static double EaseInOut(double t)
    {
        return t < 0.5 ? 2 * t * t : 1 - Math.Pow(-2 * t + 2, 2) / 2;
    }

    static void Glide(int x, int y)
    {
        POINT start;
        GetCursorPos(out start);
        double dx = x - start.X;
        double dy = y - start.Y;
        double distance = Math.Sqrt(dx * dx + dy * dy);
        if (distance < 2)
        {
            SetCursorPos(x, y);
            return;
        }

        int duration = (int)Math.Min(MAX_GLIDE_MS, MIN_GLIDE_MS + distance * 0.35);
        double bend = Math.Min(60, distance * 0.08) * (Jitter.Next(2) == 0 ? -1 : 1);
        double normalX = -dy / distance;
        double normalY = dx / distance;
        Stopwatch watch = Stopwatch.StartNew();

        while (true)
        {
            double t = Math.Min(1.0, watch.ElapsedMilliseconds / (double)duration);
            double eased = EaseInOut(t);
            double arc = Math.Sin(Math.PI * eased) * bend;
            SetCursorPos((int)Math.Round(start.X + dx * eased + normalX * arc), (int)Math.Round(start.Y + dy * eased + normalY * arc));
            if (t >= 1.0) break;
            Thread.Sleep(GLIDE_STEP_MS);
        }
        SetCursorPos(x, y);
    }

    public static void MoveCursor(int x, int y, bool animate)
    {
        if (animate) Glide(x, y);
        else SetCursorPos(x, y);
    }

    public static void Click(int x, int y, string button, int count, bool animate)
    {
        uint down = 0x0002;
        uint up = 0x0004;
        if (button == "right") { down = 0x0008; up = 0x0010; }
        else if (button == "middle") { down = 0x0020; up = 0x0040; }

        MoveCursor(x, y, animate);
        Thread.Sleep(animate ? 90 : 30);
        for (int i = 0; i < count; i++)
        {
            Send(new List<INPUT> { Mouse(down, 0) });
            if (animate) Thread.Sleep(50);
            Send(new List<INPUT> { Mouse(up, 0) });
            if (i < count - 1) Thread.Sleep(60);
        }
    }

    public static void Drag(int x1, int y1, int x2, int y2, int durationMs, bool animate)
    {
        int steps = Math.Max(5, durationMs / 15);
        MoveCursor(x1, y1, animate);
        Thread.Sleep(animate ? 90 : 30);
        Send(new List<INPUT> { Mouse(0x0002, 0) });
        for (int i = 1; i <= steps; i++)
        {
            double t = animate ? EaseInOut((double)i / steps) : (double)i / steps;
            SetCursorPos((int)Math.Round(x1 + (x2 - x1) * t), (int)Math.Round(y1 + (y2 - y1) * t));
            Thread.Sleep(Math.Max(1, durationMs / steps));
        }
        if (animate) Thread.Sleep(60);
        Send(new List<INPUT> { Mouse(0x0004, 0) });
    }

    public static void Scroll(int amount, bool horizontal, bool animate)
    {
        uint flags = horizontal ? MOUSEEVENTF_HWHEEL : MOUSEEVENTF_WHEEL;
        if (!animate)
        {
            Send(new List<INPUT> { Mouse(flags, unchecked((uint)(amount * WHEEL_DELTA))) });
            return;
        }

        int total = Math.Abs(amount) * WHEEL_DELTA;
        int direction = amount < 0 ? -1 : 1;
        int steps = Math.Min(60, Math.Abs(amount) * 8);
        int duration = Math.Min(MAX_SCROLL_MS, MIN_SCROLL_MS + Math.Abs(amount) * 90);
        int sent = 0;

        for (int i = 1; i <= steps; i++)
        {
            int target = (int)Math.Round(total * EaseInOut((double)i / steps));
            int delta = target - sent;
            if (delta > 0) Send(new List<INPUT> { Mouse(flags, unchecked((uint)(direction * delta))) });
            sent = target;
            Thread.Sleep(Math.Max(1, duration / steps));
        }
    }

    static void AppendChar(List<INPUT> inputs, char c)
    {
        if (c == '\n' || c == '\r')
        {
            inputs.Add(VirtualKey(VK_RETURN, false));
            inputs.Add(VirtualKey(VK_RETURN, true));
        }
        else if (c == '\t')
        {
            inputs.Add(VirtualKey(VK_TAB, false));
            inputs.Add(VirtualKey(VK_TAB, true));
        }
        else
        {
            inputs.Add(Key(0, c, KEYEVENTF_UNICODE));
            inputs.Add(Key(0, c, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP));
        }
    }

    static int KeystrokePause(int delayMs, char c)
    {
        double pause = delayMs * (0.6 + Jitter.NextDouble() * 0.8);
        if (c == ' ' || c == '\n' || c == ',' || c == '.') pause *= 1.8;
        return (int)Math.Max(1, pause);
    }

    public static void TypeText(string text, int delayMs)
    {
        string normalized = text.Replace("\r\n", "\n");
        int delay = normalized.Length == 0 ? 0 : Math.Min(delayMs, MAX_TYPING_MS / normalized.Length);

        if (delay < 1)
        {
            List<INPUT> inputs = new List<INPUT>();
            foreach (char c in normalized) AppendChar(inputs, c);
            Send(inputs);
            return;
        }

        for (int i = 0; i < normalized.Length; i++)
        {
            List<INPUT> inputs = new List<INPUT>();
            char c = normalized[i];
            AppendChar(inputs, c);
            if (char.IsHighSurrogate(c) && i + 1 < normalized.Length)
            {
                i++;
                AppendChar(inputs, normalized[i]);
            }
            Send(inputs);
            Thread.Sleep(KeystrokePause(delay, c));
        }
    }

    public static void PressKeys(int[] keys, int repeat, bool animate)
    {
        for (int r = 0; r < repeat; r++)
        {
            if (animate)
            {
                foreach (int key in keys)
                {
                    Send(new List<INPUT> { VirtualKey((ushort)key, false) });
                    Thread.Sleep(KEY_STEP_MS);
                }
                Thread.Sleep(KEY_HOLD_MS);
                for (int i = keys.Length - 1; i >= 0; i--)
                {
                    Send(new List<INPUT> { VirtualKey((ushort)keys[i], true) });
                    Thread.Sleep(KEY_STEP_MS / 2);
                }
                if (r < repeat - 1) Thread.Sleep(120);
                continue;
            }

            List<INPUT> inputs = new List<INPUT>();
            foreach (int key in keys) inputs.Add(VirtualKey((ushort)key, false));
            for (int i = keys.Length - 1; i >= 0; i--) inputs.Add(VirtualKey((ushort)keys[i], true));
            Send(inputs);
            if (r < repeat - 1) Thread.Sleep(40);
        }
    }

    static bool IsCloaked(IntPtr hWnd)
    {
        int cloaked;
        return DwmGetWindowAttribute(hWnd, DWMWA_CLOAKED, out cloaked, sizeof(int)) == 0 && cloaked != 0;
    }

    static string TitleOf(IntPtr hWnd)
    {
        int length = GetWindowTextLength(hWnd);
        if (length == 0) return "";
        StringBuilder builder = new StringBuilder(length + 1);
        GetWindowText(hWnd, builder, builder.Capacity);
        return builder.ToString();
    }

    public static PcWindow Describe(IntPtr hWnd)
    {
        RECT rect;
        if (DwmGetWindowAttribute(hWnd, DWMWA_EXTENDED_FRAME_BOUNDS, out rect, Marshal.SizeOf(typeof(RECT))) != 0)
        {
            GetWindowRect(hWnd, out rect);
        }
        uint processId;
        GetWindowThreadProcessId(hWnd, out processId);
        PcWindow window = new PcWindow();
        window.Handle = hWnd.ToInt64();
        window.Title = TitleOf(hWnd);
        window.ProcessId = (int)processId;
        window.X = rect.Left;
        window.Y = rect.Top;
        window.Width = rect.Right - rect.Left;
        window.Height = rect.Bottom - rect.Top;
        window.Minimized = IsIconic(hWnd);
        window.Maximized = IsZoomed(hWnd);
        return window;
    }

    public static PcWindow[] ListWindows()
    {
        List<PcWindow> windows = new List<PcWindow>();
        EnumWindows(delegate (IntPtr hWnd, IntPtr lParam)
        {
            if (!IsWindowVisible(hWnd) || IsCloaked(hWnd)) return true;
            if (GetWindow(hWnd, GW_OWNER) != IntPtr.Zero) return true;
            if ((GetWindowLong(hWnd, GWL_EXSTYLE) & WS_EX_TOOLWINDOW) != 0) return true;
            if (GetWindowTextLength(hWnd) == 0) return true;
            windows.Add(Describe(hWnd));
            return true;
        }, IntPtr.Zero);
        return windows.ToArray();
    }

    public static long ForegroundHandle()
    {
        return GetForegroundWindow().ToInt64();
    }

    static IntPtr Require(long handle)
    {
        IntPtr hWnd = new IntPtr(handle);
        if (!IsWindow(hWnd)) throw new ArgumentException("Window " + handle + " no longer exists. Call list_windows again.");
        return hWnd;
    }

    public static bool Focus(long handle)
    {
        IntPtr hWnd = Require(handle);
        if (IsIconic(hWnd)) ShowWindow(hWnd, 9);
        Send(new List<INPUT> { VirtualKey(VK_MENU, false), VirtualKey(VK_MENU, true) });
        BringWindowToTop(hWnd);
        SetForegroundWindow(hWnd);
        Thread.Sleep(80);
        return GetForegroundWindow() == hWnd;
    }

    public static void Show(long handle, int command)
    {
        ShowWindow(Require(handle), command);
    }

    public static void Close(long handle)
    {
        PostMessage(Require(handle), WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
    }

    public static bool Lock()
    {
        return LockWorkStation();
    }
}
