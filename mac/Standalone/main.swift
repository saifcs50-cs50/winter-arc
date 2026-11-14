import Cocoa
import ServiceManagement
import WebKit

/// Standalone Winter Arc for Macs without the project folder: the hub runs inside the app, and the app
/// stays in the menu bar when its window closes so the phone can keep syncing.
final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    private var hub: Hub!
    private var window: NSWindow!
    private var webView: WKWebView!
    private var statusItem: NSStatusItem!
    private let askedLoginKey = "askedOpenAtLogin"

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()
        buildStatusItem()
        buildWindow()
        hub = AppDelegate.makeHub()
        hub.start { [weak self] error in
            DispatchQueue.main.async {
                guard let self else { return }
                if let error { self.showHubError(error) } else { self.loadApp() }
            }
        }
    }

    /// Separate from the deen edition's "WinterArc" folder, so the two editions never share data.
    static func dataDir() -> URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("WinterArc Standard")
    }

    /// WA_PORT, WA_DATA_DIR and WA_STATIC_DIR override the defaults, for tests on a Mac already running a hub.
    static func makeHub() -> Hub {
        let env = ProcessInfo.processInfo.environment
        return Hub(
            port: UInt16(env["WA_PORT"] ?? "") ?? Hub.defaultPort,
            dataDir: env["WA_DATA_DIR"].map { URL(fileURLWithPath: $0) } ?? dataDir(),
            staticDir: env["WA_STATIC_DIR"].map { URL(fileURLWithPath: $0) } ?? Bundle.main.resourceURL!.appendingPathComponent("web")
        )
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showWindow(nil)
        return true
    }

    func applicationWillTerminate(_ notification: Notification) { hub?.stop() }

    // MARK: Window

    private func buildWindow() {
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
        window.isReleasedWhenClosed = false
        window.backgroundColor = NSColor(red: 0x0a / 255, green: 0x10 / 255, blue: 0x20 / 255, alpha: 1)
        window.appearance = NSAppearance(named: .darkAqua)
        window.minSize = NSSize(width: 380, height: 560)
        window.contentView = webView
        window.center()
        window.setFrameAutosaveName("WinterArcMain")
        window.makeKeyAndOrderFront(nil)
    }

    private func loadApp() {
        webView.load(URLRequest(url: URL(string: "http://localhost:\(hub.port)/")!))
        askToOpenAtLogin()
    }

    private func showHubError(_ error: Error) {
        let html = """
        <body style="background:#0a1020;color:#eef3ff;font-family:-apple-system;display:grid;place-items:center;height:90vh;text-align:center">
        <div><h2>Winter Arc couldn't start its sync service</h2>
        <p style="color:#a9b4cc">Port \(hub.port) is probably in use by another copy of Winter Arc. Quit it and reopen this app.</p>
        <p style="color:#74809a">\(error.localizedDescription)</p></div></body>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }

    @objc func showWindow(_ sender: Any?) {
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc func reload(_ sender: Any?) { webView.reload() }

    // MARK: Open at login

    private func askToOpenAtLogin() {
        guard !UserDefaults.standard.bool(forKey: askedLoginKey) else { return }
        UserDefaults.standard.set(true, forKey: askedLoginKey)
        let alert = NSAlert()
        alert.messageText = "Open Winter Arc when you log in?"
        alert.informativeText = "Your phone can only sync while Winter Arc is open on this Mac. It waits quietly in the menu bar."
        alert.addButton(withTitle: "Open at Login")
        alert.addButton(withTitle: "Not Now")
        if alert.runModal() == .alertFirstButtonReturn { setOpenAtLogin(true) }
    }

    private func setOpenAtLogin(_ on: Bool) {
        do {
            if on { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
        } catch {
            let alert = NSAlert()
            alert.messageText = "Couldn't change Open at Login"
            alert.informativeText = "Add Winter Arc in System Settings → General → Login Items instead.\n\n\(error.localizedDescription)"
            alert.runModal()
        }
    }

    @objc func toggleOpenAtLogin(_ sender: NSMenuItem) {
        setOpenAtLogin(SMAppService.mainApp.status != .enabled)
    }

    // MARK: Menus

    private func buildStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem.button?.image = NSImage(systemSymbolName: "snowflake", accessibilityDescription: "Winter Arc")
        let menu = NSMenu()
        menu.delegate = self
        menu.addItem(withTitle: "Open Winter Arc", action: #selector(showWindow(_:)), keyEquivalent: "")
        menu.addItem(withTitle: "Open at Login", action: #selector(toggleOpenAtLogin(_:)), keyEquivalent: "")
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit Winter Arc (stops phone sync)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "")
        statusItem.menu = menu
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

        let windowItem = NSMenuItem()
        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(withTitle: "Winter Arc", action: #selector(showWindow(_:)), keyEquivalent: "0")
        windowMenu.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        windowItem.submenu = windowMenu
        main.addItem(windowItem)

        NSApp.mainMenu = main
    }
}

extension AppDelegate: NSMenuDelegate {
    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.item(withTitle: "Open at Login")?.state = SMAppService.mainApp.status == .enabled ? .on : .off
    }
}

/// `--hub-only` runs just the sync server, for mac/Standalone/hub-contract.test.ts.
if CommandLine.arguments.contains("--hub-only") {
    let hub = AppDelegate.makeHub()
    hub.start { error in
        if let error {
            FileHandle.standardError.write(Data("hub failed: \(error)\n".utf8))
            exit(1)
        }
        print("ready", hub.port)
        fflush(stdout)
    }
    dispatchMain()
} else {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.setActivationPolicy(.regular)
    app.run()
}
