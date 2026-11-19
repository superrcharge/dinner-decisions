package app.dinnerdecisions;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Print for the page. Android's WebView ignores window.print(), so the page
 * calls this instead (printNative in index.html). It opens Android's own
 * print screen for the WebView as it is, which lays the page out with its
 * print styles, so the shopping list prints as it does from a browser, and
 * "Save as PDF" comes with it.
 */
@CapacitorPlugin(name = "Print")
public class PrintPlugin extends Plugin {

    @PluginMethod
    public void print(PluginCall call) {
        String name = call.getString("name", "Dinner Decisions");
        getActivity().runOnUiThread(() -> {
            PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
            WebView webView = getBridge().getWebView();
            if (printManager == null || webView == null) {
                call.reject("Printing is not available on this phone");
                return;
            }
            printManager.print(name, webView.createPrintDocumentAdapter(name), new PrintAttributes.Builder().build());
            call.resolve();
        });
    }
}
