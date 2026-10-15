# Public phone-controller proof of concept

Frontend and controller: https://joncady.github.io/R3F-Table-Tennis/
HTTP pairing: https://4jcmv1vcki.execute-api.us-west-2.amazonaws.com
WebSocket: wss://v4jcvfup57.execute-api.us-west-2.amazonaws.com/prod
Stack: PingPongRelayPrototype in us-west-2.

GitHub Pages hosts the game, controller.html, and swing.mjs over trusted HTTPS.
API Gateway exposes HTTPS pairing and WSS connections. Lambda routes messages;
a pay-per-request DynamoDB table stores random pairings and connections with
2-hour expiry. No local CA, shared Wi-Fi, inbound laptop port, or always-on server
is required. AWS usage is billed to the configured account.

The protocol carries calibrated rotation, acceleration displacement, sequence
numbers, toss/pause commands, and authoritative impact events. The phone shows
**Phone ↔ game round-trip**, measured by echoing through the actual desktop
WebSocket client. This includes both relay traversals; it is not one-way latency.
Out-of-order motion is discarded. Local sensor capture/trial upload remains local
only and is disabled on the hosted controller.

## Update

1. `npm run cloud:template`
2. `aws cloudformation deploy --template-file cloud/template.generated.json --stack-name PingPongRelayPrototype --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset`
3. Set repository Actions variable `PING_PONG_RELAY_HTTP` to the stack HttpUrl.
4. Push main. The Pages workflow runs checks, generates phone assets, builds with
   `VITE_RELAY_HTTP`, and deploys dist.
5. `RELAY_HTTP=https://4jcmv1vcki.execute-api.us-west-2.amazonaws.com npm run test:cloud`

For local development, leave VITE_RELAY_HTTP unset and run npm run controller.
Both local and hosted endpoints use the same browser controller and game path.
Raw recordings, private CA keys, generated replay data, and screen captures are
ignored and are not part of the Pages deployment.

## Validate on Android

Open the public game on the desktop, choose Pair Android phone, and create a new
pairing. Scan its QR on Android, Connect, calibrate the natural grip, select Use
phone on desktop, and resume. Use Test impact feedback on the phone, then verify
feedback on real paddle contact. Read the round-trip number during motion.
The automated cloud test uses synthetic clients on this computer; actual phone
network conditions and physical feedback still require this manual check.

The first cold burst hit the original reserved Lambda concurrency of 20. The
stack now uses 60 and 512 MB, with immutable connection lookup caching. These
settings provide prototype headroom but do not remove serverless cold starts.
No webcam validation, gameplay tuning, or scheduled follow-up is enabled here.
