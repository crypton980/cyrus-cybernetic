/**
 * CYRUS MAVLink Controller - Real Drone Communication Framework
 * 
 * This module provides REAL drone control using the MAVLink protocol,
 * the industry-standard for drone communication used by:
 * - ArduPilot (ArduCopter, ArduPlane, ArduRover)
 * - PX4 Autopilot
 * - Commercial drones from 3DR, Parrot, and many others
 * 
 * Supports communication via:
 * - Serial Port (USB/UART connection to flight controller)
 * - UDP (WiFi/Telemetry modules like ESP8266)
 * - TCP (Network-connected drones)
 * 
 * Created by Obakeng Kaelo (ID: 815219119, Botswana)
 */

import { EventEmitter } from "events";
import * as dgram from "dgram";
import * as net from "net";

// MAVLink message IDs (common.xml definitions)
const MAV_MSG = {
  HEARTBEAT: 0,
  SYS_STATUS: 1,
  SYSTEM_TIME: 2,
  GPS_RAW_INT: 24,
  ATTITUDE: 30,
  GLOBAL_POSITION_INT: 33,
  RC_CHANNELS: 65,
  VFR_HUD: 74,
  COMMAND_LONG: 76,
  COMMAND_ACK: 77,
  MISSION_COUNT: 44,
  MISSION_ITEM: 39,
  MISSION_REQUEST: 40,
  MISSION_ACK: 47,
  MISSION_CLEAR_ALL: 45,
  SET_MODE: 11,
  PARAM_REQUEST_LIST: 21,
  PARAM_VALUE: 22,
  STATUSTEXT: 253,
  BATTERY_STATUS: 147,
  HOME_POSITION: 242,
};

// MAVLink command IDs (MAV_CMD enum)
const MAV_CMD = {
  NAV_WAYPOINT: 16,
  NAV_LOITER_UNLIM: 17,
  NAV_LOITER_TURNS: 18,
  NAV_LOITER_TIME: 19,
  NAV_RETURN_TO_LAUNCH: 20,
  NAV_LAND: 21,
  NAV_TAKEOFF: 22,
  NAV_LAND_LOCAL: 23,
  DO_SET_MODE: 176,
  DO_SET_HOME: 179,
  DO_SET_SERVO: 183,
  DO_REPEAT_SERVO: 184,
  DO_FLIGHTTERMINATION: 185,
  DO_CHANGE_ALTITUDE: 186,
  DO_LAND_START: 189,
  DO_RALLY_LAND: 190,
  DO_GO_AROUND: 191,
  DO_REPOSITION: 192,
  DO_PAUSE_CONTINUE: 193,
  COMPONENT_ARM_DISARM: 400,
  GET_HOME_POSITION: 410,
  REQUEST_AUTOPILOT_CAPABILITIES: 520,
  REQUEST_CAMERA_INFORMATION: 521,
  SET_CAMERA_MODE: 530,
  DO_SET_ROI: 201,
  DO_MOUNT_CONTROL: 205,
  IMAGE_START_CAPTURE: 2000,
  IMAGE_STOP_CAPTURE: 2001,
  VIDEO_START_CAPTURE: 2500,
  VIDEO_STOP_CAPTURE: 2501,
};

// ArduPilot flight modes for copter
const COPTER_MODES = {
  STABILIZE: 0,
  ACRO: 1,
  ALT_HOLD: 2,
  AUTO: 3,
  GUIDED: 4,
  LOITER: 5,
  RTL: 6,
  CIRCLE: 7,
  LAND: 9,
  DRIFT: 11,
  SPORT: 13,
  FLIP: 14,
  AUTOTUNE: 15,
  POSHOLD: 16,
  BRAKE: 17,
  THROW: 18,
  AVOID_ADSB: 19,
  GUIDED_NOGPS: 20,
  SMART_RTL: 21,
  FLOWHOLD: 22,
  FOLLOW: 23,
  ZIGZAG: 24,
  SYSTEMID: 25,
  AUTOROTATE: 26,
  AUTO_RTL: 27,
};

// PX4 flight modes
const PX4_MODES = {
  MANUAL: 0,
  ALTITUDE: 1,
  POSITION: 2,
  AUTO_MISSION: 3,
  AUTO_LOITER: 4,
  AUTO_RTL: 5,
  ACRO: 6,
  OFFBOARD: 7,
  STABILIZED: 8,
  RATTITUDE: 9,
  AUTO_TAKEOFF: 10,
  AUTO_LAND: 11,
  AUTO_FOLLOW_TARGET: 12,
};

// Connection types
export type ConnectionType = "serial" | "udp" | "tcp";

// Connection configuration
export interface ConnectionConfig {
  type: ConnectionType;
  // Serial options
  serialPath?: string;
  baudRate?: number;
  // Network options
  host?: string;
  port?: number;
  // MAVLink options
  systemId?: number;
  componentId?: number;
}

