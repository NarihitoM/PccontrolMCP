using System;
using System.Collections.Generic;
using System.Threading;
using System.Windows;
using System.Windows.Automation;

public static class PcUi
{
    static readonly HashSet<string> Interactive = new HashSet<string>
    {
        "Button", "Edit", "CheckBox", "ComboBox", "ListItem", "MenuItem", "Hyperlink", "TabItem", "RadioButton",
        "TreeItem", "Slider", "SplitButton", "Document", "DataItem", "Spinner",
    };

    static readonly AutomationProperty[] CachedProperties =
    {
        AutomationElement.NameProperty, AutomationElement.ControlTypeProperty, AutomationElement.AutomationIdProperty,
        AutomationElement.BoundingRectangleProperty, AutomationElement.IsEnabledProperty,
        AutomationElement.HasKeyboardFocusProperty, AutomationElement.IsOffscreenProperty, ValuePattern.ValueProperty,
    };

    const int SPARSE_TREE = 15;
    const int RETRY_DELAY_MS = 500;
    const string ADMIN_WINDOW =
        "Windows does not allow reading this window. It is probably running as administrator (like Task Manager). Use screenshot instead.";

    static List<AutomationElement> lastRead = new List<AutomationElement>();

    static AutomationElementCollection Collect(long handle)
    {
        CacheRequest request = new CacheRequest();
        foreach (AutomationProperty property in CachedProperties) request.Add(property);
        request.TreeScope = TreeScope.Element;

        try
        {
            AutomationElement root = AutomationElement.FromHandle(new IntPtr(handle));
            using (request.Activate())
            {
                return root.FindAll(TreeScope.Descendants, new PropertyCondition(AutomationElement.IsControlElementProperty, true));
            }
        }
        catch (ElementNotAvailableException)
        {
            throw new InvalidOperationException("The window closed while reading it. Call list_windows again.");
        }
        catch (InvalidOperationException)
        {
            throw new InvalidOperationException(ADMIN_WINDOW);
        }
        catch (UnauthorizedAccessException)
        {
            throw new InvalidOperationException(ADMIN_WINDOW);
        }
    }

    static object Cached(AutomationElement element, AutomationProperty property)
    {
        try
        {
            object value = element.GetCachedPropertyValue(property, true);
            return value == AutomationElement.NotSupported ? null : value;
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }

    static string Text(object value)
    {
        return value == null ? "" : Convert.ToString(value);
    }

    public static object Read(PcArgs args)
    {
        long handle = args.Has("handle") ? args.Long("handle") : PcNative.ForegroundHandle();
        if (handle == 0) throw new InvalidOperationException("No window is in the foreground. Use focus_window first.");
        int maxElements = args.Int("maxElements", 150);

        AutomationElementCollection found = Collect(handle);
        if (found.Count < SPARSE_TREE)
        {
            Thread.Sleep(RETRY_DELAY_MS);
            found = Collect(handle);
        }

        List<AutomationElement> kept = new List<AutomationElement>();
        List<Dictionary<string, object>> elements = new List<Dictionary<string, object>>();
        bool truncated = false;

        foreach (AutomationElement element in found)
        {
            if (elements.Count >= maxElements)
            {
                truncated = true;
                break;
            }
            if (true.Equals(Cached(element, AutomationElement.IsOffscreenProperty))) continue;
            object bounds = Cached(element, AutomationElement.BoundingRectangleProperty);
            if (!(bounds is Rect)) continue;
            Rect rect = (Rect)bounds;
            if (rect.IsEmpty || rect.Width < 1 || rect.Height < 1) continue;

            ControlType controlType = Cached(element, AutomationElement.ControlTypeProperty) as ControlType;
            string type = controlType == null ? "" : controlType.ProgrammaticName.Replace("ControlType.", "");
            string name = Text(Cached(element, AutomationElement.NameProperty));
            string value = Text(Cached(element, ValuePattern.ValueProperty));
            if (name.Length == 0 && value.Length == 0 && !Interactive.Contains(type)) continue;

            kept.Add(element);
            elements.Add(new Dictionary<string, object>
            {
                { "index", elements.Count }, { "type", type }, { "name", name }, { "value", value },
                { "automationId", Text(Cached(element, AutomationElement.AutomationIdProperty)) },
                { "x", (int)rect.X }, { "y", (int)rect.Y }, { "width", (int)rect.Width }, { "height", (int)rect.Height },
                { "enabled", true.Equals(Cached(element, AutomationElement.IsEnabledProperty)) },
                { "focused", true.Equals(Cached(element, AutomationElement.HasKeyboardFocusProperty)) },
            });
        }

        lastRead = kept;
        return new Dictionary<string, object>
        {
            { "window", PcWindows.Info(PcNative.Describe(new IntPtr(handle))) },
            { "elements", elements },
            { "truncated", truncated },
        };
    }

    static AutomationElement Find(int index)
    {
        if (lastRead.Count == 0) throw new InvalidOperationException("No screen read yet. Call get_ui first.");
        if (index < 0 || index >= lastRead.Count)
        {
            throw new ArgumentException("Element " + index + " not found. Call get_ui again to refresh.");
        }
        return lastRead[index];
    }

    public static bool Invoke(int index)
    {
        object pattern;
        if (!Find(index).TryGetCurrentPattern(InvokePattern.Pattern, out pattern)) return false;
        ((InvokePattern)pattern).Invoke();
        return true;
    }

    public static void Focus(int index)
    {
        Find(index).SetFocus();
    }

    public static bool SetValue(int index, string text)
    {
        object pattern;
        if (!Find(index).TryGetCurrentPattern(ValuePattern.Pattern, out pattern)) return false;
        ((ValuePattern)pattern).SetValue(text);
        return true;
    }
}
