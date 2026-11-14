import Foundation
import Network

/// Swift port of server/hub.ts, so the standalone Mac app needs no Node. Same routes, pairing code,
/// rate limit and validation; mac/Standalone/hub-contract.test.ts runs the same checks against it.
final class Hub {
    static let defaultPort: UInt16 = 4747
    private static let codeAlphabet = Array("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
    private static let codeLength = 8
    private static let maxBody = 2 * 1024 * 1024
    private static let maxFailuresPerMinute = 20
    private static let contentTypes: [String: String] = [
        "html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8", "css": "text/css; charset=utf-8",
        "json": "application/json", "svg": "image/svg+xml", "png": "image/png", "woff2": "font/woff2", "woff": "font/woff",
    ]

    let port: UInt16
    private let dataDir: URL
    private let staticDir: URL
    private let queue = DispatchQueue(label: "winter-arc.hub")
    private var listener: NWListener?
    private var state: SyncState = [:]
    private(set) var code = ""
    private var failures: [String: (count: Int, since: Date)] = [:]

    init(port: UInt16, dataDir: URL, staticDir: URL) {
        self.port = port
        self.dataDir = dataDir
        self.staticDir = staticDir.standardizedFileURL
    }

    /// Loads the code and state, then listens on every interface. Calls back once with nil or an error.
    func start(onReady: @escaping (Error?) -> Void) {
        do {
            try FileManager.default.createDirectory(at: dataDir.appendingPathComponent("backups"), withIntermediateDirectories: true)
            code = loadOrCreateCode()
            state = SyncStateCodec.sanitize(readJSON(dataDir.appendingPathComponent("state.json")))
            let parameters = NWParameters.tcp
            parameters.allowLocalEndpointReuse = true
            let listener = try NWListener(using: parameters, on: NWEndpoint.Port(rawValue: port)!)
            // Announce over Bonjour so the phone finds this Mac with one query instead of scanning.
            listener.service = NWListener.Service(name: "Winter Arc", type: "_winterarc._tcp")
            listener.newConnectionHandler = { [weak self] connection in self?.accept(connection) }
            var reported = false
            listener.stateUpdateHandler = { update in
                guard !reported else { return }
                switch update {
                case .ready: reported = true; onReady(nil)
                case .failed(let error): reported = true; onReady(error)
                default: break
                }
            }
            self.listener = listener
            listener.start(queue: queue)
        } catch {
            onReady(error)
        }
    }

    func stop() { listener?.cancel() }

    // MARK: Storage

    private func readJSON(_ url: URL) -> Any? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONSerialization.jsonObject(with: data)
    }

    private func loadOrCreateCode() -> String {
        let url = dataDir.appendingPathComponent("hub.json")
        if let saved = (readJSON(url) as? [String: Any])?["code"] as? String, !saved.isEmpty { return saved }
        var generator = SystemRandomNumberGenerator()
        let fresh = String((0..<Hub.codeLength).map { _ in Hub.codeAlphabet.randomElement(using: &generator)! })
        if let data = try? JSONSerialization.data(withJSONObject: ["code": fresh]) { try? data.write(to: url, options: .atomic) }
        return fresh
    }

    private func persist() {
        guard let data = try? JSONSerialization.data(withJSONObject: SyncStateCodec.jsonObject(state), options: [.sortedKeys]) else { return }
        let stateURL = dataDir.appendingPathComponent("state.json")
        try? data.write(to: stateURL, options: .atomic)
        let day = ISO8601DateFormatter.string(from: Date(), timeZone: TimeZone(identifier: "UTC")!, formatOptions: [.withFullDate])
        let backup = dataDir.appendingPathComponent("backups/state-\(day).json")
        if !FileManager.default.fileExists(atPath: backup.path) { try? data.write(to: backup, options: .atomic) }
    }

    // MARK: Connections

    private func accept(_ connection: NWConnection) {
        connection.start(queue: queue)
        receive(connection, buffer: Data())
    }

