using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Windows.Forms;

public static class PcScreen
{
    const int JPEG_QUALITY = 80;

    public static List<Dictionary<string, object>> Monitors()
    {
        List<Dictionary<string, object>> monitors = new List<Dictionary<string, object>>();
        Screen[] screens = Screen.AllScreens;
        for (int i = 0; i < screens.Length; i++)
        {
            Rectangle bounds = screens[i].Bounds;
            monitors.Add(new Dictionary<string, object>
            {
                { "index", i }, { "name", screens[i].DeviceName }, { "primary", screens[i].Primary },
                { "x", bounds.X }, { "y", bounds.Y }, { "width", bounds.Width }, { "height", bounds.Height },
            });
        }
        return monitors;
    }

    static Rectangle Bounds(PcArgs args)
    {
        if (!args.Has("monitor")) return SystemInformation.VirtualScreen;
        int index = args.Int("monitor", 0);
        Screen[] screens = Screen.AllScreens;
        if (index < 0 || index >= screens.Length)
        {
            throw new ArgumentException("Monitor " + index + " does not exist. Call list_monitors.");
        }
        return screens[index].Bounds;
    }

    static string Encode(Bitmap image, bool jpeg)
    {
        using (MemoryStream stream = new MemoryStream())
        {
            if (jpeg)
            {
                ImageCodecInfo codec = Array.Find(ImageCodecInfo.GetImageEncoders(), c => c.MimeType == "image/jpeg");
                EncoderParameters parameters = new EncoderParameters(1);
                parameters.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, (long)JPEG_QUALITY);
                image.Save(stream, codec, parameters);
            }
            else
            {
                image.Save(stream, ImageFormat.Png);
            }
            return Convert.ToBase64String(stream.ToArray());
        }
    }

    static Bitmap Resize(Bitmap source, int width, int height)
    {
        Bitmap resized = new Bitmap(width, height, PixelFormat.Format24bppRgb);
        using (Graphics graphics = Graphics.FromImage(resized))
        {
            graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
            graphics.DrawImage(source, 0, 0, width, height);
        }
        return resized;
    }

    public static object Capture(PcArgs args)
    {
        Rectangle bounds = Bounds(args);
        int maxSide = args.Int("maxSide", 1280);
        int maxBase64 = args.Int("maxBase64", 700 * 1024);

        using (Bitmap capture = new Bitmap(bounds.Width, bounds.Height, PixelFormat.Format24bppRgb))
        {
            using (Graphics graphics = Graphics.FromImage(capture))
            {
                graphics.CopyFromScreen(bounds.X, bounds.Y, 0, 0, capture.Size);
            }

            double scale = Math.Min(1.0, maxSide / (double)Math.Max(bounds.Width, bounds.Height));
            int width = Math.Max(1, (int)Math.Round(bounds.Width * scale));
            int height = Math.Max(1, (int)Math.Round(bounds.Height * scale));
            Bitmap image = scale < 1.0 ? Resize(capture, width, height) : capture;

            try
            {
                string format = "png";
                string data = Encode(image, false);
                if (data.Length > maxBase64)
                {
                    format = "jpeg";
                    data = Encode(image, true);
                }
                return new Dictionary<string, object>
                {
                    { "data", data }, { "format", format }, { "x", bounds.X }, { "y", bounds.Y },
                    { "screenWidth", bounds.Width }, { "screenHeight", bounds.Height }, { "width", width }, { "height", height },
                };
            }
            finally
            {
                if (image != capture) image.Dispose();
            }
        }
    }
}
