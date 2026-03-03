#!/usr/bin/env node

// CYRUS AI System - Public Access Launcher with QR Code
// This script starts the server and generates a QR code for easy access

import qrcode from 'qrcode-terminal';
import { exec } from 'child_process';
import os from 'os';

console.log('🚀 CYRUS AI System - Public Access Launcher');
console.log('============================================');
console.log('');

// Get network interfaces to find the local IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();
const port = process.env.PORT || 3000;
const localUrl = `http://${localIP}:${port}`;
const localhostUrl = `http://localhost:${port}`;

console.log('🌐 Network Information:');
console.log(`   Local IP: ${localIP}`);
console.log(`   Port: ${port}`);
console.log('');

console.log('🔗 Access URLs:');
console.log(`   Local: ${localhostUrl}`);
console.log(`   Network: ${localUrl}`);
console.log('');

// Generate QR codes
console.log('📱 QR Codes for Mobile Access:');
console.log('');
console.log('Local Network Access:');
qrcode.generate(localUrl, { small: true });
console.log('');

console.log('Localhost Access:');
qrcode.generate(localhostUrl, { small: true });
console.log('');

// Start the server
console.log('🚀 Starting CYRUS AI System...');
console.log('Press Ctrl+C to stop');
console.log('');

const serverProcess = exec('npm start', (error, stdout, stderr) => {
  if (error) {
    console.error('Error starting server:', error);
    return;
  }
  console.log('Server output:', stdout);
  if (stderr) {
    console.error('Server stderr:', stderr);
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down CYRUS AI System...');
  serverProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down CYRUS AI System...');
  serverProcess.kill('SIGTERM');
  process.exit(0);
});