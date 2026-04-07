/**
 * CronScheduler — Execution engine for scheduled tasks
 *
 * Periodically checks all scheduled tasks and executes those whose cron
 * expression matches the current time. Tasks are run by spawning a CLI
 * subprocess with the task's prompt. Execution history is persisted to
 * ~/.claude/scheduled_tasks_log.json.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'
import { CronService, type CronTask } from './cronService.js'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TaskRun = {
  id: string // random ID
  taskId: string // references CronTask.id
  taskName: string
  startedAt: string // ISO timestamp
  completedAt?: string
  status: 'running' | 'completed' | 'failed' | 'timeout'
  prompt: string
  output?: string // captured stdout summary
  error?: string
  exitCode?: number
  durationMs?: number
}

// ─── Cron expression matching ──────────────────────────────────────────────────

/**
 * Check whether a single cron field matches a given numeric value.
 *
 * Supported syntax per field:
 *   *          — any value
 *   5          — exact match
 *   1,3,5      — list
 *   1-5        — inclusive range
 *   *​/2        — step from 0
 *   1-10/3     — step within a range
 */
export function fieldMatches(field: string, value: number): boolean {
  if (field === '*') return true

  // Comma-separated list — each element can be a range or step
  const parts = field.split(',')
  return parts.some((part) => singleFieldMatches(part.trim(), value))
}

function singleFieldMatches(part: string, value: number): boolean {
  // Step: */n or range/n
  if (part.includes('/')) {
    const [rangePart, stepStr] = part.split('/')
    const step = parseInt(stepStr, 10)
    if (isNaN(step) || step <= 0) return false

    if (rangePart === '*') {
      return value % step === 0
    }
    // range/step  e.g. 1-10/3
    if (rangePart.includes('-')) {
      const [startStr, endStr] = rangePart.split('-')
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)
      if (value < start || value > end) return false
      return (value - start) % step === 0
    }
    // single/step  e.g. 5/2  — treat as start with step
    const start = parseInt(rangePart, 10)
    if (value < start) return false
    return (value - start) % step === 0
  }

  // Range: a-b
  if (part.includes('-')) {
    const [startStr, endStr] = part.split('-')
    const start = parseInt(startStr, 10)
    const end = parseInt(endStr, 10)
    return value >= start && value <= end
  }

  // Exact number
  return parseInt(part, 10) === value
}

/**
 * Check whether a standard 5-field cron expression matches the given date.
 * Fields: minute hour day-of-month month day-of-week
 */
export function cronMatches(cronExpr: string, date: Date): boolean {
  const fields = cronExpr.trim().split(/\s+/)
  if (fields.length !== 5) return false

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields
  return (
    fieldMatches(minute, date.getMinutes()) &&
    fieldMatches(hour, date.getHours()) &&
    fieldMatches(dayOfMonth, date.getDate()) &&
    fieldMatches(month, date.getMonth() + 1) &&
    fieldMatches(dayOfWeek, date.getDay())
  )
}

// ─── Log file I/O ──────────────────────────────────────────────────────────────

type RunsFile = { runs: TaskRun[] }

function getLogFilePath(): string {
  const configDir =
    process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
  return path.join(configDir, 'scheduled_tasks_log.json')
}

async function readRunsFile(): Promise<RunsFile> {
  try {
    const raw = await fs.readFile(getLogFilePath(), 'utf-8')
    const parsed = JSON.parse(raw) as RunsFile
    if (!Array.isArray(parsed.runs)) return { runs: [] }
    return parsed
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { runs: [] }
    }
    throw err
  }
}

async function writeRunsFile(data: RunsFile): Promise<void> {
  const filePath = getLogFilePath()
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })

  const tmpFile = `${filePath}.tmp.${Date.now()}`
  try {
    await fs.writeFile(tmpFile, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    await fs.rename(tmpFile, filePath)
  } catch (err) {
    await fs.unlink(tmpFile).catch(() => {})
    throw err
  }
}

/** Append a run to the log and trim to keep at most MAX_RUNS_PER_TASK per task. */
async function appendRun(run: TaskRun): Promise<void> {
  const data = await readRunsFile()
  data.runs.push(run)
  trimRuns(data)
  await writeRunsFile(data)
}

/** Update an existing run in the log (matched by run.id). */
async function updateRun(run: TaskRun): Promise<void> {
  const data = await readRunsFile()
  const idx = data.runs.findIndex((r) => r.id === run.id)
  if (idx !== -1) {
    data.runs[idx] = run
  } else {
    data.runs.push(run)
  }
  trimRuns(data)
  await writeRunsFile(data)
}

const MAX_RUNS_PER_TASK = 100

/** Keep only the latest MAX_RUNS_PER_TASK entries per task. */
function trimRuns(data: RunsFile): void {
  const countByTask = new Map<string, number>()
  // Count from the end (newest first) and mark for removal
  const keep = new Array<boolean>(data.runs.length).fill(false)
  for (let i = data.runs.length - 1; i >= 0; i--) {
    const taskId = data.runs[i].taskId
    const count = countByTask.get(taskId) || 0
    if (count < MAX_RUNS_PER_TASK) {
      keep[i] = true
      countByTask.set(taskId, count + 1)
    }
  }
  data.runs = data.runs.filter((_, i) => keep[i])
}

// ─── Scheduler ─────────────────────────────────────────────────────────────────

const TASK_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

export class CronScheduler {
  private intervalId: Timer | null = null
  private runningTasks = new Map<
    string,
    { proc: ReturnType<typeof Bun.spawn>; startedAt: number; runId: string }
  >()
  private cronService: CronService

