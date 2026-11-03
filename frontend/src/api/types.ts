/** Shapes returned by the common REST API (shared by web and mobile clients). */

export type Permission = string;

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  title: string | null;
  role: { key: string; name: string; scope: 'school' | 'class' | 'family' | 'self'; homeRoute: string };
  campusId: string | null;
  permissions: Permission[];
  employeeId: string | null;
  parentId: string | null;
  studentId: string | null;
  campus_code?: string;
  campus_name?: string;
  academic_year?: string;
}

export interface Campus {
  id: string;
  code: string;
  name: string;
  shortName: string;
  place: string;
  curriculum?: string;
  latitude?: number;
  longitude?: number;
}

export interface Lookups {
  campuses: Campus[];
  academicYears: { id: string; label: string; startsOn: string; endsOn: string; isCurrent: boolean; isLocked: boolean }[];
  classes: { id: string; name: string; gradeLevel: number; stage: string; board?: string; campusId: string; sections: { id: string; name: string; room: string }[] }[];
  subjects: { id: string; code: string; name: string; stage: string }[];
  houses: string[];
  routes?: { id: string; code: string; name: string; area: string; campusId: string; stops: { id: string; name: string }[] }[];
  staff?: { id: string; fullName: string; designation: string; employeeType: string; department: string }[];
  roles?: { id: string; key: string; name: string; description: string; scope: string }[];
}

export interface StudentRow {
  id: string;
  admissionNo: string;
  fullName: string;
  firstName: string;
  lastName: string;
  gender: 'M' | 'F' | 'O';
  house: string | null;
  photoUrl: string | null;
  status: string;
  risk: string;
  dateOfBirth: string;
  classId: string | null;
  grade: string | null;
  gradeLevel: number | null;
  sectionId: string | null;
  section: string | null;
  campusId: string;
  campusCode: string;
  campusName: string;
  attendance: number | null;
  average: number | null;
  trend: number;
  signalCode: string | null;
  interventionStage: number | null;
  owner: string | null;
  parentName: string | null;
  parentPhone: string | null;
  busRoute: string | null;
  feeStatus: string;
  today: string;
  trackingStatus: string | null;
}

export type LocationStatus = 'at_home' | 'in_transit' | 'at_school' | 'on_trip' | 'unknown';

export interface CurrentLocation {
  studentId: string;
  admissionNo: string;
  fullName: string;
  photoUrl: string | null;
  grade: string | null;
  section: string | null;
  campusName: string;
  campusCode: string;
  campusLatitude: number;
  campusLongitude: number;
  trackingEnabled: boolean;
  trackingStatus: 'active' | 'paused' | 'offline' | 'disabled';
  deviceType: string | null;
  isSampleData: boolean;
  locationId: number | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  locationStatus: LocationStatus | null;
  locationStatusLabel: string;
  placeLabel: string | null;
  source: string | null;
  batteryPct: number | null;
  recordedAt: string | null;
  isStale: boolean;
  displayStatus: 'Tracking Active' | 'Tracking Paused' | 'Tracking Disabled' | 'Offline' | 'No Location Yet';
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  deviceId: string | null;
  deviceCode: string | null;
  deviceLastSeenAt: string | null;
  assignmentId: string | null;
  gpsStatus: GpsStatus;
}

/** Device connectivity: online < 2 min, stale < 10 min, offline after (configurable on the server). */
export type GpsStatus = 'online' | 'stale' | 'offline' | 'never';
export type DeviceType = 'gps_tracker' | 'id_card_tag' | 'wearable' | 'mobile_app';
export type DeviceStatus = 'available' | 'assigned' | 'inactive' | 'maintenance' | 'lost';

export interface GpsDevice {
  id: string;
  deviceCode: string;
  imei: string | null;
  serialNumber: string | null;
  deviceType: DeviceType;
  firmwareVersion: string | null;
  campusId: string | null;
  campusName: string | null;
  status: DeviceStatus;
  lastSeenAt: string | null;
  batteryPct: number | null;
  notes: string | null;
  hasToken: boolean;
  tokenIssuedAt: string | null;
  isSampleData: boolean;
  createdAt: string;
  gpsStatus: GpsStatus;
  assignmentId: string | null;
  assignedAt: string | null;
  studentId: string | null;
  admissionNo: string | null;
  studentName: string | null;
  grade: string | null;
  section: string | null;
}

export interface DeviceAssignment {
  id: string;
  status: 'active' | 'inactive';
  assignedAt: string;
  unassignedAt: string | null;
  unassignReason: string | null;
  notes: string | null;
  studentId: string;
  admissionNo: string;
  studentName: string;
  grade?: string | null;
  section?: string | null;
  deviceId?: string;
  deviceCode?: string;
  deviceType?: DeviceType;
  deviceStatus?: DeviceStatus;
  lastSeenAt?: string | null;
  gpsStatus?: GpsStatus;
  assignedBy: string | null;
  unassignedBy: string | null;
  locationCount?: number;
}

export interface GpsDeviceDetail extends GpsDevice {
  assignments: DeviceAssignment[];
}

export interface DeviceSummary {
  total: number;
  assigned: number;
  available: number;
  outOfService: number;
  maintenance: number;
  lost: number;
  online: number;
  stale: number;
  offline: number;
  lowBattery: number;
  thresholds: { onlineSeconds: number; offlineSeconds: number };
  intervalSeconds: number;
}

export interface LocationPoint {
  id: number;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  locationStatus: LocationStatus;
  locationStatusLabel: string;
  placeLabel: string | null;
  source: string;
  batteryPct: number | null;
  recordedAt: string;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  deviceCode: string | null;
}

export interface LocationHistory {
  points: LocationPoint[];
  availableDays: { date: string; points: number }[];
  summary: { count: number; first: string | null; last: string | null; distanceKm: number };
}

export interface MapMarker {
  studentId: string;
  admissionNo: string;
  fullName: string;
  grade: string | null;
  section: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  locationStatus: LocationStatus;
  locationStatusLabel: string;
  displayStatus: string;
  recordedAt: string;
  isStale: boolean;
  placeLabel: string | null;
  batteryPct: number | null;
  speed: number | null;
  deviceCode: string | null;
  gpsStatus: GpsStatus;
}

export interface TrackingMapData {
  markers: MapMarker[];
  campuses: { id: string; code: string; name: string; shortName: string; latitude: number; longitude: number; radiusM: number | null }[];
  summary: { total: number; active: number; offline: number; paused: number; disabled: number; atSchool: number; inTransit: number; atHome: number };
  staleAfterMinutes: number;
  gpsThresholds: { onlineSeconds: number; offlineSeconds: number };
  generatedAt: string;
}

export interface NotificationItem {
  id: string;
  category: 'Critical' | 'Attention' | 'Information' | 'Completed';
  tone: string;
  icon: string;
  topic: string;
  title: string;
  body: string | null;
  route: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface TaskItem {
  id: string;
  code: string;
  title: string;
  module: string;
  dueOn: string | null;
  priority: 'High' | 'Medium' | 'Low';
  status: string;
  route: string | null;
  overdue: boolean;
}
