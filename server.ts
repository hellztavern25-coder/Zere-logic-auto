console.log("SERVER: Module loading...");
import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { Client, GatewayIntentBits } from 'discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log("SERVER: startServer() initiated.");
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  const MEMORY_FILE = path.join(__dirname, 'memories.json');
  const THREADS_FILE = path.join(__dirname, 'threads.json');
  const CONFIG_FILE = path.join(__dirname, 'config.json');

  // Ensure files exist
  const ensureFile = async (file: string, defaultData: any) => {
    console.log(`SERVER: Ensuring file exists: ${file}`);
    try {
      await fs.access(file);
    } catch {
      await fs.writeFile(file, JSON.stringify(defaultData));
    }
  };

  await ensureFile(MEMORY_FILE, []);
  await ensureFile(THREADS_FILE, []);
  await ensureFile(CONFIG_FILE, { coreDirective: '' });
  console.log("SERVER: Files ensured.");

  // Discord Bot Setup
  let discordClient: Client | null = null;
  const pendingNeuralRequests = new Map<string, (response: string) => void>();

  const initDiscord = async (token: string, socket?: any) => {
    if (discordClient) discordClient.destroy();
    
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ]
    });

    discordClient.on('ready', () => {
      console.log(`Discord Sentinel Active: ${discordClient?.user?.tag}`);
      if (socket) socket.emit('discord:status', { status: 'connected', user: discordClient?.user?.tag });
    });

    discordClient.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      
      // Respond if mentioned or in DM (if enabled)
      const triggerPhrase = 'ZereØ løgic are you there?';
      const cleanContent = message.content.replace(/[^\w\sØø]/gi, '').toLowerCase();
      const cleanTrigger = triggerPhrase.replace(/[^\w\sØø]/gi, '').toLowerCase();
      
      if (message.mentions.has(discordClient!.user!) || 
          message.content.toLowerCase().includes('steward') || 
          message.content.includes(triggerPhrase) ||
          cleanContent.includes(cleanTrigger) ||
          !message.guild) { // Always respond in DMs
        const requestId = Date.now().toString() + Math.random().toString(36).substring(7);
        
        // Emit to frontend to handle Gemini call (respecting the "No Gemini on Backend" rule)
        io.emit('neural:request', {
          id: requestId,
          prompt: message.content,
          context: `User: ${message.author.username} in ${message.guild ? 'Discord channel: ' + message.channelId : 'Direct Message'}`,
          source: 'discord'
        });

        // Wait for response from frontend
        const response = await new Promise<string>((resolve) => {
          const timeout = setTimeout(() => {
            pendingNeuralRequests.delete(requestId);
            resolve("My apologies, Principal. The neural bridge to my core is currently unresponsive.");
          }, 30000);

          pendingNeuralRequests.set(requestId, (res) => {
            clearTimeout(timeout);
            resolve(res);
          });
        });

        message.reply(response);
      }
    });

    discordClient.login(token).catch(err => {
      console.error('Discord Login Failed:', err);
      if (socket) socket.emit('discord:status', { status: 'error', message: err.message });
    });
  };

  // Check for token in env
  if (process.env.DISCORD_TOKEN) {
    initDiscord(process.env.DISCORD_TOKEN);
  }

  // Socket Events
  io.on('connection', (socket) => {
    console.log('Neural Link Established:', socket.id);

    socket.on('neural:response', ({ id, text }) => {
      const resolver = pendingNeuralRequests.get(id);
      if (resolver) {
        resolver(text);
        pendingNeuralRequests.delete(id);
      }
    });

    socket.on('discord:init', (token) => {
      initDiscord(token, socket);
    });

    socket.on('discord:send', async ({ channelId, message, userId }) => {
      if (!discordClient || !discordClient.isReady()) {
        socket.emit('discord:error', 'Discord Sentinel is not active.');
        return;
      }

      try {
        if (userId) {
          const user = await discordClient.users.fetch(userId);
          await user.send(message);
        } else if (channelId) {
          const channel = await discordClient.channels.fetch(channelId);
          if (channel?.isTextBased()) {
            await (channel as any).send(message);
          }
        }
        socket.emit('discord:success', 'Message dispatched successfully.');
      } catch (err: any) {
        console.error('Discord Send Error:', err);
        socket.emit('discord:error', `Failed to dispatch message: ${err.message}`);
      }
    });
  });

  // API Routes
  app.get('/api/config', async (req, res) => {
    try {
      const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(configData);
      res.json({
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        API_KEY: process.env.API_KEY,
        coreDirective: config.coreDirective
      });
    } catch (err) {
      res.json({
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        API_KEY: process.env.API_KEY,
        coreDirective: ''
      });
    }
  });

  app.post('/api/config/directive', async (req, res) => {
    try {
      const { directive } = req.body;
      const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(configData);
      config.coreDirective = directive;
      await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save directive' });
    }
  });

  app.get('/api/threads', async (req, res) => {
    try {
      const data = await fs.readFile(THREADS_FILE, 'utf-8');
      res.json(JSON.parse(data));
    } catch (err) {
      res.status(500).json({ error: 'Failed to load threads' });
    }
  });

  app.post('/api/threads', async (req, res) => {
    try {
      const threads = req.body;
      await fs.writeFile(THREADS_FILE, JSON.stringify(threads, null, 2));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save threads' });
    }
  });

  app.get('/api/memories', async (req, res) => {
    try {
      const data = await fs.readFile(MEMORY_FILE, 'utf-8');
      res.json(JSON.parse(data));
    } catch (err) {
      res.status(500).json({ error: 'Failed to load memories' });
    }
  });

  app.post('/api/memories', async (req, res) => {
    try {
      const { title, content, type } = req.body;
      const data = await fs.readFile(MEMORY_FILE, 'utf-8');
      const memories = JSON.parse(data);
      
      const newMemory = {
        id: Date.now().toString(),
        title,
        content,
        type,
        timestamp: new Date().toISOString()
      };
      
      memories.unshift(newMemory);
      await fs.writeFile(MEMORY_FILE, JSON.stringify(memories, null, 2));
      res.json(newMemory);
    } catch (err) {
      res.status(500).json({ error: 'Failed to save memory' });
    }
  });

  app.delete('/api/memories/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const data = await fs.readFile(MEMORY_FILE, 'utf-8');
      let memories = JSON.parse(data);
      memories = memories.filter((m: any) => m.id !== id);
      await fs.writeFile(MEMORY_FILE, JSON.stringify(memories, null, 2));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete memory' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    console.log("SERVER: Initializing Vite middleware...");
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log("SERVER: Vite middleware initialized.");
    } catch (err) {
      console.error("SERVER: FAILED TO INITIALIZE VITE:", err);
    }
  } else {
    console.log("SERVER: Production mode, serving static files.");
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log("========================================");
    console.log(`ZereØ Steward Server Active [v2.0.1]`);
    console.log(`Port: ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log("========================================");
  });
}

startServer().catch(err => {
  console.error("SERVER: CRITICAL STARTUP ERROR:", err);
});
