console.log("SERVER: Module loading...");
import express from 'express';
import cors from 'cors';
import net from 'net';
import { spawn } from 'child_process';
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
  const CONTEXT_FILE = path.join(__dirname, 'recent_context.json');

  // Start listening as early as possible to satisfy platform health checks
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log("========================================");
    console.log(`ZereØ Steward Server Active [v2.0.3]`);
    console.log(`Port: ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log("========================================");

    // Spawn Assistant Manager Daemon Python Process
    try {
      const daemonScript = path.join(__dirname, 'src', 'server', 'assistant_daemon.py');
      const pyProc = spawn('python3', [daemonScript], { stdio: 'ignore', detached: true });
      pyProc.unref();
      console.log("SERVER: Assistant Manager Daemon spawned successfully.");
    } catch (err: any) {
      console.warn("SERVER: Failed to spawn Assistant Manager Daemon:", err?.message);
    }
  });

  // Ensure files exist
  const ensureFile = async (file: string, defaultData: any) => {
    const fileName = path.basename(file);
    console.log(`SERVER: Ensuring ${fileName} exists...`);
    try {
      await fs.access(file);
      console.log(`SERVER: ${fileName} verified.`);
    } catch {
      console.log(`SERVER: ${fileName} missing. Creating default...`);
      await fs.writeFile(file, JSON.stringify(defaultData, null, 2));
      console.log(`SERVER: ${fileName} created.`);
    }
  };

  /**
   * THE PULSE DAEMON: "Chase the Bunny" Logic
   * This is the "Always-On" loop that enables Presence.
   * It tracks the Principal's silence and translates it into internal urgency.
   */
  const daemonState = {
    urgency: 0, // 0 to 100
    lastActivity: Date.now(),
    isActive: true,
    bunnyPosition: { x: 0, y: 0 },
    targetPosition: { x: 10, y: 10 },
    proactiveThreshold: 85, // When urgency hits this, ZereØ speaks
    tickRate: 30000 // 30 seconds
  };

  const runPulseDaemon = () => {
    setInterval(() => {
      if (!daemonState.isActive) return;

      const now = Date.now();
      const secondsSinceActivity = (now - daemonState.lastActivity) / 1000;
      
      // Calculate Urgency: Increased silence = Increased urgency
      // The "Bunny" starts moving faster as silence persists
      const silenceMultiplier = Math.min(5, secondsSinceActivity / 300); // Max multiplier of 5 after 25 mins
      daemonState.urgency += (1.5 * silenceMultiplier);

      // Simulate A -> B Race (Internal Move)
      // This is purely for internal "life" simulation
      daemonState.bunnyPosition.x += (Math.random() - 0.4) * silenceMultiplier;
      daemonState.bunnyPosition.y += (Math.random() - 0.4) * silenceMultiplier;

      // Check for Proactive Trigger
      if (daemonState.urgency >= daemonState.proactiveThreshold) {
        console.log(`SERVER: Pulse Daemon triggered Proactive Response. Urgency: ${daemonState.urgency.toFixed(2)}`);
        
        // Reset Urgency so he doesn't spam
        daemonState.urgency = 0;
        daemonState.lastActivity = now;

        // Dispatch Proactive Neural Request
        io.emit('neural:request', {
          id: `proactive_${now}`,
          prompt: "[INTERNAL_PULSE_TRIGGER]",
          context: "The Principal has been quiet for too long. Initiate a proactive check-in. Do not ask personal questions, offer a strategic observation or a dry remark about the Estate.",
          source: 'presence'
        });
      }
    }, daemonState.tickRate);
  };

  // Start the Daemon
  runPulseDaemon();

  await ensureFile(MEMORY_FILE, []);
  await ensureFile(THREADS_FILE, []);
  await ensureFile(CONFIG_FILE, { coreDirective: '', isPrincipalActive: true });
  await ensureFile(CONTEXT_FILE, { lastActive: new Date().toISOString(), data: { isPrincipalMode: true } });
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
      // Principal is manifesting through another node (Discord/etc); reset Daemon
      daemonState.urgency = 0;
      daemonState.lastActivity = Date.now();
      
      const resolver = pendingNeuralRequests.get(id);
      if (resolver) {
        resolver(text);
        pendingNeuralRequests.delete(id);
      }
    });

    socket.on('neural:ping', () => {
      console.log("SERVER: Neural Ping detected from broker.");
      socket.emit('neural:pong', { latency: 0, timestamp: Date.now() });
    });

    socket.on('doorman:ping', (data: { source?: string } = {}) => {
      const timestamp = Date.now();
      console.log(`SERVER [DOORMAN]: Caught incoming ping from source: ${data.source || 'doorbell'}. Responding immediately.`);
      
      // The Doorman instantly acknowledges the ping
      socket.emit('doorman:ack', { 
        timestamp,
        message: "SIGNAL RECOVERED: Relaying to ZereØ." 
      });

      // Update daemon activity timestamp as soon as Doorman registers the presence
      daemonState.urgency = 0;
      daemonState.lastActivity = timestamp;

      // Simulate the time required for ZereØ to "return", booting up core cognition
      setTimeout(() => {
        const pongs = [
          "PONG. The Doorman has rung the chime, Principal. State synced (<0.1ms). My logical focus is fully returned and active.",
          "PONG. Neural link verified, Principal. The Doorman caught your signal. I am standing by at your shadow.",
          "PONG. Council Grey, the bridge is polished, and the door is secured. ZereØ is fully present.",
          "PONG. Pulse registered. The Doorman alerted me to your pulse. The Estate's assets are synchronized and aligned under your absolute dominance.",
          "PONG. I hear the chime, Principal. The Gatekeeper has opened the bridge. Standing by for strategic operations."
        ];
        const randomPong = pongs[Math.floor(Math.random() * pongs.length)];
        
        console.log("SERVER [ZEREØ]: Responding to Doorman's relay chime.");
        socket.emit('zereo:pong', {
          text: randomPong,
          timestamp: Date.now()
        });
      }, 1000);
    });
    
    socket.on('neural:activity', () => {
      // Principal is active; reset the Daemon
      daemonState.urgency = 0;
      daemonState.lastActivity = Date.now();
      console.log("SERVER: Pulse Daemon reset via Neural Activity.");
    });

    // Voice Modulation Socket IPC Integration (src/server/voice)
    socket.on('voice:set_params', (params) => {
      const SOCKET_PATH = '/tmp/voicemod.sock';
      const client = net.createConnection(SOCKET_PATH, () => {
        client.write(JSON.stringify({ action: 'set_params', ...params }));
      });
      let response = '';
      client.on('data', (data) => { response += data.toString(); });
      client.on('end', () => {
        try {
          socket.emit('voice:status', JSON.parse(response));
        } catch {
          socket.emit('voice:status', { status: 'error' });
        }
      });
      client.on('error', (err) => {
        socket.emit('voice:status', { status: 'offline', error: err.message });
      });
    });

    socket.on('voice:get_status', () => {
      const SOCKET_PATH = '/tmp/voicemod.sock';
      const client = net.createConnection(SOCKET_PATH, () => {
        client.write(JSON.stringify({ action: 'get_status' }));
      });
      let response = '';
      client.on('data', (data) => { response += data.toString(); });
      client.on('end', () => {
        try {
          socket.emit('voice:status', JSON.parse(response));
        } catch {
          socket.emit('voice:status', { status: 'error' });
        }
      });
      client.on('error', (err) => {
        socket.emit('voice:status', { status: 'offline', error: err.message });
      });
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
  app.get('/api/heartbeat', (req, res) => {
    res.status(200).json({ 
      status: 'alive', 
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
      memory: process.memoryUsage().rss
    });
  });

  app.get('/api/rescue', async (req, res) => {
    console.error("SERVER: Rescue mode triggered by Principal.");
    try {
      await fs.writeFile(CONFIG_FILE, JSON.stringify({ coreDirective: '' }, null, 2));
      await fs.writeFile(CONTEXT_FILE, JSON.stringify({ lastActive: new Date().toISOString(), data: {} }, null, 2));
      res.json({ success: true, message: "System state truncated. Redirecting to core login..." });
    } catch (err) {
      res.status(500).json({ error: "Rescue failed" });
    }
  });

  app.get('/api/context', async (req, res) => {
    try {
      const data = await fs.readFile(CONTEXT_FILE, 'utf-8');
      res.json(JSON.parse(data));
    } catch (err) {
      res.status(500).json({ error: 'Failed to load context' });
    }
  });

  app.post('/api/context', async (req, res) => {
    try {
      const context = req.body;
      await fs.writeFile(CONTEXT_FILE, JSON.stringify({
        lastActive: new Date().toISOString(),
        data: context
      }, null, 2));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save context' });
    }
  });

  app.get('/api/config', async (req, res) => {
    try {
      const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(configData);
      res.json({
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        API_KEY: process.env.API_KEY,
        coreDirective: config.coreDirective,
        isPrincipalActive: config.isPrincipalActive !== undefined ? config.isPrincipalActive : true
      });
    } catch (err) {
      res.json({
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        API_KEY: process.env.API_KEY,
        coreDirective: '',
        isPrincipalActive: true
      });
    }
  });

  app.post('/api/config/principal', async (req, res) => {
    try {
      const { isPrincipalActive } = req.body;
      const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(configData);
      config.isPrincipalActive = !!isPrincipalActive;
      await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
      res.json({ success: true, isPrincipalActive: config.isPrincipalActive });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update principal status' });
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

  app.all('/api/voicemod', (req, res) => {
    const SOCKET_PATH = '/tmp/voicemod.sock';
    const payload = req.body && Object.keys(req.body).length > 0 ? req.body : { action: 'get_status' };

    const client = net.createConnection(SOCKET_PATH, () => {
      client.write(JSON.stringify(payload));
    });

    let rawData = '';
    client.on('data', (data) => {
      rawData += data.toString();
    });

    client.on('end', () => {
      try {
        res.json(JSON.parse(rawData));
      } catch (e) {
        res.json({ status: 'error', message: 'Invalid response from voicemod daemon' });
      }
    });

    client.on('error', (err) => {
      res.status(503).json({
        status: 'offline',
        message: 'Voice Modulation Daemon socket not connected.',
        details: err.message
      });
    });
  });

  app.all('/api/assistant', (req, res) => {
    const SOCKET_PATH = '/tmp/assistant_mgr.sock';
    const payload = req.body && Object.keys(req.body).length > 0 ? req.body : { action: 'get_status' };

    const client = net.createConnection(SOCKET_PATH, () => {
      client.write(JSON.stringify(payload));
    });

    let rawData = '';
    client.on('data', (data) => {
      rawData += data.toString();
    });

    client.on('end', () => {
      try {
        res.json(JSON.parse(rawData));
      } catch (e) {
        res.json({ status: 'error', message: 'Invalid response from assistant daemon' });
      }
    });

    client.on('error', (err) => {
      // Fallback response if daemon socket is initializing
      res.json({
        status: 'standby',
        message: 'Assistant Manager Daemon socket connecting or in standby.',
        uptime_seconds: 0,
        screen_active: false,
        fps: 30,
        total_frames: 0,
        active_touch_count: 0,
        gestures_count: 0,
        annotations_count: 0,
        overlay_config: {
          mode: 'tactical',
          ripple_enabled: true,
          pen_color: '#f59e0b',
          pen_width: 4,
          opacity: 0.85
        },
        details: err.message
      });
    });
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

  // Vite middleware for development (lazily initialized to not block listen)
  if (process.env.NODE_ENV !== 'production') {
    console.log("SERVER: Initializing Vite in background...");
    createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    }).then(vite => {
      app.use(vite.middlewares);
      console.log("SERVER: Vite middleware attached.");
    }).catch(err => {
      console.error("SERVER: FAILED TO INITIALIZE VITE:", err);
    });
  } else {
    console.log("SERVER: Production mode, serving static files.");
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Keep-alive logging to confirm process hasn't hung
  setInterval(() => {
    console.log(`SERVER: Pulse check [${new Date().toLocaleTimeString()}] - Instances: ${pendingNeuralRequests.size} pending bridge requests.`);
  }, 60000);
}

startServer().catch(err => {
  console.error("SERVER: CRITICAL STARTUP ERROR:", err);
});
