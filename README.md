# Spode NAS

> Dieses Repository ist auf Englisch, da sie die Standardsprache im technischen Kontext ist.

This repository contains the main files for my Seminararbeit titled **"Network Attached Storage auf Raspberry-Pi-Basis"**. Internally, the project is called **Spode NAS**.

It does not include any config files or Bash scripts, since these contain system-specific details such as credentials, network settings and paths.

## Overview

Spode NAS is a self-built Network Attached Storage system running on a Raspberry Pi 5. It combines redundant storage, standard network file sharing and a custom web interface for remote access. The goal of the project is to show that a capable, secure and affordable NAS can be built from consumer hardware and open-source software, and to evaluate it in terms of performance and reliability.

## Features

- RAID 5 storage array managed with `mdadm`
- File sharing inside the local network via Samba (SMB)
- Web interface for browsing, downloading and uploading files remotely
- REST API built with Flask, served by gunicorn as a systemd service
- Token-based authentication for the API
- HTTPS access through a Caddy reverse proxy
- Dynamic DNS via DuckDNS, firewall managed with `ufw`
- Custom 3D-printed enclosure

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

## Repository Contents

This repository holds the main project files, in particular:

- the source code of the web interface and the Flask API
- documentation and diagrams

Configuration files and shell scripts are deliberately excluded.

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

- The setup currently relies on IPv6 for external access, because the internet provider uses DS-Lite without a public IPv4 address.
- The drives are a mix of new and used units, which affects both performance and the reliability estimate.

## Security Note

Because the NAS is reachable from the internet, all remote access goes through HTTPS and token authentication, and the firewall allows only the required ports. No credentials, tokens or system configuration are stored in this repository.


## License

All rights reserved, unless stated otherwise. Please contact the author before reusing any content.
