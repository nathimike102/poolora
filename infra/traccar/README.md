# Car tracker gateway

Poolora reads car GPS trackers through [Traccar](https://www.traccar.org) running as a **forwarder only**: it understands the trackers' protocols, stores nothing, and posts every position to the backend (`POST /api/v1/trackers/traccar`). The backend keeps a car's positions only while it is on a ride or an SOS is open, and otherwise only the time it last reported (for the "Tracked car" badge). See `backend/src/services/TrackerService.ts`.

## Run it

1. `cp traccar.example.xml traccar.xml` and fill in `forward.url` and the key in `forward.header`.
2. Set the same key in `backend/.env`: `TRACKER_GATEWAY_KEY=...` (any long random string: `openssl rand -hex 32`).
3. Set where drivers point their tracker, shown in the app: `TRACKER_GATEWAY_HOST=track.your-domain` and `TRACKER_GATEWAY_PORT=5023`.
4. Start it: `docker compose up -d traccar` from `backend/` (the service mounts this folder's `traccar.xml`). In Kubernetes, use `k8s/traccar-deployment.yaml`.
5. Open the TCP ports to the internet: 5023 (GT06), 5027 (Teltonika), 5013 (H02), 5055 (OsmAnd), 5039 (Wialon retranslation).

## Point a tracker at it

Most trackers are set by SMS from the owner's phone. For a GT06-type device the usual commands are (check the device's manual; the password is often `123456` or none):

```
SERVER,1,track.your-domain,5023,0#
APN,<the SIM network's data APN>#   (ask the network for its APN)
```

The device id the driver enters in the app is its IMEI (15 digits, on the label or by SMS `IMEI#`).

## Test without a device

Install the Traccar Client app on a phone, set the server to `http://track.your-domain:5055` and the device identifier to a test id, then link that id to a test vehicle in the app.

## A tracking company that agrees to share

Ask them to retranslate the consenting drivers' cars to this gateway. Most platforms can: Wialon ("retranslator", Wialon IPS to port 5039), or Traccar and GPSWox (forwarding). The driver links the same device id in the app.
