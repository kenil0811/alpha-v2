// Alpha's helper on the Mac: the Keychain, Calendar and Contacts, and what onboarding reads on the
// computer (Safari's history, the apps and their use, Screen Time, the names in three folders),
// answering in JSON. Node cannot reach these; connector-sdk/src/helper.ts runs it. It returns raw
// rows and decides nothing: counting, filters and words are the core's (onboarding design §4).
import AppKit
import Contacts
import CoreServices
import EventKit
import Foundation
import Security
import SQLite3

func out(_ value: Any) {
  let data = try! JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
  FileHandle.standardOutput.write(data)
  FileHandle.standardOutput.write("\n".data(using: .utf8)!)
}
func fail(_ words: String, _ code: Int32 = 1) -> Never {
  out(["ok": false, "problem": words]); exit(code)
}

let iso = ISO8601DateFormatter()
let home = FileManager.default.homeDirectoryForCurrentUser

// A store another app keeps open (Safari, Screen Time), read from a copy with its -wal and -shm,
// so its lock is never in the way; nil when macOS will not let Alpha read it (Full Disk Access).
func copied(_ file: URL) -> URL? {
  let fm = FileManager.default
  let dir = fm.temporaryDirectory.appendingPathComponent("alpha-\(UUID().uuidString)")
  try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
  for suffix in ["", "-wal", "-shm"] {
    let from = URL(fileURLWithPath: file.path + suffix)
    let to = dir.appendingPathComponent(file.lastPathComponent + suffix)
    if suffix.isEmpty {
      guard (try? fm.copyItem(at: from, to: to)) != nil else { return nil }
    } else if fm.fileExists(atPath: from.path) {
      try? fm.copyItem(at: from, to: to)
    }
  }
  return dir.appendingPathComponent(file.lastPathComponent)
}

