import { LOG_DIR } from '@/common/constants';
import { accessSync, constants, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import winston, { type Logger as WinLogger } from 'winston';

type LogFiles = 'server' | 'http' | 'access' | 'db' | 'mail' | 'payment';

class Logger {
  private static instances: Map<LogFiles, WinLogger> = new Map();
  private static logDir: string | null | undefined = undefined;

  private static tryDir(dir: string): string | null {
    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      accessSync(dir, constants.W_OK);
      return dir;
    } catch {
      return null;
    }
  }

  private static initLogDir(): string | null {
    if (this.logDir !== undefined) return this.logDir;

    if (process.env.LOG_TO_FILE === 'false') {
      this.logDir = null;
      return null;
    }

    const candidates = [
      process.env.LOG_DIR,
      join(process.cwd(), LOG_DIR),
      join(tmpdir(), 'logs'),
    ].filter((d): d is string => Boolean(d));

    for (const candidate of candidates) {
      const resolved = this.tryDir(candidate);
      if (resolved) {
        this.logDir = resolved;
        return resolved;
      }
    }

    console.warn('[Logger] No writable log directory found, using console logging only.');
    this.logDir = null;
    return null;
  }

  private static createLogger(filename: LogFiles): WinLogger {
    const logDir = this.initLogDir();

    const transports: winston.transport[] = [new winston.transports.Console()];

    if (logDir) {
      transports.push(
        new winston.transports.File({
          filename: join(logDir, `${filename}.log`),
        }),
      );
    }

    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, stack }) => {
          return stack
            ? `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`
            : `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        }),
      ),
      transports,
    });
  }

  public static getInstance(filename: LogFiles): WinLogger {
    if (!this.instances.has(filename)) {
      this.instances.set(filename, this.createLogger(filename));
    }
    return this.instances.get(filename)!;
  }

  public static getLogDir(): string | null {
    return this.initLogDir();
  }

  public static getAvailableLogFiles(): LogFiles[] {
    return ['server', 'http', 'access', 'db', 'mail', 'payment'];
  }

  public static getLogFilePath(filename: string): string | null {
    const allowed = this.getAvailableLogFiles() as string[];
    if (!allowed.includes(filename)) return null;

    const dir = this.initLogDir();
    if (!dir) return null;

    return join(dir, `${filename}.log`);
  }
}

export default Logger;