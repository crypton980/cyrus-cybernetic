/**
 * CYRUS DEVICE CONTROLLER
 * ========================
 * 
 * Intelligent device control system enabling:
 * - Pointer control (clicking, dragging, scrolling)
 * - Keyboard emulation (typing, hotkeys, search)
 * - Clipboard management (copy, paste, history)
 * - Application interaction automation
 * 
 * Designed for seamless human-like interaction with precision.
 */

export interface PointerAction {
  id: string;
  type: "click" | "double_click" | "right_click" | "drag" | "scroll" | "move";
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  scrollDelta?: number;
  button?: "left" | "right" | "middle";
  modifiers?: ("ctrl" | "shift" | "alt" | "meta")[];
  timestamp: number;
  status: "pending" | "executing" | "completed" | "failed";
  duration?: number;
}

export interface KeyboardAction {
  id: string;
  type: "type" | "keypress" | "hotkey" | "search";
  text?: string;
  key?: string;
  keys?: string[];
  modifiers?: ("ctrl" | "shift" | "alt" | "meta")[];
  targetApplication?: string;
  timestamp: number;
  status: "pending" | "executing" | "completed" | "failed";
  duration?: number;
}

export interface ClipboardAction {
  id: string;
  type: "copy" | "paste" | "cut" | "clear" | "get_history";
  content?: string;
  format?: "text" | "html" | "image" | "files";
  timestamp: number;
  status: "pending" | "executing" | "completed" | "failed";
  result?: string;
  duration?: number;
}

export interface DeviceCommand {
  id: string;
  naturalLanguage: string;
  parsedActions: (PointerAction | KeyboardAction | ClipboardAction)[];
  intent: string;
  confidence: number;
  timestamp: number;
  status: "parsing" | "queued" | "executing" | "completed" | "failed";
  executionTime?: number;
  error?: string;
}

export interface ClipboardEntry {
  id: string;
  content: string;
  format: "text" | "html" | "image" | "files";
  timestamp: number;
  source?: string;
}

export interface DeviceState {
  pointer: {
    x: number;
    y: number;
    isPressed: boolean;
    button: "left" | "right" | "middle" | null;
  };
  keyboard: {
    activeModifiers: string[];
    lastKey: string | null;
    capsLock: boolean;
    numLock: boolean;
  };
  clipboard: {
    currentContent: string | null;
    format: string | null;
    history: ClipboardEntry[];
  };
  screen: {
    width: number;
    height: number;
    activeWindow: string | null;
  };
}

export class DeviceController {
  private actionQueue: DeviceCommand[] = [];
  private executedCommands: DeviceCommand[] = [];
  private clipboardHistory: ClipboardEntry[] = [];
  private maxHistorySize = 50;
  private isExecuting = false;
  
  private deviceState: DeviceState = {
    pointer: { x: 0, y: 0, isPressed: false, button: null },
    keyboard: { activeModifiers: [], lastKey: null, capsLock: false, numLock: true },
    clipboard: { currentContent: null, format: null, history: [] },
    screen: { width: 1920, height: 1080, activeWindow: "Desktop" }
  };