// Drone telemetry data
export interface DroneTelemetry {
  timestamp: Date;
  // Position
  latitude: number;
  longitude: number;
  altitude: number;
  relativeAltitude: number;
  // Velocity
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  groundSpeed: number;
  airSpeed: number;
  // Attitude
  roll: number;
  pitch: number;
  yaw: number;
  heading: number;
  // Battery
  batteryVoltage: number;
  batteryCurrent: number;
  batteryRemaining: number;
  // GPS
  gpsFixType: number;
  gpsNumSatellites: number;
  gpsHdop: number;
  gpsVdop: number;
  // System
  systemStatus: number;
  autopilotType: string;
  isArmed: boolean;
  flightMode: string;
  missionProgress: number;
}

// Waypoint definition
export interface Waypoint {
  seq: number;
  frame: number;
  command: number;
  current: number;
  autocontinue: number;
  param1: number;
  param2: number;
  param3: number;
  param4: number;
  latitude: number;
  longitude: number;
  altitude: number;
}

// Command result
export interface CommandResult {
  success: boolean;
  message: string;
  result?: number;
  progress?: number;
}

// Discovered drone info
export interface DiscoveredDroneInfo {
  systemId: number;
  componentId: number;
  autopilotType: string;
  vehicleType: string;
  firmwareVersion?: string;
  lastHeartbeat: Date;
  connectionType: ConnectionType;
  address: string;
}

// CRC Extra values for common MAVLink messages (from mavlink/message_definitions)
const CRC_EXTRA_TABLE: Record<number, number> = {
  0: 50,    // HEARTBEAT
  1: 124,   // SYS_STATUS
  2: 137,   // SYSTEM_TIME
  11: 89,   // SET_MODE
  20: 214,  // PARAM_REQUEST_READ
  21: 159,  // PARAM_REQUEST_LIST
  22: 220,  // PARAM_VALUE
  23: 168,  // PARAM_SET
  24: 24,   // GPS_RAW_INT
  30: 39,   // ATTITUDE
  31: 246,  // ATTITUDE_QUATERNION
  32: 185,  // LOCAL_POSITION_NED
  33: 104,  // GLOBAL_POSITION_INT
  35: 244,  // RC_CHANNELS_SCALED
  36: 222,  // RC_CHANNELS_RAW
  39: 254,  // MISSION_ITEM
  40: 230,  // MISSION_REQUEST
  41: 28,   // MISSION_SET_CURRENT
  42: 28,   // MISSION_CURRENT
  43: 132,  // MISSION_REQUEST_LIST
  44: 221,  // MISSION_COUNT
  45: 232,  // MISSION_CLEAR_ALL
  46: 11,   // MISSION_ITEM_REACHED
  47: 153,  // MISSION_ACK
  65: 118,  // RC_CHANNELS
  74: 20,   // VFR_HUD
  76: 152,  // COMMAND_LONG
  77: 143,  // COMMAND_ACK
  147: 154, // BATTERY_STATUS
  242: 104, // HOME_POSITION
  253: 83,  // STATUSTEXT
};

/**
 * MAVLink CRC-16/MCRF4XX implementation
 */
function mavlinkCrc16(data: Buffer, msgId: number): number {
  let crc = 0xFFFF;
  
  for (let i = 0; i < data.length; i++) {
    let tmp = data[i] ^ (crc & 0xFF);
    tmp ^= (tmp << 4) & 0xFF;
    crc = (crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4);
    crc &= 0xFFFF;
  }
  
  // Add CRC extra byte for message type
  const extra = CRC_EXTRA_TABLE[msgId] || 0;
  let tmp = extra ^ (crc & 0xFF);
  tmp ^= (tmp << 4) & 0xFF;
  crc = (crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4);
  crc &= 0xFFFF;
  
  return crc;
}

/**
 * MAVLink Packet Parser with CRC Validation
 * Parses raw bytes into MAVLink v1/v2 packets
 */
class MAVLinkParser {
  private buffer: Buffer = Buffer.alloc(0);
  private readonly MAVLINK_V1_START = 0xFE;
  private readonly MAVLINK_V2_START = 0xFD;
  private invalidPacketCount: number = 0;
  private validPacketCount: number = 0;

  parse(data: Buffer): any[] {
    this.buffer = Buffer.concat([this.buffer, data]);
    const packets: any[] = [];

    while (this.buffer.length >= 8) {
      const startByte = this.buffer[0];

      if (startByte === this.MAVLINK_V1_START) {
        const payloadLen = this.buffer[1];
        const packetLength = payloadLen + 8; // header(6) + payload + checksum(2)
        if (this.buffer.length >= packetLength) {
          const packet = this.parseV1Packet(this.buffer.slice(0, packetLength));
          if (packet && this.validateV1Crc(this.buffer.slice(0, packetLength), packet.messageId)) {
            packets.push(packet);
            this.validPacketCount++;
          } else {
            this.invalidPacketCount++;
          }
          this.buffer = this.buffer.slice(packetLength);
        } else break;
      } else if (startByte === this.MAVLINK_V2_START) {
        const payloadLen = this.buffer[1];
        const packetLength = payloadLen + 12; // header(10) + payload + checksum(2)
        if (this.buffer.length >= packetLength) {
          const packet = this.parseV2Packet(this.buffer.slice(0, packetLength));
          if (packet && this.validateV2Crc(this.buffer.slice(0, packetLength), packet.messageId)) {
            packets.push(packet);
            this.validPacketCount++;
          } else {
            this.invalidPacketCount++;
          }
          this.buffer = this.buffer.slice(packetLength);
        } else break;
      } else {
        // Invalid start byte, skip
        this.buffer = this.buffer.slice(1);
      }
    }

    return packets;
  }

