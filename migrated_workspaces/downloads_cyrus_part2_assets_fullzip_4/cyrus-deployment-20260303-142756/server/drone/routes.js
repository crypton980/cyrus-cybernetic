import { droneController } from "../modules/drone-control";
export function registerDroneRoutes(app) {
    // Get drone state/telemetry
    app.get("/api/drone/state", async (_req, res) => {
        try {
            const state = droneController.getState();
            res.json({
                success: true,
                state,
                simulationMode: droneController.isSimulationMode()
            });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    // Connect to drone
    app.post("/api/drone/connect", async (req, res) => {
        try {
            const { connectionType, host, port, baudRate } = req.body;
            const result = await droneController.connect(connectionType || 'wifi', { host, port, baudRate });
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    // Disconnect from drone
    app.post("/api/drone/disconnect", async (_req, res) => {
        try {
            const result = await droneController.disconnect();
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    // Execute drone command
    app.post("/api/drone/command", async (req, res) => {
        try {
            const { type, params } = req.body;
            if (!type) {
                return res.status(400).json({ success: false, message: 'Command type required' });
            }
            const result = await droneController.executeCommand({ type, params });
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    // Arm drone
    app.post("/api/drone/arm", async (_req, res) => {
        try {
            const result = await droneController.executeCommand({ type: 'arm' });
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    // Disarm drone
    app.post("/api/drone/disarm", async (_req, res) => {
        try {
            const result = await droneController.executeCommand({ type: 'disarm' });
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    // Takeoff
    app.post("/api/drone/takeoff", async (req, res) => {
        try {
            const { altitude } = req.body;
            const result = await droneController.executeCommand({
                type: 'takeoff',
                params: { altitude: altitude || 10 }
            });
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    // Land
    app.post("/api/drone/land", async (_req, res) => {
        try {
            const result = await droneController.executeCommand({ type: 'land' });
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    // Return to Launch
    app.post("/api/drone/rtl", async (_req, res) => {
        try {
            const result = await droneController.executeCommand({ type: 'rtl' });
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    // Go to coordinates
    app.post("/api/drone/goto", async (req, res) => {
        try {
            const { latitude, longitude, altitude } = req.body;
            if (!latitude || !longitude) {
                return res.status(400).json({ success: false, message: 'Latitude and longitude required' });
            }
            const result = await droneController.executeCommand({
                type: 'goto',
                params: { latitude, longitude, altitude }
            });
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    // Set flight mode
    app.post("/api/drone/mode", async (req, res) => {
        try {
            const { mode } = req.body;
            if (!mode) {
                return res.status(400).json({ success: false, message: 'Mode required' });
            }
            const result = await droneController.executeCommand({
                type: 'set_mode',
                params: { mode }
            });
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    // Emergency stop
    app.post("/api/drone/emergency", async (_req, res) => {
        try {
            const result = await droneController.executeCommand({ type: 'emergency_stop' });
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    // Get all missions
    app.get("/api/drone/missions", async (_req, res) => {
        try {
            const missions = droneController.getMissions();
            const activeMission = droneController.getActiveMission();
            res.json({ success: true, missions, activeMission });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    // Create mission
    app.post("/api/drone/missions", async (req, res) => {
        try {
            const { name, waypoints } = req.body;
            if (!name || !waypoints || !Array.isArray(waypoints)) {
                return res.status(400).json({ success: false, message: 'Mission name and waypoints required' });
            }
            const result = await droneController.createMission(name, waypoints);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    // Start mission
    app.post("/api/drone/missions/:id/start", async (req, res) => {
        try {
            const { id } = req.params;
            const result = await droneController.startMission(id);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    // Abort mission
    app.post("/api/drone/missions/abort", async (_req, res) => {
        try {
            const result = await droneController.abortMission();
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    console.log('[Drone Routes] Registered drone control API endpoints');
}