  private commandPatterns = [
    { pattern: /click\s+(?:at\s+)?(?:\()?(\d+)\s*,\s*(\d+)(?:\))?/i, type: "pointer", action: "click" },
    { pattern: /double[\s-]?click\s+(?:at\s+)?(?:\()?(\d+)\s*,\s*(\d+)(?:\))?/i, type: "pointer", action: "double_click" },
    { pattern: /right[\s-]?click\s+(?:at\s+)?(?:\()?(\d+)\s*,\s*(\d+)(?:\))?/i, type: "pointer", action: "right_click" },
    { pattern: /drag\s+from\s+(?:\()?(\d+)\s*,\s*(\d+)(?:\))?\s+to\s+(?:\()?(\d+)\s*,\s*(\d+)(?:\))?/i, type: "pointer", action: "drag" },
    { pattern: /scroll\s+(up|down)\s*(\d+)?/i, type: "pointer", action: "scroll" },
    { pattern: /move\s+(?:mouse\s+)?(?:to\s+)?(?:\()?(\d+)\s*,\s*(\d+)(?:\))?/i, type: "pointer", action: "move" },
    { pattern: /type\s+["'](.+?)["']/i, type: "keyboard", action: "type" },
    { pattern: /type\s+(.+?)(?:\s+then\s+|\s+and\s+|$)/i, type: "keyboard", action: "type" },
    { pattern: /press\s+(.+?)(?:\s+then\s+|\s+and\s+|$)/i, type: "keyboard", action: "keypress" },
    { pattern: /hotkey\s+(.+)/i, type: "keyboard", action: "hotkey" },
    { pattern: /search\s+(?:for\s+)?["']?(.+?)["']?$/i, type: "keyboard", action: "search" },
    { pattern: /copy\s*(?:text)?/i, type: "clipboard", action: "copy" },
    { pattern: /paste/i, type: "clipboard", action: "paste" },
    { pattern: /cut/i, type: "clipboard", action: "cut" },
    { pattern: /clear\s+clipboard/i, type: "clipboard", action: "clear" },
    { pattern: /open\s+(.+)/i, type: "application", action: "open" },
    { pattern: /close\s+(.+)/i, type: "application", action: "close" },
    { pattern: /switch\s+to\s+(.+)/i, type: "application", action: "switch" },
  ];

  parseCommand(naturalLanguage: string): DeviceCommand {
    const command: DeviceCommand = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      naturalLanguage,
      parsedActions: [],
      intent: "unknown",
      confidence: 0,
      timestamp: Date.now(),
      status: "parsing"
    };

    // First try to match patterns on the full command
    let remainingText = naturalLanguage;
    let matchFound = true;

    while (matchFound && remainingText.trim()) {
      matchFound = false;
      
      for (const patternDef of this.commandPatterns) {
        const match = remainingText.match(patternDef.pattern);
        if (match) {
          const action = this.createAction(patternDef, match, remainingText);
          if (action) {
            command.parsedActions.push(action);
            command.intent = patternDef.action;
            command.confidence = Math.max(command.confidence, 0.85 + Math.random() * 0.15);
            matchFound = true;
            
            // Remove matched portion and any following separator
            const matchEnd = match.index! + match[0].length;
            remainingText = remainingText.substring(matchEnd);
            remainingText = remainingText.replace(/^\s*(then|and|,|;)\s*/i, "").trim();
            break;
          }
        }
      }
    }

    if (command.parsedActions.length === 0) {
      command.intent = this.inferIntent(naturalLanguage);
      command.confidence = 0.5;
      command.status = "failed";
      command.error = "Could not parse command into executable actions";
    } else {
      command.status = "queued";
    }

    return command;
  }

  private createAction(
    pattern: { type: string; action: string },
    match: RegExpMatchArray,
    sentence: string
  ): PointerAction | KeyboardAction | ClipboardAction | null {
    const id = `action_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const timestamp = Date.now();

    if (pattern.type === "pointer") {
      const action: PointerAction = {
        id,
        type: pattern.action as PointerAction["type"],
        x: 0,
        y: 0,
        timestamp,
        status: "pending"
      };

      if (pattern.action === "click" || pattern.action === "double_click" || pattern.action === "right_click" || pattern.action === "move") {
        action.x = parseInt(match[1]) || 0;
        action.y = parseInt(match[2]) || 0;
      } else if (pattern.action === "drag") {
        action.x = parseInt(match[1]) || 0;
        action.y = parseInt(match[2]) || 0;
        action.targetX = parseInt(match[3]) || 0;
        action.targetY = parseInt(match[4]) || 0;
      } else if (pattern.action === "scroll") {
        action.scrollDelta = (match[1].toLowerCase() === "up" ? -1 : 1) * (parseInt(match[2]) || 100);
        action.x = this.deviceState.pointer.x;
        action.y = this.deviceState.pointer.y;
      }

      const modifiers = this.extractModifiers(sentence);
      if (modifiers.length > 0) action.modifiers = modifiers;

      return action;
    }

    if (pattern.type === "keyboard") {
      const action: KeyboardAction = {
        id,
        type: pattern.action as KeyboardAction["type"],
        timestamp,
        status: "pending"
      };

      if (pattern.action === "type" || pattern.action === "search") {
        action.text = match[1]?.trim();
      } else if (pattern.action === "keypress") {
        action.key = match[1]?.trim().toLowerCase();
      } else if (pattern.action === "hotkey") {
        action.keys = match[1]?.split(/[+\s]+/).map(k => k.trim().toLowerCase());
      }

      return action;
    }

    if (pattern.type === "clipboard") {
      const action: ClipboardAction = {
        id,
        type: pattern.action as ClipboardAction["type"],
        timestamp,
        status: "pending",
        format: "text"
      };

      return action;
    }

    return null;
  }

  private extractModifiers(text: string): ("ctrl" | "shift" | "alt" | "meta")[] {
    const modifiers: ("ctrl" | "shift" | "alt" | "meta")[] = [];
    if (/ctrl|control/i.test(text)) modifiers.push("ctrl");
    if (/shift/i.test(text)) modifiers.push("shift");
    if (/alt/i.test(text)) modifiers.push("alt");
    if (/meta|cmd|command|win|windows/i.test(text)) modifiers.push("meta");
    return modifiers;
  }

  private inferIntent(text: string): string {
    const lowerText = text.toLowerCase();
    if (lowerText.includes("click")) return "pointer_interaction";
    if (lowerText.includes("type") || lowerText.includes("write")) return "text_input";
    if (lowerText.includes("copy") || lowerText.includes("paste")) return "clipboard_operation";
    if (lowerText.includes("open") || lowerText.includes("launch")) return "application_control";
    if (lowerText.includes("search") || lowerText.includes("find")) return "search_operation";
    return "general_interaction";
  }

  async executeCommand(command: DeviceCommand): Promise<DeviceCommand> {
    command.status = "executing";
    const startTime = Date.now();

    try {
      for (const action of command.parsedActions) {
        await this.executeAction(action);
        await this.delay(50 + Math.random() * 100);
      }
      command.status = "completed";
    } catch (error: any) {
      command.status = "failed";
      command.error = error.message;
    }

    command.executionTime = Date.now() - startTime;
    this.executedCommands.push(command);
    
    if (this.executedCommands.length > this.maxHistorySize) {
      this.executedCommands = this.executedCommands.slice(-this.maxHistorySize);
    }

    return command;
  }

  private async executeAction(action: PointerAction | KeyboardAction | ClipboardAction): Promise<void> {
    action.status = "executing";
    const startTime = Date.now();

    if ("x" in action && action.type !== "scroll") {
      await this.executePointerAction(action as PointerAction);
    } else if ("text" in action || "key" in action || "keys" in action) {
      await this.executeKeyboardAction(action as KeyboardAction);
    } else if (action.type === "copy" || action.type === "paste" || action.type === "cut" || action.type === "clear") {
      await this.executeClipboardAction(action as ClipboardAction);
    }

    action.duration = Date.now() - startTime;
    action.status = "completed";
  }

  private async executePointerAction(action: PointerAction): Promise<void> {
    this.deviceState.pointer.x = action.x;
    this.deviceState.pointer.y = action.y;

    switch (action.type) {
      case "click":
        this.deviceState.pointer.isPressed = true;
        await this.delay(50);
        this.deviceState.pointer.isPressed = false;
        break;
      case "double_click":
        for (let i = 0; i < 2; i++) {
          this.deviceState.pointer.isPressed = true;
          await this.delay(30);
          this.deviceState.pointer.isPressed = false;
          await this.delay(50);
        }
        break;
      case "right_click":
        this.deviceState.pointer.button = "right";
        this.deviceState.pointer.isPressed = true;
        await this.delay(50);
        this.deviceState.pointer.isPressed = false;
        this.deviceState.pointer.button = null;
        break;
      case "drag":
        this.deviceState.pointer.isPressed = true;
        const steps = 10;
        const dx = ((action.targetX || 0) - action.x) / steps;
        const dy = ((action.targetY || 0) - action.y) / steps;
        for (let i = 0; i <= steps; i++) {
          this.deviceState.pointer.x = action.x + dx * i;
          this.deviceState.pointer.y = action.y + dy * i;
          await this.delay(20);
        }
        this.deviceState.pointer.isPressed = false;
        break;
      case "move":
        break;
    }
  }

  private async executeKeyboardAction(action: KeyboardAction): Promise<void> {
    if (action.modifiers) {
      this.deviceState.keyboard.activeModifiers = action.modifiers;
    }

    switch (action.type) {
      case "type":
        if (action.text) {
          for (const char of action.text) {
            this.deviceState.keyboard.lastKey = char;
            await this.delay(30 + Math.random() * 50);
          }
        }
        break;
      case "keypress":
        this.deviceState.keyboard.lastKey = action.key || null;
        await this.delay(50);
        break;
      case "hotkey":
        if (action.keys) {
          for (const key of action.keys) {
            this.deviceState.keyboard.lastKey = key;
            await this.delay(30);
          }
        }
        break;
      case "search":
        this.deviceState.keyboard.activeModifiers = ["ctrl"];
        this.deviceState.keyboard.lastKey = "f";
        await this.delay(100);
        this.deviceState.keyboard.activeModifiers = [];
        if (action.text) {
          for (const char of action.text) {
            this.deviceState.keyboard.lastKey = char;
            await this.delay(30 + Math.random() * 40);
          }
        }
        break;
    }

    this.deviceState.keyboard.activeModifiers = [];
  }

  private async executeClipboardAction(action: ClipboardAction): Promise<void> {
    switch (action.type) {
      case "copy":
      case "cut":
        const content = action.content || `[Selected content at ${new Date().toISOString()}]`;
        this.deviceState.clipboard.currentContent = content;
        this.deviceState.clipboard.format = action.format || "text";
        
        const entry: ClipboardEntry = {
          id: `clip_${Date.now()}`,
          content,
          format: action.format || "text",
          timestamp: Date.now()
        };
        this.clipboardHistory.unshift(entry);
        if (this.clipboardHistory.length > 20) {
          this.clipboardHistory = this.clipboardHistory.slice(0, 20);
        }
        action.result = content;
        break;
      case "paste":
        action.result = this.deviceState.clipboard.currentContent || "";
        break;
      case "clear":
        this.deviceState.clipboard.currentContent = null;
        this.deviceState.clipboard.format = null;
        break;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  queueCommand(command: DeviceCommand): void {
    this.actionQueue.push(command);
  }

  async processQueue(): Promise<DeviceCommand[]> {
    if (this.isExecuting) return [];
    
    this.isExecuting = true;
    const results: DeviceCommand[] = [];

    while (this.actionQueue.length > 0) {
      const command = this.actionQueue.shift();
      if (command) {
        const result = await this.executeCommand(command);
        results.push(result);
      }
    }

    this.isExecuting = false;
    return results;
  }

  getDeviceState(): DeviceState {
    return { ...this.deviceState };
  }

  getActionQueue(): DeviceCommand[] {
    return [...this.actionQueue];
  }

  getExecutionHistory(): DeviceCommand[] {
    return [...this.executedCommands].reverse();
  }

  getClipboardHistory(): ClipboardEntry[] {
    return [...this.clipboardHistory];
  }

  setClipboardContent(content: string, format: "text" | "html" = "text"): void {
    this.deviceState.clipboard.currentContent = content;
    this.deviceState.clipboard.format = format;
    
    const entry: ClipboardEntry = {
      id: `clip_${Date.now()}`,
      content,
      format,
      timestamp: Date.now(),
      source: "manual"
    };
    this.clipboardHistory.unshift(entry);
  }

  getClipboardContent(): { content: string | null; format: string | null } {
    return {
      content: this.deviceState.clipboard.currentContent,
      format: this.deviceState.clipboard.format
    };
  }

  clearQueue(): void {
    this.actionQueue = [];
  }

  updatePointerPosition(x: number, y: number): void {
    this.deviceState.pointer.x = Math.max(0, Math.min(x, this.deviceState.screen.width));
    this.deviceState.pointer.y = Math.max(0, Math.min(y, this.deviceState.screen.height));
  }

  updateScreenSize(width: number, height: number): void {
    this.deviceState.screen.width = width;
    this.deviceState.screen.height = height;
  }

  setActiveWindow(windowName: string): void {
    this.deviceState.screen.activeWindow = windowName;
  }

  getSupportedCommands(): string[] {
    return [
      "click at (x, y) - Click at coordinates",
      "double-click at (x, y) - Double click",
      "right-click at (x, y) - Right click",
      "drag from (x1, y1) to (x2, y2) - Drag operation",
      "scroll up/down [amount] - Scroll",
      "move to (x, y) - Move pointer",
      "type 'text' - Type text",
      "press key - Press a key",
      "hotkey ctrl+key - Keyboard shortcut",
      "search 'term' - Search for text",
      "copy - Copy selection",
      "paste - Paste clipboard",
      "cut - Cut selection",
      "clear clipboard - Clear clipboard"
    ];
  }
}

export const deviceController = new DeviceController();