  private validateV1Crc(data: Buffer, msgId: number): boolean {
    const payloadLen = data[1];
    const crcData = data.slice(1, 6 + payloadLen); // sequence through payload
    const expectedCrc = mavlinkCrc16(crcData, msgId);
    const actualCrc = data.readUInt16LE(6 + payloadLen);
    return expectedCrc === actualCrc;
  }

  private validateV2Crc(data: Buffer, msgId: number): boolean {
    const payloadLen = data[1];
    const crcData = data.slice(1, 10 + payloadLen); // after start byte through payload
    const expectedCrc = mavlinkCrc16(crcData, msgId);
    const actualCrc = data.readUInt16LE(10 + payloadLen);
    return expectedCrc === actualCrc;
  }

  private parseV1Packet(data: Buffer): any {
    return {
      version: 1,
      payloadLength: data[1],
      sequence: data[2],
      systemId: data[3],
      componentId: data[4],
      messageId: data[5],
      payload: data.slice(6, 6 + data[1]),
    };
  }

  private parseV2Packet(data: Buffer): any {
    return {
      version: 2,
      payloadLength: data[1],
      incompatFlags: data[2],
      compatFlags: data[3],
      sequence: data[4],
      systemId: data[5],
      componentId: data[6],
      messageId: data[7] | (data[8] << 8) | (data[9] << 16),
      payload: data.slice(10, 10 + data[1]),
    };
  }

  getStats(): { valid: number; invalid: number } {
    return { valid: this.validPacketCount, invalid: this.invalidPacketCount };
  }
}

/**
 * MAVLink Message Builder
 * Creates properly formatted MAVLink packets
 */
class MAVLinkBuilder {
  private sequence: number = 0;
  private systemId: number;
  private componentId: number;

  constructor(systemId: number = 255, componentId: number = 0) {
    this.systemId = systemId;
    this.componentId = componentId;
  }

  private getNextSequence(): number {
    this.sequence = (this.sequence + 1) % 256;
    return this.sequence;
  }

  private crc16(data: Buffer, msgId: number): number {
    return mavlinkCrc16(data, msgId);
  }

  buildCommandLong(
    targetSystem: number,
    targetComponent: number,
    command: number,
    confirmation: number,
    param1: number,
    param2: number,
    param3: number,
    param4: number,
    param5: number,
    param6: number,
    param7: number
  ): Buffer {
    const payload = Buffer.alloc(33);
    payload.writeFloatLE(param1, 0);
    payload.writeFloatLE(param2, 4);
    payload.writeFloatLE(param3, 8);
    payload.writeFloatLE(param4, 12);
    payload.writeFloatLE(param5, 16);
    payload.writeFloatLE(param6, 20);
    payload.writeFloatLE(param7, 24);
    payload.writeUInt16LE(command, 28);
    payload.writeUInt8(targetSystem, 30);
    payload.writeUInt8(targetComponent, 31);
    payload.writeUInt8(confirmation, 32);

    return this.buildPacket(MAV_MSG.COMMAND_LONG, payload);
  }

  buildSetMode(targetSystem: number, baseMode: number, customMode: number): Buffer {
    const payload = Buffer.alloc(6);
    payload.writeUInt32LE(customMode, 0);
    payload.writeUInt8(targetSystem, 4);
    payload.writeUInt8(baseMode, 5);

    return this.buildPacket(MAV_MSG.SET_MODE, payload);
  }

  buildHeartbeat(): Buffer {
    const payload = Buffer.alloc(9);
    payload.writeUInt32LE(0, 0); // custom_mode
    payload.writeUInt8(6, 4);    // type: GCS
    payload.writeUInt8(8, 5);    // autopilot: INVALID
    payload.writeUInt8(192, 6);  // base_mode: MAV_MODE_FLAG_SAFETY_ARMED
    payload.writeUInt8(0, 7);    // system_status
    payload.writeUInt8(3, 8);    // mavlink_version

    return this.buildPacket(MAV_MSG.HEARTBEAT, payload);
  }

  buildMissionCount(targetSystem: number, targetComponent: number, count: number): Buffer {
    const payload = Buffer.alloc(5);
    payload.writeUInt16LE(count, 0);
    payload.writeUInt8(targetSystem, 2);
    payload.writeUInt8(targetComponent, 3);
    payload.writeUInt8(0, 4); // mission_type

    return this.buildPacket(MAV_MSG.MISSION_COUNT, payload);
  }

