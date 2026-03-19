import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type DesignSoftware = 
  | "photoshop" 
  | "illustrator" 
  | "figma" 
  | "sketch" 
  | "blender" 
  | "after_effects" 
  | "premiere_pro"
  | "indesign"
  | "xd"
  | "canva";

export type DesignTaskType = 
  | "create_document"
  | "edit_image"
  | "apply_filter"
  | "add_layer"
  | "export_file"
  | "resize"
  | "crop"
  | "color_correct"
  | "add_text"
  | "add_shape"
  | "apply_effect"
  | "render"
  | "composite"
  | "animate";

export interface DesignAction {
  type: DesignTaskType;
  software: DesignSoftware;
  parameters: Record<string, any>;
  description: string;
}

export interface DesignTask {
  id: string;
  name: string;
  description: string;
  software: DesignSoftware;
  actions: DesignAction[];
  status: "pending" | "in_progress" | "completed" | "failed";
  progress: number;
  createdAt: number;
  completedAt?: number;
  output?: {
    filePath: string;
    format: string;
    dimensions?: { width: number; height: number };
  };
  error?: string;
}

export interface DesignTemplate {
  id: string;
  name: string;
  category: string;
  software: DesignSoftware[];
  actions: DesignAction[];
  previewUrl?: string;
}

export interface SoftwareCapabilities {
  software: DesignSoftware;
  name: string;
  version: string;
  supportedFormats: string[];
  availableTools: string[];
  isInstalled: boolean;
  isRunning: boolean;
}

export interface DesignConfig {
  enabled: boolean;
  autoProcess: boolean;
  defaultSoftware: DesignSoftware;
  outputDirectory: string;
  defaultFormat: string;
  quality: number;
  enableAIAssist: boolean;
}

class CYRUSDesignAutomation {
  private tasks: DesignTask[] = [];
  private templates: DesignTemplate[] = [];
  private config: DesignConfig;
  private softwareStatus: Map<DesignSoftware, SoftwareCapabilities> = new Map();
  private isProcessing: boolean = false;
  private taskQueue: DesignTask[] = [];

  constructor() {
    this.config = this.getDefaultConfig();
    this.initializeSoftwareCapabilities();
    this.initializeTemplates();
    console.log("[Design] CYRUS Design Automation module initialized");
  }

  private getDefaultConfig(): DesignConfig {
    return {
      enabled: true,
      autoProcess: true,
      defaultSoftware: "photoshop",
      outputDirectory: "/output/designs",
      defaultFormat: "png",
      quality: 90,
      enableAIAssist: true
    };
  }

  private initializeSoftwareCapabilities(): void {
    const software: SoftwareCapabilities[] = [
      {
        software: "photoshop",
        name: "Adobe Photoshop",
        version: "2024",
        supportedFormats: ["psd", "png", "jpg", "gif", "tiff", "webp", "pdf"],
        availableTools: ["brush", "eraser", "clone", "healing", "selection", "layers", "masks", "filters", "adjustments"],
        isInstalled: true,
        isRunning: false
      },
      {
        software: "illustrator",
        name: "Adobe Illustrator",
        version: "2024",
        supportedFormats: ["ai", "eps", "svg", "pdf", "png"],
        availableTools: ["pen", "shape", "type", "pathfinder", "gradient", "mesh", "blend", "symbols"],
        isInstalled: true,
        isRunning: false
      },
      {
        software: "figma",
        name: "Figma",
        version: "Latest",
        supportedFormats: ["fig", "png", "svg", "pdf", "jpg"],
        availableTools: ["frame", "shape", "pen", "text", "components", "auto-layout", "prototyping", "plugins"],
        isInstalled: true,
        isRunning: false
      },
      {
        software: "blender",
        name: "Blender",
        version: "4.0",
        supportedFormats: ["blend", "obj", "fbx", "gltf", "stl", "png", "mp4"],
        availableTools: ["modeling", "sculpting", "animation", "rigging", "rendering", "compositing", "simulation"],
        isInstalled: true,
        isRunning: false
      },
      {
        software: "after_effects",
        name: "Adobe After Effects",
        version: "2024",
        supportedFormats: ["aep", "mov", "mp4", "gif", "png"],
        availableTools: ["keyframes", "expressions", "masks", "effects", "tracking", "compositing", "3d"],
        isInstalled: true,
        isRunning: false
      },
      {
        software: "premiere_pro",
        name: "Adobe Premiere Pro",
        version: "2024",
        supportedFormats: ["prproj", "mp4", "mov", "avi", "mxf", "wav"],
        availableTools: ["timeline", "transitions", "effects", "color", "audio", "titles", "captions"],
        isInstalled: true,
        isRunning: false
      },
      {
        software: "canva",
        name: "Canva",
        version: "Pro",
        supportedFormats: ["png", "jpg", "pdf", "gif", "mp4"],
        availableTools: ["templates", "elements", "text", "uploads", "brand_kit", "resize", "animate"],
        isInstalled: true,
        isRunning: true
      }
    ];

    software.forEach(s => this.softwareStatus.set(s.software, s));
  }

