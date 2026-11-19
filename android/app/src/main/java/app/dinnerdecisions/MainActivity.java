package app.dinnerdecisions;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugin, not from npm: see PrintPlugin.java.
        registerPlugin(PrintPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
