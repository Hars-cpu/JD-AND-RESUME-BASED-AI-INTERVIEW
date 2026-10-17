import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss()
  ],
  preview: {
    host: '0.0.0.0',
    port: 5714,
    allowedHosts: [
      'ec2-43-204-103-12.ap-south-1.compute.amazonaws.com',
    ]
  }
});