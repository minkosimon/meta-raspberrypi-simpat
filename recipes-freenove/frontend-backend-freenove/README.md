# Freenove FNK0054 — Test Dashboard (Frontend + Backend)

Dashboard web pour tester les composants du kit **Freenove FNK0054** sur Raspberry Pi 5 via une interface React + un backend Python.

---

## Documentation

- Guide detaille (FR): [EXPLICATION_FRONTEND_BACKEND.md](EXPLICATION_FRONTEND_BACKEND.md)
- Detailed guide (EN): [EXPLANATION_FRONTEND_BACKEND_EN.md](EXPLANATION_FRONTEND_BACKEND_EN.md)

---

## Architecture

```
┌─────────────────────┐
│   React Frontend    │  (navigateur PC/tablette)
│   index.html        │
│   app-preview.js / style.css│
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

| Module               | Script board-side    | Matériel                       |
| -------------------- | -------------------- | ------------------------------ |
| GPIO / Freenove LEDs | `manage_GPIO_led.py` | LEDs, boutons (BCM 2-27)       |
| PWM                  | `pwm_control.py`     | LED dimming (GPIO 12,13,18,19) |
| Servo moteur         | `servo_control.py`   | SG90 (0-180°)                  |
| LED RGB              | `led_rgb.py`         | LED RGB anode commune          |
| LED Matrix 8x8       | `led_matrix.py`      | Matrice 74HC595                |
| I2C Scanner          | `i2c_scan.py`        | Bus I2C (détection périph.)    |
| ADC                  | `adc_read.py`        | ADS7830 8-ch (potentiomètre)   |
| Thermistance         | `thermistor_read.py` | NTC + ADS7830 (thermomètre)    |
| DHT11                | `dht_read.py`        | Température + humidité         |
| Ultrason             | `ultrasonic.py`      | HC-SR04 (distance cm)          |
| Buzzer               | `buzzer.py`          | Buzzer actif/passif            |
| Infos système        | `system_info.py`     | CPU temp, RAM, uptime, disque  |
| Terminal SSH         | _(commande libre)_   | Shell distant                  |

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
    │   ├── manage_GPIO_led.py
    │   ├── pwm_control.py
    │   ├── servo_control.py
    │   ├── led_rgb.py
    │   ├── led_matrix.py
    │   ├── i2c_scan.py
    │   ├── adc_read.py
    │   ├── thermistor_read.py
    │   ├── dht_read.py
    │   ├── ultrasonic.py
    │   ├── buzzer.py
    │   └── system_info.py
    └── frontend/
        ├── index.html              ← SPA React (scripts React locaux)
        ├── app-preview.js          ← Vue principale chargée par index.html
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

Si le navigateur tourne sur la meme machine que le backend, ouvrir `http://localhost:8080`.
Si le backend tourne sur une autre machine ou sur la carte, ouvrir `http://<IP_OU_HOST_DU_BACKEND>:8080`.

### Mode WebSocket securise (WSS)

Le backend supporte maintenant TLS natif pour servir `https://` et `wss://` sur le meme port.

```bash
# Exemple de certificat auto-signe pour developpement
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -sha256 -days 365 -nodes \
  -keyout certs/freenove.key \
  -out certs/freenove.crt \
  -subj "/CN=localhost"

export FNK_WS_TLS=1
export FNK_WS_TLS_CERT=$(pwd)/certs/freenove.crt
export FNK_WS_TLS_KEY=$(pwd)/certs/freenove.key
export FNK_WS_ALLOWED_ORIGINS=https://localhost:8080
python3 app.py
```

Dans ce mode:

- l'interface est servie en `https://`
- le navigateur ouvre automatiquement le WebSocket en `wss://`
- le backend refuse les connexions navigateur venant d'une origine differente si `FNK_WS_ALLOWED_ORIGINS` est defini

### Creation manuelle d'un certificat

Pour un certificat de developpement local:

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -sha256 -days 365 -nodes \
  -keyout certs/freenove-local.key \
  -out certs/freenove-local.crt \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

Puis lancer le backend en TLS:

```bash
FNK_WS_TLS=1 \
FNK_WS_TLS_CERT=$(pwd)/certs/freenove-local.crt \
FNK_WS_TLS_KEY=$(pwd)/certs/freenove-local.key \
FNK_WS_ALLOWED_ORIGINS=https://localhost:8080 \
./run-backend.sh
```

Firefox affichera un avertissement tant que ce certificat auto-signe n'est pas ajoute comme certificat de confiance.

### Ajouter le certificat comme certificat de confiance

#### Firefox

1. Ouvrir `about:preferences#privacy`
2. Aller dans **Certificats**
3. Cliquer sur **Voir les certificats**
4. Onglet **Autorites**
5. **Importer** puis choisir `certs/freenove-local.crt`
6. Cocher la confiance pour identifier des sites web

