export interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: "Male" | "Female";
  phone: string;
  lastVisit: string;
  status: "Active" | "Admitted" | "Discharged";
}

export const PATIENTS: Patient[] = [
  { id: "p1", mrn: "MRN-00412", name: "Joseph Kamau", age: 46, gender: "Male", phone: "+254 712 345 678", lastVisit: "2026-08-01", status: "Active" },
  { id: "p2", mrn: "MRN-00398", name: "Mary Atieno", age: 33, gender: "Female", phone: "+254 733 221 004", lastVisit: "2026-08-02", status: "Admitted" },
  { id: "p3", mrn: "MRN-00377", name: "David Mutua", age: 61, gender: "Male", phone: "+254 701 887 340", lastVisit: "2026-07-29", status: "Active" },
  { id: "p4", mrn: "MRN-00355", name: "Esther Chebet", age: 27, gender: "Female", phone: "+254 728 993 015", lastVisit: "2026-07-28", status: "Discharged" },
  { id: "p5", mrn: "MRN-00341", name: "Ali Hassan", age: 54, gender: "Male", phone: "+254 745 110 267", lastVisit: "2026-07-25", status: "Active" },
  { id: "p6", mrn: "MRN-00329", name: "Lucy Wambui", age: 39, gender: "Female", phone: "+254 719 456 802", lastVisit: "2026-08-03", status: "Admitted" },
];

export interface Appointment {
  id: string;
  patient: string;
  doctor: string;
  department: string;
  time: string;
  date: string;
  type: "Consultation" | "Follow-up" | "Procedure" | "Telehealth";
  status: "Scheduled" | "Checked In" | "Completed" | "Cancelled";
}

export const APPOINTMENTS: Appointment[] = [
  { id: "a1", patient: "Joseph Kamau", doctor: "Dr. Amina Okello", department: "General Medicine", time: "09:00", date: "2026-08-03", type: "Consultation", status: "Checked In" },
  { id: "a2", patient: "Lucy Wambui", doctor: "Dr. Amina Okello", department: "General Medicine", time: "09:30", date: "2026-08-03", type: "Follow-up", status: "Scheduled" },
  { id: "a3", patient: "Mary Atieno", doctor: "Dr. Mercy Achieng", department: "Radiology", time: "10:15", date: "2026-08-03", type: "Procedure", status: "Scheduled" },
  { id: "a4", patient: "David Mutua", doctor: "Dr. Amina Okello", department: "Cardiology", time: "11:00", date: "2026-08-03", type: "Consultation", status: "Scheduled" },
  { id: "a5", patient: "Esther Chebet", doctor: "Dr. Amina Okello", department: "General Medicine", time: "14:00", date: "2026-08-03", type: "Telehealth", status: "Scheduled" },
  { id: "a6", patient: "Ali Hassan", doctor: "Dr. Mercy Achieng", department: "Radiology", time: "15:30", date: "2026-08-04", type: "Procedure", status: "Scheduled" },
];

export const VISITS_TREND = [
  { day: "Mon", outpatient: 42, inpatient: 11 },
  { day: "Tue", outpatient: 51, inpatient: 13 },
  { day: "Wed", outpatient: 47, inpatient: 9 },
  { day: "Thu", outpatient: 58, inpatient: 15 },
  { day: "Fri", outpatient: 63, inpatient: 12 },
  { day: "Sat", outpatient: 35, inpatient: 8 },
  { day: "Sun", outpatient: 22, inpatient: 6 },
];

export const REVENUE_TREND = [
  { month: "Mar", revenue: 128000, expenses: 84000 },
  { month: "Apr", revenue: 145000, expenses: 91000 },
  { month: "May", revenue: 139000, expenses: 88000 },
  { month: "Jun", revenue: 162000, expenses: 95000 },
  { month: "Jul", revenue: 171000, expenses: 99000 },
  { month: "Aug", revenue: 176500, expenses: 97500 },
];

export interface Ward {
  id: string;
  name: string;
  totalBeds: number;
  occupied: number;
}

export const WARDS: Ward[] = [
  { id: "w1", name: "Ward A — General", totalBeds: 24, occupied: 19 },
  { id: "w2", name: "Ward B — Maternity", totalBeds: 16, occupied: 11 },
  { id: "w3", name: "Ward C — Pediatrics", totalBeds: 20, occupied: 14 },
  { id: "w4", name: "ICU", totalBeds: 8, occupied: 6 },
];

export interface Medication {
  id: string;
  name: string;
  category: string;
  stock: number;
  reorderLevel: number;
  expiry: string;
}