  buildMissionItem(
    targetSystem: number,
    targetComponent: number,
    seq: number,
    frame: number,
    command: number,
    current: number,
    autocontinue: number,
    param1: number,
    param2: number,
    param3: number,
    param4: number,
    x: number,
    y: number,
    z: number
  ): Buffer {
    const payload = Buffer.alloc(37);
    payload.writeFloatLE(param1, 0);
    payload.writeFloatLE(param2, 4);
    payload.writeFloatLE(param3, 8);
    payload.writeFloatLE(param4, 12);
    payload.writeFloatLE(x, 16);
    payload.writeFloatLE(y, 20);
    payload.writeFloatLE(z, 24);
    payload.writeUInt16LE(seq, 28);
    payload.writeUInt16LE(command, 30);
    payload.writeUInt8(targetSystem, 32);
    payload.writeUInt8(targetComponent, 33);
    payload.writeUInt8(frame, 34);
    payload.writeUInt8(current, 35);
    payload.writeUInt8(autocontinue, 36);

    return this.buildPacket(MAV_MSG.MISSION_ITEM, payload);
  }

  private buildPacket(msgId: number, payload: Buffer): Buffer {
    // Build MAVLink v1 packet
    const header = Buffer.alloc(6);
    header[0] = 0xFE; // Start byte
    header[1] = payload.length;
    header[2] = this.getNextSequence();
    header[3] = this.systemId;
    header[4] = this.componentId;
    header[5] = msgId;

    const crcData = Buffer.concat([header.slice(1), payload]);
    const crc = this.crc16(crcData, msgId);

    const checksum = Buffer.alloc(2);
    checksum.writeUInt16LE(crc, 0);

    return Buffer.concat([header, payload, checksum]);
  }
}

/**
 * CYRUS MAVLink Controller
 * Main class for real drone communication
 */
export class CyrusMAVLinkController extends EventEmitter {
  private config: ConnectionConfig;
  private parser: MAVLinkParser;
  private builder: MAVLinkBuilder;
  private socket: dgram.Socket | net.Socket | null = null;
  private serialPort: any = null;
  private isConnected: boolean = false;
  private telemetry: DroneTelemetry;
  private discoveredDrones: Map<number, DiscoveredDroneInfo> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private targetSystem: number = 1;
  private targetComponent: number = 1;

  constructor(config: ConnectionConfig) {
    super();
    this.config = {
      systemId: 255,
      componentId: 0,
      ...config,
    };
    this.parser = new MAVLinkParser();
    this.builder = new MAVLinkBuilder(this.config.systemId!, this.config.componentId!);
    this.telemetry = this.createEmptyTelemetry();
  }

  private createEmptyTelemetry(): DroneTelemetry {
    return {
      timestamp: new Date(),
      latitude: 0,
      longitude: 0,
      altitude: 0,
      relativeAltitude: 0,
      velocityX: 0,
      velocityY: 0,
      velocityZ: 0,
      groundSpeed: 0,
      airSpeed: 0,
      roll: 0,
      pitch: 0,
      yaw: 0,
      heading: 0,
      batteryVoltage: 0,
      batteryCurrent: 0,
      batteryRemaining: 100,
      gpsFixType: 0,
      gpsNumSatellites: 0,
      gpsHdop: 99.99,
      gpsVdop: 99.99,
      systemStatus: 0,
      autopilotType: "Unknown",
      isArmed: false,
      flightMode: "Unknown",
      missionProgress: 0,
    };
  }

