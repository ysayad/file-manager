# GPU Render Studio

A file management and rendering system with integrated GPU acceleration, built with Next.js and TypeScript.

## 🚀 Features

- **File upload** with type validation
- **GPU render queue** with Bull/Redis
- **Real-time tracking** of render jobs
- **Modern interface** with shadcn/ui
- **Automatic download** of rendered files
- **Multi-format support** (video, image, PDF)

## 🏗️ Architecture

### Frontend (Next.js)
- **File Manager**: Main file management interface
- **Upload Dialog**: Modal to configure and launch renders
- **Render Jobs Panel**: Real-time panel for jobs in progress
- **Progress Tracking**: Visual render progress tracking

### Backend (API Routes)
- **`/api/upload`**: Multipart file upload
- **`/api/render`**: Render job management
- **`/api/render/[jobId]`**: Specific job status
- **`/api/download/[jobId]`**: Rendered file download

### Queue System (Bull + ioredis)
- **Job Queue**: Persistent render task queue with Redis backend
- **Worker Process**: GPU CLI command execution
- **Progress Tracking**: Real-time progress updates via ioredis
- **Error Handling**: Error management and automatic retry

## 📦 Installation

1. **Clone the project**
```bash
git clone <repo-url>
cd file-manager
```

2. **Install dependencies**
```bash
npm install
# or
pnpm install
```

**For Windows users:**
```cmd
# Install Node.js from https://nodejs.org/
# Install Git from https://git-scm.com/download/win
# Use Command Prompt or PowerShell for the commands above
```

3. **Configure Redis with ioredis**

**Windows (using Docker):**
```cmd
# Install Docker Desktop from https://www.docker.com/products/docker-desktop
# Run Redis container
docker run -d --name redis -p 6379:6379 redis:latest
```

**Alternative - Windows with WSL:**
```bash
# Install WSL2 and Ubuntu
wsl --install
# Then in WSL terminal:
sudo apt update && sudo apt install redis-server
redis-server --daemonize yes
```

4. **Configure environment variables**
Create a `.env.local` file:
```env
# For local Redis with ioredis
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_APP_NAME="GPU Render Studio"
```

5. **Install dependencies for the queue system**
```bash
# ioredis is already included in package.json dependencies
npm install
```

## 🖥️ GPU Configuration

### For FFmpeg with NVENC (NVIDIA)

**Linux:**
```bash
# Install FFmpeg with NVENC support
sudo apt update
sudo apt install ffmpeg

# Check GPU support
ffmpeg -encoders | grep nvenc
```

**Windows:**
```cmd
# Download FFmpeg from https://ffmpeg.org/download.html#build-windows
# Extract and add to PATH environment variable
# Or use chocolatey: choco install ffmpeg

# Check GPU support
ffmpeg -encoders | findstr nvenc
```

### Example render commands
```bash
# Video rendering with NVENC (NVIDIA)
ffmpeg -i {input} -c:v h264_nvenc -preset fast {output}

# Rendering with CUDA filters
ffmpeg -i {input} -vf scale_cuda=1920:1080 -c:v h264_nvenc {output}

# Image rendering with GPU
ffmpeg -i {input} -vf scale=1920:1080 {output}
```

## 🚀 Usage

1. **Start the development server**
```bash
npm run dev
```

2. **Access the interface**
Open [http://localhost:3000](http://localhost:3000)

3. **Upload and render**
   - Click "Upload & Render"
   - Configure the GPU render command
   - Select a file
   - Track progress in the right panel

## 🔧 Advanced Configuration

### Customize render commands

In `file-manager.tsx`, modify the default command:
```typescript
const [renderCommand, setRenderCommand] = useState(
  "ffmpeg -i {input} -c:v h264_nvenc -preset fast {output}"
)
```

### Add new file types

In `app/api/upload/route.ts`:
```typescript
const allowedTypes = [
  'video/mp4', 'video/avi', 'video/mov', 'video/mkv',
  'image/jpeg', 'image/png', 'image/gif',
  'application/pdf',
  // Add here
]
```

### Optimize progress monitoring

In `lib/render-queue.ts`, improve `executeRenderCommand` to parse real output from your CLI:

```typescript
// Example for FFmpeg
const ffmpegProcess = spawn('ffmpeg', args);
ffmpegProcess.stderr.on('data', (data) => {
  const output = data.toString();
  // Parse output to extract real progress
  const progressMatch = output.match(/time=(\d+:\d+:\d+)/);
  if (progressMatch) {
    // Calculate percentage based on total duration
    const currentTime = parseTime(progressMatch[1]);
    const progress = (currentTime / totalDuration) * 100;
    this.updateJobStatus(jobId, 'processing', progress);
  }
});
```

## 🐳 Deployment

### Docker (optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Local network configuration
To access from other machines on the network:
```bash
# Start on all interfaces
npm run dev -- -H 0.0.0.0

# Or modify package.json
"dev": "next dev -H 0.0.0.0"
```

## 🔒 Security

- Strict file type validation
- Upload size limitation
- Render process isolation
- Automatic cleanup of temporary files

## 🛠️ Troubleshooting

### Redis connection issues
```bash
# Test Redis connection
redis-cli ping

# For Docker Redis container
docker ps  # Check if redis container is running
docker start redis  # Start if stopped

# For WSL Redis
wsl -d Ubuntu redis-cli ping
```

### GPU errors
```bash
# Check NVIDIA drivers (Linux/Windows)
nvidia-smi

# Test FFmpeg with GPU
ffmpeg -f lavfi -i testsrc=duration=10:size=1920x1080:rate=30 -c:v h264_nvenc test.mp4
```

### Permission issues

**Windows:**
```cmd
# Run as administrator if permission issues persist
# Check file access permissions for the application
```

## 📁 Project Structure

```
file-manager/
├── app/
│   ├── api/
│   │   ├── upload/route.ts      # File upload
│   │   ├── render/route.ts      # Job management
│   │   └── download/[jobId]/route.ts
│   ├── layout.tsx               # Main layout
│   └── page.tsx                 # Home page
├── components/
│   ├── ui/                      # shadcn/ui components
│   └── render-jobs-panel.tsx    # Jobs panel
├── hooks/
│   └── use-render-jobs.ts       # Job management hook
├── lib/
│   ├── render-queue.ts          # Queue service
│   ├── types.ts                 # TypeScript types
│   └── utils.ts                 # Utilities
└── file-manager.tsx             # Main component
```

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or pull requests.

## 📄 License

MIT License 