// Each row of a query as text and numbers, the store's copy removed after.
func rows(_ db: URL, _ sql: String, _ bind: [Double] = []) -> [[Any]] {
  defer { try? FileManager.default.removeItem(at: db.deletingLastPathComponent()) }
  var handle: OpaquePointer?
  guard sqlite3_open_v2(db.path, &handle, SQLITE_OPEN_READONLY, nil) == SQLITE_OK else { return [] }
  defer { sqlite3_close(handle) }
  var stmt: OpaquePointer?
  guard sqlite3_prepare_v2(handle, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
  defer { sqlite3_finalize(stmt) }
  for (i, v) in bind.enumerated() { sqlite3_bind_double(stmt, Int32(i + 1), v) }
  var out: [[Any]] = []
  while sqlite3_step(stmt) == SQLITE_ROW {
    out.append((0..<sqlite3_column_count(stmt)).map { c -> Any in
      switch sqlite3_column_type(stmt, c) {
      case SQLITE_INTEGER, SQLITE_FLOAT: return sqlite3_column_double(stmt, c)
      case SQLITE_TEXT: return String(cString: sqlite3_column_text(stmt, c))
      default: return NSNull()
      }
    })
  }
  return out
}

// A moment as macOS's own stores keep it (seconds since 2001), as an ISO string.
func when(_ v: Any) -> String {
  guard let s = v as? Double else { return "" }
  return iso.string(from: Date(timeIntervalSinceReferenceDate: s))
}
func since(_ arg: String?) -> Double {
  (arg.flatMap { iso.date(from: $0) } ?? Date().addingTimeInterval(-86400 * 90)).timeIntervalSinceReferenceDate
}

let safariHistory = home.appendingPathComponent("Library/Safari/History.db")
let knowledge = home.appendingPathComponent("Library/Application Support/Knowledge/knowledgeC.db")
let biome = home.appendingPathComponent("Library/Biome/streams/restricted/App.InFocus/local")
let folders = ["documents": "Documents", "desktop": "Desktop", "downloads": "Downloads"]

// What a folder holds, its own and its folders' names, kinds and dates, never their contents:
// hidden files, bundles, node_modules, .git and Library left out, at most 50,000.
func walk(_ root: URL) -> [[String: Any]]? {
  let fm = FileManager.default
  guard (try? fm.contentsOfDirectory(atPath: root.path)) != nil else { return nil }
  let keys: [URLResourceKey] = [.isDirectoryKey, .contentModificationDateKey, .fileSizeKey]
  guard let e = fm.enumerator(at: root, includingPropertiesForKeys: keys,
                              options: [.skipsHiddenFiles, .skipsPackageDescendants]) else { return [] }
  var out: [[String: Any]] = []
  for case let url as URL in e {
    let name = url.lastPathComponent
    if ["node_modules", ".git", "Library"].contains(name) { e.skipDescendants(); continue }
    let v = try? url.resourceValues(forKeys: Set(keys))
    out.append([
      "path": String(url.path.dropFirst(root.path.count + 1)), "folder": v?.isDirectory ?? false,
      "modified": v?.contentModificationDate.map { iso.string(from: $0) } ?? "",
      "size": v?.fileSize ?? 0,
    ])
    if out.count >= 50_000 { break }
  }
  return out
}

// The outermost app around this helper: the one a person switches on in System Settings.
func outerApp() -> URL {
  var url = Bundle.main.bundleURL
  var outer = url
  while url.path != "/" {
    if url.pathExtension == "app" { outer = url }
    url.deleteLastPathComponent()
  }
  return outer
}

let args = Array(CommandLine.arguments.dropFirst())
guard let cmd = args.first else { fail("say what to do") }

switch cmd {
case "keychain":
  guard args.count >= 4 else { fail("keychain set|get|delete <service> <account>") }
  let (op, service, account) = (args[1], args[2], args[3])
  let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                             kSecAttrService as String: service, kSecAttrAccount as String: account]
  switch op {
  case "set":
    let secret = FileHandle.standardInput.readDataToEndOfFile()
    SecItemDelete(base as CFDictionary)
    var add = base; add[kSecValueData as String] = secret
    add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
    let s = SecItemAdd(add as CFDictionary, nil)
    if s != errSecSuccess { fail("keychain add failed: \(s)") }
    out(["ok": true])
  case "get":
    var q = base; q[kSecReturnData as String] = true; q[kSecMatchLimit as String] = kSecMatchLimitOne
    var item: CFTypeRef?
    let s = SecItemCopyMatching(q as CFDictionary, &item)
    guard s == errSecSuccess, let data = item as? Data else { fail("no secret: \(s)") }
    FileHandle.standardOutput.write(data)
  case "delete":
    let s = SecItemDelete(base as CFDictionary)
    if s != errSecSuccess && s != errSecItemNotFound { fail("delete failed: \(s)") }
    out(["ok": true])
  default: fail("keychain set|get|delete")
  }

case "calendar":
  let store = EKEventStore()
  // macOS asks the person once; after a no, only System Settings turns it on, and the words say so
  let before = EKEventStore.authorizationStatus(for: .event)
  let sem = DispatchSemaphore(value: 0)
  var granted = false
  store.requestFullAccessToEvents { ok, _ in granted = ok; sem.signal() }
  sem.wait()
  guard granted else {
    fail(before == .notDetermined ? "calendar access was not given" : "calendar access is off", 2)
  }
  let from = args.count > 1 ? iso.date(from: args[1]) ?? Date() : Date()
  let to = args.count > 2 ? iso.date(from: args[2]) ?? from.addingTimeInterval(86400 * 7) : from.addingTimeInterval(86400 * 7)
  let pred = store.predicateForEvents(withStart: from, end: to, calendars: nil)
  let events = store.events(matching: pred).map { e -> [String: Any] in
    [
      "id": e.calendarItemExternalIdentifier ?? e.eventIdentifier ?? "",
      "title": e.title ?? "",
      "start": iso.string(from: e.startDate), "end": iso.string(from: e.endDate),
      "allDay": e.isAllDay, "location": e.location ?? "", "calendar": e.calendar.title,
      "attendees": (e.attendees ?? []).map { a in
        ["name": a.name ?? "", "email": a.url.absoluteString.replacingOccurrences(of: "mailto:", with: ""),
         "me": a.isCurrentUser]
      },
      "organizer": e.organizer.map { o in
        ["name": o.name ?? "", "email": o.url.absoluteString.replacingOccurrences(of: "mailto:", with: ""),
         "me": o.isCurrentUser]
      } ?? [:],
    ]
  }
  out(["ok": true, "events": events])

case "contacts":
  let store = CNContactStore()
  let before = CNContactStore.authorizationStatus(for: .contacts)
  let sem = DispatchSemaphore(value: 0)
  var granted = false
  store.requestAccess(for: .contacts) { ok, _ in granted = ok; sem.signal() }
  sem.wait()
  guard granted else {
    fail(before == .notDetermined ? "contacts access was not given" : "contacts access is off", 2)
  }
  let keys = [CNContactGivenNameKey, CNContactFamilyNameKey, CNContactOrganizationNameKey,
              CNContactJobTitleKey, CNContactEmailAddressesKey, CNContactPhoneNumbersKey,
              CNContactSocialProfilesKey, CNContactUrlAddressesKey, CNContactIdentifierKey] as [CNKeyDescriptor]
  // the person's own card, so they are never one of their contacts
  let me = (try? store.unifiedMeContactWithKeys(toFetch: [CNContactIdentifierKey as CNKeyDescriptor]))?.identifier
  var people: [[String: Any]] = []
  try? store.enumerateContacts(with: CNContactFetchRequest(keysToFetch: keys)) { c, _ in
    people.append([
      "id": c.identifier, "given": c.givenName, "family": c.familyName, "company": c.organizationName,
      "title": c.jobTitle, "me": c.identifier == me,
      "emails": c.emailAddresses.map { $0.value as String },
      "phones": c.phoneNumbers.map { $0.value.stringValue },
      "links": c.socialProfiles.map { $0.value.urlString } + c.urlAddresses.map { $0.value as String },
    ])
  }
  out(["ok": true, "contacts": people])

case "safari-visits":
  guard FileManager.default.fileExists(atPath: safariHistory.path) else { fail("absent", 4) }
  guard let db = copied(safariHistory) else { fail("full disk access is off", 3) }
  let visits = rows(db, """
    SELECT i.url, v.title, v.visit_time FROM history_visits v
    JOIN history_items i ON i.id = v.history_item WHERE v.visit_time > ? ORDER BY v.visit_time
    """, [since(args.dropFirst().first)])
  out(["ok": true, "visits": visits.map { ["url": $0[0], "title": $0[1], "at": when($0[2])] }])

case "apps":
  // every app's last use and how often it was opened, as Spotlight keeps them
  let fm = FileManager.default
  var apps: [[String: Any]] = []
  for dir in ["/Applications", "/Applications/Utilities", home.path + "/Applications",
              "/System/Applications", "/System/Applications/Utilities"] {
    for name in (try? fm.contentsOfDirectory(atPath: dir)) ?? [] where name.hasSuffix(".app") {
      let path = dir + "/" + name
      let item = MDItemCreate(nil, path as CFString)
      let used = item.flatMap { MDItemCopyAttribute($0, kMDItemLastUsedDate) as? Date }
      let count = item.flatMap { MDItemCopyAttribute($0, "kMDItemUseCount" as CFString) as? Int }
      apps.append([
        "name": String(name.dropLast(4)), "id": Bundle(path: path)?.bundleIdentifier ?? "",
        "lastUsed": used.map { iso.string(from: $0) } ?? "", "launches": count ?? 0,
        "system": dir.hasPrefix("/System"),
      ])
    }
  }
  out(["ok": true, "apps": apps])

case "app-time":
  // the time in each app: Screen Time's knowledgeC.db, else what the Biome streams hold
  let from = since(args.dropFirst().first)
  if FileManager.default.fileExists(atPath: knowledge.path) {
    guard let db = copied(knowledge) else { fail("full disk access is off", 3) }
    let spans = rows(db, """
      SELECT ZVALUESTRING, ZSTARTDATE, ZENDDATE FROM ZOBJECT
      WHERE ZSTREAMNAME = '/app/usage' AND ZSTARTDATE > ? ORDER BY ZSTARTDATE
      """, [from])
    if !spans.isEmpty {
      out(["ok": true, "from": "knowledgeC", "spans": spans.map {
        ["app": $0[0], "start": when($0[1]), "end": when($0[2])]
      }])
      exit(0)
    }
  }
  // Biome's own record format is read once it is seen on a Mac (onboarding step 1): for now,
  // what is there to read
  guard let files = try? FileManager.default.contentsOfDirectory(at: biome, includingPropertiesForKeys: [.fileSizeKey]) else {
    fail(FileManager.default.fileExists(atPath: biome.deletingLastPathComponent().path)
      ? "full disk access is off" : "absent", FileManager.default.fileExists(atPath: biome.deletingLastPathComponent().path) ? 3 : 4)
  }
  out(["ok": true, "from": "biome", "spans": [], "files": files.map {
    ["name": $0.lastPathComponent, "size": (try? $0.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0]
  }])

case "files":
  guard args.count > 1, let name = folders[args[1]] else { fail("files documents|desktop|downloads") }
  // the first read of each folder is when macOS asks the person, naming Alpha
  guard let found = walk(home.appendingPathComponent(name)) else { fail("\(args[1]) access is off", 2) }
  out(["ok": true, "files": found])

case "access":
  // the state of one part, in the five words every platform uses: ready, ask, settings, absent,
  // refused (what a folder's first read asks is its own dialog, so a folder is tried)
  guard args.count > 1 else { fail("access <part>") }
  let fm = FileManager.default
  func locked(_ file: URL) -> String {
    guard fm.fileExists(atPath: file.deletingLastPathComponent().path) else { return "absent" }
    return fm.isReadableFile(atPath: file.path) && (try? Data(contentsOf: file, options: .alwaysMapped)) != nil
      ? "ready" : "settings"
  }
  switch args[1] {
  case "safari": out(["ok": true, "state": locked(safariHistory)])
  case "screen-time": out(["ok": true, "state": fm.fileExists(atPath: knowledge.path) ? locked(knowledge)
    : (try? fm.contentsOfDirectory(atPath: biome.path)) != nil ? "ready" : "settings"])
  case "documents", "desktop", "downloads":
    let dir = home.appendingPathComponent(folders[args[1]]!)
    out(["ok": true, "state": !fm.fileExists(atPath: dir.path) ? "absent"
      : (try? fm.contentsOfDirectory(atPath: dir.path)) != nil ? "ready" : "refused"])
  default: fail("access safari|screen-time|documents|desktop|downloads")
  }

case "show-settings":
  // Privacy & Security at the part's pane, and Alpha shown in Finder beside it to switch on or drag in
  guard args.count > 1 else { fail("show-settings <part>") }
  let pane = ["safari": "Privacy_AllFiles", "screen-time": "Privacy_AllFiles"][args[1]] ?? "Privacy_FilesAndFolders"
  NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.security?\(pane)")!)
  NSWorkspace.shared.activateFileViewerSelecting([outerApp()])
  out(["ok": true, "app": outerApp().path])

default:
  fail("unknown: \(cmd)")
}
