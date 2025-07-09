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

### Queue System (Bull + Redis)
- **Job Queue**: Persistent render task queue
- **Worker Process**: GPU CLI command execution
- **Progress Tracking**: Real-time progress updates
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

3. **Configure Redis**
```bash
# Install Redis (Ubuntu/Debian)
sudo apt update
sudo apt install redis-server

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify Redis is working
redis-cli ping
```

4. **Configure environment variables**
Create a `.env.local` file:
```env
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_APP_NAME="GPU Render Studio"
```

5. **Create necessary folders**
```bash
mkdir -p uploads/rendered
chmod 755 uploads
```

## 🖥️ GPU Configuration

### For FFmpeg with NVENC (NVIDIA)
```bash
# Install FFmpeg with NVENC support
sudo apt update
sudo apt install ffmpeg

# Check GPU support
ffmpeg -encoders | grep nvenc
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

### Redis won't connect
```bash
# Check status
sudo systemctl status redis-server

# Restart Redis
sudo systemctl restart redis-server
```

### GPU errors
```bash
# Check NVIDIA drivers
nvidia-smi

# Test FFmpeg with GPU
ffmpeg -f lavfi -i testsrc=duration=10:size=1920x1080:rate=30 -c:v h264_nvenc test.mp4
```

### Permission issues
```bash
# Grant permissions to folders
sudo chown -R $USER:$USER uploads/
chmod -R 755 uploads/
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