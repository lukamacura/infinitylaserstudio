Parameters
These parameters consist of all required event data parameters and any additional data parameters the Conversions API needs to use for ads attribution and/or ads delivery optimization.

The Conversions API now supports web, app, offline, and business messaging events.

Website events shared using the Conversions API require the client_user_agent, action_source, and event_source_url parameters, while non-web events require only action_source. These parameters contribute to improving the quality of events used for ad delivery and may improve campaign performance.

By using the Conversions API, you agree that the action_source parameter is accurate to the best of your knowledge.

Main Body Parameters
data
test_event_code
Customer Information Parameters
em: Email — Hashing required
ph: Phone Number — Hashing required
fn: First Name — Hashing required
ln: Last Name — Hashing required
ge: Gender — Hashing required
db: Date of Birth — Hashing required
ct: City — Hashing required
st: State — Hashing required
zp: Zip Code — Hashing required
country: Country — Hashing required
external_id: External ID — Hashing recommended
client_ip_address: Client IP Address — Do not hash
client_user_agent: Client User Agent — Do not hash
fbc: Click ID — Do not hash
fbp: Browser ID — Do not hash
subscription_id: Subscription ID — Do not hash
fb_login_id: Facebook Login ID — Do not hash
lead_id: Lead ID — Do not hash
anon_id: Install ID — Do not hash (Note: This parameter is for app events only)
madid: Mobile Advertiser ID — Do not hash (Note: This parameter is for app events only)
page_id: Page ID — Do not hash
page_scoped_user_id: Page scoped user ID — Do not hash
ctwa_clid: Click to WhatsApp ID — Do not hash
ig_account_id: IG account ID — Do not hash
ig_sid: Click to Instagram ID — Do not hash
Server Event Parameters
event_name
event_time
user_data
custom_data
event_source_url
opt_out
event_id
action_source
data_processing_options
data_processing_options_country
data_processing_options_state
referrer_url
customer_segmentation
App Data Parameters
advertiser_tracking_enabled
application_tracking_enabled
extinfo
campaign_ids
install_referrer
installer_package
url_schemes
windows_attribution_id
anon_id
madid
vendor_id
Note: See the Conversions API for App Events documentation for guidance on integrating app events.

Standard Parameters
See a list of all standard parameters users can send to Meta.

Original Event Data Parameters
event_name
event_time
order_id
event_id