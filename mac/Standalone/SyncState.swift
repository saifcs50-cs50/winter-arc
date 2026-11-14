import Foundation

/// Swift port of src/core/merge.ts. Every value is a field stamped with the time it was written (t)
/// and the device that wrote it (d); merging keeps the newest stamp per field. Keep the two in step.
struct Field {
    let v: Any
    let t: Double
    let d: String

    func isNewer(than other: Field) -> Bool {
        if t != other.t { return t > other.t }
        return d > other.d
    }

    var json: [String: Any] { ["v": v, "t": t, "d": d] }
}

typealias SyncRecord = [String: Field]
typealias SyncState = [String: SyncRecord]

enum SyncStateCodec {
    static let maxString = 20_000
    static let maxList = 64
    static let maxListString = 128
    static let maxDevice = 64
    static let maxKey = 64

    /// Matches /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,63}$/ with no "..".
    static func isValidKey(_ key: String) -> Bool {
        guard !key.isEmpty, key.utf16.count <= maxKey, !key.contains("..") else { return false }
        for (i, scalar) in key.unicodeScalars.enumerated() {
            let alnum = scalar.isASCII && CharacterSet.alphanumerics.contains(scalar)
            if i == 0 ? !alnum : !(alnum || "._/-".unicodeScalars.contains(scalar)) { return false }
        }
        return true
    }

    private static func isBool(_ n: NSNumber) -> Bool { CFGetTypeID(n) == CFBooleanGetTypeID() }

    private static func isFiniteNumber(_ value: Any) -> Bool {
        guard let n = value as? NSNumber, !isBool(n) else { return false }
        return n.doubleValue.isFinite
    }

    static func isValidValue(_ value: Any) -> Bool {
        if value is NSNull { return true }
        if let n = value as? NSNumber { return isBool(n) || n.doubleValue.isFinite }
        if let s = value as? String { return s.utf16.count <= maxString }
        if let list = value as? [Any] {
            guard list.count <= maxList else { return false }
            return list.allSatisfy(isFiniteNumber) || list.allSatisfy { ($0 as? String).map { $0.utf16.count <= maxListString } ?? false }
        }
        return false
    }

    static func field(from raw: Any) -> Field? {
        guard let object = raw as? [String: Any],
              let v = object["v"], isValidValue(v),
              let tRaw = object["t"], isFiniteNumber(tRaw), let t = (tRaw as? NSNumber)?.doubleValue,
              let d = object["d"] as? String, d.utf16.count <= maxDevice
        else { return nil }
        return Field(v: v, t: t, d: d)
    }

    /// Validates state that arrived over the network before it is merged or stored.
    static func sanitize(_ raw: Any?) -> SyncState {
        guard let object = raw as? [String: Any] else { return [:] }
        var clean: SyncState = [:]
        for (key, rawRecord) in object {
            guard isValidKey(key), let record = rawRecord as? [String: Any] else { continue }
            var fields: SyncRecord = [:]
            for (name, rawField) in record where isValidKey(name) {
                if let field = field(from: rawField) { fields[name] = field }
            }
            if !fields.isEmpty { clean[key] = fields }
        }
        return clean
    }

    /// Returns the merged state and whether anything in `base` changed.
    static func merge(_ base: SyncState, _ incoming: SyncState) -> (SyncState, Bool) {
        var merged = base
        var changed = false
        for (key, record) in incoming {
            var target = merged[key] ?? [:]
            for (name, field) in record {
                if let existing = target[name], !field.isNewer(than: existing) { continue }
                target[name] = field
                changed = true
            }
            merged[key] = target
        }
        return (merged, changed)
    }

    static func jsonObject(_ state: SyncState) -> [String: Any] {
        state.mapValues { record in record.mapValues { $0.json } }
    }
}
