# On-demand match service

Live frontend: https://joncady.github.io/R3F-Table-Tennis/?multiplayer
Control API: https://2dwapmqu97.execute-api.us-west-2.amazonaws.com
WSS hostname: match.pingpong.kureo.dev (only available while a task is ready)
Stack: `PingPongMatches`, AWS account `221027267881`, region `us-west-2`.

See the root README for the measured cold-start/game/shutdown trial and limits.
This is a private single-match prototype, not an open matchmaking queue.

## Local development

```sh
npm ci
npm run dev
npm run multiplayer
```

Open `http://127.0.0.1:5174/R3F-Table-Tennis/?multiplayer` and create a room using
`local-development`. The local control API listens on 8790 and starts a room
server on 8791. A browser on the same computer can use the local phone page;
physical sensors still require trusted HTTPS. Use the public deployment for
physical iPhone/Android testing. Solo local phone pairing still uses the
separate `npm run controller` service.

`VITE_MATCH_HTTP` overrides the control endpoint; production builds receive it
from GitHub Actions variable `PING_PONG_MATCH_HTTP`. Leave it unset for local
matching. `VITE_RELAY_HTTP` continues to configure solo phone pairing separately.

## Deploy/update

The deployment helper is intentionally configured for this account, existing
public subnet/VPC, ECR repository `pingpong-match`, and delegated DNS zone
`Z06848001XU9OPPTT1WDP`. Review those constants before using another account.
It does not change the main kureo.dev hosted project.

```sh
npm test
npm run lint
npm run build
docker build --platform linux/amd64 -f multiplayer/Dockerfile -t pingpong-match:prototype .
npm run multiplayer:deploy
```

Requires Docker, AWS CLI sign-in, and an existing ECR repository. The helper
pushes the image and pins CloudFormation to its digest. It creates/preserves a
random private launch key and passes it as a NoEcho CloudFormation parameter.
Secrets use a temporary mode-0600 parameter file, removed after deployment.
Certificate state is retained in encrypted private S3 storage across task exits;
Caddy obtains and renews trusted certificates. Ports 80 (ACME/HTTPS redirect)
and 443 are public; raw Node port 8080 and SSH are not exposed.

Only `pingpong.kureo.dev` is delegated from the existing registrar to these NS
records: `ns-984.awsdns-59.net`, `ns-1072.awsdns-06.org`,
`ns-2016.awsdns-60.co.uk`, `ns-5.awsdns-00.com`. The deployment helper shortens
this child zone's negative DNS caching and seeds an idle TEST-NET address if the
match hostname does not exist. Lifecycle code updates its 10-second-TTL A record,
waits for Route 53 INSYNC plus a propagation grace, and restores the idle address
on cleanup. There is no retained Elastic IP, ALB, NAT gateway or ECS service.

Set GitHub Actions variable `PING_PONG_MATCH_HTTP` to the stack's ControlUrl,
then push main to publish Pages. No launch key or player credential goes into
that variable. `npm run multiplayer:deploy` updates AWS only; the existing Pages
workflow separately builds and deploys the browser/controller.

## Private files

All `*.local` files are gitignored and excluded from Docker build context:

- `launch-key.local`: private room-creation key (do not commit/share publicly).
- `deployment.local`: stack outputs used by the cloud test.
- `trial-room.local`: latest synthetic trial's private room credentials.
- `cloud-evidence.local`: measured latest successful live test, without tokens.

Generated `engine.mjs` and `template.generated.json` are ignored. Build/transpile
scripts regenerate them from checked-in source. Keep the TLS bucket private;
its cache contains certificate private keys and ACME account state.

## Tests and diagnostics

```sh
npm run test:multiplayer
npm run test:multiplayer:cloud
```

The cloud test creates a paid task, tests launch authorization/cap, joins both
seats, runs the shipped iPhone/Android controller script with sensor/API doubles
over public WSS, serves with mouse input, verifies phone paddle return/impact,
pauses/resumes, disconnects and switches control mode. It closes clients, waits
for ECS STOPPED and checks zero remaining running tasks. The previous saved
trial must be stopped before another starts. A failed trial also has idle/lifetime
limits; inspect the private evidence/room files and stack logs to diagnose it.
Physical phone accuracy, audio/haptics and two-person network feel are separate
manual checks; these tests do not operate actual phones.

The template outputs the Cluster, RoomTable, GameLogGroup and CertificateBucket
names. Control logs: `/aws/lambda/PingPongMatches-control`. Logs retain seven days.
A one-minute EventBridge watchdog uses the active DynamoDB room lock and server
heartbeats; it stops orphan/stale tasks and imposes a two-hour maximum. Paused
rooms time out after five minutes, both-disconnected rooms after 90 seconds, and
finished games after two minutes. Match state lives in the task: shutdown loses
the current game. Reconnection inside the grace period uses the saved player URL;
a stopped task requires a new room. Retrying room creation after a lost HTTP
response is not an idempotent room-recovery flow yet.

## Costs and limits

One 0.5-vCPU / 1-GB Linux/x86 task plus a temporary public IPv4 address is about
$0.0297/hour in Oregon before transfer/logs/storage/control requests. Billing
includes startup and grace time. Idle game compute is zero. Route 53 adds
$0.50/month for the child zone, plus small ECR/S3/DynamoDB/serverless-watchdog
costs. API Gateway handles room control and heartbeats, not per-frame gameplay.

One active room at a time is enforced with a conditional DynamoDB lock. Seats
have independent display/controller credentials, the server derives ownership
from the token, caps/normalizes inputs, discards old phone sequences and applies
one paddle source per seat. Invites claim the second seat once. Preserve your
player URL for reconnects. There is no AI fallback, account system, public queue,
match-state failover, local prediction, or lag compensation in this version.