export const MEDICATIONS: Medication[] = [
  { id: "m1", name: "Amoxicillin 500mg", category: "Antibiotic", stock: 420, reorderLevel: 100, expiry: "2027-02-15" },
  { id: "m2", name: "Paracetamol 500mg", category: "Analgesic", stock: 85, reorderLevel: 200, expiry: "2026-11-30" },
  { id: "m3", name: "Metformin 850mg", category: "Antidiabetic", stock: 310, reorderLevel: 120, expiry: "2027-06-01" },
  { id: "m4", name: "Amlodipine 5mg", category: "Antihypertensive", stock: 45, reorderLevel: 80, expiry: "2026-10-12" },
  { id: "m5", name: "Omeprazole 20mg", category: "Antacid", stock: 260, reorderLevel: 100, expiry: "2027-01-20" },
];

export interface LabRequest {
  id: string;
  patient: string;
  test: string;
  requestedBy: string;
  priority: "Routine" | "Urgent" | "STAT";
  status: "Pending" | "Sample Collected" | "In Progress" | "Completed";
}

export const LAB_REQUESTS: LabRequest[] = [
  { id: "l1", patient: "Mary Atieno", test: "Complete Blood Count", requestedBy: "Dr. Amina Okello", priority: "Urgent", status: "In Progress" },
  { id: "l2", patient: "Joseph Kamau", test: "Lipid Profile", requestedBy: "Dr. Amina Okello", priority: "Routine", status: "Pending" },
  { id: "l3", patient: "David Mutua", test: "HbA1c", requestedBy: "Dr. Amina Okello", priority: "Routine", status: "Sample Collected" },
  { id: "l4", patient: "Lucy Wambui", test: "Malaria RDT", requestedBy: "Dr. Amina Okello", priority: "STAT", status: "Completed" },
];

export interface ScanRequest {
  id: string;
  patient: string;
  scan: string;
  requestedBy: string;
  scheduled: string;
  status: "Scheduled" | "In Progress" | "Report Pending" | "Completed";
}

export const SCAN_REQUESTS: ScanRequest[] = [
  { id: "r1", patient: "Mary Atieno", scan: "Chest X-Ray", requestedBy: "Dr. Amina Okello", scheduled: "2026-08-03 10:15", status: "Scheduled" },
  { id: "r2", patient: "Ali Hassan", scan: "Abdominal Ultrasound", requestedBy: "Dr. Amina Okello", scheduled: "2026-08-04 15:30", status: "Scheduled" },
  { id: "r3", patient: "David Mutua", scan: "Echocardiogram", requestedBy: "Dr. Amina Okello", scheduled: "2026-08-02 11:00", status: "Report Pending" },
];

export interface Invoice {
  id: string;
  number: string;
  patient: string;
  amount: number;
  issued: string;
  due: string;
  status: "Paid" | "Pending" | "Overdue" | "Partial";
}

export const INVOICES: Invoice[] = [
  { id: "i1", number: "INV-2026-0841", patient: "Joseph Kamau", amount: 12500, issued: "2026-08-01", due: "2026-08-15", status: "Pending" },
  { id: "i2", number: "INV-2026-0838", patient: "Esther Chebet", amount: 48200, issued: "2026-07-28", due: "2026-08-11", status: "Paid" },
  { id: "i3", number: "INV-2026-0832", patient: "Ali Hassan", amount: 9700, issued: "2026-07-25", due: "2026-08-08", status: "Partial" },
  { id: "i4", number: "INV-2026-0819", patient: "David Mutua", amount: 31400, issued: "2026-07-15", due: "2026-07-29", status: "Overdue" },
];

export interface StaffMember {
  id: string;
  name: string;
  employeeId: string;
  role: string;
  department: string;
  status: "Active" | "On Leave";
}

export const STAFF: StaffMember[] = [
  { id: "s1", name: "Dr. Amina Okello", employeeId: "EMP-014", role: "Doctor", department: "General Medicine", status: "Active" },
  { id: "s2", name: "Grace Wanjiru", employeeId: "EMP-027", role: "Nurse", department: "Ward A", status: "Active" },
  { id: "s3", name: "Faith Njeri", employeeId: "EMP-031", role: "Pharmacist", department: "Pharmacy", status: "Active" },
  { id: "s4", name: "Samuel Kiptoo", employeeId: "EMP-044", role: "Lab Technician", department: "Laboratory", status: "On Leave" },
  { id: "s5", name: "Dr. Mercy Achieng", employeeId: "EMP-052", role: "Radiologist", department: "Radiology", status: "Active" },
  { id: "s6", name: "Peter Mwangi", employeeId: "EMP-060", role: "Accountant", department: "Finance", status: "Active" },
  { id: "s7", name: "Brian Otieno", employeeId: "EMP-068", role: "Receptionist", department: "Front Office", status: "Active" },
];

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  hours: string;
  available: boolean;
  phone: string;
  email: string;
}

