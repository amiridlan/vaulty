declare global {
  interface Window {
    __TAURI__?: any;
    __TAURI_INVOKE__?: any;
  }
}

declare module '@tauri-apps/plugin-sql' {
  export default class Database {
    static load(path: string): Promise<Database>;
    execute(query: string, bindValues?: unknown[]): Promise<void>;
    select<T>(query: string, bindValues?: unknown[]): Promise<T[]>;
  }
}

declare module '@tauri-apps/plugin-fs' {
  export function readFile(path: string): Promise<Uint8Array>;
  export function writeFile(path: string, contents: Uint8Array): Promise<void>;
}

declare module '@tauri-apps/plugin-dialog' {
  export function open(options?: {
    directory?: boolean;
    multiple?: boolean;
  }): Promise<string | string[] | null>;
}

export {};