  constructor(cronService?: CronService) {
    this.cronService = cronService || new CronService()
  }

  /** Start the scheduler (called on server boot). */
  start(): void {
    if (this.intervalId) return // already running
    console.log('[CronScheduler] Starting — checking every 60 s')
    this.intervalId = setInterval(() => this.tick(), 60_000)
    // Immediate first check
    this.tick()
  }

  /** Stop the scheduler and kill any running task processes. */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    for (const [taskId, entry] of this.runningTasks) {
      try {
        entry.proc.kill()
      } catch {
        // process may have already exited
      }
      this.runningTasks.delete(taskId)
    }
    console.log('[CronScheduler] Stopped')
  }

  /** One tick of the scheduler — evaluate all tasks against the current time. */
  async tick(): Promise<void> {
    try {
      const tasks = await this.cronService.listTasks()
      const now = new Date()

      for (const task of tasks) {
        // Skip disabled tasks
        if (task.enabled === false) continue

        // Skip if already running
        if (this.runningTasks.has(task.id)) continue

        if (cronMatches(task.cron, now)) {
          // Fire and forget — don't await; we want all matching tasks to start
          this.executeTask(task).catch((err) => {
            console.error(
              `[CronScheduler] Unhandled error executing task ${task.id}:`,
              err,
            )
          })
        }
      }
    } catch (err) {
      console.error('[CronScheduler] Error during tick:', err)
    }
  }

  /** Execute a single task by spawning a CLI subprocess. */
  async executeTask(task: CronTask): Promise<TaskRun> {
    const runId = crypto.randomBytes(6).toString('hex')
    const startedAt = new Date().toISOString()

    const run: TaskRun = {
      id: runId,
      taskId: task.id,
      taskName: task.name || task.prompt.slice(0, 60),
      startedAt,
      status: 'running',
      prompt: task.prompt,
    }

    // Persist the "running" state
    await appendRun(run)

    // Resolve CLI entry point relative to this file
    const cliPath = path.resolve(import.meta.dir, '../../entrypoints/cli.tsx')

    const inputPayload = JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'text', text: task.prompt }],
      },
      parent_tool_use_id: null,
      session_id: '',
    }) + '\n'

    const proc = Bun.spawn(
      [
        'bun',
        cliPath,
        '--print',
        '--verbose',
        '--input-format',
        'stream-json',
        '--output-format',
        'stream-json',
      ],
      {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        cwd: task.folderPath || os.homedir(),
      },
    )

    this.runningTasks.set(task.id, { proc, startedAt: Date.now(), runId })

    // Write prompt to stdin then close it
    try {
      proc.stdin.write(inputPayload)
      proc.stdin.end()
    } catch {
      // If writing fails, the process may have already exited
    }

    // Set up a timeout
    const timeoutId = setTimeout(() => {
      if (this.runningTasks.has(task.id)) {
        try {
          proc.kill()
        } catch {
          // ignore
        }
      }
    }, TASK_TIMEOUT_MS)

    try {
      // Collect stdout
      const stdoutChunks: string[] = []
      if (proc.stdout) {
        const reader = proc.stdout.getReader()
        const decoder = new TextDecoder()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            stdoutChunks.push(decoder.decode(value, { stream: true }))
          }
        } catch {
          // stream may be interrupted on kill
        }
      }

      // Wait for exit
      const exitCode = await proc.exited

      clearTimeout(timeoutId)
      this.runningTasks.delete(task.id)

      const completedAt = new Date().toISOString()
      const output = stdoutChunks.join('')
      const durationMs =
        new Date(completedAt).getTime() - new Date(startedAt).getTime()

      // Determine if this was a timeout
      const wasTimeout = durationMs >= TASK_TIMEOUT_MS

      const completedRun: TaskRun = {
        ...run,
        completedAt,
        status: wasTimeout ? 'timeout' : exitCode === 0 ? 'completed' : 'failed',
        output: output.slice(0, 10_000), // cap stored output
        exitCode,
        durationMs,
      }

      // Collect stderr for error field
      if (exitCode !== 0 && proc.stderr) {
        try {
          const stderrText = await new Response(proc.stderr).text()
          completedRun.error = stderrText.slice(0, 5_000)
        } catch {
          // ignore
        }
      }

      await updateRun(completedRun)

      // Update lastFiredAt on the task
      await this.cronService.updateLastFired(task.id, startedAt)

      // If non-recurring, disable after first run
      if (!task.recurring) {
        await this.cronService.updateTask(task.id, { enabled: false }).catch(() => {
          // Task may have been deleted
        })
      }

      return completedRun
    } catch (err) {
      clearTimeout(timeoutId)
      this.runningTasks.delete(task.id)

      const completedAt = new Date().toISOString()
      const failedRun: TaskRun = {
        ...run,
        completedAt,
        status: 'failed',
        error: (err as Error).message,
        durationMs:
          new Date(completedAt).getTime() - new Date(startedAt).getTime(),
      }

      await updateRun(failedRun)
      await this.cronService.updateLastFired(task.id, startedAt)

      return failedRun
    }
  }

  // ─── Query helpers ─────────────────────────────────────────────────────────

  /** Get execution history for a specific task. */
  async getTaskRuns(taskId: string): Promise<TaskRun[]> {
    const data = await readRunsFile()
    return data.runs
      .filter((r) => r.taskId === taskId)
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )
  }

  /** Get recent runs across all tasks. */
  async getRecentRuns(limit = 50): Promise<TaskRun[]> {
    const data = await readRunsFile()
    return data.runs
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )
      .slice(0, limit)
  }
}

// ─── Singleton export ──────────────────────────────────────────────────────────

export const cronScheduler = new CronScheduler()