export const DOCTORS: Doctor[] = [
  { id: "d1", name: "Dr. Amina Okello", specialty: "General Medicine", hours: "Mon – Fri (08:00 – 17:00)", available: true, phone: "+254 712 000 101", email: "a.okello@nyalife.health" },
  { id: "d2", name: "Dr. Kevin Ndegwa", specialty: "Cardiology", hours: "Mon – Fri (08:00 – 14:00)", available: true, phone: "+254 712 000 102", email: "k.ndegwa@nyalife.health" },
  { id: "d3", name: "Dr. Sophia Muthoni", specialty: "Pediatrics", hours: "Mon – Fri (10:00 – 18:00)", available: false, phone: "+254 712 000 103", email: "s.muthoni@nyalife.health" },
  { id: "d4", name: "Dr. Daniel Omondi", specialty: "Orthopedics", hours: "Mon – Thu (08:00 – 12:00)", available: true, phone: "+254 712 000 104", email: "d.omondi@nyalife.health" },
  { id: "d5", name: "Dr. Wanja Kariuki", specialty: "Dermatology", hours: "Tue – Sat (13:00 – 20:00)", available: true, phone: "+254 712 000 105", email: "w.kariuki@nyalife.health" },
  { id: "d6", name: "Dr. Laila Hassan", specialty: "Neurology", hours: "Mon – Fri (09:00 – 15:00)", available: true, phone: "+254 712 000 106", email: "l.hassan@nyalife.health" },
  { id: "d7", name: "Dr. Mercy Achieng", specialty: "Radiology", hours: "Mon – Sun (07:00 – 13:00)", available: true, phone: "+254 712 000 107", email: "m.achieng@nyalife.health" },
  { id: "d8", name: "Dr. Arjun Mehta", specialty: "Pulmonology", hours: "Mon – Fri (08:00 – 16:00)", available: false, phone: "+254 712 000 108", email: "a.mehta@nyalife.health" },
];

export const SPECIALTIES = [
  "All",
  "General Medicine",
  "Cardiology",
  "Pediatrics",
  "Orthopedics",
  "Dermatology",
  "Neurology",
  "Radiology",
  "Pulmonology",
];

export interface Department {
  id: string;
  name: string;
  location: string;
  staff: number;
  description: string;
  doctors: number;
  nurses: number;
  specialists: number;
  support: number;
}

export const DEPARTMENTS: Department[] = [
  { id: "dep1", name: "General Medicine", location: "Main Building – 2nd Floor", staff: 24, doctors: 8, nurses: 10, specialists: 4, support: 2, description: "Handles routine check-ups, acute illnesses, and chronic disease management with integrated access to diagnostics and referrals." },
  { id: "dep2", name: "Pediatrics", location: "Children's Wing – 3rd Floor", staff: 20, doctors: 6, nurses: 9, specialists: 3, support: 2, description: "Dedicated to infants, children, and adolescents with child-friendly rooms and family-focused care." },
  { id: "dep3", name: "Cardiology", location: "Heart Center – 4th Floor", staff: 22, doctors: 7, nurses: 8, specialists: 5, support: 2, description: "Specializes in heart disease prevention, diagnosis, and intervention with access to advanced monitoring and imaging." },
  { id: "dep4", name: "Orthopedics", location: "Surgical Block – 3rd Floor", staff: 22, doctors: 6, nurses: 10, specialists: 4, support: 2, description: "Focuses on bone, joint, and muscle conditions, including trauma cases and post-operative rehabilitation." },
  { id: "dep5", name: "Dermatology", location: "Outpatient Clinic – 2nd Floor", staff: 16, doctors: 5, nurses: 7, specialists: 2, support: 2, description: "Provides medical and cosmetic skin treatments for acne, allergies, chronic rashes, and aesthetic procedures." },
  { id: "dep6", name: "Neurology", location: "Neuro Center – 5th Floor", staff: 19, doctors: 6, nurses: 8, specialists: 3, support: 2, description: "Manages brain, nerve, and spinal disorders with coordinated diagnostic tests and long-term follow-up plans." },
  { id: "dep7", name: "Radiology", location: "Diagnostic Wing – 1st Floor", staff: 18, doctors: 5, nurses: 6, specialists: 5, support: 2, description: "Supports all departments with X-ray, CT, MRI, and ultrasound imaging, integrated directly into patient records." },
  { id: "dep8", name: "Maternity Care", location: "Maternity Tower – 4th & 5th Floor", staff: 25, doctors: 7, nurses: 12, specialists: 4, support: 2, description: "Covers prenatal care, delivery, and newborn services with specialized neonatal support and family-centered rooms." },
];

