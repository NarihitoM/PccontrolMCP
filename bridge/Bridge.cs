using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Text;
using System.Web.Script.Serialization;

public class PcArgs
{
    readonly Dictionary<string, object> values;

    public PcArgs(Dictionary<string, object> values)
    {
        this.values = values ?? new Dictionary<string, object>();
    }

    public bool Has(string key)
    {
        object value;
        return values.TryGetValue(key, out value) && value != null;
    }

    public int Int(string key, int fallback)
    {
        return Has(key) ? Convert.ToInt32(values[key]) : fallback;
    }

    public long Long(string key)
    {
        return Has(key) ? Convert.ToInt64(values[key]) : 0;
    }

    public bool Bool(string key, bool fallback)
    {
        return Has(key) ? Convert.ToBoolean(values[key]) : fallback;
    }

    public string Str(string key)
    {
        return Has(key) ? Convert.ToString(values[key]) : "";
    }

    public int[] Ints(string key)
    {
        object[] items = Has(key) ? values[key] as object[] : null;
        if (items == null) return new int[0];
        int[] result = new int[items.Length];
        for (int i = 0; i < items.Length; i++) result[i] = Convert.ToInt32(items[i]);
        return result;
    }
}

public static class PcBridge
{
    delegate object Operation(PcArgs args);

    static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = int.MaxValue, RecursionLimit = 64 };

    static readonly Dictionary<string, Operation> Operations = new Dictionary<string, Operation>
    {
        { "ping", a => Result("pong", true) },
        { "list_monitors", a => Result("monitors", PcScreen.Monitors()) },
        { "screenshot", PcScreen.Capture },
        { "get_ui", PcUi.Read },
        { "invoke_element", a => Result("invoked", PcUi.Invoke(a.Int("index", 0))) },
        { "focus_element", a => { PcUi.Focus(a.Int("index", 0)); return Done(); } },
        { "set_element_value", a => Result("set", PcUi.SetValue(a.Int("index", 0), a.Str("text"))) },
        { "move_mouse", a => { PcNative.MoveCursor(a.Int("x", 0), a.Int("y", 0), a.Bool("animate", false)); return Done(); } },
        { "click", a => { PcNative.Click(a.Int("x", 0), a.Int("y", 0), a.Str("button"), a.Int("count", 1), a.Bool("animate", false)); return Done(); } },
        { "drag", a => { PcNative.Drag(a.Int("x1", 0), a.Int("y1", 0), a.Int("x2", 0), a.Int("y2", 0), a.Int("durationMs", 400), a.Bool("animate", false)); return Done(); } },
        { "scroll", Scroll },
        { "type_text", a => { PcNative.TypeText(a.Str("text"), a.Int("delayMs", 0)); return Done(); } },
        { "press_keys", a => { PcNative.PressKeys(a.Ints("keys"), a.Int("repeat", 1), a.Bool("animate", false)); return Done(); } },
        { "list_windows", PcWindows.List },
        { "focus_window", PcWindows.Focus },
        { "window_action", PcWindows.Act },
        { "list_apps", a => Result("apps", PcMachine.StartApps()) },
        { "start_app", a => { PcMachine.StartApp(a.Str("id")); return Done(); } },
        { "start_program", a => { PcMachine.Open(a.Str("name"), false); return Done(); } },
        { "open_target", a => { PcMachine.Open(a.Str("target"), a.Str("kind") == "path"); return Done(); } },
        { "get_volume", a => Volume() },
        { "set_volume", SetVolume },
        { "get_brightness", a => Result("brightness", PcMachine.GetBrightness()) },
        { "set_brightness", a => { PcMachine.SetBrightness(a.Int("brightness", 50)); return Result("brightness", a.Int("brightness", 50)); } },
        { "get_clipboard", a => Result("text", PcMachine.GetClipboard()) },
        { "set_clipboard", a => { PcMachine.SetClipboard(a.Str("text")); return Done(); } },
        { "system_info", a => PcMachine.Info() },
        { "lock_screen", a => Result("locked", PcNative.Lock()) },
        { "sleep_pc", a => { PcMachine.Sleep(); return Done(); } },
    };

    public static Dictionary<string, object> Result(string key, object value)
    {
        return new Dictionary<string, object> { { key, value } };
    }

    static Dictionary<string, object> Done()
    {
        return Result("done", true);
    }

    static object Scroll(PcArgs a)
    {
        bool animate = a.Bool("animate", false);
        if (a.Has("x") && a.Has("y")) PcNative.MoveCursor(a.Int("x", 0), a.Int("y", 0), animate);
        PcNative.Scroll(a.Int("amount", 0), a.Bool("horizontal", false), animate);
        return Done();
    }

    static Dictionary<string, object> Volume()
    {
        return new Dictionary<string, object> { { "volume", PcAudio.GetVolume() }, { "muted", PcAudio.GetMute() } };
    }

    static object SetVolume(PcArgs a)
    {
        if (a.Has("volume")) PcAudio.SetVolume(a.Int("volume", 0));
        if (a.Has("muted")) PcAudio.SetMute(a.Bool("muted", false));
        return Volume();
    }

    static string Describe(Exception error)
    {
        while ((error is TargetInvocationException || error is AggregateException) && error.InnerException != null)
        {
            error = error.InnerException;
        }
        return error.Message;
    }

    static object Handle(string line, out object id)
    {
        id = 0;
        Dictionary<string, object> request = Json.DeserializeObject(line) as Dictionary<string, object>;
        if (request == null) throw new InvalidDataException("Request must be a JSON object.");
        if (request.ContainsKey("id")) id = request["id"];

        object name;
        request.TryGetValue("op", out name);
        Operation operation;
        if (name == null || !Operations.TryGetValue(Convert.ToString(name), out operation))
        {
            throw new InvalidDataException("Unknown operation: " + name);
        }

        object raw;
        request.TryGetValue("args", out raw);
        return operation(new PcArgs(raw as Dictionary<string, object>));
    }

    public static void Run()
    {
        PcNative.EnableDpiAwareness();
        UTF8Encoding utf8 = new UTF8Encoding(false);
        StreamReader input = new StreamReader(Console.OpenStandardInput(), utf8);
        StreamWriter output = new StreamWriter(Console.OpenStandardOutput(), utf8);
        output.AutoFlush = true;

        output.WriteLine(Json.Serialize(Result("ready", true)));

        string line;
        while ((line = input.ReadLine()) != null)
        {
            if (line.Trim().Length == 0) continue;
            object id = 0;
            Dictionary<string, object> reply;
            try
            {
                object result = Handle(line, out id);
                reply = new Dictionary<string, object> { { "id", id }, { "ok", true }, { "result", result } };
            }
            catch (Exception error)
            {
                reply = new Dictionary<string, object> { { "id", id }, { "ok", false }, { "error", Describe(error) } };
            }
            output.WriteLine(Json.Serialize(reply));
        }
    }
}
