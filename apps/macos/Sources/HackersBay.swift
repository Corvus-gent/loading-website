import AppKit
import Foundation
import SwiftUI
import UserNotifications
import WebKit

@MainActor
final class Skipper: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, UNUserNotificationCenterDelegate {
    private static let home = URL(string: "https://corvus.gent/hackersbay")!
    private static let demo = URL(string: "https://corvus.gent/hackersbay/demo?format=wide")!
    private static let seenKey = "HackersBay.mutuals.seen"
    private static let soundKey = "HackersBay.squawk.enabled"
    private var seen: [String] = UserDefaults.standard.stringArray(forKey: Skipper.seenKey) ?? []
    private var timer: Timer?
    private var activeSound: NSSound?
    private var cannonPending = false
    private let webConfig = WKWebViewConfiguration()
    lazy var webView = WKWebView(frame: .zero, configuration: webConfig)
    @Published var newIntros = 0
    @Published var squawkEnabled = UserDefaults.standard.bool(forKey: Skipper.soundKey) {
        didSet { UserDefaults.standard.set(squawkEnabled, forKey: Self.soundKey) }
    }

    override init() {
        super.init()
        let scripts = webConfig.userContentController
        scripts.add(self, name: "captainSquawk")
        if let url = Bundle.main.url(forResource: "watch-intros", withExtension: "js"),
           let watcher = try? String(contentsOf: url, encoding: .utf8) {
            scripts.addUserScript(WKUserScript(source: watcher, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        webView.navigationDelegate = self
        webView.uiDelegate = self
        UNUserNotificationCenter.current().delegate = self
        sailHome()
        timer = Timer.scheduledTimer(withTimeInterval: 25, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.scanIntros() }
        }
    }

    private static func owns(_ url: URL?) -> Bool {
        guard let url, url.scheme == "https", url.host == "corvus.gent", url.port == nil else { return false }
        return url.path == "/hackersbay" || url.path.hasPrefix("/hackersbay/")
    }

    func sailHome() {
        cannonPending = false
        webView.load(URLRequest(url: Self.home))
    }

    func sinkLuma() {
        cannonPending = true
        webView.load(URLRequest(url: Self.demo))
    }

    func enableNotifications() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert]) { _, _ in }
    }

    func scanIntros() {
        guard Self.owns(webView.url) else { return }
        webView.evaluateJavaScript("window.hackersBayNativeScan?.()")
    }

    private func sound(_ cue: String) {
        guard let url = Bundle.main.url(forResource: cue, withExtension: "wav") else { return }
        activeSound?.stop()
        activeSound = NSSound(contentsOf: url, byReference: true)
        activeSound?.play()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "captainSquawk", message.frameInfo.isMainFrame,
              Self.owns(message.frameInfo.request.url), Self.owns(webView.url),
              let raw = message.body as? String, let uuid = UUID(uuidString: raw) else { return }
        let id = uuid.uuidString
        guard !seen.contains(id) else { return }
        seen = Array((seen + [id]).suffix(128))
        UserDefaults.standard.set(seen, forKey: Self.seenKey)
        newIntros += 1
        if squawkEnabled { sound("squawk") }

        let contents = UNMutableNotificationContent()
        contents.title = "IT’S MUTUAL ⚓"
        contents.body = "Captain Squawk found two yeses. Open HackersBay to find your meetup."
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: id, content: contents, trigger: nil), withCompletionHandler: nil)
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                           withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .list])
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        scanIntros()
        if cannonPending && webView.url?.path == "/hackersbay/demo" {
            cannonPending = false
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 650_000_000)
                if self.webView.url?.path == "/hackersbay/demo" { self.sound("cannon") }
            }
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard action.targetFrame?.isMainFrame != false else { decisionHandler(.allow); return }
        if Self.owns(action.request.url) {
            decisionHandler(.allow)
        } else {
            if action.navigationType == .linkActivated, let url = action.request.url, url.scheme == "https" {
                NSWorkspace.shared.open(url)
            }
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if action.targetFrame == nil, let url = action.request.url {
            if Self.owns(url) { webView.load(action.request) }
            else if url.scheme == "https" { NSWorkspace.shared.open(url) }
        }
        return nil
    }
}

@MainActor
struct ShipWindow: NSViewRepresentable {
    @ObservedObject var skipper: Skipper
    func makeNSView(context: Context) -> WKWebView { skipper.webView }
    func updateNSView(_ view: WKWebView, context: Context) {}
}

@MainActor
struct CaptainMenu: View {
    @Environment(\.openWindow) private var openWindow
    @ObservedObject var skipper: Skipper
    var body: some View {
        Button("Open HackersBay") {
            openWindow(id: "ship")
            NSApp.activate(ignoringOtherApps: true)
            skipper.newIntros = 0
        }
        Button("Sink Luma") {
            openWindow(id: "ship")
            NSApp.activate(ignoringOtherApps: true)
            skipper.sinkLuma()
        }
        Button("Back to port") { skipper.sailHome() }
        Divider()
        Toggle("Captain Squawk sounds", isOn: $skipper.squawkEnabled)
        Button("Enable native notifications") { skipper.enableNotifications() }
        Divider()
        Button("Quit HackersBay") { NSApp.terminate(nil) }.keyboardShortcut("q")
    }
}

@main @MainActor
struct HackersBayApp: App {
    @StateObject private var skipper = Skipper()

    var body: some Scene {
        Window("HackersBay", id: "ship") {
            ShipWindow(skipper: skipper).frame(minWidth: 390, minHeight: 600)
        }
        .defaultSize(width: 1100, height: 760)

        MenuBarExtra {
            CaptainMenu(skipper: skipper)
        } label: {
            HStack(spacing: 3) {
                if let url = Bundle.main.url(forResource: "menu-squawk", withExtension: "png"),
                   let sprite = NSImage(contentsOf: url) {
                    Image(nsImage: sprite).resizable().interpolation(.none).frame(width: 18, height: 18)
                } else {
                    Image(systemName: "bird")
                }
                if skipper.newIntros > 0 { Text(String(skipper.newIntros)) }
            }
            .accessibilityLabel("HackersBay · Captain Squawk")
        }
    }
}