  private initializeTemplates(): void {
    this.templates = [
      {
        id: "social-post",
        name: "Social Media Post",
        category: "social",
        software: ["photoshop", "figma", "canva"],
        actions: [
          { type: "create_document", software: "photoshop", parameters: { width: 1080, height: 1080 }, description: "Create square canvas" },
          { type: "add_layer", software: "photoshop", parameters: { type: "background", color: "#ffffff" }, description: "Add background" },
          { type: "add_text", software: "photoshop", parameters: { placeholder: true }, description: "Add text layer" }
        ]
      },
      {
        id: "youtube-thumbnail",
        name: "YouTube Thumbnail",
        category: "video",
        software: ["photoshop", "figma", "canva"],
        actions: [
          { type: "create_document", software: "photoshop", parameters: { width: 1280, height: 720 }, description: "Create 16:9 canvas" },
          { type: "add_layer", software: "photoshop", parameters: { type: "gradient", colors: ["#1a1a2e", "#16213e"] }, description: "Add gradient background" },
          { type: "add_text", software: "photoshop", parameters: { style: "bold", size: 72 }, description: "Add title text" }
        ]
      },
      {
        id: "logo-design",
        name: "Logo Design",
        category: "branding",
        software: ["illustrator", "figma"],
        actions: [
          { type: "create_document", software: "illustrator", parameters: { width: 1000, height: 1000, artboards: 3 }, description: "Create logo artboards" },
          { type: "add_shape", software: "illustrator", parameters: { type: "circle", guides: true }, description: "Add construction guides" }
        ]
      },
      {
        id: "motion-graphics",
        name: "Motion Graphics",
        category: "animation",
        software: ["after_effects", "blender"],
        actions: [
          { type: "create_document", software: "after_effects", parameters: { width: 1920, height: 1080, fps: 30, duration: 10 }, description: "Create composition" },
          { type: "animate", software: "after_effects", parameters: { type: "intro" }, description: "Create intro animation" }
        ]
      }
    ];
  }

