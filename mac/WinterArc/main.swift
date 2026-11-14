import Cocoa
import WebKit

/// A native Mac window around the Winter Arc hub (http://localhost:4747). The hub runs as a login
/// service; if it isn't answering, this app asks launchd to restart it and retries.
final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    private let hubURL = URL(string: "http://localhost:4747/")!
    private let hubLabel = "com.saif.winterarc.hub"
    private var window: NSWindow!
    private var webView: WKWebView!
    private var retries = 0
    private let maxRetries = 5

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground")

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1120, height: 820),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "Winter Arc"
        window.titlebarAppearsTransparent = true
        window.backgroundColor = NSColor(red: 0x0a / 255, green: 0x10 / 255, blue: 0x20 / 255, alpha: 1)
        window.appearance = NSAppearance(named: .darkAqua)
        window.minSize = NSSize(width: 380, height: 560)
        window.contentView = webView
        window.center()
        window.setFrameAutosaveName("WinterArcMain")
        window.makeKeyAndOrderFront(nil)
        webView.load(URLRequest(url: hubURL))
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        retries = 0
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        guard retries < maxRetries else {
            showHubDown()
            return
        }
        retries += 1
        restartHub()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            guard let self else { return }
            self.webView.load(URLRequest(url: self.hubURL))
        }
    }

    private func restartHub() {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/bin/launchctl")
        task.arguments = ["kickstart", "gui/\(getuid())/\(hubLabel)"]
        try? task.run()
    }

    private func showHubDown() {
        let html = """
        <body style="background:#0a1020;color:#eef3ff;font-family:-apple-system;display:grid;place-items:center;height:90vh;text-align:center">
        <div><h2>The Winter Arc hub isn't running</h2>
        <p style="color:#a9b4cc">Open Terminal in the winter-arc folder and run <code>mac/install-hub.sh</code>, then press ⌘R.</p></div></body>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }

    @objc func reload(_ sender: Any?) {
        retries = 0
        webView.load(URLRequest(url: hubURL))
    }

    private func buildMenu() {
        let main = NSMenu()

        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Hide Winter Arc", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Winter Arc", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        main.addItem(appItem)

        // Without an Edit menu, copy and paste don't work inside the journal boxes.
        let editItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = editMenu
        main.addItem(editItem)

        let viewItem = NSMenuItem()
        let viewMenu = NSMenu(title: "View")
        viewMenu.addItem(withTitle: "Reload", action: #selector(reload(_:)), keyEquivalent: "r")
        viewItem.submenu = viewMenu
        main.addItem(viewItem)

        NSApp.mainMenu = main
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
