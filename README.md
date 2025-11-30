# WhatsApp Contact Exporter

Export all your WhatsApp contacts (name and phone number) to a CSV file using the [Baileys](https://github.com/WhiskeySockets/Baileys) library.

## 🐳 Docker Setup (Recommended)

### Using Docker Compose

1. **Build and run:**
   ```bash
   docker-compose run --rm wa-contact-exporter
   ```

2. **Scan the QR code** that appears in the terminal with WhatsApp:
   - Open WhatsApp on your phone
   - Go to **Settings > Linked Devices**
   - Tap **"Link a Device"**
   - Point your camera at the QR code

3. **Wait for contacts to sync** (~30-60 seconds)

4. Your contacts will be exported to `./output/contacts.csv`

### Using Docker directly

```bash
# Build the image
docker build -t wa-contact-exporter .

# Run with volumes for auth persistence and output
docker run -it --rm \
  -v $(pwd)/auth_info:/app/auth_info \
  -v $(pwd)/output:/app/output \
  wa-contact-exporter
```

### Re-running (after first authentication)

Once authenticated, your session is saved. Just run again:
```bash
docker-compose run --rm wa-contact-exporter
```

No QR scan needed on subsequent runs!

---

## 💻 Local Setup (Without Docker)

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/beastytitan18/whatsapp-contact-exporter.git
   cd whatsapp-contact-exporter
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the TypeScript code:
   ```bash
   npm run build
   ```

## Usage

1. Run the exporter:
   ```bash
   npm start
   ```

2. **First time only:** A QR code will appear in the terminal. Scan it with WhatsApp on your phone:
   - Open WhatsApp on your phone
   - Go to Settings > Linked Devices
   - Tap "Link a Device"
   - Scan the QR code

3. Wait for the contacts to sync (about 15 seconds)

4. The contacts will be exported to `contacts.csv` in the project root

## Output Format

The CSV file will contain:
- **Name**: Contact name as saved in WhatsApp
- **Phone Number**: Phone number with country code (e.g., +1234567890)

Example:
```csv
Name,Phone Number
John Doe,+1234567890
Jane Smith,+0987654321
```

## Development

Run in development mode (without building):
```bash
npm run dev
```

## Notes

- Session data is stored in the `auth_info/` folder
- You won't need to scan the QR code again unless you log out or delete `auth_info/`
- Only personal contacts are exported (not group participants)
- The exporter waits 15 seconds after connection for contacts to sync

## Troubleshooting

### No contacts exported
- Make sure you have contacts in WhatsApp
- Try running the exporter again (contacts sync may take time on first connection)

### QR code not appearing
- Delete the `auth_info/` folder and try again
- Make sure your terminal supports displaying QR codes

### Connection issues
- Check your internet connection
- WhatsApp may be temporarily blocking connections, wait a few minutes and try again

## Disclaimer

This tool is for personal use only. Please respect WhatsApp's Terms of Service and don't use this for spam or bulk messaging.

## Credits

- [Baileys](https://github.com/WhiskeySockets/Baileys) - The WhatsApp Web API library that powers this tool
- [WhiskeySockets](https://github.com/WhiskeySockets) - Maintainers of the Baileys library

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

⭐ If you find this useful, please star the repo!