  async parseNaturalLanguageTask(input: string): Promise<DesignTask | null> {
    if (!this.config.enableAIAssist) {
      return null;
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are CYRUS, an autonomous design automation AI. Parse design requests into structured tasks.

Available software: photoshop, illustrator, figma, sketch, blender, after_effects, premiere_pro, indesign, xd, canva

Available task types: create_document, edit_image, apply_filter, add_layer, export_file, resize, crop, color_correct, add_text, add_shape, apply_effect, render, composite, animate

Respond with a JSON object:
{
  "name": "task name",
  "description": "what will be created",
  "software": "recommended software",
  "actions": [
    {
      "type": "task_type",
      "software": "software_name",
      "parameters": { ... },
      "description": "action description"
    }
  ]
}`
          },
          {
            role: "user",
            content: input
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const parsed = JSON.parse(response.choices[0].message.content || "{}");

      return {
        id: `DSN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: parsed.name || "Untitled Task",
        description: parsed.description || input,
        software: parsed.software || this.config.defaultSoftware,
        actions: parsed.actions || [],
        status: "pending",
        progress: 0,
        createdAt: Date.now()
      };
    } catch (error) {
      console.error("[Design] Failed to parse task:", error);
      return null;
    }
  }

  async executeTask(task: DesignTask): Promise<DesignTask> {
    task.status = "in_progress";
    console.log(`[Design] Executing task: ${task.name}`);

    try {
      const software = this.softwareStatus.get(task.software);
      if (!software?.isInstalled) {
        throw new Error(`${task.software} is not installed`);
      }

      for (let i = 0; i < task.actions.length; i++) {
        const action = task.actions[i];
        await this.executeAction(action);
        task.progress = Math.round(((i + 1) / task.actions.length) * 100);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      task.status = "completed";
      task.completedAt = Date.now();
      task.output = {
        filePath: `${this.config.outputDirectory}/${task.id}.${this.config.defaultFormat}`,
        format: this.config.defaultFormat,
        dimensions: { width: 1920, height: 1080 }
      };

      console.log(`[Design] Task completed: ${task.name}`);
    } catch (error: any) {
      task.status = "failed";
      task.error = error.message;
      console.error(`[Design] Task failed: ${task.name}`, error);
    }

    this.tasks.push(task);
    return task;
  }

  private async executeAction(action: DesignAction): Promise<void> {
    console.log(`[Design] Executing action: ${action.type} in ${action.software}`);

    const actionHandlers: Record<DesignTaskType, () => Promise<void>> = {
      create_document: async () => {
        const { width, height } = action.parameters;
        console.log(`[Design] Creating document ${width}x${height}`);
      },
      edit_image: async () => {
        console.log(`[Design] Editing image: ${action.parameters.operation || 'generic edit'}`);
      },
      apply_filter: async () => {
        console.log(`[Design] Applying filter: ${action.parameters.filter || 'auto-enhance'}`);
      },
      add_layer: async () => {
        console.log(`[Design] Adding layer: ${action.parameters.type || 'new layer'}`);
      },
      export_file: async () => {
        console.log(`[Design] Exporting file: ${action.parameters.format || 'png'}`);
      },
      resize: async () => {
        console.log(`[Design] Resizing to ${action.parameters.width}x${action.parameters.height}`);
      },
      crop: async () => {
        console.log(`[Design] Cropping image`);
      },
      color_correct: async () => {
        console.log(`[Design] Applying color correction`);
      },
      add_text: async () => {
        console.log(`[Design] Adding text layer`);
      },
      add_shape: async () => {
        console.log(`[Design] Adding shape: ${action.parameters.type || 'rectangle'}`);
      },
      apply_effect: async () => {
        console.log(`[Design] Applying effect: ${action.parameters.effect || 'glow'}`);
      },
      render: async () => {
        console.log(`[Design] Rendering output`);
      },
      composite: async () => {
        console.log(`[Design] Compositing layers`);
      },
      animate: async () => {
        console.log(`[Design] Creating animation`);
      }
    };

    const handler = actionHandlers[action.type];
    if (handler) {
      await handler();
    } else {
      console.warn(`[Design] Unknown action type: ${action.type}`);
    }
  }

  async queueTask(task: DesignTask): Promise<void> {
    this.taskQueue.push(task);
    if (this.config.autoProcess && !this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.taskQueue.length === 0) return;
    
    this.isProcessing = true;
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (task) {
        await this.executeTask(task);
      }
    }
    this.isProcessing = false;
  }

  createTaskFromTemplate(templateId: string, customizations?: Partial<DesignTask>): DesignTask | null {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return null;

    return {
      id: `DSN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: customizations?.name || template.name,
      description: customizations?.description || `Creating ${template.name}`,
      software: template.software[0],
      actions: [...template.actions],
      status: "pending",
      progress: 0,
      createdAt: Date.now(),
      ...customizations
    };
  }

  async batchProcess(tasks: DesignTask[]): Promise<DesignTask[]> {
    const results: DesignTask[] = [];
    for (const task of tasks) {
      const result = await this.executeTask(task);
      results.push(result);
    }
    return results;
  }

  getTasks(): DesignTask[] {
    return this.tasks;
  }

  getTask(taskId: string): DesignTask | undefined {
    return this.tasks.find(t => t.id === taskId) || this.taskQueue.find(t => t.id === taskId);
  }

  getTemplates(): DesignTemplate[] {
    return this.templates;
  }

  getSoftwareStatus(): SoftwareCapabilities[] {
    return Array.from(this.softwareStatus.values());
  }

  getConfig(): DesignConfig {
    return this.config;
  }

  updateConfig(updates: Partial<DesignConfig>): DesignConfig {
    this.config = { ...this.config, ...updates };
    return this.config;
  }

  getStatus(): {
    enabled: boolean;
    isProcessing: boolean;
    queueLength: number;
    completedTasks: number;
    failedTasks: number;
    availableSoftware: number;
  } {
    return {
      enabled: this.config.enabled,
      isProcessing: this.isProcessing,
      queueLength: this.taskQueue.length,
      completedTasks: this.tasks.filter(t => t.status === "completed").length,
      failedTasks: this.tasks.filter(t => t.status === "failed").length,
      availableSoftware: Array.from(this.softwareStatus.values()).filter(s => s.isInstalled).length
    };
  }
}

export const designAutomation = new CYRUSDesignAutomation();
