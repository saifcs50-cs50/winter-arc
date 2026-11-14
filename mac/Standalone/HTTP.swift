import Foundation

struct HTTPRequest {
    let method: String
    let path: String
    let headers: [String: String]
    let body: Data
}

struct HTTPResponse {
    var status: Int
    var headers: [String: String]
    var body: Data

    static func json(_ status: Int, _ object: Any) -> HTTPResponse {
        let data = (try? JSONSerialization.data(withJSONObject: object)) ?? Data("{}".utf8)
        return HTTPResponse(status: status, headers: ["Content-Type": "application/json", "Cache-Control": "no-store"], body: data)
    }

    func serialized() -> Data {
        var head = "HTTP/1.1 \(status) \(HTTPResponse.reason(status))\r\n"
        var all = headers
        all["Content-Length"] = String(body.count)
        all["Connection"] = "close"
        for (name, value) in all { head += "\(name): \(value)\r\n" }
        head += "\r\n"
        return Data(head.utf8) + body
    }

    private static func reason(_ status: Int) -> String {
        switch status {
        case 200: return "OK"
        case 400: return "Bad Request"
        case 401: return "Unauthorized"
        case 403: return "Forbidden"
        case 404: return "Not Found"
        case 413: return "Payload Too Large"
        case 429: return "Too Many Requests"
        case 503: return "Service Unavailable"
        default: return "Error"
        }
    }
}

enum ParseResult {
    case incomplete
    case invalid
    case complete(HTTPRequest)
}

enum HTTPParser {
    static let maxHeaderBytes = 16 * 1024
    private static let separator = Data("\r\n\r\n".utf8)

    static func parse(_ buffer: Data, maxBody: Int) -> ParseResult {
        guard let end = buffer.range(of: separator) else {
            return buffer.count > maxHeaderBytes ? .invalid : .incomplete
        }
        guard let head = String(data: buffer[buffer.startIndex..<end.lowerBound], encoding: .utf8) else { return .invalid }
        var lines = head.components(separatedBy: "\r\n")
        let requestLine = lines.removeFirst().split(separator: " ")
        guard requestLine.count >= 2 else { return .invalid }
        var headers: [String: String] = [:]
        for line in lines {
            guard let colon = line.firstIndex(of: ":") else { continue }
            let name = line[..<colon].trimmingCharacters(in: .whitespaces).lowercased()
            headers[name] = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
        }
        let method = String(requestLine[0])
        let path = String(requestLine[1])
        let rest = Data(buffer[end.upperBound...])
        if headers["transfer-encoding"]?.lowercased().contains("chunked") == true {
            switch dechunk(rest, maxBody: maxBody) {
            case .incomplete: return .incomplete
            case .invalid: return .invalid
            case .body(let body): return .complete(HTTPRequest(method: method, path: path, headers: headers, body: body))
            }
        }
        let length = Int(headers["content-length"] ?? "0") ?? -1
        guard length >= 0, length <= maxBody else { return .invalid }
        guard rest.count >= length else { return .incomplete }
        return .complete(HTTPRequest(method: method, path: path, headers: headers, body: rest.prefix(length)))
    }

    private enum Dechunked {
        case incomplete
        case invalid
        case body(Data)
    }

    /// Decodes `Transfer-Encoding: chunked`, which some clients use when they don't send Content-Length.
    private static func dechunk(_ data: Data, maxBody: Int) -> Dechunked {
        let crlf = Data("\r\n".utf8)
        var body = Data()
        var index = data.startIndex
        while true {
            guard let lineEnd = data.range(of: crlf, in: index..<data.endIndex) else { return .incomplete }
            let sizeText = String(decoding: data[index..<lineEnd.lowerBound], as: UTF8.self).split(separator: ";").first ?? ""
            guard let size = Int(sizeText.trimmingCharacters(in: .whitespaces), radix: 16), size >= 0 else { return .invalid }
            let chunkStart = lineEnd.upperBound
            if size == 0 {
                return data.range(of: crlf, in: chunkStart..<data.endIndex) == nil ? .incomplete : .body(body)
            }
            guard body.count + size <= maxBody else { return .invalid }
            guard data.distance(from: chunkStart, to: data.endIndex) >= size + 2 else { return .incomplete }
            let chunkEnd = data.index(chunkStart, offsetBy: size)
            body.append(data[chunkStart..<chunkEnd])
            index = data.index(chunkEnd, offsetBy: 2)
        }
    }
}