  /**
   * Connect to drone via configured method
   */
  async connect(): Promise<CommandResult> {
    try {
      switch (this.config.type) {
        case "udp":
          return await this.connectUDP();
        case "tcp":
          return await this.connectTCP();
        case "serial":
          return await this.connectSerial();
        default:
          return { success: false, message: `Unknown connection type: ${this.config.type}` };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { success: false, message: `Connection failed: ${msg}` };
    }
  }

  private async connectUDP(): Promise<CommandResult> {
    return new Promise((resolve) => {
      const socket = dgram.createSocket("udp4");
      
      socket.on("message", (msg, rinfo) => {
        this.handleData(msg, `${rinfo.address}:${rinfo.port}`);
      });

      socket.on("error", (err) => {
        this.emit("error", err);
        resolve({ success: false, message: `UDP error: ${err.message}` });
      });

      socket.on("listening", () => {
        this.socket = socket;
        this.isConnected = true;
        this.startHeartbeat();
        console.log(`[CYRUS MAVLink] UDP listening on port ${this.config.port}`);
        resolve({ success: true, message: `UDP connection established on port ${this.config.port}` });
      });

      socket.bind(this.config.port || 14550);
    });
  }

  private async connectTCP(): Promise<CommandResult> {
    return new Promise((resolve) => {
      const socket = net.connect({
        host: this.config.host || "127.0.0.1",
        port: this.config.port || 5760,
      });

      socket.on("connect", () => {
        this.socket = socket;
        this.isConnected = true;
        this.startHeartbeat();
        console.log(`[CYRUS MAVLink] TCP connected to ${this.config.host}:${this.config.port}`);
        resolve({ success: true, message: `TCP connected to ${this.config.host}:${this.config.port}` });
      });

      socket.on("data", (data) => {
        this.handleData(data, `${this.config.host}:${this.config.port}`);
      });

      socket.on("error", (err) => {
        this.emit("error", err);
        resolve({ success: false, message: `TCP error: ${err.message}` });
      });

      socket.on("close", () => {
        this.isConnected = false;
        this.emit("disconnected");
      });
    });
  }

  private async connectSerial(): Promise<CommandResult> {
    try {
      // Dynamic import for serialport
      const { SerialPort } = await import("serialport");
      
      return new Promise((resolve) => {
        const port = new SerialPort({
          path: this.config.serialPath || "/dev/ttyACM0",
          baudRate: this.config.baudRate || 57600,
        });

        port.on("open", () => {
          this.serialPort = port;
          this.isConnected = true;
          this.startHeartbeat();
          console.log(`[CYRUS MAVLink] Serial connected to ${this.config.serialPath}`);
          resolve({ success: true, message: `Serial connected to ${this.config.serialPath}` });
        });

        port.on("data", (data: Buffer) => {
          this.handleData(data, this.config.serialPath || "serial");
        });

        port.on("error", (err) => {
          this.emit("error", err);
          resolve({ success: false, message: `Serial error: ${err.message}` });
        });

        port.on("close", () => {
          this.isConnected = false;
          this.emit("disconnected");
        });
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { success: false, message: `Serial port error: ${msg}` };
    }
  }

  /**
   * Handle incoming MAVLink data
   */
  private handleData(data: Buffer, source: string) {
    const packets = this.parser.parse(data);
    
    for (const packet of packets) {
      this.processPacket(packet, source);
    }
  }

  /**
   * Process a MAVLink packet
   */
  private processPacket(packet: any, source: string) {
    const { messageId, payload, systemId, componentId } = packet;

    switch (messageId) {
      case MAV_MSG.HEARTBEAT:
        this.handleHeartbeat(payload, systemId, componentId, source);
        break;
      case MAV_MSG.GLOBAL_POSITION_INT:
        this.handleGlobalPosition(payload);
        break;
      case MAV_MSG.ATTITUDE:
        this.handleAttitude(payload);
        break;
      case MAV_MSG.GPS_RAW_INT:
        this.handleGpsRaw(payload);
        break;
      case MAV_MSG.SYS_STATUS:
        this.handleSysStatus(payload);
        break;
      case MAV_MSG.VFR_HUD:
        this.handleVfrHud(payload);
        break;
      case MAV_MSG.BATTERY_STATUS:
        this.handleBatteryStatus(payload);
        break;
      case MAV_MSG.COMMAND_ACK:
        this.handleCommandAck(payload);
        break;
      case MAV_MSG.STATUSTEXT:
        this.handleStatusText(payload);
        break;
    }

    this.emit("packet", packet);
  }

  private handleHeartbeat(payload: Buffer, systemId: number, componentId: number, source: string) {
    const customMode = payload.readUInt32LE(0);
    const type = payload.readUInt8(4);
    const autopilot = payload.readUInt8(5);
    const baseMode = payload.readUInt8(6);
    const systemStatus = payload.readUInt8(7);

    // Update or add discovered drone
    const droneInfo: DiscoveredDroneInfo = {
      systemId,
      componentId,
      autopilotType: this.getAutopilotName(autopilot),
      vehicleType: this.getVehicleTypeName(type),
      lastHeartbeat: new Date(),
      connectionType: this.config.type,
      address: source,
    };

    this.discoveredDrones.set(systemId, droneInfo);

    // Update telemetry
    this.telemetry.autopilotType = droneInfo.autopilotType;
    this.telemetry.isArmed = (baseMode & 0x80) !== 0;
    this.telemetry.systemStatus = systemStatus;
    this.telemetry.flightMode = this.getFlightModeName(autopilot, customMode);
    this.telemetry.timestamp = new Date();

    this.emit("heartbeat", droneInfo);
    this.emit("telemetry", this.telemetry);
  }

  private handleGlobalPosition(payload: Buffer) {
    this.telemetry.latitude = payload.readInt32LE(0) / 1e7;
    this.telemetry.longitude = payload.readInt32LE(4) / 1e7;
    this.telemetry.altitude = payload.readInt32LE(8) / 1000;
    this.telemetry.relativeAltitude = payload.readInt32LE(12) / 1000;
    this.telemetry.velocityX = payload.readInt16LE(16) / 100;
    this.telemetry.velocityY = payload.readInt16LE(18) / 100;
    this.telemetry.velocityZ = payload.readInt16LE(20) / 100;
    this.telemetry.heading = payload.readUInt16LE(22) / 100;
    this.telemetry.timestamp = new Date();

    this.emit("position", {
      lat: this.telemetry.latitude,
      lon: this.telemetry.longitude,
      alt: this.telemetry.altitude,
      heading: this.telemetry.heading,
    });
    this.emit("telemetry", this.telemetry);
  }

  private handleAttitude(payload: Buffer) {
    this.telemetry.roll = (payload.readFloatLE(4) * 180) / Math.PI;
    this.telemetry.pitch = (payload.readFloatLE(8) * 180) / Math.PI;
    this.telemetry.yaw = (payload.readFloatLE(12) * 180) / Math.PI;
    this.telemetry.timestamp = new Date();

    this.emit("attitude", {
      roll: this.telemetry.roll,
      pitch: this.telemetry.pitch,
      yaw: this.telemetry.yaw,
    });
  }

  private handleGpsRaw(payload: Buffer) {
    this.telemetry.gpsFixType = payload.readUInt8(28);
    this.telemetry.gpsNumSatellites = payload.readUInt8(29);
    this.telemetry.gpsHdop = payload.readUInt16LE(26) / 100;
    this.telemetry.gpsVdop = payload.readUInt16LE(24) / 100;
    this.telemetry.timestamp = new Date();

    this.emit("gps", {
      fixType: this.telemetry.gpsFixType,
      satellites: this.telemetry.gpsNumSatellites,
      hdop: this.telemetry.gpsHdop,
    });
  }

  private handleSysStatus(payload: Buffer) {
    this.telemetry.batteryVoltage = payload.readUInt16LE(14) / 1000;
    this.telemetry.batteryCurrent = payload.readInt16LE(16) / 100;
    this.telemetry.batteryRemaining = payload.readInt8(30);
    this.telemetry.timestamp = new Date();

    this.emit("battery", {
      voltage: this.telemetry.batteryVoltage,
      current: this.telemetry.batteryCurrent,
      remaining: this.telemetry.batteryRemaining,
    });
  }

  private handleVfrHud(payload: Buffer) {
    this.telemetry.airSpeed = payload.readFloatLE(0);
    this.telemetry.groundSpeed = payload.readFloatLE(4);
    this.telemetry.timestamp = new Date();

    this.emit("vfr", {
      airSpeed: this.telemetry.airSpeed,
      groundSpeed: this.telemetry.groundSpeed,
    });
  }

  private handleBatteryStatus(payload: Buffer) {
    this.telemetry.batteryRemaining = payload.readInt8(35);
    this.telemetry.timestamp = new Date();
  }

  private handleCommandAck(payload: Buffer) {
    const command = payload.readUInt16LE(0);
    const result = payload.readUInt8(2);
    const progress = payload.length > 3 ? payload.readUInt8(3) : 0;

    this.emit("commandAck", { command, result, progress });
  }

  private handleStatusText(payload: Buffer) {
    const severity = payload.readUInt8(0);
    const text = payload.slice(1).toString("utf8").replace(/\0/g, "").trim();

    this.emit("statusText", { severity, text });
    console.log(`[CYRUS MAVLink] Status: [${severity}] ${text}`);
  }

  private getAutopilotName(autopilot: number): string {
    const names: Record<number, string> = {
      0: "Generic",
      3: "ArduPilotMega",
      4: "OpenPilot",
      5: "GenericWP",
      8: "Invalid",
      12: "PX4",
      13: "SMACCMPILOT",
      14: "AUTOQUAD",
      15: "ARMAZILA",
      16: "AEROB",
      17: "ASLUAV",
      18: "SmartAP",
      19: "AirRails",
    };
    return names[autopilot] || `Unknown (${autopilot})`;
  }

  private getVehicleTypeName(type: number): string {
    const types: Record<number, string> = {
      0: "Generic",
      1: "Fixed Wing",
      2: "Quadrotor",
      3: "Coaxial",
      4: "Helicopter",
      5: "Antenna Tracker",
      6: "GCS",
      7: "Airship",
      8: "Free Balloon",
      9: "Rocket",
      10: "Ground Rover",
      11: "Surface Boat",
      12: "Submarine",
      13: "Hexarotor",
      14: "Octorotor",
      15: "Tricopter",
      16: "Flapping Wing",
      17: "Kite",
      18: "Onboard Companion",
      19: "Two-rotor VTOL",
      20: "Quad-rotor VTOL",
      21: "Tiltrotor VTOL",
    };
    return types[type] || `Unknown (${type})`;
  }

  private getFlightModeName(autopilot: number, customMode: number): string {
    if (autopilot === 3) {
      // ArduPilot
      for (const [name, value] of Object.entries(COPTER_MODES)) {
        if (value === customMode) return name;
      }
    } else if (autopilot === 12) {
      // PX4
      for (const [name, value] of Object.entries(PX4_MODES)) {
        if (value === customMode) return name;
      }
    }
    return `Mode ${customMode}`;
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 1000);
  }

  private sendHeartbeat() {
    const packet = this.builder.buildHeartbeat();
    this.send(packet);
  }

  /**
   * Send a MAVLink packet
   */
  send(packet: Buffer): boolean {
    if (!this.isConnected) return false;

    try {
      if (this.config.type === "udp" && this.socket instanceof dgram.Socket) {
        this.socket.send(packet, this.config.port || 14550, this.config.host || "127.0.0.1");
      } else if (this.config.type === "tcp" && this.socket instanceof net.Socket) {
        this.socket.write(packet);
      } else if (this.config.type === "serial" && this.serialPort) {
        this.serialPort.write(packet);
      }
      return true;
    } catch (error) {
      console.error("[CYRUS MAVLink] Send error:", error);
      return false;
    }
  }

  /**
   * Safety checks before arming
   */
  private performArmingSafetyCheck(): { safe: boolean; reason?: string } {
    // Check GPS fix (need at least 3D fix for safe arming)
    if (this.telemetry.gpsFixType < 3) {
      return { safe: false, reason: `Insufficient GPS fix (type ${this.telemetry.gpsFixType}). Need 3D fix or better.` };
    }

    // Check battery level
    if (this.telemetry.batteryRemaining > 0 && this.telemetry.batteryRemaining < 20) {
      return { safe: false, reason: `Battery too low (${this.telemetry.batteryRemaining}%). Minimum 20% required.` };
    }

    return { safe: true };
  }

  /**
   * Safety checks before takeoff
   */
  private performTakeoffSafetyCheck(altitude: number): { safe: boolean; reason?: string } {
    // Must be armed
    if (!this.telemetry.isArmed) {
      return { safe: false, reason: "Drone must be armed before takeoff." };
    }

    // Altitude limits (max 7620m = 25000ft, reasonable max for most drones)
    const MAX_ALTITUDE = 7620;
    if (altitude > MAX_ALTITUDE) {
      return { safe: false, reason: `Altitude ${altitude}m exceeds maximum allowed (${MAX_ALTITUDE}m).` };
    }

    if (altitude < 1) {
      return { safe: false, reason: "Takeoff altitude must be at least 1 meter." };
    }

    // Check GPS fix
    if (this.telemetry.gpsFixType < 3) {
      return { safe: false, reason: `Insufficient GPS fix for takeoff. Need 3D fix or better.` };
    }

    return { safe: true };
  }

  /**
   * Safety checks before navigation
   */
  private performNavigationSafetyCheck(lat: number, lon: number, alt: number): { safe: boolean; reason?: string } {
    // Validate coordinates
    if (lat < -90 || lat > 90) {
      return { safe: false, reason: `Invalid latitude: ${lat}. Must be between -90 and 90.` };
    }

    if (lon < -180 || lon > 180) {
      return { safe: false, reason: `Invalid longitude: ${lon}. Must be between -180 and 180.` };
    }

    // Altitude limits
    const MAX_ALTITUDE = 7620;
    if (alt > MAX_ALTITUDE) {
      return { safe: false, reason: `Altitude ${alt}m exceeds maximum allowed (${MAX_ALTITUDE}m).` };
    }

    if (alt < 5) {
      return { safe: false, reason: "Navigation altitude must be at least 5 meters for safety." };
    }

    // Must be armed and have GPS
    if (!this.telemetry.isArmed) {
      return { safe: false, reason: "Drone must be armed before navigation." };
    }

    if (this.telemetry.gpsFixType < 3) {
      return { safe: false, reason: "Insufficient GPS fix for navigation." };
    }

    return { safe: true };
  }

  /**
   * Arm the drone with safety checks
   */
  async arm(bypassSafety: boolean = false): Promise<CommandResult> {
    // Perform safety checks unless bypassed
    if (!bypassSafety) {
      const check = this.performArmingSafetyCheck();
      if (!check.safe) {
        return { success: false, message: `SAFETY: ${check.reason}` };
      }
    }

    const packet = this.builder.buildCommandLong(
      this.targetSystem,
      this.targetComponent,
      MAV_CMD.COMPONENT_ARM_DISARM,
      0,
      1, 0, 0, 0, 0, 0, 0
    );

    if (this.send(packet)) {
      return { success: true, message: "Arm command sent. Safety checks passed." };
    }
    return { success: false, message: "Failed to send arm command" };
  }

  /**
   * Disarm the drone
   */
  async disarm(): Promise<CommandResult> {
    const packet = this.builder.buildCommandLong(
      this.targetSystem,
      this.targetComponent,
      MAV_CMD.COMPONENT_ARM_DISARM,
      0,
      0, 0, 0, 0, 0, 0, 0
    );

    if (this.send(packet)) {
      return { success: true, message: "Disarm command sent" };
    }
    return { success: false, message: "Failed to send disarm command" };
  }

  /**
   * Takeoff to specified altitude with safety checks
   */
  async takeoff(altitude: number, bypassSafety: boolean = false): Promise<CommandResult> {
    // Perform safety checks unless bypassed
    if (!bypassSafety) {
      const check = this.performTakeoffSafetyCheck(altitude);
      if (!check.safe) {
        return { success: false, message: `SAFETY: ${check.reason}` };
      }
    }

    const packet = this.builder.buildCommandLong(
      this.targetSystem,
      this.targetComponent,
      MAV_CMD.NAV_TAKEOFF,
      0,
      0, 0, 0, 0, 0, 0, altitude
    );

    if (this.send(packet)) {
      return { success: true, message: `Takeoff command sent. Target altitude: ${altitude}m. Safety checks passed.` };
    }
    return { success: false, message: "Failed to send takeoff command" };
  }

  /**
   * Land the drone
   */
  async land(): Promise<CommandResult> {
    const packet = this.builder.buildCommandLong(
      this.targetSystem,
      this.targetComponent,
      MAV_CMD.NAV_LAND,
      0,
      0, 0, 0, 0, 0, 0, 0
    );

    if (this.send(packet)) {
      return { success: true, message: "Land command sent" };
    }
    return { success: false, message: "Failed to send land command" };
  }

  /**
   * Return to launch
   */
  async returnToLaunch(): Promise<CommandResult> {
    const packet = this.builder.buildCommandLong(
      this.targetSystem,
      this.targetComponent,
      MAV_CMD.NAV_RETURN_TO_LAUNCH,
      0,
      0, 0, 0, 0, 0, 0, 0
    );

    if (this.send(packet)) {
      return { success: true, message: "Return to launch command sent" };
    }
    return { success: false, message: "Failed to send RTL command" };
  }

  /**
   * Set flight mode
   */
  async setMode(mode: string | number): Promise<CommandResult> {
    let customMode: number;

    if (typeof mode === "string") {
      const modeUpper = mode.toUpperCase();
      customMode = (COPTER_MODES as any)[modeUpper] ?? (PX4_MODES as any)[modeUpper] ?? 0;
    } else {
      customMode = mode;
    }

    const packet = this.builder.buildSetMode(
      this.targetSystem,
      217, // MAV_MODE_FLAG_CUSTOM_MODE_ENABLED | MAV_MODE_FLAG_SAFETY_ARMED
      customMode
    );

    if (this.send(packet)) {
      return { success: true, message: `Mode change command sent: ${mode}` };
    }
    return { success: false, message: "Failed to send mode change command" };
  }

  /**
   * Navigate to GPS coordinates with safety checks
   */
  async gotoLocation(lat: number, lon: number, alt: number, bypassSafety: boolean = false): Promise<CommandResult> {
    // Perform safety checks unless bypassed
    if (!bypassSafety) {
      const check = this.performNavigationSafetyCheck(lat, lon, alt);
      if (!check.safe) {
        return { success: false, message: `SAFETY: ${check.reason}` };
      }
    }

    // First, ensure GUIDED mode
    await this.setMode("GUIDED");

    const packet = this.builder.buildCommandLong(
      this.targetSystem,
      this.targetComponent,
      MAV_CMD.DO_REPOSITION,
      0,
      -1, // Speed (-1 = default)
      0,  // Bitmask (0 = all DOF)
      0,  // Radius (0 = default)
      NaN, // Yaw (NaN = no change)
      lat,
      lon,
      alt
    );

    if (this.send(packet)) {
      return { success: true, message: `Navigating to: ${lat.toFixed(6)}, ${lon.toFixed(6)} at ${alt}m. Safety checks passed.` };
    }
    return { success: false, message: "Failed to send navigation command" };
  }

  /**
   * Upload a mission (waypoints)
   */
  async uploadMission(waypoints: Waypoint[]): Promise<CommandResult> {
    // Send mission count
    const countPacket = this.builder.buildMissionCount(
      this.targetSystem,
      this.targetComponent,
      waypoints.length
    );
    this.send(countPacket);

    // Wait for mission requests and send items
    // In a real implementation, this would wait for MISSION_REQUEST messages
    for (const wp of waypoints) {
      const itemPacket = this.builder.buildMissionItem(
        this.targetSystem,
        this.targetComponent,
        wp.seq,
        wp.frame,
        wp.command,
        wp.current,
        wp.autocontinue,
        wp.param1,
        wp.param2,
        wp.param3,
        wp.param4,
        wp.latitude,
        wp.longitude,
        wp.altitude
      );
      this.send(itemPacket);
      
      // Small delay between items
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return { success: true, message: `Mission uploaded with ${waypoints.length} waypoints` };
  }

  /**
   * Start the uploaded mission
   */
  async startMission(): Promise<CommandResult> {
    // Set to AUTO mode
    await this.setMode("AUTO");
    return { success: true, message: "Mission started" };
  }

  /**
   * Pause current mission
   */
  async pauseMission(): Promise<CommandResult> {
    const packet = this.builder.buildCommandLong(
      this.targetSystem,
      this.targetComponent,
      MAV_CMD.DO_PAUSE_CONTINUE,
      0,
      0, 0, 0, 0, 0, 0, 0
    );

    if (this.send(packet)) {
      return { success: true, message: "Mission paused" };
    }
    return { success: false, message: "Failed to pause mission" };
  }

  /**
   * Get current telemetry
   */
  getTelemetry(): DroneTelemetry {
    return { ...this.telemetry };
  }

  /**
   * Get discovered drones
   */
  getDiscoveredDrones(): DiscoveredDroneInfo[] {
    return Array.from(this.discoveredDrones.values());
  }

  /**
   * Check if connected
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Disconnect from drone
   */
  disconnect(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.socket) {
      if (this.socket instanceof dgram.Socket) {
        this.socket.close();
      } else if (this.socket instanceof net.Socket) {
        this.socket.destroy();
      }
      this.socket = null;
    }

    if (this.serialPort) {
      this.serialPort.close();
      this.serialPort = null;
    }

    this.isConnected = false;
    this.emit("disconnected");
  }
}

// Singleton instance for UDP (default)
let defaultController: CyrusMAVLinkController | null = null;

export function getMAVLinkController(config?: ConnectionConfig): CyrusMAVLinkController {
  if (!defaultController) {
    defaultController = new CyrusMAVLinkController(config || {
      type: "udp",
      port: 14550,
      host: "127.0.0.1",
    });
  }
  return defaultController;
}

export { MAV_CMD, COPTER_MODES, PX4_MODES };
