//! Notifications from Alpha (Kenil's plan, step 2): reminders and cards that need the person, shown
//! through macOS's own notification centre with Alpha's name and icon. A click opens the place the
//! notice names (a task, or Needs you on Home). macOS asks the person once whether Alpha may.

use std::sync::OnceLock;

use block2::RcBlock;
use objc2::rc::Retained;
use objc2::runtime::{Bool, ProtocolObject};
use objc2::{define_class, msg_send, AllocAnyThread};
use objc2_foundation::{NSError, NSObject, NSObjectProtocol, NSString};
use objc2_user_notifications::{
    UNAuthorizationOptions, UNMutableNotificationContent, UNNotification,
    UNNotificationPresentationOptions, UNNotificationRequest, UNNotificationResponse,
    UNNotificationSound, UNUserNotificationCenter, UNUserNotificationCenterDelegate,
};

/// What a click on a notice does: opens its place in Alpha's window.
static OPEN: OnceLock<Box<dyn Fn(String) + Send + Sync>> = OnceLock::new();
/// The centre keeps its delegate weakly: the shell keeps it for as long as it runs.
static DELEGATE: OnceLock<Retained<Delegate>> = OnceLock::new();

define_class!(
    // SAFETY: NSObject has no subclassing requirements, and Delegate does not implement Drop.
    #[unsafe(super(NSObject))]
    #[name = "AlphaNoticeDelegate"]
    struct Delegate;

    unsafe impl NSObjectProtocol for Delegate {}

    unsafe impl UNUserNotificationCenterDelegate for Delegate {
        // shown even while Alpha is the app in front
        #[unsafe(method(userNotificationCenter:willPresentNotification:withCompletionHandler:))]
        fn will_present(
            &self,
            _center: &UNUserNotificationCenter,
            _notification: &UNNotification,
            handler: &block2::DynBlock<dyn Fn(UNNotificationPresentationOptions)>,
        ) {
            handler.call((UNNotificationPresentationOptions::Banner
                | UNNotificationPresentationOptions::List
                | UNNotificationPresentationOptions::Sound,));
        }

        #[unsafe(method(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:))]
        fn did_receive(
            &self,
            _center: &UNUserNotificationCenter,
            response: &UNNotificationResponse,
            handler: &block2::DynBlock<dyn Fn()>,
        ) {
            let id = response.notification().request().identifier().to_string();
            if let (Some((_, place)), Some(open)) = (id.split_once('|'), OPEN.get()) {
                open(place.to_string());
            }
            handler.call(());
        }
    }
);

impl Delegate {
    fn new() -> Retained<Self> {
        let this = Self::alloc().set_ivars(());
        unsafe { msg_send![super(this), init] }
    }
}

/// Takes notices from here on: asks macOS once whether Alpha may show them, and opens a clicked
/// one's place with `open`.
pub fn start(open: impl Fn(String) + Send + Sync + 'static) {
    let _ = OPEN.set(Box::new(open));
    let center = UNUserNotificationCenter::currentNotificationCenter();
    let delegate = DELEGATE.get_or_init(Delegate::new);
    center.setDelegate(Some(ProtocolObject::from_ref(&**delegate)));
    let asked = RcBlock::new(|_granted: Bool, _error: *mut NSError| {});
    center.requestAuthorizationWithOptions_completionHandler(
        UNAuthorizationOptions::Alert | UNAuthorizationOptions::Sound,
        &asked,
    );
}

/// One notice. Its id keeps the same notice from showing twice; `place` is where a click goes.
pub fn show(id: &str, title: &str, subtitle: Option<&str>, body: &str, place: &str) {
    let content = UNMutableNotificationContent::new();
    content.setTitle(&NSString::from_str(title));
    if let Some(subtitle) = subtitle {
        content.setSubtitle(&NSString::from_str(subtitle));
    }
    content.setBody(&NSString::from_str(body));
    content.setSound(Some(&UNNotificationSound::defaultSound()));
    let request = UNNotificationRequest::requestWithIdentifier_content_trigger(
        &NSString::from_str(&format!("{id}|{place}")),
        &content,
        None,
    );
    UNUserNotificationCenter::currentNotificationCenter()
        .addNotificationRequest_withCompletionHandler(&request, None);
}