#### Linux (Debian/Ubuntu)

```bash
sudo cp certs/freenove-local.crt /usr/local/share/ca-certificates/freenove-local.crt
sudo update-ca-certificates
```

Apres ca, `https://localhost:8080` ne devrait plus afficher d'avertissement de certificat sur les applications qui utilisent le magasin systeme.

### Integration dans l'image Yocto

Le dashboard principal installe maintenant un fichier d'environnement dans `/etc/default/freenove-dashboard`.
La recette TLS genere le certificat pendant la construction Yocto et installe `/etc/default/freenove-dashboard-tls` dans l'image.

Ajout dans `local.conf`:

```conf
IMAGE_INSTALL:append = " frontend-backend-freenove freenove-dashboard-certs"
```

Pendant le build Yocto, la recette TLS:

- genere `/etc/ssl/freenove/freenove-dashboard.crt`
- genere `/etc/ssl/freenove/freenove-dashboard.key`
- active `FNK_WS_TLS=1`
- installe les origines autorisees dans `/etc/default/freenove-dashboard-tls`

### Recette Yocto de gestion des certificats

La recette ajoutee est:

- `recipes-freenove/freenove-dashboard-certs/freenove-dashboard-certs.bb`

Elle installe:

- un certificat auto-signe genere au build
- une cle privee associee
- le fichier d'environnement `/etc/default/freenove-dashboard-tls`

Le certificat n'est pas stocke dans le depot. Il est genere pendant le build Yocto, ce qui supprime le cout de generation au boot sur la cible.

### Mode Yocto (sur la carte)

Sans la recette TLS, ajouter la recette dans `local.conf` :

```
IMAGE_INSTALL:append = " frontend-backend-freenove"
```

Après déploiement, le service `freenove-dashboard` démarre automatiquement.
Depuis un PC du réseau, accéder au dashboard : `http://<IP_CARTE>:8080`

Avec TLS activé, ajouter dans `local.conf` :

```conf
IMAGE_INSTALL:append = " frontend-backend-freenove freenove-dashboard-certs"
```

Dans ce cas, le certificat est généré au premier boot et le dashboard est servi en HTTPS/WSS sur le meme port.
Depuis un PC du réseau, accéder au dashboard : `https://<IP_CARTE>:8080`

Important : `localhost:8080` ne fonctionne que si le navigateur s'exécute sur la meme machine que le backend. Depuis le poste de développement, il faut utiliser l'IP ou le nom d'hote de la carte.

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

| Action                 | Params                                                |
| ---------------------- | ----------------------------------------------------- |
| `connect`              | `host`, `user`, `password`                            |
| `disconnect`           | —                                                     |
| `status`               | —                                                     |
| `freenove_led_status`  | `led`                                                 |
| `freenove_led_set`     | `led`, `value` (0/1)                                  |
| `freenove_led_trigger` | `led`, `trigger` (`none`/`timer`)                     |
| `gpio_setup`           | `pin`, `direction` (in/out)                           |
| `gpio_write`           | `pin`, `value` (0/1)                                  |
| `gpio_read`            | `pin`                                                 |
| `gpio_read_many`       | `pins` (liste BCM)                                    |
| `pwm_start`            | `pin`, `frequency`, `duty`                            |
| `pwm_set`              | `pin`, `duty`                                         |
| `pwm_stop`             | `pin`                                                 |
| `servo_set`            | `pin`, `angle` (0-180)                                |
| `led_rgb`              | `r_pin`, `g_pin`, `b_pin`, `r`, `g`, `b`              |
| `led_matrix`           | `pattern` (liste de 8 valeurs 0-255)                  |
| `i2c_scan`             | `bus`                                                 |
| `adc_read`             | `channel` (0-7)                                       |
| `dht_read`             | `pin`                                                 |
| `ultrasonic_read`      | `trig_pin`, `echo_pin`                                |
| `buzzer`               | `pin`, `state` (on/off/tone), `frequency`, `duration` |
| `system_info`          | —                                                     |
| `run_command`          | `command` (necessite connexion SSH active)            |

## Circuits de référence (FNK0054)

```
GPIO17 ── 220Ω ── LED ── GND          (LED simple)
GPIO17 ── 220Ω ── LED_R               (RGB)
GPIO27 ── 220Ω ── LED_G       ── 3.3V (anode commune)
GPIO22 ── 220Ω ── LED_B
GPIO18 ── Servo SG90 signal           (PWM 50 Hz)
GPIO20 ── HC-SR04 Trig                (ultrason)
GPIO21 ── HC-SR04 Echo
GPIO25 ── Buzzer ── GND
SDA/SCL ── ADS7830 (0x4B)             (ADC I2C)
GPIO17  ── DHT11 data (+ 10kΩ pullup)
```
