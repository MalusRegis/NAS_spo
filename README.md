# Spode NAS

> Dieses Repository ist auf Englisch, da sie die Standardsprache im technischen Kontext ist.

This repository contains the web interface and the Flask API of **Spode NAS**, the practical part of my Seminararbeit titled **"Network Attached Storage auf Raspberry-Pi-Basis"**.

It does not include any config files or Bash scripts (Samba, mdadm, Caddy, systemd, cron), since these contain system-specific details such as credentials, network settings and paths.

## Overview

Spode NAS is a self-built Network Attached Storage system running on a Raspberry Pi 5. It combines redundant storage (RAID 5), standard network file sharing (Samba) and a custom web interface for remote access. The goal of the project is to show that a capable, secure and affordable NAS can be built from consumer hardware and open-source software, and to evaluate it in terms of performance and reliability.

## Features

**System**
- RAID 5 array managed with `mdadm`
- File sharing inside the local network via Samba (SMB)
- HTTPS access through a Caddy reverse proxy, dynamic DNS via DuckDNS, firewall managed with `ufw`
- Custom 3D-printed enclosure

**Web interface and API (this repository)**
- Browse folders with breadcrumb navigation, search and sortable columns
- Upload (multiple files, drag and drop, progress bar), download, create folders, delete
- Preview for images, PDF and text files
- REST API built with Flask, served by gunicorn as a systemd service
- Token-based authentication (can be disabled for development)
- Path traversal protection and atomic uploads
- The interface itself is in German

## Hardware

| Component | Description |
|---|---|
| Board | Raspberry Pi 5 |
| Storage interface | Waveshare PCIe to SATA HAT+ and USB 3.0 |
| Power supply | Dedicated USB-C supply (5 A) |
| Drives | SanDisk SSD Plus 2 TB, Samsung Portable SSD T7 2 TB, 3 TB HDD |
| System drive | USB drive (migrated from SD card with `rpi-clone`) |
| Network | Wired Gigabit Ethernet |
| Enclosure | Custom design, printed on a Prusa XL |

## Software Stack

| Layer | Technology |
|---|---|
| Operating system | Raspberry Pi OS (Linux) |
| Redundancy | mdadm, RAID 5 |
| File sharing | Samba |
| Backend | Python, Flask, gunicorn |
| Frontend | Plain HTML, CSS and JavaScript (no framework) |
| Reverse proxy | Caddy (automatic HTTPS) |
| Security | ufw, token authentication |
| Remote access | DuckDNS, port forwarding on the router |

## Architecture

```
 Client (browser / file manager)
        |
        |  HTTPS (443)                SMB (local network)
        v                                   |
     Caddy  -->  gunicorn + Flask API       |
                        |                   |
                        +-------+-----------+
                                |
                         RAID 5 (mdadm)
                                |
                   SSD  +  SSD  +  HDD
```

## Repository Structure

```
api.py                 Flask API, also serves index.html
index.html             Single-page web interface (German)
static/css/            Stylesheet
static/js/app.js       Frontend logic (API layer, rendering, actions)
requirements.txt       Python dependencies
```

## Getting Started

Requirements: Python 3 and a directory to serve. The storage root is set by `BASE_DIR` at the top of `api.py` (default: `/mnt/raid5`). Change it to any folder for local testing.

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Development, without authentication
SPODE_AUTH=0 python3 api.py
# then open http://127.0.0.1:5000

# Production, with authentication, behind a reverse proxy
export SPODE_API_TOKEN="a-long-random-secret"
gunicorn -w 2 -b 127.0.0.1:5000 api:app
```

| Variable | Default | Description |
|---|---|---|
| `SPODE_API_TOKEN` | none | Shared secret. Required unless authentication is disabled. |
| `SPODE_AUTH` | `1` | Set to `0` to disable authentication (development only). |

In the web interface, open "Einstellungen" and enter the token. It is stored in the browser's `localStorage`.

## API

All endpoints except `/` and the static files require the header `Authorization: Bearer <token>`. Paths are relative to the storage root. Errors are returned as JSON: `{"error": "..."}`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/browse[/<path>]` | List folders and files, or describe a single file |
| GET | `/download/<path>` | Download a file as attachment |
| POST | `/upload/<path>` | Upload a file (multipart field `file`). Returns 409 if it exists, unless `?overwrite=true` |
| POST | `/new_folder/<path>` | Create a folder |
| DELETE | `/delete/<path>` | Delete a file or an empty folder |

Upload size is limited to 2 GB per request.

## Seminararbeit

The written work is in German and covers, among other topics:

- the basic principle of a NAS
- the modules and interfaces of the Raspberry Pi
- file systems and redundancy (RAID levels)
- network protocols for file access
- performance analysis and failure probability of the RAID 5 array

## Project Status

| Area | Status |
|---|---|
| Hardware build and enclosure | Done |
| RAID 5 and Samba file sharing | Done |
| Flask API with token login | Done |
| Web interface with HTTPS | Live |
| Access via IPv4 | Planned |

## Known Limitations

- External access currently relies on IPv6, because the internet provider uses DS-Lite without a public IPv4 address.
- The drives are a mix of new and used units, which affects both performance and the reliability estimate.
- Authentication uses a single shared token. There are no user accounts and no per-user permissions.
- Folders can only be deleted when they are empty.

## Security Note

Because the NAS is reachable from the internet, all remote access goes through HTTPS and token authentication, and the firewall allows only the required ports. The API resolves every path against the storage root and rejects anything that escapes it, including via symlinks. The token is compared in constant time. Rate limiting for failed logins should be handled at the reverse proxy.

No credentials, tokens or system configuration are stored in this repository. The token entered in the web interface is kept in the browser's `localStorage`, so use the interface only on devices you trust.

## License

All rights reserved, unless stated otherwise. Please contact the author before reusing any content.
