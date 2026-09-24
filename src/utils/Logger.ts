export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  colors?: boolean;
}

class Logger {
  private level: LogLevel;
  private prefix: string;
  private colors: boolean;
  private startTime: Map<string, number> = new Map();

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix ?? "xanpack";
    this.colors = options.colors ?? true;
  }

  private getColorCode(level: LogLevel): string {
    if (!this.colors) return "";
    switch (level) {
      case LogLevel.DEBUG:
        return "\x1b[36m"; // cyan
      case LogLevel.INFO:
        return "\x1b[32m"; // green
      case LogLevel.WARN:
        return "\x1b[33m"; // yellow
      case LogLevel.ERROR:
        return "\x1b[31m"; // red
      default:
        return "";
    }
  }

  private formatMessage(level: LogLevel, message: string): string {
    const levelName = LogLevel[level];
    const colorCode = this.getColorCode(level);
    const reset = this.colors ? "\x1b[0m" : "";
    return `${colorCode}[${this.prefix}:${levelName}]${reset} ${message}`;
  }

  private log(level: LogLevel, message: string, data?: any): void {
    if (level < this.level) return;

    const formatted = this.formatMessage(level, message);

    switch (level) {
      case LogLevel.ERROR:
        console.error(formatted, data ?? "");
        break;
      case LogLevel.WARN:
        console.warn(formatted, data ?? "");
        break;
      case LogLevel.INFO:
        console.log(formatted, data ?? "");
        break;
      case LogLevel.DEBUG:
        console.debug(formatted, data ?? "");
        break;
    }
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }

  time(label: string): void {
    this.startTime.set(label, performance.now());
  }

  timeEnd(label: string): void {
    const start = this.startTime.get(label);
    if (!start) {
      this.warn(`Timer "${label}" does not exist`);
      return;
    }

    const duration = (performance.now() - start).toFixed(2);
    this.info(`${label}: ${duration}ms`);
    this.startTime.delete(label);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

export default Logger;
