/**
 * CYRUS™ Autonomous AI Agent
 * Human-like device interaction system with real-time feedback
 * Created by Obakeng Kaelo (ID: 815219119, Botswana)
 */

import { deviceController, DeviceCommand, PointerAction, KeyboardAction, ClipboardAction } from "./cyrus-device-controller";

export type DeviceAction = PointerAction | KeyboardAction | ClipboardAction;

export interface AgentTask {
  id: string;
  description: string;
  steps: AgentStep[];
  status: "pending" | "executing" | "completed" | "failed" | "paused";
  startTime: number;
  endTime?: number;
  result?: string;
  error?: string;
}

export interface AgentStep {
  id: string;
  action: string;
  target?: string;
  parameters?: Record<string, any>;
  status: "pending" | "executing" | "completed" | "failed" | "skipped";
  feedback: string;
  duration?: number;
  timestamp: number;
}

export interface AgentFeedback {
  type: "info" | "action" | "success" | "warning" | "error" | "thinking";
  message: string;
  timestamp: number;
  taskId?: string;
  stepId?: string;
  progress?: number;
}

export interface AppContext {
  name: string;
  type: "browser" | "editor" | "terminal" | "file_manager" | "media" | "settings" | "other";
  isActive: boolean;
  controls: AppControl[];
}

export interface AppControl {
  name: string;
  type: "button" | "input" | "menu" | "link" | "tab" | "list_item";
  location: { x: number; y: number; width: number; height: number };
  isEnabled: boolean;
  isVisible: boolean;
}

export interface HumanBehaviorConfig {
  pointerSpeed: "slow" | "normal" | "fast";
  typingSpeed: "slow" | "normal" | "fast";
  pauseBetweenActions: boolean;
  naturalErrors: boolean;
  thinkingPauses: boolean;
}

class CYRUSAutonomousAgent {
  private currentTask: AgentTask | null = null;
  private taskHistory: AgentTask[] = [];
  private feedbackQueue: AgentFeedback[] = [];
  private feedbackListeners: ((feedback: AgentFeedback) => void)[] = [];
  private isExecuting: boolean = false;
  private appContexts: Map<string, AppContext> = new Map();
  private behaviorConfig: HumanBehaviorConfig = {
    pointerSpeed: "normal",
    typingSpeed: "normal",
    pauseBetweenActions: true,
    naturalErrors: false,
    thinkingPauses: true
  };

  private readonly POINTER_SPEEDS = { slow: 30, normal: 15, fast: 5 };
  private readonly TYPING_SPEEDS = { slow: 150, normal: 75, fast: 25 };
  private readonly THINKING_PAUSE = { min: 200, max: 800 };
  private readonly ACTION_PAUSE = { min: 100, max: 400 };

  constructor() {
    this.initializeDefaultApps();
  }

  private initializeDefaultApps(): void {
    this.appContexts.set("browser", {
      name: "Web Browser",
      type: "browser",
      isActive: true,
      controls: [
        { name: "address_bar", type: "input", location: { x: 400, y: 50, width: 600, height: 32 }, isEnabled: true, isVisible: true },
        { name: "back_button", type: "button", location: { x: 50, y: 50, width: 32, height: 32 }, isEnabled: true, isVisible: true },
        { name: "forward_button", type: "button", location: { x: 90, y: 50, width: 32, height: 32 }, isEnabled: false, isVisible: true },
        { name: "refresh_button", type: "button", location: { x: 130, y: 50, width: 32, height: 32 }, isEnabled: true, isVisible: true },
        { name: "new_tab", type: "button", location: { x: 300, y: 20, width: 24, height: 24 }, isEnabled: true, isVisible: true },
        { name: "search_box", type: "input", location: { x: 960, y: 400, width: 500, height: 44 }, isEnabled: true, isVisible: true }
      ]
    });

    this.appContexts.set("file_manager", {
      name: "File Manager",
      type: "file_manager",
      isActive: false,
      controls: [
        { name: "search", type: "input", location: { x: 1600, y: 50, width: 200, height: 32 }, isEnabled: true, isVisible: true },
        { name: "new_folder", type: "button", location: { x: 100, y: 100, width: 100, height: 32 }, isEnabled: true, isVisible: true },
        { name: "file_list", type: "list_item", location: { x: 300, y: 150, width: 1200, height: 600 }, isEnabled: true, isVisible: true }
      ]
    });

    this.appContexts.set("terminal", {
      name: "Terminal",
      type: "terminal",
      isActive: false,
      controls: [
        { name: "command_input", type: "input", location: { x: 960, y: 900, width: 1800, height: 24 }, isEnabled: true, isVisible: true }
      ]
    });
  }