export const AGE_STAGES = [
  { day: "Mon", children: 38, teens: 45, adults: 17 },
  { day: "Tue", children: 30, teens: 41, adults: 22 },
  { day: "Wed", children: 38, teens: 56, adults: 17 },
  { day: "Thu", children: 25, teens: 47, adults: 30 },
  { day: "Fri", children: 33, teens: 51, adults: 26 },
  { day: "Sat", children: 40, teens: 44, adults: 20 },
  { day: "Sun", children: 28, teens: 46, adults: 18 },
];

export const DEPT_DISTRIBUTION = [
  { name: "General Medicine", value: 2140, color: "#2d545b" },
  { name: "Pediatrics", value: 1620, color: "#4a929b" },
  { name: "Cardiology", value: 1380, color: "#67a9af" },
  { name: "Orthopedics", value: 1050, color: "#92c5c9" },
  { name: "Dermatology", value: 1120, color: "#bcdcde" },
  { name: "Neurology", value: 1030, color: "#dcedee" },
];

export const REVENUE_LINE = [
  { month: "Jan", income: 820, expense: 610 },
  { month: "Feb", income: 940, expense: 640 },
  { month: "Mar", income: 880, expense: 700 },
  { month: "Apr", income: 1050, expense: 720 },
  { month: "May", income: 990, expense: 680 },
  { month: "Jun", income: 1620, expense: 872 },
  { month: "Jul", income: 1280, expense: 790 },
  { month: "Aug", income: 1440, expense: 810 },
  { month: "Sep", income: 1330, expense: 760 },
  { month: "Oct", income: 1510, expense: 830 },
  { month: "Nov", income: 1460, expense: 800 },
  { month: "Dec", income: 1690, expense: 900 },
];

export const REPORTS = [
  { id: "rep1", title: "Medication stock running low in Pharmacy", source: "MED-2026-112", time: "4m ago" },
  { id: "rep2", title: "System lag on Outpatient Registration", source: "Eliana Marks (Front Desk)", time: "10m ago" },
  { id: "rep3", title: "Air conditioning error in ICU ward", source: "Eduardo Juarez (Maintenance)", time: "Yesterday" },
  { id: "rep4", title: "Broken wheelchair near Emergency entrance", source: "Andrew Feign (Hospital Staff)", time: "Yesterday" },
];

export const AGENDA = [
  { id: "ag1", date: "17", weekday: "Mon", tag: "Meeting", title: "Monthly Staff Meeting & Hospital Update", time: "09:00 – 10:30" },
  { id: "ag2", date: "20", weekday: "Thu", tag: "Training", title: "Industry Networking Night", time: "14:00 – 16:00" },
  { id: "ag3", date: "28", weekday: "Fri", tag: "Review", title: "Policy Review & Compliance Documents", time: "11:00 – 12:00" },
];

export const RECENT_ACTIVITY = [
  { id: "ac1", title: "New patient profile created", meta: "MRN-00412", time: "2m ago" },
  { id: "ac2", title: "Appointment rescheduled", meta: "APT-2026-089 (Cardiology)", time: "12m ago" },
  { id: "ac3", title: "Discharge summary updated", meta: "ADM-2026-034", time: "45m ago" },
  { id: "ac4", title: "New doctor added", meta: "Dr. Kevin Ndegwa (Cardiology)", time: "2h ago" },
  { id: "ac5", title: "Billing invoice generated", meta: "INV-2026-0841", time: "3h ago" },
  { id: "ac6", title: "Lab results published", meta: "Malaria RDT – Lucy Wambui", time: "4h ago" },
];

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unit: string;
  pct: number;
  expiry: string;
  expiryNote?: string;
  status: "Available" | "Low" | "Out of Stock";
}

