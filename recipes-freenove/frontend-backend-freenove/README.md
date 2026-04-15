# Freenove FNK0054 — Test Dashboard (Frontend + Backend)

Dashboard web pour tester les composants du kit **Freenove FNK0054** sur Raspberry Pi 5 via une interface React + un backend Python.

---

## Architecture

```
┌─────────────────────┐
│   React Frontend    │  (navigateur PC/tablette)
│   index.html        │
│   app.js / style.css│
└────────┬────────────┘
         │ WebSocket (port 8080)
         ▼
┌─────────────────────┐
│   Backend Python    │  (sur PC ou sur la carte)
│   app.py            │
│   ssh_bridge.py     │
└────────┬────────────┘
         │ SSH (paramiko)
         ▼
┌─────────────────────┐
│  Carte FNK0054      │  (Linux embarqué / Yocto)
│  ├── GPIO / PWM     │
│  ├── I2C / SPI      │
│  ├── Capteurs       │
│  └── scripts Python │
│      /opt/freenove/ │
└─────────────────────┘
```

## Composants testables

| Module            | Script board-side       | Matériel                        |
|-------------------|-------------------------|---------------------------------|
| GPIO Control      | `gpio_control.py`       | LEDs, boutons (BCM 2-27)       |
| PWM               | `pwm_control.py`        | LED dimming (GPIO 12,13,18,19) |
| Servo moteur      | `servo_control.py`      | SG90 (0-180°)                  |
| LED RGB           | `led_rgb.py`            | LED RGB anode commune           |
| I2C Scanner       | `i2c_scan.py`           | Bus I2C (détection périph.)    |
| ADC               | `adc_read.py`           | ADS7830 8-ch (potentiomètre)  |
| DHT11             | `dht_read.py`           | Température + humidité         |
| Ultrason          | `ultrasonic.py`         | HC-SR04 (distance cm)          |
| Buzzer            | `buzzer.py`             | Buzzer actif/passif             |
| Infos système     | `system_info.py`        | CPU temp, RAM, uptime, disque  |
| Terminal SSH      | *(commande libre)*      | Shell distant                   |

## Structure du projet

```
frontend-backend-freenove/
├── frontend-backend-freenove.bb    ← Recette Yocto
└── files/
    ├── backend/
    │   ├── app.py                  ← Serveur WebSocket + HTTP (aiohttp)
    │   ├── config.py               ← Configuration (IP, port, SSH)
    │   ├── ssh_bridge.py           ← Pont SSH (paramiko)
    │   └── requirements.txt
    ├── board-scripts/              ← Scripts installés sur la carte
    │   ├── gpio_control.py
    │   ├── pwm_control.py
    │   ├── servo_control.py
    │   ├── led_rgb.py
    │   ├── i2c_scan.py
    │   ├── adc_read.py
    │   ├── dht_read.py
    │   ├── ultrasonic.py
    │   ├── buzzer.py
    │   └── system_info.py
    └── frontend/
        ├── index.html              ← SPA React (CDN)
        ├── app.js                  ← Composants React
        └── style.css               ← Thème dark
```

## Utilisation

### Mode développement (sur PC)

```bash
# 1. Installer les dépendances Python
cd files/backend
pip install -r requirements.txt

# 2. Configurer l'IP de la carte
export FNK_SSH_HOST=192.168.10.22
export FNK_SSH_USER=root
export FNK_FRONTEND_DIR=$(pwd)/../frontend

# 3. Lancer le backend
python3 app.py
```

Ouvrir `http://localhost:8080` dans le navigateur.

### Mode Yocto (sur la carte)

Ajouter la recette dans `local.conf` :

```
IMAGE_INSTALL:append = " frontend-backend-freenove"
```

Après déploiement, le service `freenove-dashboard` démarre automatiquement.
Accéder au dashboard : `http://<IP_CARTE>:8080`

## Protocole WebSocket

Messages JSON :

```json
// Client → Serveur
{
  "id": "1",
  "action": "gpio_write",
  "params": { "pin": 17, "value": 1 }
}

// Serveur → Client
{
  "type": "response",
  "id": "1",
  "action": "gpio_write",
  "status": "ok",
  "data": { "stdout": "{\"pin\":17,\"value\":1}", "stderr": "", "returncode": 0 }
}
```

### Actions disponibles

| Action            | Params                                        |
|-------------------|-----------------------------------------------|
| `connect`         | `host`, `user`, `password`                    |
| `disconnect`      | —                                             |
| `status`          | —                                             |
| `gpio_setup`      | `pin`, `direction` (in/out)                   |
| `gpio_write`      | `pin`, `value` (0/1)                          |
| `gpio_read`       | `pin`                                         |
| `pwm_start`       | `pin`, `frequency`, `duty`                    |
| `pwm_stop`        | `pin`                                         |
| `servo_set`       | `pin`, `angle` (0-180)                        |
| `led_rgb`         | `r_pin`, `g_pin`, `b_pin`, `r`, `g`, `b`     |
| `i2c_scan`        | `bus`                                         |
| `adc_read`        | `channel` (0-7)                               |
| `dht_read`        | `pin`                                         |
| `ultrasonic_read` | `trig_pin`, `echo_pin`                        |
| `buzzer`          | `pin`, `state` (on/off/tone), `frequency`, `duration` |
| `system_info`     | —                                             |
| `run_command`     | `command`                                     |

## Circuits de référence (FNK0054)

```
GPIO17 ── 220Ω ── LED ── GND          (LED simple)
GPIO17 ── 220Ω ── LED_R               (RGB)
GPIO27 ── 220Ω ── LED_G       ── 3.3V (anode commune)
GPIO22 ── 220Ω ── LED_B
GPIO18 ── Servo SG90 signal           (PWM 50 Hz)
GPIO23 ── HC-SR04 Trig                (ultrason)
GPIO24 ── HC-SR04 Echo
GPIO25 ── Buzzer ── GND
SDA/SCL ── ADS7830 (0x4B)             (ADC I2C)
GPIO17  ── DHT11 data (+ 10kΩ pullup)
```