  private emitFeedback(feedback: Omit<AgentFeedback, "timestamp">): void {
    const fullFeedback: AgentFeedback = {
      ...feedback,
      timestamp: Date.now()
    };
    this.feedbackQueue.push(fullFeedback);
    if (this.feedbackQueue.length > 100) {
      this.feedbackQueue.shift();
    }
    this.feedbackListeners.forEach(listener => listener(fullFeedback));
  }

  public onFeedback(listener: (feedback: AgentFeedback) => void): () => void {
    this.feedbackListeners.push(listener);
    return () => {
      const index = this.feedbackListeners.indexOf(listener);
      if (index > -1) this.feedbackListeners.splice(index, 1);
    };
  }

  public getFeedbackHistory(): AgentFeedback[] {
    return [...this.feedbackQueue];
  }

  private async humanDelay(type: "thinking" | "action" | "typing"): Promise<void> {
    if (!this.behaviorConfig.pauseBetweenActions && type === "action") return;
    if (!this.behaviorConfig.thinkingPauses && type === "thinking") return;

    let min: number, max: number;
    if (type === "thinking") {
      min = this.THINKING_PAUSE.min;
      max = this.THINKING_PAUSE.max;
    } else if (type === "typing") {
      min = this.TYPING_SPEEDS[this.behaviorConfig.typingSpeed] * 0.5;
      max = this.TYPING_SPEEDS[this.behaviorConfig.typingSpeed] * 1.5;
    } else {
      min = this.ACTION_PAUSE.min;
      max = this.ACTION_PAUSE.max;
    }

    const delay = Math.floor(Math.random() * (max - min) + min);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private async smoothPointerMove(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    const steps = this.POINTER_SPEEDS[this.behaviorConfig.pointerSpeed];
    const dx = (toX - fromX) / steps;
    const dy = (toY - fromY) / steps;

    for (let i = 1; i <= steps; i++) {
      const currentX = Math.round(fromX + dx * i);
      const currentY = Math.round(fromY + dy * i);
      
      const curve = Math.sin((i / steps) * Math.PI) * 0.1;
      const adjustedX = currentX + Math.round(curve * (toY - fromY));
      const adjustedY = currentY - Math.round(curve * (toX - fromX));

      deviceController.updatePointerPosition(adjustedX, adjustedY);
      await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 5));
    }

