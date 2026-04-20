package cloud.lionfish.app

import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent
import cloud.lionfish.app.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        binding.webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            @Suppress("DEPRECATION")
            databaseEnabled = true
        }
        val defaultUa = binding.webView.settings.userAgentString ?: ""
        binding.webView.settings.userAgentString = "$defaultUa LionfishWebView/1.0"

        binding.webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                return handleUrl(url)
            }

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                return url?.let { handleUrl(it) } ?: false
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                hideError()
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?,
            ) {
                if (request?.isForMainFrame == true) {
                    showError(getString(R.string.error_loading))
                }
            }
        }

        if (savedInstanceState == null) {
            val data = intent?.data
            if (data != null && HOST.equals(data.host, ignoreCase = true)) {
                binding.webView.loadUrl(data.toString())
            } else {
                binding.webView.loadUrl(BASE_URL)
            }
        }
    }

    private fun handleUrl(url: String): Boolean {
        val uri = try {
            Uri.parse(url)
        } catch (_: Exception) {
            return false
        }
        when {
            url.contains("/api/auth/google") -> {
                launchCustomTab(url)
                return true
            }
            url.startsWith("mailto:", ignoreCase = true) ||
                url.startsWith("tel:", ignoreCase = true) -> {
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                } catch (_: Exception) {
                    // ignore
                }
                return true
            }
        }
        return false
    }

    private fun launchCustomTab(url: String) {
        try {
            val builder = CustomTabsIntent.Builder()
            builder.setShowTitle(true)
            builder.build().launchUrl(this, Uri.parse(url))
        } catch (_: Exception) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            } catch (_: Exception) {
                // ignore
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.data?.let { uri ->
            if (HOST.equals(uri.host, ignoreCase = true)) {
                binding.webView.loadUrl(uri.toString())
                hideError()
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (binding.webView.canGoBack()) {
            binding.webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    private fun showError(msg: String) {
        binding.errorView.text = msg
        binding.errorView.visibility = android.view.View.VISIBLE
    }

    private fun hideError() {
        binding.errorView.visibility = android.view.View.GONE
    }

    companion object {
        private const val BASE_URL = "https://lionfish.cloud/"
        private const val HOST = "lionfish.cloud"
    }
}