export const INVENTORY_ITEMS: InventoryItem[] = [
  { id: "in1", name: "Surgical Gloves Nitrile Medium", sku: "GLV-NT-M", category: "Consumables", quantity: 320, unit: "Boxes", pct: 80, expiry: "30 Dec 2027", status: "Available" },
  { id: "in2", name: "Normal Saline 0.9% 500ml", sku: "IVF-NS-500", category: "IV & Fluids", quantity: 180, unit: "Bottles", pct: 70, expiry: "15 Nov 2027", status: "Available" },
  { id: "in3", name: "Paracetamol 500mg Tablets", sku: "MED-PARA-500", category: "Medications", quantity: 24, unit: "Boxes", pct: 20, expiry: "20 Aug 2026", expiryNote: "Near Expiry", status: "Low" },
  { id: "in4", name: "Ceftriaxone 1g Injection", sku: "MED-CEF-1G", category: "Medications", quantity: 95, unit: "Vials", pct: 60, expiry: "05 Jul 2027", status: "Available" },
  { id: "in5", name: "Rapid Malaria Antigen Test Kit", sku: "LAB-RAP-AG", category: "Laboratory Supplies", quantity: 0, unit: "Packs", pct: 0, expiry: "01 Jun 2026", expiryNote: "Expired", status: "Out of Stock" },
  { id: "in6", name: "Amlodipine 5mg Tablets", sku: "MED-AMLO-5", category: "Medications", quantity: 45, unit: "Boxes", pct: 30, expiry: "12 Oct 2026", status: "Low" },
];

export const INVENTORY_USAGE = [
  { day: "Mon", value: 32 },
  { day: "Tue", value: 41 },
  { day: "Wed", value: 38 },
  { day: "Thu", value: 47 },
  { day: "Fri", value: 74 },
  { day: "Sat", value: 52 },
  { day: "Sun", value: 44 },
];

export const INVENTORY_CATEGORIES = [
  { name: "Medications", pct: 40, count: 512, color: "#2d545b" },
  { name: "Consumables", pct: 30, count: 384, color: "#4a929b" },
  { name: "IV & Fluids", pct: 12, count: 154, color: "#92c5c9" },
  { name: "Laboratory Supplies", pct: 10, count: 128, color: "#bcdcde" },
  { name: "Equipment & Accessories", pct: 8, count: 102, color: "#dcedee" },
];

export const INVENTORY_ACTIVITY = [
  { id: "ia1", title: "Stock added", meta: "50 boxes Surgical Gloves (Medium) to Central Store", time: "5m ago" },
  { id: "ia2", title: "Stock issued", meta: "20 bottles Normal Saline 0.9% for Emergency Dept", time: "37m ago" },
  { id: "ia3", title: "Transfer", meta: "10 vials Insulin to ICU from Pharmacy", time: "2h ago" },
  { id: "ia4", title: "Wastage", meta: "6 packs expired Rapid Test Kits disposed", time: "4h ago" },
  { id: "ia5", title: "Damaged items report", meta: "2 units Portable BP Monitor (screen cracked)", time: "Yesterday" },
];

export interface InsuranceProvider {
  id: string;
  name: string;
  /**
   * Which integration channel handles this insurer:
   * SHA — government scheme API; SLADE — Smart/Slade360 switch (covers many
   * private insurers through one integration); MANUAL — no portal, billing
   * staff confirm cover by email/portal.
   */
  integration: "SHA" | "SLADE" | "MANUAL";
}

export const INSURANCE_PROVIDERS: InsuranceProvider[] = [
  { id: "ins1", name: "SHA (Social Health Authority)", integration: "SHA" },
  { id: "ins2", name: "Jubilee Health", integration: "SLADE" },
  { id: "ins3", name: "AAR Insurance", integration: "SLADE" },
  { id: "ins4", name: "Britam Health", integration: "MANUAL" },
  { id: "ins5", name: "Madison Insurance", integration: "MANUAL" },
];

export const LAB_TEST_CATALOG = [
  { name: "Complete Blood Count", unit: "cells/µL", range: "4,500 – 11,000" },
  { name: "Blood Glucose (Fasting)", unit: "mmol/L", range: "3.9 – 5.6" },
  { name: "Lipid Profile (Total Cholesterol)", unit: "mmol/L", range: "< 5.2" },
  { name: "HbA1c", unit: "%", range: "4.0 – 5.6" },
  { name: "Malaria RDT", unit: "", range: "Negative" },
  { name: "Urinalysis", unit: "", range: "Normal" },
];

export interface Conversation {
  id: string;
  with: string;
  preview: string;
  time: string;
  unread: number;
}

export const CONVERSATIONS: Conversation[] = [
  { id: "c1", with: "Dr. Amina Okello", preview: "Please review the CBC results for Mary Atieno.", time: "09:42", unread: 2 },
  { id: "c2", with: "Ward A Nurses", preview: "Bed 12 transfer completed, notes updated.", time: "08:55", unread: 0 },
  { id: "c3", with: "Pharmacy Desk", preview: "Amlodipine 5mg is below reorder level.", time: "Yesterday", unread: 1 },
  { id: "c4", with: "Front Office", preview: "Two walk-ins added to Dr. Okello's queue.", time: "Yesterday", unread: 0 },
];