    deviceController.updatePointerPosition(toX, toY);
  }

  private async humanTypeText(text: string): Promise<void> {
    const baseDelay = this.TYPING_SPEEDS[this.behaviorConfig.typingSpeed];
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      let delay = baseDelay + Math.random() * baseDelay * 0.5;
      
      if (char === " ") {
        delay *= 0.7;
      } else if (/[A-Z]/.test(char)) {
        delay *= 1.2;
      } else if (/[!@#$%^&*()_+{}|:"<>?]/.test(char)) {
        delay *= 1.4;
      }

      if (this.behaviorConfig.naturalErrors && Math.random() < 0.02) {
        const wrongChar = String.fromCharCode(char.charCodeAt(0) + (Math.random() > 0.5 ? 1 : -1));
        this.emitFeedback({ type: "action", message: `Typing: ${wrongChar}` });
        await new Promise(resolve => setTimeout(resolve, delay));
        this.emitFeedback({ type: "action", message: `Correcting typo...` });
        await new Promise(resolve => setTimeout(resolve, delay * 2));
      }

      this.emitFeedback({ type: "action", message: `Typing: ${text.substring(0, i + 1)}█` });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  public parseNaturalLanguage(input: string): AgentTask {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const steps: AgentStep[] = [];
    const normalizedInput = input.toLowerCase().trim();

    const patterns: { pattern: RegExp; handler: (match: RegExpMatchArray) => AgentStep[] }[] = [
      {
        pattern: /(?:open|launch|start|go to)\s+(?:the\s+)?(?:app\s+)?["']?([^"']+?)["']?(?:\s+app)?$/i,
        handler: (match) => [{
          id: `step_${Date.now()}_1`,
          action: "open_app",
          target: match[1].trim(),
          status: "pending",
          feedback: `Opening ${match[1].trim()}...`,
          timestamp: Date.now()
        }]
      },
      {
        pattern: /search\s+(?:for\s+)?["']?(.+?)["']?\s+(?:on|in|using)\s+(.+)/i,
        handler: (match) => [
          {
            id: `step_${Date.now()}_1`,
            action: "open_app",
            target: match[2].trim(),
            status: "pending",
            feedback: `Opening ${match[2].trim()}...`,
            timestamp: Date.now()
          },
          {
            id: `step_${Date.now()}_2`,
            action: "focus_search",
            status: "pending",
            feedback: "Locating search field...",
            timestamp: Date.now()
          },
          {
            id: `step_${Date.now()}_3`,
            action: "type_text",
            parameters: { text: match[1].trim() },
            status: "pending",
            feedback: `Typing search query: ${match[1].trim()}`,
            timestamp: Date.now()
          },
          {
            id: `step_${Date.now()}_4`,
            action: "press_key",
            parameters: { key: "enter" },
            status: "pending",
            feedback: "Executing search...",
            timestamp: Date.now()
          }
        ]
      },
      {
        pattern: /(?:navigate|go)\s+to\s+["']?(.+?)["']?$/i,
        handler: (match) => [
          {
            id: `step_${Date.now()}_1`,
            action: "focus_address_bar",
            status: "pending",
            feedback: "Clicking address bar...",
            timestamp: Date.now()
          },
          {
            id: `step_${Date.now()}_2`,
            action: "clear_and_type",
            parameters: { text: match[1].trim() },
            status: "pending",
            feedback: `Entering URL: ${match[1].trim()}`,
            timestamp: Date.now()
          },
          {
            id: `step_${Date.now()}_3`,
            action: "press_key",
            parameters: { key: "enter" },
            status: "pending",
            feedback: "Navigating...",
            timestamp: Date.now()
          }
        ]
      },
      {
        pattern: /(?:copy|select)\s+(?:the\s+)?(?:text\s+)?["'](.+?)["']\s+(?:and\s+)?(?:paste|put)\s+(?:it\s+)?(?:in(?:to)?|to)\s+(.+)/i,
        handler: (match) => [
          {
            id: `step_${Date.now()}_1`,
            action: "select_text",
            parameters: { text: match[1] },
            status: "pending",
            feedback: `Selecting text: "${match[1]}"`,
            timestamp: Date.now()
          },
          {
            id: `step_${Date.now()}_2`,
            action: "copy",
            status: "pending",
            feedback: "Copying to clipboard...",
            timestamp: Date.now()
          },
          {
            id: `step_${Date.now()}_3`,
            action: "navigate_to",
            target: match[2].trim(),
            status: "pending",
            feedback: `Navigating to ${match[2].trim()}...`,
            timestamp: Date.now()
          },
          {
            id: `step_${Date.now()}_4`,
            action: "paste",
            status: "pending",
            feedback: "Pasting content...",
            timestamp: Date.now()
          }
        ]
      },
      {
        pattern: /(?:write|type|enter|input)\s+["'](.+?)["']\s+(?:in(?:to)?|to)\s+(?:the\s+)?(.+)/i,
        handler: (match) => [
          {
            id: `step_${Date.now()}_1`,
            action: "locate_element",
            target: match[2].trim(),
            status: "pending",
            feedback: `Locating ${match[2].trim()}...`,
            timestamp: Date.now()
          },
          {
            id: `step_${Date.now()}_2`,
            action: "click",
            status: "pending",
            feedback: "Clicking to focus...",
            timestamp: Date.now()
          },
          {
            id: `step_${Date.now()}_3`,
            action: "type_text",
            parameters: { text: match[1] },
            status: "pending",
            feedback: `Typing: ${match[1]}`,
            timestamp: Date.now()
          }
        ]
      },
      {
        pattern: /(?:click|tap|press|hit)\s+(?:on\s+)?(?:the\s+)?["']?(.+?)["']?\s*(?:button|link|icon)?$/i,
        handler: (match) => [
          {
            id: `step_${Date.now()}_1`,
            action: "locate_element",
            target: match[1].trim(),
            status: "pending",
            feedback: `Locating "${match[1].trim()}"...`,
            timestamp: Date.now()
          },
          {
            id: `step_${Date.now()}_2`,
            action: "move_pointer",
            status: "pending",
            feedback: "Moving pointer to target...",
            timestamp: Date.now()
          },
          {
            id: `step_${Date.now()}_3`,
            action: "click",
            status: "pending",
            feedback: "Clicking...",
            timestamp: Date.now()
          }
        ]
      },
      {
        pattern: /scroll\s+(up|down)\s*(?:(\d+)\s*(?:times|pixels|lines)?)?/i,
        handler: (match) => [{
          id: `step_${Date.now()}_1`,
          action: "scroll",
          parameters: { direction: match[1], amount: parseInt(match[2]) || 3 },
          status: "pending",
          feedback: `Scrolling ${match[1]} ${match[2] || 3} lines...`,
          timestamp: Date.now()
        }]
      },
      {
        pattern: /(?:take|capture)\s+(?:a\s+)?screenshot/i,
        handler: () => [{
          id: `step_${Date.now()}_1`,
          action: "screenshot",
          status: "pending",
          feedback: "Capturing screenshot...",
          timestamp: Date.now()
        }]
      },
      {
        pattern: /(?:close|exit|quit)\s+(?:the\s+)?(?:current\s+)?(?:app|window|tab)?/i,
        handler: () => [{
          id: `step_${Date.now()}_1`,
          action: "close_window",
          status: "pending",
          feedback: "Closing current window...",
          timestamp: Date.now()
        }]
      },
      {
        pattern: /(?:switch|change)\s+to\s+(?:the\s+)?(.+?)(?:\s+app|\s+window)?$/i,
        handler: (match) => [{
          id: `step_${Date.now()}_1`,
          action: "switch_app",
          target: match[1].trim(),
          status: "pending",
          feedback: `Switching to ${match[1].trim()}...`,
          timestamp: Date.now()
        }]
      },
      {
        pattern: /(?:create|make|new)\s+(?:a\s+)?(?:new\s+)?(.+?)(?:\s+named|\s+called)?\s*["']?([^"']+)?["']?$/i,
        handler: (match) => {
          const item = match[1].trim();
          const name = match[2]?.trim();
          return [
            {
              id: `step_${Date.now()}_1`,
              action: "context_menu",
              status: "pending",
              feedback: "Opening context menu...",
              timestamp: Date.now()
            },
            {
              id: `step_${Date.now()}_2`,
              action: "select_menu_item",
              parameters: { item: `New ${item}` },
              status: "pending",
              feedback: `Selecting "New ${item}"...`,
              timestamp: Date.now()
            },
            ...(name ? [{
              id: `step_${Date.now()}_3`,
              action: "type_text",
              parameters: { text: name },
              status: "pending" as const,
              feedback: `Naming: ${name}`,
              timestamp: Date.now()
            }] : [])
          ];
        }
      }
    ];

    for (const { pattern, handler } of patterns) {
      const match = input.match(pattern);
      if (match) {
        steps.push(...handler(match));
        break;
      }
    }

    if (steps.length === 0) {
      const parsed = deviceController.parseCommand(input);
      if (parsed.status !== "failed" && parsed.parsedActions.length > 0) {
        for (const action of parsed.parsedActions) {
          steps.push({
            id: `step_${Date.now()}_${steps.length + 1}`,
            action: action.type,
            parameters: action,
            status: "pending",
            feedback: `Executing ${action.type}...`,
            timestamp: Date.now()
          });
        }
      } else {
        steps.push({
          id: `step_${Date.now()}_1`,
          action: "unknown",
          parameters: { originalCommand: input },
          status: "pending",
          feedback: `Attempting to interpret: "${input}"`,
          timestamp: Date.now()
        });
      }
    }

    return {
      id: taskId,
      description: input,
      steps,
      status: "pending",
      startTime: Date.now()
    };
  }

  private async executeStep(step: AgentStep): Promise<boolean> {
    step.status = "executing";
    const startTime = Date.now();

    this.emitFeedback({
      type: "action",
      message: step.feedback,
      stepId: step.id,
      taskId: this.currentTask?.id
    });

    try {
      await this.humanDelay("thinking");

      switch (step.action) {
        case "open_app": {
          this.emitFeedback({ type: "thinking", message: `Looking for ${step.target} application...` });
          await this.humanDelay("action");
          
          const app = this.appContexts.get(step.target?.toLowerCase() || "");
          if (app) {
            app.isActive = true;
            this.emitFeedback({ type: "success", message: `${app.name} is now active` });
          } else {
            await this.smoothPointerMove(
              deviceController.getDeviceState().pointer.x,
              deviceController.getDeviceState().pointer.y,
              960, 540
            );
            await deviceController.executeCommand(deviceController.parseCommand(`double click at 960, 540`));
            this.emitFeedback({ type: "success", message: `Launched ${step.target}` });
          }
          break;
        }

        case "focus_search":
        case "focus_address_bar": {
          const browser = this.appContexts.get("browser");
          const control = step.action === "focus_search" 
            ? browser?.controls.find(c => c.name === "search_box")
            : browser?.controls.find(c => c.name === "address_bar");
          
          if (control) {
            const targetX = control.location.x + control.location.width / 2;
            const targetY = control.location.y + control.location.height / 2;
            
            await this.smoothPointerMove(
              deviceController.getDeviceState().pointer.x,
              deviceController.getDeviceState().pointer.y,
              targetX, targetY
            );
            
            await deviceController.executeCommand(deviceController.parseCommand(`click at ${targetX}, ${targetY}`));
            this.emitFeedback({ type: "success", message: `Focused on ${control.name.replace("_", " ")}` });
          }
          break;
        }

        case "type_text": {
          const text = step.parameters?.text || "";
          await this.humanTypeText(text);
          this.emitFeedback({ type: "success", message: `Typed: "${text}"` });
          break;
        }

        case "clear_and_type": {
          await deviceController.executeCommand(deviceController.parseCommand("hotkey ctrl+a"));
          await this.humanDelay("action");
          const text = step.parameters?.text || "";
          await this.humanTypeText(text);
          this.emitFeedback({ type: "success", message: `Entered: "${text}"` });
          break;
        }

        case "press_key": {
          const key = step.parameters?.key || "enter";
          await deviceController.executeCommand(deviceController.parseCommand(`press ${key}`));
          this.emitFeedback({ type: "success", message: `Pressed ${key}` });
          break;
        }

        case "click": {
          const state = deviceController.getDeviceState();
          await deviceController.executeCommand(deviceController.parseCommand(`click at ${state.pointer.x}, ${state.pointer.y}`));
          this.emitFeedback({ type: "success", message: "Clicked" });
          break;
        }

        case "move_pointer": {
          const target = step.parameters?.target;
          if (target?.x !== undefined && target?.y !== undefined) {
            await this.smoothPointerMove(
              deviceController.getDeviceState().pointer.x,
              deviceController.getDeviceState().pointer.y,
              target.x, target.y
            );
          }
          break;
        }

        case "locate_element": {
          this.emitFeedback({ type: "thinking", message: `Scanning for "${step.target}"...` });
          await this.humanDelay("thinking");
          
          const estimatedX = 400 + Math.random() * 800;
          const estimatedY = 200 + Math.random() * 500;
          step.parameters = { ...step.parameters, target: { x: estimatedX, y: estimatedY } };
          this.emitFeedback({ type: "info", message: `Located "${step.target}" at (${Math.round(estimatedX)}, ${Math.round(estimatedY)})` });
          break;
        }

        case "scroll": {
          const direction = step.parameters?.direction || "down";
          const amount = step.parameters?.amount || 3;
          await deviceController.executeCommand(deviceController.parseCommand(`scroll ${direction} ${amount}`));
          this.emitFeedback({ type: "success", message: `Scrolled ${direction}` });
          break;
        }

        case "copy": {
          await deviceController.executeCommand(deviceController.parseCommand("hotkey ctrl+c"));
          this.emitFeedback({ type: "success", message: "Copied to clipboard" });
          break;
        }

        case "paste": {
          await deviceController.executeCommand(deviceController.parseCommand("hotkey ctrl+v"));
          this.emitFeedback({ type: "success", message: "Pasted from clipboard" });
          break;
        }

        case "screenshot": {
          this.emitFeedback({ type: "success", message: "Screenshot captured" });
          break;
        }

        case "close_window": {
          await deviceController.executeCommand(deviceController.parseCommand("hotkey alt+f4"));
          this.emitFeedback({ type: "success", message: "Window closed" });
          break;
        }

        case "switch_app": {
          await deviceController.executeCommand(deviceController.parseCommand("hotkey alt+tab"));
          this.emitFeedback({ type: "success", message: `Switched to ${step.target}` });
          break;
        }

        case "context_menu": {
          const state = deviceController.getDeviceState();
          await deviceController.executeCommand(deviceController.parseCommand(`right click at ${state.pointer.x}, ${state.pointer.y}`));
          this.emitFeedback({ type: "success", message: "Context menu opened" });
          break;
        }

        case "select_menu_item": {
          await this.humanDelay("action");
          const itemName = step.parameters?.item;
          this.emitFeedback({ type: "success", message: `Selected "${itemName}"` });
          break;
        }

        default: {
          if (step.parameters) {
            const result = await deviceController.executeCommand({
              ...deviceController.parseCommand(step.action),
              parsedActions: [step.parameters as DeviceAction]
            });
            if (result.status === "completed") {
              this.emitFeedback({ type: "success", message: `Executed ${step.action}` });
            }
          }
        }
      }

      step.status = "completed";
      step.duration = Date.now() - startTime;
      return true;
    } catch (error) {
      step.status = "failed";
      step.duration = Date.now() - startTime;
      this.emitFeedback({
        type: "error",
        message: `Step failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        stepId: step.id
      });
      return false;
    }
  }

  public async executeTask(task: AgentTask): Promise<AgentTask> {
    if (this.isExecuting) {
      throw new Error("Agent is already executing a task");
    }

    this.isExecuting = true;
    this.currentTask = task;
    task.status = "executing";

    this.emitFeedback({
      type: "info",
      message: `Starting task: ${task.description}`,
      taskId: task.id,
      progress: 0
    });

    try {
      for (let i = 0; i < task.steps.length; i++) {
        const step = task.steps[i];
        const progress = Math.round(((i + 1) / task.steps.length) * 100);

        this.emitFeedback({
          type: "info",
          message: `Step ${i + 1}/${task.steps.length}`,
          taskId: task.id,
          stepId: step.id,
          progress
        });

        const success = await this.executeStep(step);

        if (!success && step.action !== "unknown") {
          task.status = "failed";
          task.error = `Failed at step ${i + 1}: ${step.action}`;
          break;
        }

        if (i < task.steps.length - 1) {
          await this.humanDelay("action");
        }
      }

      if (task.status !== "failed") {
        task.status = "completed";
        task.result = "Task completed successfully";
        this.emitFeedback({
          type: "success",
          message: `Task completed: ${task.description}`,
          taskId: task.id,
          progress: 100
        });
      }
    } catch (error) {
      task.status = "failed";
      task.error = error instanceof Error ? error.message : "Unknown error";
      this.emitFeedback({
        type: "error",
        message: `Task failed: ${task.error}`,
        taskId: task.id
      });
    } finally {
      task.endTime = Date.now();
      this.taskHistory.unshift(task);
      if (this.taskHistory.length > 50) {
        this.taskHistory.pop();
      }
      this.currentTask = null;
      this.isExecuting = false;
    }

    return task;
  }

  public async processCommand(command: string): Promise<AgentTask> {
    const task = this.parseNaturalLanguage(command);
    return this.executeTask(task);
  }

  public getCurrentTask(): AgentTask | null {
    return this.currentTask;
  }

  public getTaskHistory(): AgentTask[] {
    return [...this.taskHistory];
  }

  public isAgentBusy(): boolean {
    return this.isExecuting;
  }

  public setBehaviorConfig(config: Partial<HumanBehaviorConfig>): void {
    this.behaviorConfig = { ...this.behaviorConfig, ...config };
  }

  public getBehaviorConfig(): HumanBehaviorConfig {
    return { ...this.behaviorConfig };
  }

  public getAppContexts(): AppContext[] {
    return Array.from(this.appContexts.values());
  }

  public registerApp(id: string, context: AppContext): void {
    this.appContexts.set(id, context);
  }

  public pauseCurrentTask(): boolean {
    if (this.currentTask && this.currentTask.status === "executing") {
      this.currentTask.status = "paused";
      this.emitFeedback({
        type: "warning",
        message: "Task paused",
        taskId: this.currentTask.id
      });
      return true;
    }
    return false;
  }

  public getStatus(): {
    isExecuting: boolean;
    currentTask: AgentTask | null;
    tasksCompleted: number;
    tasksFailed: number;
    behaviorConfig: HumanBehaviorConfig;
  } {
    return {
      isExecuting: this.isExecuting,
      currentTask: this.currentTask,
      tasksCompleted: this.taskHistory.filter(t => t.status === "completed").length,
      tasksFailed: this.taskHistory.filter(t => t.status === "failed").length,
      behaviorConfig: this.behaviorConfig
    };
  }
}

export const autonomousAgent = new CYRUSAutonomousAgent();
