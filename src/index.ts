import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  Contact,
  Browsers,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

// Logger configuration
const logger = pino({ level: 'silent' });

// Output file path - use /app/output in Docker, or local directory otherwise
const OUTPUT_DIR = process.env.NODE_ENV === 'production' 
  ? '/app/output' 
  : path.join(__dirname, '..');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'contacts.csv');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

interface ContactInfo {
  name: string;
  number: string;
}

function formatPhoneNumber(jid: string): string {
  const number = jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
  return '+' + number;
}

function exportContactsToCSV(contacts: ContactInfo[]): void {
  contacts.sort((a, b) => a.name.localeCompare(b.name));

  let csvContent = 'Name,Phone Number\n';
  
  for (const contact of contacts) {
    const escapedName = contact.name.replace(/"/g, '""');
    const formattedName = contact.name.includes(',') ? `"${escapedName}"` : escapedName;
    csvContent += `${formattedName},${contact.number}\n`;
  }

  fs.writeFileSync(OUTPUT_FILE, csvContent, 'utf-8');
  console.log(`\n✅ Contacts exported successfully to: ${OUTPUT_FILE}`);
  console.log(`📊 Total contacts exported: ${contacts.length}`);
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log('🚀 Starting WhatsApp Contact Exporter...\n');

  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const collectedContacts: Map<string, ContactInfo> = new Map();

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    browser: Browsers.macOS('Desktop'),
    syncFullHistory: true,
    markOnlineOnConnect: false,
  });

  let connected = false;
  let syncReceived = false;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Display QR code for scanning
    if (qr) {
      console.log('📱 Scan this QR code with WhatsApp:\n');
      console.log('   1. Open WhatsApp on your phone');
      console.log('   2. Go to Settings > Linked Devices');
      console.log('   3. Tap "Link a Device"');
      console.log('   4. Point your phone camera at the QR code below:\n');
      qrcode.generate(qr, { small: true });
      console.log('\n⏳ Waiting for you to scan...\n');
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      
      if (statusCode === DisconnectReason.loggedOut) {
        console.log('❌ Logged out. Delete auth_info folder and restart.');
        process.exit(1);
      }
      
      if (!connected) {
        console.log('Reconnecting...');
        await delay(2000);
        main();
      }
    } else if (connection === 'open') {
      connected = true;
      console.log('\n✅ Connected to WhatsApp!\n');
      console.log('⏳ Syncing contacts... (this may take up to 60 seconds)\n');
      
      // Wait for sync, but check periodically
      let waitTime = 0;
      const maxWait = 60000;
      const checkInterval = 5000;
      
      const checkAndExport = async () => {
        waitTime += checkInterval;
        
        if (collectedContacts.size > 0 && (syncReceived || waitTime >= maxWait)) {
          exportContactsToCSV(Array.from(collectedContacts.values()));
          console.log('\n👋 Done! Disconnecting...');
          sock.end(undefined);
          process.exit(0);
        } else if (waitTime >= maxWait) {
          console.log('❌ No contacts received after waiting.');
          console.log('   Your WhatsApp may not have synced contacts yet.');
          console.log('   Try running the script again.');
          console.log('\n👋 Disconnecting...');
          sock.end(undefined);
          process.exit(0);
        } else {
          console.log(`   Waiting... ${waitTime/1000}s (${collectedContacts.size} contacts so far)`);
          setTimeout(checkAndExport, checkInterval);
        }
      };
      
      setTimeout(checkAndExport, checkInterval);
    }
  });

  // Handle contacts from upsert
  sock.ev.on('contacts.upsert', (contacts: Contact[]) => {
    console.log(`📥 Received ${contacts.length} contacts...`);
    
    for (const contact of contacts) {
      if (contact.id?.endsWith('@s.whatsapp.net')) {
        const name = contact.name || contact.notify || contact.verifiedName || formatPhoneNumber(contact.id);
        const number = formatPhoneNumber(contact.id);
        collectedContacts.set(contact.id, { name, number });
      }
    }
    
    console.log(`📊 Total: ${collectedContacts.size} contacts`);
  });

  // Handle contacts update
  sock.ev.on('contacts.update', (updates) => {
    for (const update of updates) {
      if (update.id?.endsWith('@s.whatsapp.net')) {
        const existing = collectedContacts.get(update.id);
        const name = update.name || update.notify || update.verifiedName || existing?.name || formatPhoneNumber(update.id);
        collectedContacts.set(update.id, { name, number: formatPhoneNumber(update.id) });
      }
    }
  });

  // Handle messaging history - this is the main source of contacts
  sock.ev.on('messaging-history.set', (data) => {
    syncReceived = true;
    const chatCount = data.chats?.length || 0;
    const contactCount = data.contacts?.length || 0;
    console.log(`📥 Received history: ${chatCount} chats, ${contactCount} contacts`);
    
    if (data.contacts) {
      for (const contact of data.contacts) {
        if (contact.id?.endsWith('@s.whatsapp.net')) {
          const name = contact.name || contact.notify || contact.verifiedName || formatPhoneNumber(contact.id);
          collectedContacts.set(contact.id, { name, number: formatPhoneNumber(contact.id) });
        }
      }
    }

    if (data.chats) {
      for (const chat of data.chats) {
        if (chat.id?.endsWith('@s.whatsapp.net') && !collectedContacts.has(chat.id)) {
          const name = chat.name || formatPhoneNumber(chat.id);
          collectedContacts.set(chat.id, { name, number: formatPhoneNumber(chat.id) });
        }
      }
    }

    console.log(`📊 Total: ${collectedContacts.size} contacts`);
  });

  // Handle chats
  sock.ev.on('chats.upsert', (chats) => {
    for (const chat of chats) {
      if (chat.id?.endsWith('@s.whatsapp.net') && !collectedContacts.has(chat.id)) {
        const name = chat.name || formatPhoneNumber(chat.id);
        collectedContacts.set(chat.id, { name, number: formatPhoneNumber(chat.id) });
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

process.on('SIGINT', () => {
  console.log('\n\n👋 Interrupted. Exiting...');
  process.exit(0);
});

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
