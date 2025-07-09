"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RenderJob } from "@/lib/types"
import { Clock, CheckCircle, XCircle, Loader2, Download } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface RenderJobsPanelProps {
  jobs: RenderJob[]
  onRefresh: () => void
}

function getStatusIcon(status: RenderJob['status']) {
  switch (status) {
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-500" />
    case 'processing':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />
  }
}

function getStatusColor(status: RenderJob['status']) {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'processing':
      return 'bg-blue-100 text-blue-800'
    case 'completed':
      return 'bg-green-100 text-green-800'
    case 'failed':
      return 'bg-red-100 text-red-800'
  }
}

export function RenderJobsPanel({ jobs, onRefresh }: RenderJobsPanelProps) {
  const downloadRenderedFile = async (job: RenderJob) => {
    if (!job.outputPath) return

    try {
      // Créer un lien de téléchargement (tu devras créer une API route pour servir les fichiers)
      const response = await fetch(`/api/download/${job.id}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `rendered_${job.filename}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  return (
    <div className="w-80 border-l bg-gray-50/50">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Render Jobs</h2>
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            Refresh
          </Button>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {jobs.length} total jobs
        </p>
      </div>

      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="p-4 space-y-4">
          {jobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-sm">No render jobs yet</div>
              <div className="text-xs mt-1">Upload a file to get started</div>
            </div>
          ) : (
            jobs.map((job) => (
              <div
                key={job.id}
                className="bg-white border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {job.filename}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Created {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(job.status)}
                    <Badge variant="outline" className={getStatusColor(job.status)}>
                      {job.status}
                    </Badge>
                  </div>
                </div>

                {(job.status === 'processing' || job.status === 'completed') && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Progress</span>
                      <span>{job.progress}%</span>
                    </div>
                    <Progress value={job.progress} className="h-2" />
                  </div>
                )}

                {job.status === 'failed' && job.error && (
                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                    Error: {job.error}
                  </div>
                )}

                {job.status === 'completed' && (
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-green-600">
                      ✅ Render completed
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadRenderedFile(job)}
                      className="gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </Button>
                  </div>
                )}

                {job.startedAt && job.completedAt && (
                  <div className="text-xs text-gray-400">
                    Duration: {Math.round(
                      (new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000
                    )}s
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
} 