    private func receive(_ connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) { [weak self] data, _, isComplete, error in
            guard let self else { return }
            var buffer = buffer
            if let data { buffer.append(data) }
            switch HTTPParser.parse(buffer, maxBody: Hub.maxBody) {
            case .complete(let request):
                self.send(self.route(request, from: connection.endpoint), on: connection)
            case .invalid:
                self.send(.json(400, ["error": "Bad request"]), on: connection)
            case .incomplete:
                if isComplete || error != nil { connection.cancel() } else { self.receive(connection, buffer: buffer) }
            }
        }
    }

    private func send(_ response: HTTPResponse, on connection: NWConnection) {
        connection.send(content: response.serialized(), completion: .contentProcessed { _ in connection.cancel() })
    }

    // MARK: Routes

    private func route(_ request: HTTPRequest, from endpoint: NWEndpoint) -> HTTPResponse {
        let path = request.path.split(separator: "?", maxSplits: 1).first.map(String.init) ?? "/"
        switch (request.method, path) {
        case ("GET", "/api/hello"):
            return .json(200, ["app": "winter-arc", "v": 1, "name": Host.current().localizedName ?? "Mac"])
        case ("GET", "/api/local-token"):
            return isLocalPage(request, from: endpoint) ? .json(200, ["token": code]) : .json(403, ["error": "Local page only"])
        case ("POST", "/api/sync"):
            return sync(request, from: endpoint)
        case ("GET", _) where !path.hasPrefix("/api/"):
            return serveStatic(path)
        default:
            return .json(404, ["error": "Not found"])
        }
    }

    private static func host(of endpoint: NWEndpoint) -> NWEndpoint.Host? {
        if case .hostPort(let host, _) = endpoint { return host }
        return nil
    }

    private static func isLoopback(_ endpoint: NWEndpoint) -> Bool {
        switch host(of: endpoint) {
        case .ipv4(let address): return address.isLoopback
        case .ipv6(let address): return address.isLoopback || address.asIPv4?.isLoopback == true
        default: return false
        }
    }

    /// Only the Mac's own page may read the code: loopback address, local Host, not cross-site.
    private func isLocalPage(_ request: HTTPRequest, from endpoint: NWEndpoint) -> Bool {
        let host = request.headers["host"] ?? ""
        let hostName = host.split(separator: ":").first.map(String.init) ?? ""
        let site = request.headers["sec-fetch-site"]
        return Hub.isLoopback(endpoint) && (hostName == "localhost" || hostName == "127.0.0.1")
            && (site == nil || site == "same-origin" || site == "none")
    }

    private func sameCode(_ given: String) -> Bool {
        let normalized = given.uppercased().filter { $0.isASCII && ($0.isLetter || $0.isNumber) }
        guard normalized.utf8.count == code.utf8.count else { return false }
        return zip(normalized.utf8, code.utf8).reduce(0) { $0 | ($1.0 ^ $1.1) } == 0
    }

    private func sync(_ request: HTTPRequest, from endpoint: NWEndpoint) -> HTTPResponse {
        let client = Hub.host(of: endpoint).map { "\($0)" } ?? "unknown"
        let now = Date()
        if let entry = failures[client], now.timeIntervalSince(entry.since) <= 60, entry.count >= Hub.maxFailuresPerMinute {
            return .json(429, ["error": "Too many attempts"])
        }
        guard let given = request.headers["x-wa-token"], sameCode(given) else {
            let entry = failures[client]
            let fresh = entry == nil || now.timeIntervalSince(entry!.since) > 60
            failures[client] = fresh ? (1, now) : (entry!.count + 1, entry!.since)
            return .json(401, ["error": "Wrong pairing code"])
        }
        guard let body = try? JSONSerialization.jsonObject(with: request.body) else {
            return .json(400, ["error": "Bad request body"])
        }
        let incoming = SyncStateCodec.sanitize((body as? [String: Any])?["state"])
        let (merged, changed) = SyncStateCodec.merge(state, incoming)
        if changed {
            state = merged
            persist()
        }
        return .json(200, ["state": SyncStateCodec.jsonObject(state)])
    }

    private func serveStatic(_ rawPath: String) -> HTTPResponse {
        guard let decoded = rawPath.removingPercentEncoding else { return .json(400, ["error": "Bad path"]) }
        let root = staticDir.path
        var file = staticDir.appendingPathComponent(decoded).standardizedFileURL
        guard file.path == root || file.path.hasPrefix(root + "/") else { return .json(403, ["error": "Forbidden"]) }
        var isDirectory: ObjCBool = false
        if !FileManager.default.fileExists(atPath: file.path, isDirectory: &isDirectory) || isDirectory.boolValue {
            file = staticDir.appendingPathComponent("index.html")
        }
        guard let data = try? Data(contentsOf: file) else { return .json(503, ["error": "The app files are missing"]) }
        let isIndex = file.lastPathComponent == "index.html"
        return HTTPResponse(status: 200, headers: [
            "Content-Type": Hub.contentTypes[file.pathExtension.lowercased()] ?? "application/octet-stream",
            "Cache-Control": isIndex ? "no-cache" : "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
        ], body: data)
    }
}
