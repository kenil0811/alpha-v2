// Alpha's helper on the Mac: the Keychain, Calendar and Contacts, answering in JSON. Node cannot
// reach these; connector-sdk/src/helper.ts runs it.
import Contacts
import EventKit
import Foundation
import Security

func out(_ value: Any) {
  let data = try! JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
  FileHandle.standardOutput.write(data)
  FileHandle.standardOutput.write("\n".data(using: .utf8)!)
}
func fail(_ words: String, _ code: Int32 = 1) -> Never {
  out(["ok": false, "problem": words]); exit(code)
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
  let iso = ISO8601DateFormatter()
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

default:
  fail("unknown: \(cmd)")
}
