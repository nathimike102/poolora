/**
 * utils/logger.ts
 * 
 * Client-side logging utility
 * In production, logs can be sent to a logging service
 */

import { API_CONFIG } from '../api/constants';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

class Logger {
  private currentLevel: LogLevel;
  private isDev: boolean;

  constructor() {
    this.currentLevel = API_CONFIG.logLevel;
    this.isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false; // Metro/Expo global
  }

  private shouldLog(level: LogLevel): boolean {
    // In production, suppress debug logs unless explicitly enabled.
    if (!this.isDev && level === 'debug') return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.currentLevel];
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    return data ? `${prefix} ${message} ${JSON.stringify(data)}` : `${prefix} ${message}`;
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, data));
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  error(message: string, data?: any): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, data));
    }
  }
}

export const logger = new Logger();
